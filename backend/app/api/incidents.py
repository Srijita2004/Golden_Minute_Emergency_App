import os
import uuid
import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import IncidentOut, WristbandIncidentPayload, MobileCameraIncidentPayload, IncidentStatusUpdate
from app.services.incident_service import IncidentService
from app.adapters.ai_adapter import ai_inference_provider
from app.api.deps import get_current_user
from app.models.all_models import User
from app.core.config import settings

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("/camera", response_model=IncidentOut)
async def create_camera_incident(
    event_id: str = Form(...),
    device_id: str = Form(...),
    detection_status: str = Form("ACCIDENT_DETECTED"),
    confidence: Optional[float] = Form(0.85),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    detected_at: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Entrypoint for ESP32-CAM external camera:
    Accepts snapshot image, runs AI inference via adapter if raw image is provided,
    and feeds into common incident pipeline.
    """
    image_url = None
    if image is not None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        filename = f"{uuid.uuid4()}_{image.filename}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        content = await image.read()
        with open(file_path, "wb") as f:
            f.write(content)
        image_url = f"/uploads/{filename}"

        # If camera sends raw image, run through AI inference adapter
        ai_result = ai_inference_provider.predict_image(content, incident_type_hint=detection_status)
        if ai_result.get("detected"):
            confidence = ai_result.get("confidence", confidence)

    det_dt = datetime.datetime.fromisoformat(detected_at) if detected_at else None

    # Safely parse coordinates without failing on empty strings or null
    lat_val: Optional[float] = None
    lon_val: Optional[float] = None
    if latitude is not None and str(latitude).strip() not in ("", "null", "None"):
        try:
            lat_val = float(latitude)
        except (ValueError, TypeError):
            lat_val = None
    if longitude is not None and str(longitude).strip() not in ("", "null", "None"):
        try:
            lon_val = float(longitude)
        except (ValueError, TypeError):
            lon_val = None

    incident = IncidentService.handle_camera_incident(
        db=db,
        event_id=event_id,
        device_id=device_id,
        detection_status=detection_status,
        confidence=confidence or 0.85,
        latitude=lat_val,
        longitude=lon_val,
        image_url=image_url,
        detected_at=det_dt
    )
    return IncidentOut.model_validate(incident)

@router.post("/wristband", response_model=IncidentOut)
def create_wristband_incident(req: WristbandIncidentPayload, db: Session = Depends(get_db)):
    """
    Entrypoint for ESP32 DevKit Wristband:
    Evaluates abnormal pulse (bradycardia/tachycardia) and stores wristband GPS.
    """
    incident = IncidentService.handle_wristband_incident(
        db=db,
        event_id=req.event_id,
        device_id=req.device_id,
        bpm=req.bpm,
        latitude=req.latitude,
        longitude=req.longitude,
        battery_level=req.battery_level,
        detected_at=req.detected_at
    )
    return IncidentOut.model_validate(incident)

@router.post("/mobile-camera", response_model=IncidentOut)
async def create_mobile_camera_incident(
    event_id: str = Form(...),
    incident_type: str = Form("ROAD_ACCIDENT"),
    confidence: float = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_accuracy: Optional[float] = Form(None),
    detected_at: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Entrypoint for Phone AI Camera:
    Uses Phone GPS and phone front/rear camera snapshot.
    """
    image_url = None
    if image is not None:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        filename = f"phone_{uuid.uuid4()}_{image.filename}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        content = await image.read()
        with open(file_path, "wb") as f:
            f.write(content)
        image_url = f"/uploads/{filename}"

    det_dt = datetime.datetime.fromisoformat(detected_at) if detected_at else None

    incident = IncidentService.handle_mobile_camera_incident(
        db=db,
        event_id=event_id,
        user_id=current_user.user_id,
        incident_type=incident_type,
        confidence=confidence,
        latitude=latitude,
        longitude=longitude,
        image_url=image_url,
        location_accuracy=location_accuracy,
        detected_at=det_dt
    )
    return IncidentOut.model_validate(incident)

@router.get("", response_model=List[IncidentOut])
def get_user_incidents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    incidents = IncidentService.get_user_incidents(db, current_user.user_id)
    return [IncidentOut.model_validate(i) for i in incidents]

@router.get("/{id}", response_model=IncidentOut)
def get_incident(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    is_admin_or_hospital = current_user.role.upper() in ["ADMIN", "HOSPITAL", "SUPER_ADMIN"]
    incident = IncidentService.get_incident_by_id(
        db, id, current_user.user_id, is_admin=is_admin_or_hospital
    )
    return IncidentOut.model_validate(incident)

@router.patch("/{id}/status", response_model=IncidentOut)
def update_incident_status(
    id: str,
    new_status: Optional[str] = None,
    payload: Optional[IncidentStatusUpdate] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_status = new_status
    if not target_status and payload:
        target_status = payload.new_status or payload.status
    if not target_status:
        raise HTTPException(status_code=400, detail="Missing status parameter")
    is_admin_or_hospital = current_user.role.upper() in ["ADMIN", "HOSPITAL", "SUPER_ADMIN"]
    incident = IncidentService.update_incident_status(
        db, id, current_user.user_id, target_status.upper(), is_admin=is_admin_or_hospital
    )
    return IncidentOut.model_validate(incident)
