# System Installation & Setup Guide

This guide describes how to install and configure the entire **AI-Based Accident Detection & Emergency Response System** from scratch.

---

## Prerequisites

1. **Python 3.10+** (Python 3.13 supported)
2. **Node.js 18+** (Node.js v24.19 supported) and **npm**
3. **PostgreSQL 13+** (or built-in SQLite development mode for zero-setup local dev)

---

## 1. Backend Installation

```bash
# Navigate to backend directory
cd accident-response-system/backend

# (Optional) Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Configuration
Copy `.env.example` or create a `.env` file in `backend/`:
```env
PROJECT_NAME="AI-Based Accident Detection & Emergency Response System"
SECRET_KEY="super-secret-jwt-emergency-key-change-in-production"
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database:
# For production PostgreSQL:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/accident_db"
# For development SQLite:
DATABASE_URL="sqlite:///./accident_response.db"

# Hardware UUID Placeholders
BLE_SERVICE_UUID="<CONFIGURE_BLE_SERVICE_UUID_LATER>"
BLE_CHARACTERISTIC_UUID_PULSE="<CONFIGURE_BLE_CHAR_PULSE_LATER>"
BLE_CHARACTERISTIC_UUID_GPS="<CONFIGURE_BLE_CHAR_GPS_LATER>"

# Notification & Maps
FCM_SERVER_KEY="<CONFIGURE_FCM_SERVER_KEY_LATER>"
GOOGLE_MAPS_API_KEY="<CONFIGURE_GOOGLE_MAPS_KEY_LATER>"

# ML Weights
ROAD_MODEL_PATH="D:/accident/accident/road_expanded_best.pt"
FALL_MODEL_PATH="D:/accident/accident/fall_expanded_best.pt"
```

Initialize the database schema:
```bash
python -m app.database.init_db
```

Start the API server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 2. Frontend Installation

```bash
# Navigate to frontend directory
cd accident-response-system/frontend

# Install node dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will run at `http://localhost:3000`.

---

## 3. Verifying the Installation

Run automated test suite:
```bash
cd accident-response-system/backend
python -m pytest tests/test_scenarios.py -v
```
All 8 integration tests should return `PASSED`.
