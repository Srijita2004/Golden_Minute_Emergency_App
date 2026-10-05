import pytest
import datetime
from fastapi.testclient import TestClient
from main import app
from app.database.connection import SessionLocal
from app.models.all_models import User, Device, Incident, DetectionEvent

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

# =========================================================================
# TEST SCENARIO 1: WRISTBAND & ABNORMAL BPM EMERGENCY
# =========================================================================
def test_scenario_1_wristband_emergency_flow():
    # 1. Register User
    reg_payload = {
        "name": "Scenario One User",
        "email": "scenario1@test.com",
        "password": "Password@123",
        "confirm_password": "Password@123"
    }
    r = client.post("/api/auth/register", json=reg_payload)
    assert r.status_code in [200, 400]
    
    # 2. Login
    login_payload = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=login_payload)
    assert r.status_code == 200
    token = r.json()["access_token"]
    user_id = r.json()["user"]["user_id"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Register FCM notification token for user's phone
    fcm_payload = {
        "platform": "ANDROID",
        "fcm_token": "fcm_test_token_user1_pixel7",
        "device_name": "Google Pixel 7"
    }
    r = client.post("/api/notifications/register-device", json=fcm_payload, headers=headers)
    assert r.status_code == 200

    # 4. Add Wristband
    wrist_payload = {
        "device_name": "Test ESP32 Wristband",
        "device_type": "WRISTBAND",
        "connection_type": "BLE",
        "hardware_identifier": "ESP32-WRIST-TEST-01",
        "pairing_code": "123456"
    }
    r = client.post("/api/devices/register", json=wrist_payload, headers=headers)
    assert r.status_code == 200
    device_id = r.json()["device_id"]

    # 5. Connect Wristband
    r = client.post(f"/api/devices/{device_id}/connect", headers=headers)
    assert r.status_code == 200
    assert r.json()["connection_status"] == "CONNECTED"

    # 6. Receive Normal BPM telemetry (heartbeat)
    hb_payload = {"bpm": 72, "battery_level": 95, "latitude": 22.5726, "longitude": 88.3639}
    r = client.post(f"/api/devices/{device_id}/heartbeat", json=hb_payload)
    assert r.status_code == 200
    assert r.json()["last_bpm"] == 72

    # 7. Trigger simulated abnormal BPM (152 BPM Tachycardia)
    event_id = f"EVENT-TEST-WRIST-{datetime.datetime.utcnow().timestamp()}"
    incident_payload = {
        "event_id": event_id,
        "device_id": device_id,
        "bpm": 152,
        "latitude": 22.5726,
        "longitude": 88.3639,
        "battery_level": 94
    }
    r = client.post("/api/incidents/wristband", json=incident_payload)
    assert r.status_code == 200
    incident_data = r.json()
    assert incident_data["incident_type"] == "ABNORMAL_PULSE"
    assert incident_data["status"] == "ACTIVE"
    incident_id = incident_data["incident_id"]

    # 8. Check Active Emergency Alerts stream (simulates FCM arrival & user notification siren)
    r = client.get("/api/notifications/active-alerts", headers=headers)
    assert r.status_code == 200
    alerts = r.json()["alerts"]
    assert len(alerts) > 0
    assert alerts[0]["data"]["incidentId"] == incident_id

    # 9. Tap Alert -> Open Exact Incident Details
    r = client.get(f"/api/incidents/{incident_id}", headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["incident_id"] == incident_id
    assert detail["events"][0]["bpm"] == 152
    assert detail["events"][0]["location_status"] == "AVAILABLE"
    assert detail["events"][0]["latitude"] == 22.5726

# =========================================================================
# TEST SCENARIO 2: ESP32-CAM ACCIDENT DETECTION & SNAPSHOT
# =========================================================================
def test_scenario_2_camera_accident_flow():
    # Login as User
    login_payload = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=login_payload)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Register ESP32-CAM
    cam_payload = {
        "device_name": "Highway Camera 4",
        "device_type": "ESP32_CAM",
        "connection_type": "WIFI",
        "hardware_identifier": "ESP32-CAM-HW-04",
        "pairing_code": "999888"
    }
    r = client.post("/api/devices/register", json=cam_payload, headers=headers)
    assert r.status_code == 200
    cam_device_id = r.json()["device_id"]

    # Simulate Camera Accident Detection with GPS
    event_id = f"EVENT-CAM-004-{datetime.datetime.utcnow().timestamp()}"
    form_data = {
        "event_id": event_id,
        "device_id": cam_device_id,
        "detection_status": "ACCIDENT_DETECTED",
        "confidence": "0.912",
        "latitude": "22.5801",
        "longitude": "88.3712"
    }
    files = {"image": ("crash.jpg", b"fake-jpeg-image-bytes-header", "image/jpeg")}
    r = client.post("/api/incidents/camera", data=form_data, files=files)
    assert r.status_code == 200
    incident = r.json()
    assert incident["incident_type"] == "ROAD_ACCIDENT"
    assert incident["status"] == "ACTIVE"
    inc_id = incident["incident_id"]

    # Verify Details + GPS coordinates
    r = client.get(f"/api/incidents/{inc_id}", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["events"][0]["source_type"] == "ESP32_CAM"
    assert data["events"][0]["latitude"] == 22.5801
    assert data["events"][0]["longitude"] == 88.3712
    assert data["events"][0]["image_url"] is not None

# =========================================================================
# TEST SCENARIO 3: PHONE AI CAMERA & PHONE GPS
# =========================================================================
def test_scenario_3_phone_ai_camera_flow():
    login_payload = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=login_payload)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    event_id = f"EVENT-PHONE-{datetime.datetime.utcnow().timestamp()}"
    form_data = {
        "event_id": event_id,
        "incident_type": "ROAD_ACCIDENT",
        "confidence": "0.875",
        "latitude": "22.5699",
        "longitude": "88.3611",
        "location_accuracy": "4.5"
    }
    files = {"image": ("phone_cam.jpg", b"phone-snapshot-binary-data", "image/jpeg")}
    r = client.post("/api/incidents/mobile-camera", data=form_data, files=files, headers=headers)
    assert r.status_code == 200
    incident = r.json()
    assert incident["incident_type"] == "ROAD_ACCIDENT"
    inc_id = incident["incident_id"]

    # Verify Details
    r = client.get(f"/api/incidents/{inc_id}", headers=headers)
    assert r.status_code == 200
    ev = r.json()["events"][0]
    assert ev["source_type"] == "MOBILE_CAMERA"
    assert ev["latitude"] == 22.5699
    assert ev["longitude"] == 88.3611

# =========================================================================
# TEST SCENARIO 4: UNPAIR / REMOVE DEVICE & RE-REGISTER
# =========================================================================
def test_scenario_4_device_unpair_and_reregister():
    login_payload = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=login_payload)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add temporary device
    reg_payload = {
        "device_name": "Temporary Wristband",
        "device_type": "WRISTBAND",
        "connection_type": "BLE",
        "hardware_identifier": "ESP32-TEMP-777",
        "pairing_code": "000000"
    }
    r = client.post("/api/devices/register", json=reg_payload, headers=headers)
    assert r.status_code == 200
    dev_id = r.json()["device_id"]

    # Disconnect
    r = client.post(f"/api/devices/{dev_id}/disconnect", headers=headers)
    assert r.status_code == 200
    assert r.json()["connection_status"] == "DISCONNECTED"

    # Remove/Unpair
    r = client.delete(f"/api/devices/{dev_id}", headers=headers)
    assert r.status_code == 200

    # Verify removed
    r = client.get(f"/api/devices/{dev_id}", headers=headers)
    assert r.status_code == 404

    # Register replacement device
    new_reg = {
        "device_name": "Replacement Wristband V2",
        "device_type": "WRISTBAND",
        "connection_type": "BLE",
        "hardware_identifier": "ESP32-V2-888",
        "pairing_code": "111222"
    }
    r = client.post("/api/devices/register", json=new_reg, headers=headers)
    assert r.status_code == 200
    assert r.json()["device_name"] == "Replacement Wristband V2"

# =========================================================================
# TEST SCENARIO 5: ADMIN LOGIN & RBAC SECURITY
# =========================================================================
def test_scenario_5_admin_security_and_visibility():
    # 1. Admin Login
    admin_login = {"email": "admin@emergency.com", "password": "Admin@123456"}
    r = client.post("/api/auth/login", json=admin_login)
    assert r.status_code == 200
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. View System Stats
    r = client.get("/api/admin/system-status", headers=admin_headers)
    assert r.status_code == 200
    stats = r.json()
    assert "total_users" in stats
    assert "total_devices" in stats
    assert "system_status" in stats

    # 3. View Users (verify passwords/secrets are NEVER exposed)
    r = client.get("/api/admin/users", headers=admin_headers)
    assert r.status_code == 200
    users = r.json()["users"]
    assert len(users) > 0
    for u in users:
        assert "hashed_password" not in u
        assert "password" not in u
        assert "reset_token" not in u

    # 4. View Devices (verify pairing codes/secrets are NEVER exposed)
    r = client.get("/api/admin/devices", headers=admin_headers)
    assert r.status_code == 200
    devices = r.json()["devices"]
    for d in devices:
        assert "pairing_code" not in d

    # 5. Non-admin forbidden check
    user_login = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=user_login)
    user_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    r = client.get("/api/admin/system-status", headers=user_headers)
    assert r.status_code == 403 # Forbidden!

# =========================================================================
# TEST SCENARIO 6: IDEMPOTENCY / DUPLICATE ACCIDENT PREVENTION
# =========================================================================
def test_duplicate_accident_prevention_idempotency():
    login_payload = {"email": "scenario1@test.com", "password": "Password@123"}
    r = client.post("/api/auth/login", json=login_payload)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    duplicate_event_id = "EVENT-CAM-RETRY-00028"
    form_data = {
        "event_id": duplicate_event_id,
        "device_id": "CAM-001",
        "detection_status": "ACCIDENT_DETECTED",
        "confidence": "0.88",
        "latitude": "22.5742",
        "longitude": "88.3654"
    }

    # First delivery
    r1 = client.post("/api/incidents/camera", data=form_data)
    assert r1.status_code == 200
    inc1 = r1.json()["incident_id"]

    # ESP32 network retry delivery with same event_id
    r2 = client.post("/api/incidents/camera", data=form_data)
    assert r2.status_code == 200
    inc2 = r2.json()["incident_id"]

    # Must NOT create a second accident incident!
    assert inc1 == inc2

# =========================================================================
# TEST SCENARIO 7: USER DATA ISOLATION (ZERO CROSS-USER LEAKAGE)
# =========================================================================
def test_cross_user_data_isolation():
    # Register User A
    client.post("/api/auth/register", json={
        "name": "User Alpha", "email": "alpha@test.com", "password": "Password@123", "confirm_password": "Password@123"
    })
    r_a = client.post("/api/auth/login", json={"email": "alpha@test.com", "password": "Password@123"})
    token_a = r_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B
    client.post("/api/auth/register", json={
        "name": "User Beta", "email": "beta@test.com", "password": "Password@123", "confirm_password": "Password@123"
    })
    r_b = client.post("/api/auth/login", json={"email": "beta@test.com", "password": "Password@123"})
    token_b = r_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A registers a private device
    r_dev = client.post("/api/devices/register", json={
        "device_name": "Alpha Private Wrist", "device_type": "WRISTBAND", "connection_type": "BLE"
    }, headers=headers_a)
    dev_a_id = r_dev.json()["device_id"]

    # User B attempts to access User A's private device -> HTTP 403 Forbidden!
    r_access = client.get(f"/api/devices/{dev_a_id}", headers=headers_b)
    assert r_access.status_code == 403
