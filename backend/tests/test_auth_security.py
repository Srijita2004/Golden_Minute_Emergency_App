import pytest
from fastapi.testclient import TestClient
from main import app
from app.database.connection import SessionLocal
from app.models.all_models import User

client = TestClient(app)

def test_1_normal_registration_always_creates_user():
    """Verify that public registration produces an account with role = USER."""
    email = "test_normal_user@emergency.com"
    payload = {
        "name": "Jane Citizen",
        "email": email,
        "password": "SecurePassword@123",
        "confirm_password": "SecurePassword@123"
    }
    r = client.post("/api/auth/register", json=payload)
    if r.status_code == 400 and "already exists" in r.text:
        # If already exists, test login
        r = client.post("/api/auth/login", json={"email": email, "password": "SecurePassword@123"})
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["role"] == "USER"
    assert data["user"]["user_id"].startswith("USER-")

def test_2_privilege_escalation_prevention_role_in_normal_register():
    """
    CRITICAL SECURITY TEST:
    A malicious user attempting to pass 'role': 'ADMIN' in public user registration
    MUST NOT be granted ADMIN privileges.
    """
    email = "hacker_wannabe@emergency.com"
    malicious_payload = {
        "name": "Malicious Attacker",
        "email": email,
        "password": "AttackPassword@123",
        "confirm_password": "AttackPassword@123",
        "role": "ADMIN"  # Attempted privilege escalation
    }
    r = client.post("/api/auth/register", json=malicious_payload)
    if r.status_code == 400 and "already exists" in r.text:
        r = client.post("/api/auth/login", json={"email": email, "password": "AttackPassword@123"})
    assert r.status_code == 200
    data = r.json()
    
    # Must NOT be an admin!
    assert data["user"]["role"] == "USER", f"CRITICAL SECURITY FAILURE: User was assigned {data['user']['role']}!"
    assert not data["user"]["user_id"].startswith("ADMIN-")
    assert not data["user"]["user_id"].startswith("HOSP-")

def test_3_hospital_admin_registration_via_dedicated_flow():
    """Verify dedicated hospital registration flow correctly creates an ADMIN."""
    email = "city_trauma_director@hospital.org"
    hospital_payload = {
        "organization_name": "City Central Trauma Center",
        "operator_name": "Dr. Angela Vance",
        "email": email,
        "password": "HospitalAdmin@123",
        "confirm_password": "HospitalAdmin@123"
    }
    r = client.post("/api/auth/register-hospital", json=hospital_payload)
    if r.status_code == 400 and "already exists" in r.text:
        r = client.post("/api/auth/login", json={"email": email, "password": "HospitalAdmin@123"})
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["role"] == "ADMIN"
    assert "HOSP-" in data["user"]["user_id"] or "ADMIN-" in data["user"]["user_id"]
    assert "City Central Trauma Center" in data["user"]["name"]

def test_4_user_jwt_cannot_access_admin_endpoints():
    """Verify normal user JWT receives 403 Forbidden on GET /api/admin/incidents."""
    # Register/login normal user
    email = "regular_commuter@test.com"
    client.post("/api/auth/register", json={
        "name": "Regular Commuter",
        "email": email,
        "password": "Password@123",
        "confirm_password": "Password@123"
    })
    r_login = client.post("/api/auth/login", json={"email": email, "password": "Password@123"})
    assert r_login.status_code == 200
    user_token = r_login.json()["access_token"]

    # Attempt to access admin incident monitoring feed
    headers = {"Authorization": f"Bearer {user_token}"}
    r_admin = client.get("/api/admin/incidents", headers=headers)
    assert r_admin.status_code == 403, f"Expected 403 Forbidden, got {r_admin.status_code}"

def test_5_admin_jwt_can_access_admin_endpoints():
    """Verify hospital admin JWT successfully accesses GET /api/admin/incidents."""
    email = "lead_surgeon@trauma.gov"
    client.post("/api/auth/register-hospital", json={
        "organization_name": "Metropolitan Trauma Hospital",
        "operator_name": "Chief Surgeon Ross",
        "email": email,
        "password": "TraumaAdmin@123",
        "confirm_password": "TraumaAdmin@123"
    })
    r_login = client.post("/api/auth/login", json={"email": email, "password": "TraumaAdmin@123"})
    assert r_login.status_code == 200
    admin_token = r_login.json()["access_token"]

    # Access admin incident feed
    headers = {"Authorization": f"Bearer {admin_token}"}
    r_admin = client.get("/api/admin/incidents", headers=headers)
    assert r_admin.status_code == 200
    data = r_admin.json()
    assert "incidents" in data
    assert "total" in data
