import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from main import app
from app.database.connection import SessionLocal
from app.models.all_models import User
from app.core.security import create_access_token, get_password_hash

client = TestClient(app)

def setup_users():
    db = SessionLocal()
    # Ensure Admin, Hospital, User A, and User B exist
    users_to_ensure = [
        ("ADMIN-001", "Admin User", "admin@emergency.com", "ADMIN"),
        ("HOSPITAL-001", "City Hospital", "hospital@emergency.com", "HOSPITAL"),
        ("USER-001", "Victim User A", "user_a@emergency.com", "USER"),
        ("USER-002", "Unrelated User B", "user_b@emergency.com", "USER")
    ]
    for uid, name, email, role in users_to_ensure:
        u = db.query(User).filter(User.user_id == uid).first()
        if not u:
            u = User(
                user_id=uid,
                name=name,
                email=email,
                hashed_password=get_password_hash("Password123!"),
                role=role,
                status="ACTIVE"
            )
            db.add(u)
    db.commit()
    db.close()

def test_rbac_and_alert_fan_out():
    setup_users()

    admin_token = create_access_token({"sub": "ADMIN-001"})
    hospital_token = create_access_token({"sub": "HOSPITAL-001"})
    user_a_token = create_access_token({"sub": "USER-001"})
    user_b_token = create_access_token({"sub": "USER-002"})

    # =========================================================================
    # TEST 1: User A Phone AI Incident
    # =========================================================================
    event_id_a = f"EVENT-TEST-A-{time.time()}"
    r_create_a = client.post(
        "/api/incidents/mobile-camera",
        headers={"Authorization": f"Bearer {user_a_token}"},
        data={
            "event_id": event_id_a,
            "incident_type": "ROAD_ACCIDENT",
            "confidence": 0.89,
            "latitude": 22.5726,
            "longitude": 88.3639
        }
    )
    assert r_create_a.status_code == 200, f"Failed to create mobile incident: {r_create_a.text}"
    inc_a_id = r_create_a.json()["incident_id"]
    print(f"\n[TEST 1] Created Phone AI Incident for User A: {inc_a_id}")

    # Check active-alerts for User A (Owner -> MUST receive)
    res_a = client.get("/api/notifications/active-alerts", headers={"Authorization": f"Bearer {user_a_token}"})
    assert res_a.status_code == 200
    ids_a = [a["data"]["incidentId"] for a in res_a.json()["alerts"]]
    assert inc_a_id in ids_a, "Owner User A did NOT receive own incident alert!"
    print("  -> User A (Owner) received own alert: PASS")

    # Check active-alerts for User B (Unrelated -> MUST NOT receive)
    res_b = client.get("/api/notifications/active-alerts", headers={"Authorization": f"Bearer {user_b_token}"})
    assert res_b.status_code == 200
    ids_b = [a["data"]["incidentId"] for a in res_b.json()["alerts"]]
    assert inc_a_id not in ids_b, "Security breach: User B received User A's private alert!"
    print("  -> User B (Unrelated) did NOT receive User A alert: PASS")

    # Check active-alerts for Admin (Global scope -> MUST receive)
    res_admin = client.get("/api/notifications/active-alerts", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    ids_admin = [a["data"]["incidentId"] for a in res_admin.json()["alerts"]]
    assert inc_a_id in ids_admin, "Admin did NOT receive global alert for User A's incident!"
    print("  -> Admin received global emergency alert: PASS")

    # Check active-alerts for Hospital (Global scope -> MUST receive)
    res_hosp = client.get("/api/notifications/active-alerts", headers={"Authorization": f"Bearer {hospital_token}"})
    assert res_hosp.status_code == 200
    ids_hosp = [a["data"]["incidentId"] for a in res_hosp.json()["alerts"]]
    assert inc_a_id in ids_hosp, "Hospital did NOT receive global emergency alert!"
    print("  -> Hospital received global emergency alert: PASS")

    # Verify User B cannot access User A's private incident details (403 Forbidden)
    r_forbidden = client.get(f"/api/incidents/{inc_a_id}", headers={"Authorization": f"Bearer {user_b_token}"})
    assert r_forbidden.status_code == 403, f"Expected 403 Forbidden, got {r_forbidden.status_code}"
    print("  -> User B blocked from viewing User A incident details (403): PASS")

    # Verify Hospital can access User A's incident details (200 OK)
    r_hosp_detail = client.get(f"/api/incidents/{inc_a_id}", headers={"Authorization": f"Bearer {hospital_token}"})
    assert r_hosp_detail.status_code == 200, f"Hospital was blocked from incident details: {r_hosp_detail.status_code}"
    print("  -> Hospital successfully accessed incident details (200): PASS")

    # =========================================================================
    # TEST 2: Simulated Wristband Incident (Sensor evidence, NO fake image)
    # =========================================================================
    event_id_wb = f"EVENT-TEST-WB-{time.time()}"
    r_create_wb = client.post(
        "/api/incidents/wristband",
        json={
            "event_id": event_id_wb,
            "device_id": "WRIST-001",
            "bpm": 142,
            "latitude": 22.5801,
            "longitude": 88.3712,
            "battery_level": 88
        }
    )
    assert r_create_wb.status_code == 200, f"Wristband incident failed: {r_create_wb.text}"
    inc_wb_id = r_create_wb.json()["incident_id"]
    print(f"\n[TEST 2] Created Wristband Incident: {inc_wb_id}")

    # Verify Wristband payload details: BPM present, image is None/empty
    r_wb_detail = client.get(f"/api/incidents/{inc_wb_id}", headers={"Authorization": f"Bearer {hospital_token}"})
    wb_data = r_wb_detail.json()
    assert wb_data["incident_type"] == "ABNORMAL_PULSE"
    assert len(wb_data["events"]) > 0
    wb_event = wb_data["events"][0]
    assert wb_event["bpm"] == 142
    assert wb_event["image_url"] is None or wb_event["image_url"] == ""
    print("  -> Wristband sensor metadata verified: BPM=142, Image=None (no fake image): PASS")

    # =========================================================================
    # TEST 3: Incident Acknowledgment (ACKNOWLEDGED != RESOLVED)
    # =========================================================================
    r_ack = client.patch(
        f"/api/incidents/{inc_a_id}/status",
        headers={"Authorization": f"Bearer {hospital_token}"},
        json={"status": "ACKNOWLEDGED"}
    )
    assert r_ack.status_code == 200
    assert r_ack.json()["status"] == "ACKNOWLEDGED"
    assert r_ack.json()["status"] != "RESOLVED"
    print(f"\n[TEST 3] Incident {inc_a_id} marked ACKNOWLEDGED (preserved from RESOLVED): PASS")

    # =========================================================================
    # TEST 4: VAPID Public Key Endpoint
    # =========================================================================
    r_vapid = client.get("/api/notifications/vapid-public-key")
    assert r_vapid.status_code == 200
    pub_k = r_vapid.json().get("publicKey")
    assert pub_k and len(pub_k) > 20
    print(f"\n[TEST 4] VAPID Public Key endpoint verified: Length {len(pub_k)}: PASS")

    print("\n" + "=" * 70)
    print(" ALL BACKEND RBAC, CENTRAL FAN-OUT & NOTIFICATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_rbac_and_alert_fan_out()
