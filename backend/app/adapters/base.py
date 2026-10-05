from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple

class BaseDeviceManager(ABC):
    """Abstract interface for managing device communication channels."""

    @abstractmethod
    def connect_device(self, hardware_id: str, connection_params: Dict[str, Any]) -> bool:
        pass

    @abstractmethod
    def disconnect_device(self, hardware_id: str) -> bool:
        pass

    @abstractmethod
    def get_status(self, hardware_id: str) -> str:
        pass


class BaseAiInferenceProvider(ABC):
    """Abstract interface for Accident & Emergency Computer Vision AI models."""

    @abstractmethod
    def predict_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Runs ML model inference on image.
        Returns: { 'detected': bool, 'incident_type': str, 'confidence': float, 'labels': list }
        """
        pass


class BaseLocationProvider(ABC):
    """Abstract interface for resolving and validating GPS coordinates."""

    @abstractmethod
    def format_coordinates(self, lat: Optional[float], lon: Optional[float]) -> Tuple[Optional[float], Optional[float], str]:
        """Returns: (latitude, longitude, status_message)"""
        pass


class BaseNotificationService(ABC):
    """Abstract interface for Emergency Push Notifications (e.g. Firebase Cloud Messaging)."""

    @abstractmethod
    def send_emergency_alert(self, tokens: list, title: str, body: str, data: Dict[str, Any]) -> list:
        pass
