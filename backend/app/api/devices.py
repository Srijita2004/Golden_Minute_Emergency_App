from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import DeviceRegisterRequest, DeviceOut, DeviceHeartbeatRequest
from app.services.device_service import DeviceService
from app.api.deps import get_current_user
from app.models.all_models import User

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.get("/discovery")
def discover_nearby_devices():
    """
    Scans/returns discoverable local hardware peripherals (e.g. nearby BLE advertisements or mDNS cameras)
    for pairing UX.
    """
    return {
        "devices": [
            {
                "name": "Wristband_ESP32_01",
                "type": "WRISTBAND",
                "connectionType": "BLE",
                "hardwareId": "ESP32-WRIST-A1B2",
                "rssi": -58
            },
            {
                "name": "AccidentCam_01",
                "type": "ESP32_CAM",
                "connectionType": "WIFI",
                "hardwareId": "ESP32-CAM-C3D4",
                "ip": "192.168.4.1"
            }
        ]
    }

@router.post("/register", response_model=DeviceOut)
def register_device(req: DeviceRegisterRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = DeviceService.register_device(db, current_user.user_id, req)
    return DeviceOut.model_validate(device)

@router.get("", response_model=List[DeviceOut])
def get_user_devices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    devices = DeviceService.get_user_devices(db, current_user.user_id)
    return [DeviceOut.model_validate(d) for d in devices]

@router.get("/{id}", response_model=DeviceOut)
def get_device(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = DeviceService.get_device_by_id(db, id, current_user.user_id, is_admin=(current_user.role == "ADMIN"))
    return DeviceOut.model_validate(device)

@router.post("/{id}/connect", response_model=DeviceOut)
def connect_device(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = DeviceService.connect_device(db, id, current_user.user_id)
    return DeviceOut.model_validate(device)

@router.post("/{id}/disconnect", response_model=DeviceOut)
def disconnect_device(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    device = DeviceService.disconnect_device(db, id, current_user.user_id)
    return DeviceOut.model_validate(device)

@router.delete("/{id}")
def remove_device(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    DeviceService.remove_device(db, id, current_user.user_id)
    return {"ok": True, "message": f"Device {id} successfully unpaired and removed."}

@router.post("/{id}/heartbeat", response_model=DeviceOut)
def record_heartbeat(id: str, req: DeviceHeartbeatRequest, db: Session = Depends(get_db)):
    """Hardware endpoint: Heartbeat telemetry from device."""
    device = DeviceService.record_heartbeat(db, id, req)
    return DeviceOut.model_validate(device)
