import os
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings

from app.database.init_db import init_database
from app.api import auth, devices, incidents, notifications, admin, mock

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Unified API Server for AI-Based Accident Detection & Emergency Response System",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads folder exists and mount static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(devices.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(mock.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def on_startup():
    init_database()

@app.get("/api/health")
def health_check():
    ml_status = "unreachable"
    try:
        r = requests.get(f"{settings.ML_SERVICE_URL.rstrip('/')}/", timeout=5)
        if r.status_code == 200:
            ml_status = "connected"
        else:
            ml_status = f"http_{r.status_code}"
    except Exception as e:
        ml_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "connected",
        "ml_service": {
            "url": settings.ML_SERVICE_URL,
            "status": ml_status
        },
        "mock_mode": True
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
