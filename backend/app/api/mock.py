import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.services.incident_service import IncidentService
from app.services.device_service import DeviceService
from app.models.all_models import Device, User
from app.api.deps import get_current_user

router = APIRouter(prefix="/mock", tags=["Mock Hardware Simulation"])

@router.post("/wristband/trigger")
def mock_wristband_event(
    device_id: str,
    bpm: int,
    latitude: float = 22.572645,
    longitude: float = 88.363892,
    battery: int = 85,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates physical ESP32 DevKit sending telemetry.
    Passes directly into common IncidentService pipeline!
    """
    device = DeviceService.get_device_by_id(db, device_id, current_user.user_id)
    event_id = f"EVENT-WRIST-{device_id}-{int(datetime.datetime.utcnow().timestamp())}"

    # Heartbeat update
    device.connection_status = "CONNECTED"
    device.last_bpm = bpm
    device.last_latitude = latitude
    device.last_longitude = longitude
    device.battery_level = battery
    device.last_seen = datetime.datetime.utcnow()
    db.commit()

    # Trigger incident if abnormal
    if bpm < 45 or bpm > 130:
        incident = IncidentService.handle_wristband_incident(
            db=db,
            event_id=event_id,
            device_id=device_id,
            bpm=bpm,
            latitude=latitude,
            longitude=longitude,
            battery_level=battery
        )
        return {"emergency_triggered": True, "incident": incident.incident_id, "bpm": bpm, "status": "INCIDENT_DISPATCHED"}
    
    return {"emergency_triggered": False, "bpm": bpm, "message": "Normal pulse recorded"}

@router.post("/camera/trigger")
def mock_camera_accident(
    device_id: str,
    detection_type: str = "ROAD_ACCIDENT",
    confidence: float = 0.89,
    latitude: float = 22.572645,
    longitude: float = 88.363892,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates ESP32-CAM optical sensor detection event.
    Feeds through real IncidentService pipeline!
    """
    device = DeviceService.get_device_by_id(db, device_id, current_user.user_id)
    event_id = f"EVENT-CAM-{device_id}-{int(datetime.datetime.utcnow().timestamp())}"

    incident = IncidentService.handle_camera_incident(
        db=db,
        event_id=event_id,
        device_id=device_id,
        detection_status="ACCIDENT_DETECTED" if detection_type == "ROAD_ACCIDENT" else "FIRE_DETECTED",
        confidence=confidence,
        latitude=latitude,
        longitude=longitude,
        image_url="/uploads/mock_accident_sample.jpg"
    )
    return {"emergency_triggered": True, "incident": incident.incident_id, "confidence": confidence}

@router.post("/device/toggle-offline")
def mock_toggle_offline(device_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Simulates hardware losing signal / battery drain."""
    device = DeviceService.get_device_by_id(db, device_id, current_user.user_id)
    if device.connection_status == "CONNECTED":
        device.connection_status = "OFFLINE"
        # Simulate last_seen older than offline threshold
        device.last_seen = datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    else:
        device.connection_status = "CONNECTED"
        device.last_seen = datetime.datetime.utcnow()
    db.commit()
    return {"device_id": device_id, "new_status": device.connection_status}
