import datetime
import os
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.all_models import Incident, DetectionEvent, Device, User, NotificationToken, NotificationLog, IncidentMedia, WebPushSubscription
from app.adapters.location_provider import location_provider
from app.adapters.fcm_adapter import fcm_service
from app.adapters.webpush_adapter import webpush_service
from app.adapters.hardware_adapters import device_connection_manager

class IncidentService:

    @staticmethod
    def generate_next_incident_id(db: Session) -> str:
        count = db.query(Incident).count()
        year = datetime.datetime.utcnow().year
        return f"INC-{year}-{(count + 1):04d}"

    @staticmethod
    def _dispatch_emergency_alerts(db: Session, incident: Incident, event: DetectionEvent):
        """
        CENTRAL INCIDENT FAN-OUT:
        1. Owner Scope: Dispatches to the incident owner's registered devices.
        2. Global Admin / Hospital Scope: Fans out to ALL active Hospital and Admin receivers
           across Web Push (PWA/Browser) and Native Android FCM.
        """
        owner_id = incident.owner_user_id

        # 1. Resolve Admin / Hospital User IDs
        admin_users = db.query(User).filter(
            User.role.in_(["ADMIN", "HOSPITAL", "SUPER_ADMIN"]),
            User.status == "ACTIVE"
        ).all()
        admin_user_ids = {u.user_id for u in admin_users}

        # Combined target user IDs (Owner + all Admins/Hospitals)
        all_target_user_ids = set(admin_user_ids)
        if owner_id:
            all_target_user_ids.add(owner_id)

        # 2. Collect FCM Tokens for all targets
        fcm_tokens = db.query(NotificationToken).filter(
            NotificationToken.user_id.in_(list(all_target_user_ids)),
            NotificationToken.enabled == True
        ).all()
        unique_fcm_tokens = list({t.fcm_token for t in fcm_tokens})

        # 3. Format Emergency Title and Content
        clean_type = incident.incident_type.replace('_', ' ').title()
        title = f"🚨 EMERGENCY: {clean_type}"
        source_label = event.source_type.replace('_', ' ')
        loc_str = f"({event.latitude:.4f}, {event.longitude:.4f})" if event.location_status == "AVAILABLE" and event.latitude is not None else "Location Unavailable"
        body = f"{source_label} triggered emergency alert for incident {incident.incident_id}. {loc_str}"

        payload_data = {
            "incidentId": incident.incident_id,
            "incidentType": incident.incident_type,
            "eventId": event.event_id,
            "sourceType": event.source_type,
            "ownerUserId": owner_id,
            "latitude": str(event.latitude) if event.latitude is not None else "",
            "longitude": str(event.longitude) if event.longitude is not None else "",
            "locationStatus": event.location_status,
            "bpm": str(event.bpm) if event.bpm is not None else "",
            "confidence": str(event.confidence) if event.confidence is not None else "",
            "imageUrl": event.image_url or "",
            "detectedAt": event.detected_at.isoformat()
        }

        # 4. Dispatch via FCM & Real-Time SSE Event Bus
        dispatch_results = fcm_service.send_emergency_alert(unique_fcm_tokens, title, body, payload_data)

        # 5. Collect and Dispatch Web Push (VAPID) Subscriptions
        webpush_subs = db.query(WebPushSubscription).filter(
            WebPushSubscription.user_id.in_(list(all_target_user_ids)),
            WebPushSubscription.enabled == True
        ).all()

        webpush_payload = {
            "title": title,
            "body": body,
            "incidentId": incident.incident_id,
            "incidentType": incident.incident_type,
            "sourceType": event.source_type,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "bpm": event.bpm,
            "confidence": event.confidence,
            "imageUrl": event.image_url or "",
            "timestamp": event.detected_at.isoformat()
        }

        expired_sub_ids = []
        for sub in webpush_subs:
            sub_dict = {
                "endpoint": sub.endpoint,
                "p256dh": sub.p256dh,
                "auth": sub.auth
            }
            wp_res = webpush_service.send_notification(sub_dict, webpush_payload)
            # If subscription was invalidated or expired (404/410), mark for deletion
            if wp_res.get("status_code") in (404, 410):
                expired_sub_ids.append(sub.id)

            # Log delivery
            n_log = NotificationLog(
                incident_id=incident.incident_id,
                user_id=sub.user_id,
                fcm_token=sub.endpoint[:200],
                status=wp_res.get("status", "UNKNOWN"),
                response_payload=str(wp_res)
            )
            db.add(n_log)

        # Clean up expired Web Push subscriptions
        if expired_sub_ids:
            db.query(WebPushSubscription).filter(WebPushSubscription.id.in_(expired_sub_ids)).delete(synchronize_session=False)

        # Log FCM deliveries
        for res in dispatch_results:
            n_log = NotificationLog(
                incident_id=incident.incident_id,
                user_id=owner_id,
                fcm_token=res["token"],
                status=res["status"],
                response_payload=str(res)
            )
            db.add(n_log)

        db.commit()

    @staticmethod
    def handle_camera_incident(
        db: Session,
        event_id: str,
        device_id: str,
        detection_status: str,
        confidence: float,
        latitude: Optional[float],
        longitude: Optional[float],
        image_url: Optional[str] = None,
        detected_at: Optional[datetime.datetime] = None
    ) -> Incident:
        """Pipeline entry for ESP32-CAM external camera."""
        # 1. Duplicate check (Idempotency)
        existing_event = db.query(DetectionEvent).filter(DetectionEvent.event_id == event_id).first()
        if existing_event:
            return db.query(Incident).filter(Incident.incident_id == existing_event.incident_id).first()

        # 2. Resolve Device & Owner
        device = db.query(Device).filter(
            (Device.device_id == device_id) | (Device.hardware_identifier == device_id)
        ).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device {device_id} not registered.")
        owner_user_id = device.owner_user_id

        # 3. Format Location at time of detection (NEVER fabricate fake GPS)
        lat, lon, loc_status = location_provider.format_coordinates(latitude, longitude)
        det_time = detected_at or datetime.datetime.utcnow()

        # 4. Create Incident & Detection Event
        inc_id = IncidentService.generate_next_incident_id(db)
        incident_type = "ROAD_ACCIDENT" if "ACCIDENT" in detection_status.upper() else "FIRE_ACCIDENT" if "FIRE" in detection_status.upper() else "FALL_ACCIDENT"

        new_incident = Incident(
            incident_id=inc_id,
            owner_user_id=owner_user_id,
            incident_type=incident_type,
            status="ACTIVE",
            summary=f"Camera {device.device_name} ({device_id}) detected {incident_type} with confidence {confidence:.2f}"
        )
        db.add(new_incident)

        new_event = DetectionEvent(
            event_id=event_id,
            incident_id=inc_id,
            source_type="ESP32_CAM",
            source_device_id=device_id,
            image_url=image_url,
            confidence=confidence,
            latitude=lat,
            longitude=lon,
            location_status=loc_status,
            alert_status="SENT",
            detected_at=det_time
        )
        db.add(new_event)

        if image_url:
            media = IncidentMedia(
                incident_id=inc_id,
                event_id=event_id,
                media_type="IMAGE",
                file_url=image_url
            )
            db.add(media)

        device.last_seen = datetime.datetime.utcnow()
        if lat is not None and lon is not None:
            device.last_latitude = lat
            device.last_longitude = lon

        db.commit()
        db.refresh(new_incident)

        # 5. Dispatch Emergency Alerts
        IncidentService._dispatch_emergency_alerts(db, new_incident, new_event)
        return new_incident

    @staticmethod
    def handle_wristband_incident(
        db: Session,
        event_id: str,
        device_id: str,
        bpm: int,
        latitude: Optional[float],
        longitude: Optional[float],
        battery_level: Optional[int] = None,
        detected_at: Optional[datetime.datetime] = None
    ) -> Incident:
        """Pipeline entry for ESP32 DevKit Wristband (abnormal pulse or SOS)."""
        existing_event = db.query(DetectionEvent).filter(DetectionEvent.event_id == event_id).first()
        if existing_event:
            return db.query(Incident).filter(Incident.incident_id == existing_event.incident_id).first()

        device = db.query(Device).filter(Device.device_id == device_id).first()
        if not device:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Wristband {device_id} not registered.")
        owner_user_id = device.owner_user_id

        # Evaluate pulse with configurable adapter
        pulse_eval = device_connection_manager.wristband_adapter.evaluate_pulse(bpm)
        lat, lon, loc_status = location_provider.format_coordinates(latitude, longitude)
        det_time = detected_at or datetime.datetime.utcnow()

        inc_id = IncidentService.generate_next_incident_id(db)
        new_incident = Incident(
            incident_id=inc_id,
            owner_user_id=owner_user_id,
            incident_type="ABNORMAL_PULSE",
            status="ACTIVE",
            summary=f"Wristband {device.device_name} detected {pulse_eval['condition']} at {bpm} BPM"
        )
        db.add(new_incident)

        new_event = DetectionEvent(
            event_id=event_id,
            incident_id=inc_id,
            source_type="WRISTBAND",
            source_device_id=device_id,
            bpm=bpm,
            latitude=lat,
            longitude=lon,
            location_status=loc_status,
            alert_status="SENT",
            detected_at=det_time
        )
        db.add(new_event)

        device.last_seen = datetime.datetime.utcnow()
        device.last_bpm = bpm
        if battery_level is not None:
            device.battery_level = battery_level
        if lat is not None and lon is not None:
            device.last_latitude = lat
            device.last_longitude = lon

        db.commit()
        db.refresh(new_incident)

        IncidentService._dispatch_emergency_alerts(db, new_incident, new_event)
        return new_incident

    @staticmethod
    def handle_mobile_camera_incident(
        db: Session,
        event_id: str,
        user_id: str,
        incident_type: str,
        confidence: float,
        latitude: Optional[float],
        longitude: Optional[float],
        image_url: Optional[str] = None,
        location_accuracy: Optional[float] = None,
        detected_at: Optional[datetime.datetime] = None
    ) -> Incident:
        """Pipeline entry for Mobile Phone AI Camera."""
        existing_event = db.query(DetectionEvent).filter(DetectionEvent.event_id == event_id).first()
        if existing_event:
            return db.query(Incident).filter(Incident.incident_id == existing_event.incident_id).first()

        lat, lon, loc_status = location_provider.format_coordinates(latitude, longitude)
        det_time = detected_at or datetime.datetime.utcnow()

        inc_id = IncidentService.generate_next_incident_id(db)
        new_incident = Incident(
            incident_id=inc_id,
            owner_user_id=user_id,
            incident_type=incident_type,
            status="ACTIVE",
            summary=f"Phone AI Camera detected {incident_type} with confidence {confidence:.2f}"
        )
        db.add(new_incident)

        new_event = DetectionEvent(
            event_id=event_id,
            incident_id=inc_id,
            source_type="MOBILE_CAMERA",
            confidence=confidence,
            image_url=image_url,
            latitude=lat,
            longitude=lon,
            location_accuracy=location_accuracy,
            location_status=loc_status,
            alert_status="SENT",
            detected_at=det_time
        )
        db.add(new_event)

        if image_url:
            media = IncidentMedia(
                incident_id=inc_id,
                event_id=event_id,
                media_type="IMAGE",
                file_url=image_url
            )
            db.add(media)

        db.commit()
        db.refresh(new_incident)

        IncidentService._dispatch_emergency_alerts(db, new_incident, new_event)
        return new_incident

    @staticmethod
    def get_user_incidents(db: Session, user_id: str) -> List[Incident]:
        """Returns incidents owned by this user only."""
        return db.query(Incident).filter(Incident.owner_user_id == user_id).order_by(Incident.created_at.desc()).all()

    @staticmethod
    def get_incident_by_id(db: Session, incident_id: str, user_id: str, is_admin: bool = False) -> Incident:
        incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
        if not incident:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")
        
        # Enforce isolation
        if not is_admin and incident.owner_user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: You do not have permission to view this incident.")
        return incident

    @staticmethod
    def update_incident_status(db: Session, incident_id: str, user_id: str, new_status: str, is_admin: bool = False) -> Incident:
        incident = IncidentService.get_incident_by_id(db, incident_id, user_id, is_admin)
        incident.status = new_status
        incident.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(incident)
        return incident
