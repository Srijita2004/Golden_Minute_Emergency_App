# ESP32-CAM External Accident Camera Integration Guide

This guide details how the ESP32-CAM camera module captures incident snapshots and triggers the emergency incident pipeline.

---

## 1. Hardware Specifications

* **Module**: AI-Thinker ESP32-CAM with OV2640 2MP Camera Sensor
* **Memory**: 520 KB SRAM + 4 MB external PSRAM (crucial for UXGA/SVGA JPEG capture)
* **Wi-Fi**: 802.11 b/g/n (2.4 GHz)
* **Power Supply**: 5V / 2A dedicated power rail (prevent brownout resets during Wi-Fi transmission)

---

## 2. API Dispatch Contract

When the camera module detects an incident (or sends a frame to the backend AI inference provider), it issues an HTTP POST request:

```http
POST /api/incidents/camera
Content-Type: multipart/form-data

Headers:
  Authorization: Bearer <DEVICE_API_KEY>

Form Fields:
  event_id: "EVENT-CAM-001-00028"
  device_id: "CAM-001"
  detection_status: "ACCIDENT_DETECTED"
  confidence: "0.89"
  latitude: "22.580120"
  longitude: "88.371250"
  image: <binary JPEG payload: image/jpeg>
```

---

## 3. Idempotency & Duplicate Prevention (CRITICAL)

Because edge devices frequently experience Wi-Fi packet drops, firmware may retry sending the same incident packet.

* **Every incident must carry a unique `event_id`** (e.g. `EVENT-CAM-001-00028`).
* If the backend receives the same `event_id` multiple times, the server recognizes the idempotent key and **returns the existing incident without creating duplicates or spamming notifications**.
