# Comprehensive Testing Guide

This guide describes how to run both automated end-to-end integration tests and manual interactive testing using the built-in **Mock Hardware Studio**.

---

## 1. Automated Test Suite (Pytest)

The automated test suite in `backend/tests/test_scenarios.py` verifies all 5 critical project scenarios plus idempotency and cross-user isolation:

```bash
cd backend
python -m pytest tests/test_scenarios.py -v
```

### Verification Matrix
* **Scenario 1**: Register -> Login -> Pair Wristband -> Connect -> Receive BPM -> Trigger abnormal pulse (152 BPM) -> Verify Incident created -> Verify GPS stored -> Verify FCM notification dispatched -> Tap Alert -> Open exact incident.
* **Scenario 2**: Login -> Add ESP32-CAM -> Connect -> Simulate ML Accident -> Upload snapshot image -> Verify incident -> Verify coordinates -> Open details & map.
* **Scenario 3**: Login -> Phone AI Camera -> Verify Front/Rear camera modes -> Phone GPS -> Trigger mobile accident -> Verify incident & stored coordinates.
* **Scenario 4**: Disconnect wristband -> Remove device -> Pair replacement wristband -> Verify ownership updated.
* **Scenario 5**: Admin login -> View system metrics -> Verify user inventory -> Verify device inventory -> Verify passwords and secrets are strictly hidden from admin responses.
* **Scenario 6**: Idempotency & duplicate prevention (delivering the same `event_id` repeatedly creates zero duplicate incidents).
* **Scenario 7**: Cross-user data isolation (User B is forbidden via HTTP 403 from inspecting User A's private devices).

---

## 2. Interactive Testing via Mock Hardware Studio

Launch both servers:
1. Backend: `python -m uvicorn main:app --host 0.0.0.0 --port 8000`
2. Frontend: `npm run dev`
3. Log into `http://localhost:3000` using `user@emergency.com` / `User@123456`.
4. Click **Mock Studio** in the top navigation bar.
5. In the simulator cards:
   * Click **Tachycardia (152 BPM)** -> Observe the high-priority alarm siren synthesize audio, the red heads-up banner appear, and clicking **Open Exact Incident** navigates directly to the incident with the Leaflet map and Google Maps link!
   * Click **Simulate Road Crash** -> Observe the ESP32-CAM optical hazard incident trigger and display the crash snapshot!
