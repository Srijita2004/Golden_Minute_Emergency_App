# Google Maps & Geolocation System Setup

The system tracks and displays coordinates captured at the exact moment an emergency incident is detected across all three sources.

---

## 1. Google Maps Platform Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the following APIs:
   * **Maps JavaScript API**
   * **Geocoding API**
   * **Places API** (Optional, for hospital routing)
3. Generate an API Key under **Credentials**.
4. Restrict the API key to your mobile package name or domain for security.

---

## 2. Configuration

In `backend/.env` and `frontend/.env`:
```env
GOOGLE_MAPS_API_KEY="AIzaSyYourProductionGoogleMapsKeyHere"
```

---

## 3. Location Ingestion Rules

1. **Phone Camera**: Coordinates are extracted strictly from `navigator.geolocation` or native Android LocationManager (`GPS_PROVIDER` or `FUSED_PROVIDER`). If the phone does not have a GPS fix, the system sets `location_status = "LOCATION UNAVAILABLE"`. **Never invent fake coordinates.**
2. **ESP32 Wristband**: Coordinates are parsed from the NEO-6M / NEO-8M GPS NMEA `$GPGGA` sentences via hardware UART.
3. **ESP32-CAM**: Fixed camera latitude and longitude are assigned during deployment registration or received via an attached GPS module.
4. **Historical Immutability**: The incident record permanently stores the coordinates *at detection time*. The location is never overwritten by subsequent movements of the phone.
