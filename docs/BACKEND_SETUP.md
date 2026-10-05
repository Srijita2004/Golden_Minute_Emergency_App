# Backend Server Setup & Architecture Guide

The backend server is built using **FastAPI**, **SQLAlchemy 2.0**, **Pydantic v2**, and **PyJWT**.

---

## 1. Modular Architecture

```
backend/app/
├── api/             # HTTP Route Handlers
│   ├── auth.py      # Registration, Login, Refresh, Password Reset
│   ├── devices.py   # Discovery, Registration, Connect, Heartbeat
│   ├── incidents.py # Camera, Wristband, Mobile Camera ingestion
│   ├── notifications.py # FCM token registration and alert feed
│   ├── admin.py     # Administrative stats, users, devices, audit logs
│   └── mock.py      # Mock Hardware Simulation endpoints
├── core/            # Configuration and security primitives
├── models/          # SQLAlchemy Database entities
├── schemas/         # Pydantic request & response validators
├── services/        # Business logic & ownership rules
├── adapters/        # Replaceable hardware and AI adapters
└── database/        # Database initialization & PostgreSQL schema
```

---

## 2. Running Backend Server

```bash
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at:
`http://localhost:8000/docs`
