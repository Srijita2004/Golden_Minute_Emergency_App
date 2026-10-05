import datetime
from typing import Dict, Any, Optional
from app.adapters.base import BaseDeviceManager
from app.core.config import settings

class BleDeviceManager(BaseDeviceManager):
    """
    Adapter for Bluetooth Low Energy (BLE) peripheral communications.
    Hardware team will configure specific UUIDs when physical ESP32 boards arrive.
    """
    def __init__(self):
        self.service_uuid = settings.BLE_SERVICE_UUID
        self.char_pulse_uuid = settings.BLE_CHARACTERISTIC_UUID_PULSE
        self.char_gps_uuid = settings.BLE_CHARACTERISTIC_UUID_GPS
        self.connected_sessions: Dict[str, Dict[str, Any]] = {}

    def connect_device(self, hardware_id: str, connection_params: Dict[str, Any]) -> bool:
        # Registers device session (Mockable or physical BLE GATT connection)
        self.connected_sessions[hardware_id] = {
            "connected_at": datetime.datetime.utcnow(),
            "params": connection_params,
            "status": "CONNECTED"
        }
        return True

    def disconnect_device(self, hardware_id: str) -> bool:
        if hardware_id in self.connected_sessions:
            del self.connected_sessions[hardware_id]
        return True

    def get_status(self, hardware_id: str) -> str:
        if hardware_id in self.connected_sessions:
            return "CONNECTED"
        return "DISCONNECTED"


class WifiDeviceManager(BaseDeviceManager):
    """
    Adapter for Wi-Fi enabled devices (e.g. ESP32-CAM streaming snapshots over HTTP POST / WebSockets).
    """
    def __init__(self):
        self.active_endpoints: Dict[str, Dict[str, Any]] = {}

    def connect_device(self, hardware_id: str, connection_params: Dict[str, Any]) -> bool:
        self.active_endpoints[hardware_id] = {
            "ip_address": connection_params.get("ip_address", "192.168.4.1"),
            "connected_at": datetime.datetime.utcnow(),
            "status": "CONNECTED"
        }
        return True

    def disconnect_device(self, hardware_id: str) -> bool:
        if hardware_id in self.active_endpoints:
            del self.active_endpoints[hardware_id]
        return True

    def get_status(self, hardware_id: str) -> str:
        if hardware_id in self.active_endpoints:
            return "CONNECTED"
        return "DISCONNECTED"


class WristbandDeviceAdapter:
    """
    Processes telemetry data coming from ESP32 DevKit wristband.
    Evaluates heart-rate / pulse using configurable thresholds (not hardcoded universal facts).
    """
    def __init__(self, low_threshold: int = settings.ABNORMAL_BPM_LOW, high_threshold: int = settings.ABNORMAL_BPM_HIGH):
        self.low_threshold = low_threshold
        self.high_threshold = high_threshold

    def evaluate_pulse(self, bpm: int) -> Dict[str, Any]:
        """
        Determines whether pulse reading constitutes an emergency event (bradycardia / severe tachycardia).
        """
        if bpm <= 0:
            return {"is_abnormal": False, "condition": "SENSOR_DISCONNECTED"}
        
        if bpm < self.low_threshold:
            return {
                "is_abnormal": True,
                "condition": "SEVERE_BRADYCARDIA",
                "severity": "CRITICAL",
                "message": f"Critical low heart rate detected: {bpm} BPM (threshold: <{self.low_threshold})"
            }
        elif bpm > self.high_threshold:
            return {
                "is_abnormal": True,
                "condition": "SEVERE_TACHYCARDIA",
                "severity": "CRITICAL",
                "message": f"Critical high heart rate detected: {bpm} BPM (threshold: >{self.high_threshold})"
            }
        
        return {"is_abnormal": False, "condition": "NORMAL", "message": f"Normal pulse: {bpm} BPM"}


class ExternalCameraAdapter:
    """
    Handles payload packaging and metadata verification for ESP32-CAM accident camera.
    """
    def parse_camera_payload(self, raw_payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "event_id": raw_payload.get("eventId") or raw_payload.get("event_id"),
            "device_id": raw_payload.get("deviceId") or raw_payload.get("device_id"),
            "detection_status": raw_payload.get("detectionStatus") or raw_payload.get("detection_status", "ACCIDENT_DETECTED"),
            "confidence": float(raw_payload.get("confidence", 0.85)),
            "latitude": raw_payload.get("latitude"),
            "longitude": raw_payload.get("longitude"),
            "timestamp": raw_payload.get("timestamp") or datetime.datetime.utcnow()
        }


class DeviceConnectionManager:
    """
    Unified manager routing devices to appropriate connection managers (BLE vs. Wi-Fi).
    """
    def __init__(self):
        self.ble_manager = BleDeviceManager()
        self.wifi_manager = WifiDeviceManager()
        self.wristband_adapter = WristbandDeviceAdapter()
        self.camera_adapter = ExternalCameraAdapter()

    def connect(self, connection_type: str, hardware_id: str, params: Optional[Dict[str, Any]] = None) -> bool:
        params = params or {}
        if connection_type.upper() == "BLE":
            return self.ble_manager.connect_device(hardware_id, params)
        elif connection_type.upper() == "WIFI":
            return self.wifi_manager.connect_device(hardware_id, params)
        return True

    def disconnect(self, connection_type: str, hardware_id: str) -> bool:
        if connection_type.upper() == "BLE":
            return self.ble_manager.disconnect_device(hardware_id)
        elif connection_type.upper() == "WIFI":
            return self.wifi_manager.disconnect_device(hardware_id)
        return True

device_connection_manager = DeviceConnectionManager()
