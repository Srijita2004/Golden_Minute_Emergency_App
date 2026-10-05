import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import RegisterDeviceTokenRequest, NotificationTokenOut
from app.models.all_models import NotificationToken, User
from app.api.deps import get_current_user
from app.adapters.fcm_adapter import fcm_service

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

@router.get("/active-alerts")
def get_active_emergency_alerts(current_user: User = Depends(get_current_user)):
    """
    Real-time emergency alert feed.
    Client polls or connects here to trigger instant local emergency sound & vibration.
    """
    alerts = fcm_service.get_recent_alerts_for_user(current_user.user_id)
    return {"alerts": alerts}
