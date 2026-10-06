import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.all_models import Device, AuditLog, User
from app.schemas.schemas import DeviceRegisterRequest, DeviceHeartbeatRequest
from app.adapters.hardware_adapters import device_connection_manager

class DeviceService:

    @staticmethod
    def generate_next_device_id(db: Session, device_type: str) -> str:
        prefix = "WRIST" if "WRIST" in device_type.upper() else "CAM" if "CAM" in device_type.upper() else "PHONE"
        count = db.query(Device).filter(Device.device_id.like(f"{prefix}-%")).count()
        return f"{prefix}-{(count + 1):03d}"

    @staticmethod
    def register_device(db: Session, user_id: str, req: DeviceRegisterRequest) -> Device:
        # Check if hardware identifier is already claimed by someone else
        if req.hardware_identifier:
            existing = db.query(Device).filter(Device.hardware_identifier == req.hardware_identifier).first()
            if existing:
                if existing.owner_user_id != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This physical hardware is already claimed under another user account. Unpair it first."
                    )
                return existing

        device_id = DeviceService.generate_next_device_id(db, req.device_type)

        new_device = Device(
            device_id=device_id,
            device_name=req.device_name.strip(),
            device_type=req.device_type.upper(),
            owner_user_id=user_id,
            connection_type=req.connection_type.upper(),
            hardware_identifier=req.hardware_identifier,
            pairing_code=req.pairing_code,
            registration_status="CLAIMED",
            connection_status="DISCONNECTED",
            battery_level=100 if "WRIST" in req.device_type.upper() else None,
            last_seen=datetime.datetime.utcnow()
        )
        db.add(new_device)

        audit = AuditLog(
            actor_user_id=user_id,
            action="DEVICE_REGISTERED",
            resource_type="DEVICE",
            resource_id=device_id,
            details=f"Device {device_id} ({req.device_name}) claimed by {user_id}"
        )
        db.add(audit)
        db.commit()
        db.refresh(new_device)
        return new_device

    @staticmethod
    def get_user_devices(db: Session, user_id: str) -> List[Device]:
        """Fetch only devices belonging to this user."""
        return db.query(Device).filter(Device.owner_user_id == user_id).all()

    @staticmethod
    def get_device_by_id(db: Session, device_id: str, user_id: str, is_admin: bool = False) -> Device:
        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
        
        # Enforce strict ownership protection
        if not is_admin and device.owner_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not own this device.")
        return device

    @staticmethod
    def connect_device(db: Session, device_id: str, user_id: str) -> Device:
        device = DeviceService.get_device_by_id(db, device_id, user_id)
        # Invoke adapter
        device_connection_manager.connect(device.connection_type, device.hardware_identifier or device.device_id)
        device.connection_status = "CONNECTED"
        device.last_seen = datetime.datetime.utcnow()
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def disconnect_device(db: Session, device_id: str, user_id: str) -> Device:
        device = DeviceService.get_device_by_id(db, device_id, user_id)
        device_connection_manager.disconnect(device.connection_type, device.hardware_identifier or device.device_id)
        device.connection_status = "DISCONNECTED"
        device.last_seen = datetime.datetime.utcnow()
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def remove_device(db: Session, device_id: str, user_id: str) -> bool:
        device = DeviceService.get_device_by_id(db, device_id, user_id)
        db.delete(device)

        audit = AuditLog(
            actor_user_id=user_id,
            action="DEVICE_REMOVED",
            resource_type="DEVICE",
            resource_id=device_id,
            details=f"Device {device_id} unpaired and deleted by {user_id}"
        )
        db.add(audit)
        db.commit()
        return True

    @staticmethod
    def record_heartbeat(db: Session, device_id: str, req: DeviceHeartbeatRequest) -> Device:
        device = db.query(Device).filter(
            (Device.device_id == device_id) | (Device.hardware_identifier == device_id)
        ).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
        
        device.last_seen = datetime.datetime.utcnow()
        device.connection_status = "CONNECTED"
        if req.battery_level is not None:
            device.battery_level = req.battery_level
        if req.bpm is not None:
            device.last_bpm = req.bpm
        if req.latitude is not None:
            device.last_latitude = req.latitude
        if req.longitude is not None:
            device.last_longitude = req.longitude
        
        db.commit()
        db.refresh(device)
        return device
