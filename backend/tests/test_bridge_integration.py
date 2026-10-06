import os
import sys
from pathlib import Path
import io

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ML_PROJECT_DIR = PROJECT_ROOT / "ML_project"
APP_BACKEND_DIR = PROJECT_ROOT / "Golden_Minute_Emergency_App" / "backend"

sys.path.insert(0, str(ML_PROJECT_DIR))
sys.path.insert(0, str(APP_BACKEND_DIR))

# Import ML service app
import app_final
from app_final import app as ml_flask_app

# Import Golden Minute backend components
from app.database.connection import SessionLocal
from app.models.all_models import Incident, DetectionEvent, Device, User
from app.services.incident_service import IncidentService
from app.adapters.ai_adapter import ai_inference_provider

def run_integration_pipeline_test():
    print("=" * 80)
    print(" 🧪 RUNNING END-TO-END BRIDGE INTEGRATION TEST")
    print("=" * 80)

    ml_client = ml_flask_app.test_client()
    db = SessionLocal()

    try:
        # ---------------------------------------------------------------------
        # STEP 1: Verify Seed Device & User Exist
        # ---------------------------------------------------------------------
        print("\n[STEP 1] Verifying Device CAM-001 in Database...")
        cam_device = db.query(Device).filter(Device.device_id == "CAM-001").first()
        assert cam_device is not None, "CAM-001 not found in DB!"
        print(f"✅ Found Device: {cam_device.device_id} ({cam_device.device_name}), Owner: {cam_device.owner_user_id}")

        # ---------------------------------------------------------------------
        # STEP 2: ML Inference on Real Road Accident Test Image
        # ---------------------------------------------------------------------
        accident_img_path = ML_PROJECT_DIR / "test_images" / "skynews-car-crash-goodmayes_7250187.jpg"
        print(f"\n[STEP 2] Simulating Camera Optical Feed with Image: {accident_img_path.name}")
        assert accident_img_path.exists(), f"Image not found at {accident_img_path}"
        img_bytes = accident_img_path.read_bytes()

        print("--> Posting frame bytes to ML /predict...")
        ml_resp = ml_client.post("/predict", data=img_bytes, content_type="application/octet-stream")
        assert ml_resp.status_code == 200, f"ML API returned {ml_resp.status_code}"
        ml_data = ml_resp.get_json()

        print(f"--> ML Response: {ml_data}")
        assert ml_data.get("accident") is True, "Expected accident == True!"
        assert ml_data.get("type") == "road_vehicle_accident"
        accident_type = ml_data.get("type")
        confidence = float(ml_data.get("score", 0.85))
        print(f"✅ ML Detection Confirmed: {accident_type} (Confidence: {confidence:.4f})")

        # ---------------------------------------------------------------------
        # STEP 3: Dispatch Incident to Golden Minute Pipeline (as ESP32-CAM does)
        # ---------------------------------------------------------------------
        print("\n[STEP 3] ESP32-CAM Dispatches Detection to Golden Minute Backend...")
        event_id = f"TEST-EVENT-CAM-001-{int(os.times().elapsed * 1000)}"

        # Save snapshot into uploads
        upload_dir = APP_BACKEND_DIR / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        snapshot_filename = f"test_{event_id}.jpg"
        snapshot_path = upload_dir / snapshot_filename
        snapshot_path.write_bytes(img_bytes)
        image_url = f"/uploads/{snapshot_filename}"

        incident = IncidentService.handle_camera_incident(
            db=db,
            event_id=event_id,
            device_id="CAM-001",
            detection_status="ACCIDENT_DETECTED",
            confidence=confidence,
            latitude=22.580120,
            longitude=88.371250,
            image_url=image_url
        )

        print(f"✅ Incident Created Successfully: {incident.incident_id}")
        print(f"   Owner User ID  : {incident.owner_user_id}")
        print(f"   Incident Type  : {incident.incident_type}")
        print(f"   Incident Status: {incident.status}")
        print(f"   Summary        : {incident.summary}")

        # ---------------------------------------------------------------------
        # STEP 4: Verify Event in Database
        # ---------------------------------------------------------------------
        print("\n[STEP 4] Verifying Event Record in DB...")
        event_record = db.query(DetectionEvent).filter(DetectionEvent.event_id == event_id).first()
        assert event_record is not None, "DetectionEvent record not found in DB!"
        assert event_record.incident_id == incident.incident_id
        assert event_record.source_type == "ESP32_CAM"
        assert event_record.source_device_id == "CAM-001"
        assert event_record.image_url == image_url
        assert event_record.latitude == 22.580120
        assert event_record.longitude == 88.371250
        print(f"✅ DetectionEvent Verified: Event {event_record.event_id} associated with Incident {event_record.incident_id}")

        # ---------------------------------------------------------------------
        # STEP 5: Negative Test (Normal Traffic Scene -> accident == False -> NO incident)
        # ---------------------------------------------------------------------
        normal_img_path = ML_PROJECT_DIR / "test_images" / "images (4).jpg"
        print(f"\n[STEP 5] Testing Normal Traffic Scene: {normal_img_path.name}")
        norm_bytes = normal_img_path.read_bytes()
        norm_resp = ml_client.post("/predict", data=norm_bytes, content_type="application/octet-stream")
        assert norm_resp.status_code == 200
        norm_data = norm_resp.get_json()
        print(f"--> ML Response: accident={norm_data.get('accident')}, result={norm_data.get('result')}")
        assert norm_data.get("accident") is False, "Normal traffic should NOT trigger an accident!"
        print("✅ Confirmed: accident == False. No emergency incident triggered for normal traffic.")

        print("\n" + "=" * 80)
        print(" 🏆 ALL INTEGRATION BRIDGE PIPELINE TESTS PASSED 100%!")
        print("=" * 80)

    finally:
        db.close()

if __name__ == "__main__":
    run_integration_pipeline_test()
