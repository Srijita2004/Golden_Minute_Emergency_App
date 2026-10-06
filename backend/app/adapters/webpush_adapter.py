import os
import json
import base64
from typing import Dict, Any, Optional
from app.core.config import settings

class WebPushService:
    def __init__(self):
        self.claim_email = getattr(settings, "VAPID_CLAIM_EMAIL", "emergency-response@goldenminute.org")
        self.public_key_b64 = ""
        self.private_key_pem = ""
        self._initialize_keys()

    def _initialize_keys(self):
        # 1. Environment variables have highest priority
        env_pub = os.getenv("VAPID_PUBLIC_KEY", "")
        env_priv = os.getenv("VAPID_PRIVATE_KEY", "")

        if env_pub and env_priv:
            self.public_key_b64 = env_pub
            self.private_key_pem = env_priv
            print("[WEBPUSH] Initialized VAPID keys from environment variables.")
            return

        # 2. Local persistent key file (.vapid_keys.json in backend directory)
        key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".vapid_keys.json")
        if os.path.exists(key_file):
            try:
                with open(key_file, "r") as f:
                    data = json.load(f)
                    self.public_key_b64 = data.get("public_key", "")
                    self.private_key_pem = data.get("private_key", "")
                if self.public_key_b64 and self.private_key_pem:
                    print("[WEBPUSH] Loaded existing VAPID keypair from .vapid_keys.json.")
                    return
            except Exception as e:
                print(f"[WEBPUSH] Failed to read .vapid_keys.json: {e}")

        # 3. Generate a fresh keypair and persist locally
        try:
            from py_vapid import Vapid
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

            vapid = Vapid()
            vapid.generate_keys()

            raw_pub = vapid.public_key.public_bytes(
                encoding=Encoding.X962,
                format=PublicFormat.UncompressedPoint
            )
            self.public_key_b64 = base64.urlsafe_b64encode(raw_pub).rstrip(b'=').decode('utf-8')
            self.private_key_pem = vapid.private_pem().decode('utf-8')

            try:
                with open(key_file, "w") as f:
                    json.dump({
                        "public_key": self.public_key_b64,
                        "private_key": self.private_key_pem
                    }, f, indent=2)
                print("[WEBPUSH] Generated and saved new persistent VAPID keypair in .vapid_keys.json.")
            except Exception as fe:
                print(f"[WEBPUSH] Notice: Could not save .vapid_keys.json ({fe}), keeping in memory.")

        except Exception as e:
            print(f"[WEBPUSH ERROR] Could not initialize VAPID keys: {e}")

    def get_public_key(self) -> str:
        return self.public_key_b64

    def send_notification(self, subscription_info: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Dispatches RFC 8291 / 8292 encrypted Web Push notification.
        """
        if not self.private_key_pem:
            return {"status": "FAILED", "error": "VAPID private key uninitialized"}

        try:
            from pywebpush import webpush, WebPushException

            # Ensure subscription_info has the standard format
            sub = {
                "endpoint": subscription_info.get("endpoint"),
                "keys": {
                    "p256dh": subscription_info.get("keys", {}).get("p256dh") or subscription_info.get("p256dh"),
                    "auth": subscription_info.get("keys", {}).get("auth") or subscription_info.get("auth")
                }
            }

            resp = webpush(
                subscription_info=sub,
                data=json.dumps(payload),
                vapid_private_key=self.private_key_pem,
                vapid_claims={"sub": f"mailto:{self.claim_email}"},
                ttl=300
            )
            return {
                "status": "DELIVERED",
                "status_code": resp.status_code,
                "endpoint": sub["endpoint"]
            }
        except Exception as e:
            from pywebpush import WebPushException
            status_code = None
            if isinstance(e, WebPushException) and e.response is not None:
                status_code = e.response.status_code
            return {
                "status": "FAILED",
                "error": str(e),
                "status_code": status_code,
                "endpoint": subscription_info.get("endpoint")
            }

webpush_service = WebPushService()
