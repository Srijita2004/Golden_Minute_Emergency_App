from typing import Optional, Tuple
from app.adapters.base import BaseLocationProvider

class LocationProvider(BaseLocationProvider):
    """
    Validates, formats, and seals detection-time GPS coordinates.
    Strictly forbids generating fabricated coordinates when hardware GPS is absent.
    """

    def format_coordinates(self, lat: Optional[float], lon: Optional[float]) -> Tuple[Optional[float], Optional[float], str]:
        """
        Validates coordinate bounds (-90 to 90, -180 to 180).
        If lat or lon is None or invalid, returns (None, None, 'LOCATION UNAVAILABLE').
        """
        if lat is None or lon is None:
            return None, None, "LOCATION UNAVAILABLE"
        
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            if not (-90.0 <= lat_f <= 90.0) or not (-180.0 <= lon_f <= 180.0):
                return None, None, "LOCATION UNAVAILABLE"
            
            # Legitimate non-zero coordinates
            return round(lat_f, 6), round(lon_f, 6), "AVAILABLE"
        except (ValueError, TypeError):
            return None, None, "LOCATION UNAVAILABLE"

    def get_google_maps_url(self, lat: Optional[float], lon: Optional[float]) -> Optional[str]:
        if lat is not None and lon is not None:
            return f"https://www.google.com/maps?q={lat},{lon}"
        return None

location_provider = LocationProvider()
