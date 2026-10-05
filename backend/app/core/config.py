import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "AI-Based Accident Detection & Emergency Response System"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-jwt-emergency-key-981247192")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database Configuration (PostgreSQL in production, SQLite fallback in dev)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./accident_response.db")

    # Uploads directory
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads")

    # Firebase / FCM Configuration Placeholders
    FCM_SERVER_KEY: str = os.getenv("FCM_SERVER_KEY", "<CONFIGURE_FCM_SERVER_KEY_LATER>")
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "<CONFIGURE_FIREBASE_CREDENTIALS_PATH_LATER>")

    # Google Maps API Key Placeholder
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "<CONFIGURE_GOOGLE_MAPS_KEY_LATER>")

    # ESP32 BLE Hardware UUID Placeholders (as required in prompt)
    BLE_SERVICE_UUID: str = os.getenv("BLE_SERVICE_UUID", "<CONFIGURE_BLE_SERVICE_UUID_LATER>")
    BLE_CHARACTERISTIC_UUID_PULSE: str = os.getenv("BLE_CHARACTERISTIC_UUID_PULSE", "<CONFIGURE_BLE_CHAR_PULSE_LATER>")
    BLE_CHARACTERISTIC_UUID_GPS: str = os.getenv("BLE_CHARACTERISTIC_UUID_GPS", "<CONFIGURE_BLE_CHAR_GPS_LATER>")

    # ML Model Path Placeholders
    ROAD_MODEL_PATH: str = os.getenv("ROAD_MODEL_PATH", "D:/accident/accident/road_expanded_best.pt")
    FALL_MODEL_PATH: str = os.getenv("FALL_MODEL_PATH", "D:/accident/accident/fall_expanded_best.pt")

    # Heartbeat & Offline thresholds
    DEVICE_OFFLINE_THRESHOLD_SECONDS: int = 90
    ABNORMAL_BPM_LOW: int = 45
    ABNORMAL_BPM_HIGH: int = 130

settings = Settings()
