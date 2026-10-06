import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.all_models import User, Device, Incident, AuditLog, NotificationLog
from app.core.config import settings

class AdminService:

    @staticmethod
    def get_system_stats(db: Session) -> Dict[str, Any]:
        total_users = db.query(User).filter(User.role == "USER").count()
        active_users = db.query(User).filter(User.role == "USER", User.status == "ACTIVE").count()
        
        total_devices = db.query(Device).count()
        connected_devices = db.query(Device).filter(Device.connection_status == "CONNECTED").count()
        
        # Consider devices offline if last_seen > threshold seconds
        threshold = datetime.datetime.utcnow() - datetime.timedelta(seconds=settings.DEVICE_OFFLINE_THRESHOLD_SECONDS)
        offline_devices = db.query(Device).filter(
            or_(Device.connection_status == "OFFLINE", Device.last_seen < threshold)
        ).count()

        total_incidents = db.query(Incident).count()
        active_incidents = db.query(Incident).filter(Incident.status == "ACTIVE").count()

        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_devices": total_devices,
            "connected_devices": connected_devices,
            "offline_devices": offline_devices,
            "total_incidents": total_incidents,
            "active_incidents": active_incidents,
            "system_status": "OPERATIONAL"
        }

    @staticmethod
    def list_users(db: Session, search: Optional[str] = None, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Strictly omits hashed_password, reset_token, and secrets."""
        query = db.query(User)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(User.name.ilike(s), User.email.ilike(s), User.user_id.ilike(s)))
        
        total = query.count()
        items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        user_list = [
            {
                "user_id": u.user_id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "status": u.status,
                "created_at": u.created_at,
                "device_count": len(u.devices),
                "incident_count": len(u.incidents)
            }
            for u in items
        ]
        return {"total": total, "page": page, "page_size": page_size, "users": user_list}

    @staticmethod
    def list_devices(db: Session, search: Optional[str] = None, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        """Strictly omits device pairing codes and hardware secrets."""
        query = db.query(Device)
        if search:
            s = f"%{search}%"
            query = query.filter(or_(Device.device_name.ilike(s), Device.device_id.ilike(s), Device.owner_user_id.ilike(s)))
        
        total = query.count()
        items = query.order_by(Device.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        device_list = [
            {
                "device_id": d.device_id,
                "device_name": d.device_name,
                "device_type": d.device_type,
                "owner_user_id": d.owner_user_id,
                "connection_type": d.connection_type,
                "registration_status": d.registration_status,
                "connection_status": d.connection_status,
                "battery_level": d.battery_level,
                "last_bpm": d.last_bpm,
                "last_latitude": d.last_latitude,
                "last_longitude": d.last_longitude,
                "last_seen": d.last_seen,
                "created_at": d.created_at
            }
            for d in items
        ]
        return {"total": total, "page": page, "page_size": page_size, "devices": device_list}

    @staticmethod
    def list_incidents(
        db: Session,
        status: Optional[str] = None,
        incident_type: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        query = db.query(Incident)
        if status and status.upper() != "ALL":
            query = query.filter(Incident.status == status.upper())
        if incident_type and incident_type.upper() != "ALL":
            query = query.filter(Incident.incident_type == incident_type.upper())
        if search:
            s = f"%{search}%"
            query = query.filter(or_(
                Incident.incident_id.ilike(s),
                Incident.owner_user_id.ilike(s),
                Incident.summary.ilike(s)
            ))

        total = query.count()
        items = query.order_by(Incident.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        incidents_out = []
        for inc in items:
            incidents_out.append({
                "incident_id": inc.incident_id,
                "owner_user_id": inc.owner_user_id,
                "incident_type": inc.incident_type,
                "status": inc.status,
                "summary": inc.summary,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
                "updated_at": inc.updated_at.isoformat() if inc.updated_at else None,
                "events": [
                    {
                        "event_id": e.event_id,
                        "incident_id": e.incident_id,
                        "source_type": e.source_type,
                        "source_device_id": e.source_device_id,
                        "image_url": e.image_url,
                        "bpm": e.bpm,
                        "confidence": e.confidence,
                        "latitude": e.latitude,
                        "longitude": e.longitude,
                        "location_accuracy": e.location_accuracy,
                        "location_status": e.location_status,
                        "alert_status": e.alert_status,
                        "detected_at": e.detected_at.isoformat() if e.detected_at else None,
                        "received_at": e.received_at.isoformat() if e.received_at else None
                    }
                    for e in inc.events
                ]
            })

        return {"total": total, "page": page, "page_size": page_size, "incidents": incidents_out}

    @staticmethod
    def list_audit_logs(db: Session, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        query = db.query(AuditLog)
        total = query.count()
        items = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "page": page, "page_size": page_size, "logs": items}

    @staticmethod
    def list_notification_logs(db: Session, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        query = db.query(NotificationLog)
        total = query.count()
        items = query.order_by(NotificationLog.sent_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return {"total": total, "page": page, "page_size": page_size, "logs": items}
