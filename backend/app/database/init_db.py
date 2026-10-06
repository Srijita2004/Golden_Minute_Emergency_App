import os
import shutil
from sqlalchemy.orm import Session
from app.database.connection import engine, SessionLocal, Base
from app.models.all_models import User, Device, Incident, DetectionEvent, NotificationToken, AuditLog
from app.core.security import get_password_hash
from app.core.config import settings

def init_database():
    print("[DB INIT] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("[DB INIT] Tables verified successfully.")

    db: Session = SessionLocal()
    try:
        # 1. Seed Default Admin User
        admin = db.query(User).filter(User.email == "admin@emergency.com").first()
        if not admin:
            admin = User(
                user_id="ADMIN-001",
                name="System Administrator",
                email="admin@emergency.com",
                hashed_password=get_password_hash("Admin@123456"),
                role="ADMIN",
                status="ACTIVE"
            )
            db.add(admin)
            print("[DB SEED] Created Admin user: admin@emergency.com (Password: Admin@123456)")

        # 2. Seed Default Demo Regular User
        demo_user = db.query(User).filter(User.email == "user@emergency.com").first()
        if not demo_user:
            demo_user = User(
                user_id="USER-001",
                name="Sounava Chakraborty",
                email="user@emergency.com",
                hashed_password=get_password_hash("User@123456"),
                role="USER",
                status="ACTIVE"
            )
            db.add(demo_user)
            print("[DB SEED] Created Demo user: user@emergency.com (Password: User@123456)")

        db.commit()

        # 3. Seed Sample Devices for USER-001
        wristband = db.query(Device).filter(Device.device_id == "WRIST-001").first()
        if not wristband:
            wristband = Device(
                device_id="WRIST-001",
                device_name="ESP32 Smart Wristband",
                device_type="WRISTBAND",
                owner_user_id="USER-001",
                connection_type="BLE",
                hardware_identifier="ESP32-DEV-WRIST-9812",
                pairing_code="123456",
                registration_status="CLAIMED",
                connection_status="CONNECTED",
                battery_level=92,
                last_bpm=74,
                last_latitude=22.572645,
                last_longitude=88.363892
            )
            db.add(wristband)
            print("[DB SEED] Created seed device WRIST-001")

        camera = db.query(Device).filter(Device.device_id == "CAM-001").first()
        if not camera:
            camera = Device(
                device_id="CAM-001",
                device_name="ESP32-CAM Highway Cam",
                device_type="ESP32_CAM",
                owner_user_id="USER-001",
                connection_type="WIFI",
                hardware_identifier="ESP32-CAM-OPT-4411",
                pairing_code="654321",
                registration_status="CLAIMED",
                connection_status="CONNECTED",
                last_latitude=22.574211,
                last_longitude=88.365402
            )
            db.add(camera)
            print("[DB SEED] Created seed device CAM-001")

        db.commit()

        # 4. Create uploads folder and sample accident snapshot
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        sample_img_dest = os.path.join(settings.UPLOAD_DIR, "mock_accident_sample.jpg")
        sample_img_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "ML_project", "test_images", "Pedestrian-accident-3.jpg")
        if os.path.exists(sample_img_src) and not os.path.exists(sample_img_dest):
            shutil.copy(sample_img_src, sample_img_dest)
            print("[DB SEED] Prepared sample test snapshot in uploads folder.")

    except Exception as e:
        db.rollback()
        print(f"[DB INIT ERROR] {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
