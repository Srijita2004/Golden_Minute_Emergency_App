import os
import io
from typing import Dict, Any, List, Optional
import requests
from app.adapters.base import BaseAiInferenceProvider
from app.core.config import settings

class AiInferenceProvider(BaseAiInferenceProvider):
    """
    Adapter interfacing directly with the central ML inference service (ML_project).
    Sends image bytes to the ML API (/predict) and maps detection outcomes to the
    Golden Minute incident format without loading redundant PyTorch models.
    """
    def __init__(self):
        self.ml_service_url = settings.ML_SERVICE_URL
        print(f"[AI ADAPTER] Configured Central ML API: {self.ml_service_url}")

    def predict_image(self, image_bytes: bytes, incident_type_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Runs ML inference by forwarding raw image bytes to the central ML service.
        """
        try:
            url = f"{self.ml_service_url.rstrip('/')}/predict"
            resp = requests.post(
                url,
                data=image_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("accident"):
                    raw_type = data.get("type", "road_vehicle_accident")
                    
                    # Standardize incident classification
                    if "fire" in raw_type.lower():
                        inc_type = "FIRE_ACCIDENT"
                    elif "fall" in raw_type.lower():
                        inc_type = "FALL_ACCIDENT"
                    else:
                        inc_type = "ROAD_ACCIDENT"

                    return {
                        "detected": True,
                        "incident_type": inc_type,
                        "confidence": round(float(data.get("score", 0.85)), 4),
                        "labels": data.get("labels", [raw_type]),
                        "message": data.get("result", "Accident detected")
                    }
                else:
                    return {
                        "detected": False,
                        "incident_type": "NORMAL",
                        "confidence": float(data.get("score", 0.0)),
                        "labels": data.get("labels", []),
                        "message": "No incident detected by ML service"
                    }
        except Exception as e:
            print(f"[AI ADAPTER] Connection warning: Could not reach ML service at {self.ml_service_url}: {e}")

        # Fallback response if ML service is temporarily unreachable
        return {
            "detected": True if incident_type_hint else False,
            "incident_type": incident_type_hint or "NORMAL",
            "confidence": 0.85 if incident_type_hint else 0.0,
            "labels": ["fallback_simulation"] if incident_type_hint else [],
            "message": "Processed via AI adapter fallback (ML service unreachable)"
        }

ai_inference_provider = AiInferenceProvider()
