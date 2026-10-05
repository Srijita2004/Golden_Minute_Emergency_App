# Wi-Fi & REST API Integration Documentation

This document describes the network protocol for Wi-Fi-enabled edge hardware communicating with the backend.

---

## 1. Edge Authentication Architecture

Physical ESP32 hardware connects to the backend over standard HTTPS (or HTTP in local development):

* **Heartbeat & Telemetry**:
```http
POST /api/devices/{device_id}/heartbeat
Content-Type: application/json

{
  "battery_level": 92,
  "bpm": 74,
  "latitude": 22.572645,
  "longitude": 88.363892
}
```
* **Offline Detection Rule**:
If a registered device does not issue a heartbeat or incident event within `DEVICE_OFFLINE_THRESHOLD_SECONDS` (default: 90 seconds), the system marks the device as `OFFLINE` on the Admin and User dashboards.

---

## 2. Arduino C++ HTTP Client Snippet

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

void sendHeartbeat(String deviceId, int battery, int bpm) {
    if(WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = "http://192.168.1.100:8000/api/devices/" + deviceId + "/heartbeat";
        http.begin(url);
        http.addHeader("Content-Type", "application/json");

        String payload = "{\"battery_level\":" + String(battery) + ",\"bpm\":" + String(bpm) + "}";
        int httpResponseCode = http.POST(payload);
        http.end();
    }
}
```
