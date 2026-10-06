import json
import asyncio
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import (
    RegisterDeviceTokenRequest, NotificationTokenOut,
    WebPushSubscribeRequest, WebPushSubscriptionOut
)
from app.models.all_models import NotificationToken, WebPushSubscription, User
from app.api.deps import get_current_user
from app.adapters.fcm_adapter import fcm_service
from app.adapters.webpush_adapter import webpush_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.post("/register-device", response_model=NotificationTokenOut)
def register_notification_token(req: RegisterDeviceTokenRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(NotificationToken).filter(NotificationToken.fcm_token == req.fcm_token).first()
    if existing:
        existing.user_id = current_user.user_id
        existing.platform = req.platform
        existing.device_name = req.device_name
        existing.enabled = True
        existing.last_updated = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return NotificationTokenOut.model_validate(existing)

    token_entry = NotificationToken(
        user_id=current_user.user_id,
        platform=req.platform,
        fcm_token=req.fcm_token,
        device_name=req.device_name,
        enabled=True
    )
    db.add(token_entry)
    db.commit()
    db.refresh(token_entry)
    return NotificationTokenOut.model_validate(token_entry)

@router.delete("/device/{token_id}")
def delete_notification_token(token_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tok = db.query(NotificationToken).filter(NotificationToken.id == token_id, NotificationToken.user_id == current_user.user_id).first()
    if not tok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token registration not found.")
    db.delete(tok)
    db.commit()
    return {"ok": True, "message": "FCM device registration removed."}

# =========================================================================
# WEB PUSH & VAPID SUBSCRIPTION MANAGEMENT
# =========================================================================

@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Returns applicationServerKey (VAPID Public Key) for browser PushManager subscription."""
    key = webpush_service.get_public_key()
    return {"publicKey": key}

@router.post("/subscribe-webpush", response_model=WebPushSubscriptionOut)
def subscribe_web_push(req: WebPushSubscribeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p256dh = req.keys.get("p256dh")
    auth_key = req.keys.get("auth")
    if not req.endpoint or not p256dh or not auth_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid push subscription payload")

    existing = db.query(WebPushSubscription).filter(WebPushSubscription.endpoint == req.endpoint).first()
    if existing:
        existing.user_id = current_user.user_id
        existing.p256dh = p256dh
        existing.auth = auth_key
        existing.user_agent = req.user_agent
        existing.enabled = True
        existing.last_seen = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return WebPushSubscriptionOut.model_validate(existing)

    sub = WebPushSubscription(
        user_id=current_user.user_id,
        endpoint=req.endpoint,
        p256dh=p256dh,
        auth=auth_key,
        user_agent=req.user_agent,
        enabled=True
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return WebPushSubscriptionOut.model_validate(sub)

@router.post("/unsubscribe-webpush")
def unsubscribe_web_push(req: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    endpoint = req.get("endpoint")
    if endpoint:
        sub = db.query(WebPushSubscription).filter(
            WebPushSubscription.endpoint == endpoint,
            WebPushSubscription.user_id == current_user.user_id
        ).first()
        if sub:
            db.delete(sub)
            db.commit()
    return {"ok": True, "message": "Web Push subscription removed."}

# =========================================================================
# REAL-TIME EMERGENCY ALERT FEEDS (SSE & POLLING)
# =========================================================================

@router.get("/active-alerts")
def get_active_emergency_alerts(current_user: User = Depends(get_current_user)):
    """
    Real-time emergency alert feed.
    Admin/Hospital receivers receive the global alert stream.
    Normal users receive only alerts originating from their own devices.
    """
    is_admin_or_hospital = current_user.role.upper() in ["ADMIN", "HOSPITAL", "SUPER_ADMIN"]
    alerts = fcm_service.get_recent_alerts(user_id=current_user.user_id, is_admin_or_hospital=is_admin_or_hospital)
    return {"alerts": alerts}

@router.get("/stream")
async def stream_emergency_alerts(current_user: User = Depends(get_current_user)):
    """
    Server-Sent Events (SSE) stream for instant sub-second emergency dispatch
    to open Hospital Monitoring Centers and Active User sessions.
    """
    is_admin_or_hospital = current_user.role.upper() in ["ADMIN", "HOSPITAL", "SUPER_ADMIN"]
    queue: asyncio.Queue = asyncio.Queue()
    fcm_service.register_sse_subscriber(queue, current_user.user_id, is_admin_or_hospital)

    async def event_generator():
        try:
            # Initial handshake
            init_payload = {
                "type": "CONNECTED",
                "user_id": current_user.user_id,
                "role": current_user.role,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
            yield f"data: {json.dumps(init_payload)}\n\n"

            while True:
                try:
                    alert = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(alert)}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment to prevent proxy timeouts
                    yield ": keep-alive\n\n"
        finally:
            fcm_service.unregister_sse_subscriber(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
