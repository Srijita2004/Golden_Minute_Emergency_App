import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any

# =========================================================================
# USER & AUTH SCHEMAS
# =========================================================================

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v

class HospitalRegister(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=150)
    operator_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
    confirm_password: str

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v

class UserOut(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# =========================================================================
# DEVICE SCHEMAS
# =========================================================================

class DeviceRegisterRequest(BaseModel):
    device_name: str
    device_type: str # WRISTBAND, ESP32_CAM, MOBILE_CAMERA
    connection_type: str = "BLE" # BLE, WIFI, INTERNAL_PHONE
    hardware_identifier: Optional[str] = None
    pairing_code: Optional[str] = "123456" # Secure pairing code for verification

class DeviceOut(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    owner_user_id: str
    connection_type: str
    hardware_identifier: Optional[str] = None
    registration_status: str
    connection_status: str
    battery_level: Optional[int] = None
    last_bpm: Optional[int] = None
    last_latitude: Optional[float] = None
    last_longitude: Optional[float] = None
    last_seen: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class DeviceHeartbeatRequest(BaseModel):
    battery_level: Optional[int] = None
    bpm: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# =========================================================================
# NOTIFICATION SCHEMAS
# =========================================================================

class RegisterDeviceTokenRequest(BaseModel):
    platform: str = "ANDROID" # ANDROID, IOS, WEB
    fcm_token: str
    device_name: Optional[str] = None

class NotificationTokenOut(BaseModel):
    id: int
    user_id: str
    platform: str
    fcm_token: str
    device_name: Optional[str] = None
    enabled: bool
    last_updated: datetime.datetime

    class Config:
        from_attributes = True

# =========================================================================
# DETECTION & INCIDENT SCHEMAS
# =========================================================================

class DetectionEventOut(BaseModel):
    event_id: str
    incident_id: str
    source_type: str
    source_device_id: Optional[str] = None
    image_url: Optional[str] = None
    bpm: Optional[int] = None
    confidence: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_status: str
    alert_status: str
    detected_at: datetime.datetime
    received_at: datetime.datetime

    class Config:
        from_attributes = True

class IncidentOut(BaseModel):
    incident_id: str
    owner_user_id: str
    incident_type: str
    status: str
    summary: Optional[str] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    events: List[DetectionEventOut] = []

    class Config:
        from_attributes = True

class CameraIncidentPayload(BaseModel):
    event_id: str # Idempotency key, e.g. EVENT-CAM-001-00028
    device_id: str
    detection_status: str = "ACCIDENT_DETECTED" # ACCIDENT_DETECTED, FIRE_DETECTED, FALL_DETECTED
    incident_type: Optional[str] = "ROAD_ACCIDENT"
    confidence: Optional[float] = 0.85
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    detected_at: Optional[datetime.datetime] = None

class WristbandIncidentPayload(BaseModel):
    event_id: str
    device_id: str
    bpm: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    battery_level: Optional[int] = None
    detected_at: Optional[datetime.datetime] = None

class MobileCameraIncidentPayload(BaseModel):
    event_id: str
    incident_type: str = "ROAD_ACCIDENT" # ROAD_ACCIDENT, FALL_ACCIDENT, FIRE_ACCIDENT
    confidence: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    detected_at: Optional[datetime.datetime] = None

class IncidentStatusUpdate(BaseModel):
    status: Optional[str] = None
    new_status: Optional[str] = None

# =========================================================================
# ADMIN SCHEMAS
# =========================================================================

class AdminStatsOut(BaseModel):
    total_users: int
    active_users: int
    total_devices: int
    connected_devices: int
    offline_devices: int
    total_incidents: int
    active_incidents: int
    system_status: str

class AuditLogOut(BaseModel):
    id: int
    actor_user_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class NotificationLogOut(BaseModel):
    id: int
    incident_id: str
    user_id: str
    fcm_token: str
    status: str
    sent_at: datetime.datetime

    class Config:
        from_attributes = True
