import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from app.database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. USER-001
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="USER", nullable=False) # USER, ADMIN
    status = Column(String(20), default="ACTIVE", nullable=False) # ACTIVE, SUSPENDED
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    devices = relationship("Device", back_populates="owner", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="owner", cascade="all, delete-orphan")
    notification_tokens = relationship("NotificationToken", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="actor")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. WRIST-001, CAM-001
    device_name = Column(String(100), nullable=False)
    device_type = Column(String(50), nullable=False) # WRISTBAND, ESP32_CAM, MOBILE_CAMERA
    owner_user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False, index=True)
    connection_type = Column(String(50), nullable=False) # BLE, WIFI, INTERNAL_PHONE
    hardware_identifier = Column(String(100), nullable=True) # MAC address or hardware serial
    pairing_code = Column(String(50), nullable=True) # Verification pairing code
    registration_status = Column(String(30), default="CLAIMED", nullable=False) # CLAIMED, PENDING
    connection_status = Column(String(30), default="DISCONNECTED", nullable=False) # CONNECTED, CONNECTING, DISCONNECTED, OFFLINE, ERROR
    battery_level = Column(Integer, nullable=True) # 0-100%
    last_bpm = Column(Integer, nullable=True)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="devices")
    detection_events = relationship("DetectionEvent", back_populates="device")


class NotificationToken(Base):
    __tablename__ = "notification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False, index=True)
    platform = Column(String(20), default="ANDROID", nullable=False) # ANDROID, IOS, WEB
    fcm_token = Column(String(500), unique=True, index=True, nullable=False)
    device_name = Column(String(100), nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notification_tokens")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), unique=True, index=True, nullable=False) # e.g. INC-2026-0001
    owner_user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False, index=True)
    incident_type = Column(String(50), nullable=False) # ROAD_ACCIDENT, FALL_ACCIDENT, FIRE_ACCIDENT, ABNORMAL_PULSE, MANUAL_SOS
    status = Column(String(30), default="ACTIVE", nullable=False) # ACTIVE, ACKNOWLEDGED, RESOLVED, FALSE_ALARM
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="incidents")
    events = relationship("DetectionEvent", back_populates="incident", cascade="all, delete-orphan")
    media_files = relationship("IncidentMedia", back_populates="incident", cascade="all, delete-orphan")
    notification_logs = relationship("NotificationLog", back_populates="incident", cascade="all, delete-orphan")


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, index=True, nullable=False) # Idempotency key, e.g. EVENT-CAM-001-00028
    incident_id = Column(String(50), ForeignKey("incidents.incident_id"), nullable=False, index=True)
    source_type = Column(String(50), nullable=False) # ESP32_CAM, WRISTBAND, MOBILE_CAMERA
    source_device_id = Column(String(50), ForeignKey("devices.device_id"), nullable=True, index=True)
    image_url = Column(String(500), nullable=True)
    bpm = Column(Integer, nullable=True)
    confidence = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True)
    location_status = Column(String(50), default="AVAILABLE", nullable=False) # AVAILABLE, LOCATION UNAVAILABLE
    alert_status = Column(String(30), default="SENT", nullable=False) # SENT, PENDING, FAILED
    detected_at = Column(DateTime, nullable=False)
    received_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="events")
    device = relationship("Device", back_populates="detection_events")
    media = relationship("IncidentMedia", back_populates="event")


class IncidentMedia(Base):
    __tablename__ = "incident_media"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), ForeignKey("incidents.incident_id"), nullable=False, index=True)
    event_id = Column(String(100), ForeignKey("detection_events.event_id"), nullable=True)
    media_type = Column(String(20), default="IMAGE", nullable=False) # IMAGE, VIDEO
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="media_files")
    event = relationship("DetectionEvent", back_populates="media")


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(50), ForeignKey("incidents.incident_id"), nullable=False, index=True)
    user_id = Column(String(50), nullable=False, index=True)
    fcm_token = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False) # SUCCESS, FAILED, SIMULATED
    response_payload = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="notification_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(String(50), ForeignKey("users.user_id"), nullable=True, index=True)
    action = Column(String(100), nullable=False) # LOGIN, REGISTER, DEVICE_ADD, DEVICE_REMOVE, INCIDENT_VIEW, etc.
    resource_type = Column(String(50), nullable=True) # USER, DEVICE, INCIDENT
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    actor = relationship("User", back_populates="audit_logs")
