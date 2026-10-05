# AI-Based Accident Detection & Emergency Response System
## Universal Golden Minute Multi-Hazard Dispatch Platform

An end-to-end mission-critical emergency response platform combining wearable biometric monitoring, optical AI accident surveillance, smartphone computer vision, and real-time emergency dispatching during the life-saving "Golden Minute" window.

---

## 🌟 System Overview & Three Detection Sources

```
                          ┌────────────────────────────────────────────────────────┐
                          │               THREE DETECTION SOURCES                  │
                          └────────────────────────────────────────────────────────┘
                                     │                     │                     │
                  ┌──────────────────┴──────────┐          │          ┌──────────┴──────────────────┐
                  ▼                             │          ▼          │                             ▼
      ┌─────────────────────────┐               │   ┌─────────────┐   │               ┌─────────────────────────┐
      │   1. EXTERNAL CAMERA    │               │   │2. WRISTBAND │   │               │   3. PHONE AI CAMERA    │
      │ ESP32-CAM + AI Model    │               │   │ESP32 DevKit │   │               │ Front/Rear YOLO Camera  │
      │ Snapshot + Fixed GPS    │               │   │Pulse + GPS  │   │               │ Live Snapshot + PhoneGPS│
      └───────────┬─────────────┘               │   └──────┬──────┘   │               └───────────┬─────────────┘
                  │                             │          │          │                           │
                  │ HTTP POST /incidents/camera │          │ BLE/HTTP │                           │ HTTP POST /mobile-camera
                  ▼                             │          ▼          │                           ▼
        ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
        │                        COMMON BACKEND INCIDENT MANAGEMENT PIPELINE                            │
        │             (Idempotency Deduplication, Device Ownership, Event Storage & Audit)             │
        └───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
        ┌───────────────────────────┐                                       ┌───────────────────────────┐
        │   PostgreSQL Database     │                                       │   Emergency Alert Engine  │
        │ - Users & Roles           │                                       │ - FCM High-Priority Push  │
        │ - Devices & Ownership     │                                       │ - Max-Priority Channel    │
        │ - Incidents & Events      │                                       │ - Siren Audio Synthesis   │
        │ - Historical GPS Audit    │                                       │ - Hardware Vibration      │
        └───────────────────────────┘                                       └─────────────┬─────────────┘
                                                                                          │
                                                        ┌─────────────────────────────────┴─────────────────────────────────┐
                                                        ▼                                                                   ▼
                                          ┌───────────────────────────┐                       ┌───────────────────────────┐
                                          │   User Mobile App         │                       │   Central Admin Dashboard │
                                          │ - Device Discovery & Pair │                       │ - Platform Health KPIs    │
                                          │ - Live Telemetry & Map    │                       │ - User & Device Inventory │
                                          │ - Exact Incident View     │                       │ - Incident Surveillance   │
                                          │ - Mock Hardware Studio    │                       │ - Zero Secrets Exposure   │
                                          └───────────────────────────┘                       └───────────────────────────┘
```

---

## 📦 Directory Structure

```
accident-response-system/
├── backend/
│   ├── app/
│   │   ├── api/             # REST Endpoints: auth, devices, incidents, notifications, admin, mock
│   │   ├── core/            # Config, Security, JWT tokens, bcrypt hashing
│   │   ├── database/        # SQLAlchemy engine, PostgreSQL schema.sql, init_db.py
│   │   ├── models/          # SQLAlchemy Data Models (User, Device, Incident, DetectionEvent, etc.)
│   │   ├── schemas/         # Pydantic validation schemas
│   │   ├── services/        # Business logic & ownership isolation
│   │   └── adapters/        # Replaceable hardware and AI interfaces
│   ├── tests/               # Pytest suite verifying Scenarios 1–5, Idempotency, Isolation
│   ├── uploads/             # Snapshot storage
│   ├── requirements.txt     # Python dependencies
│   └── main.py              # FastAPI server entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/      # Navbar, BottomNav, AlarmBanner, IncidentMap
│   │   ├── context/         # AuthContext, EmergencyAlertContext
│   │   ├── pages/
│   │   │   ├── user/        # Home, MyDevices, WristbandDetail, CameraDetail, PhoneCamera, Incidents, IncidentDetail, Profile, MockHardwareHub, Login, Register
│   │   │   └── admin/       # Central Admin Dashboard, Users, Devices, Incidents, Audit Logs
│   │   ├── services/        # API Client
│   │   └── App.tsx          # Router configuration
│   ├── vite.config.ts       # Vite proxy to backend port 8000
│   └── package.json         # React 19 + TypeScript + Tailwind CSS
└── docs/                    # Complete setup, integration, and hardware guides
```

---

## ⚡ Quick Start

### 1. Start Backend Server
```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 2. Start Frontend App
```bash
cd frontend
npm run dev
```
Open in browser or mobile viewport at: `http://localhost:3000`

---

## 🔑 Default Accounts (Pre-Seeded)

| Account Type | Email | Password | Role | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | `admin@emergency.com` | `Admin@123456` | `ADMIN` | Central Admin Dashboard, Device Inventory, System Audits |
| **Demo User** | `user@emergency.com` | `User@123456` | `USER` | Personal Devices (`WRIST-001`, `CAM-001`), Incidents, Phone Cam |
