# ESP32 DevKit Wristband Integration Guide

This guide describes how the physical ESP32 DevKit wristband communicates with the mobile application and backend server.

---

## 1. Hardware Overview

* **Microcontroller**: ESP32 DevKit V1 / ESP32-WROOM-32
* **Biometric Sensor**: MAX30102 / Pulse Sensor (I2C / ADC)
* **GPS Module**: NEO-6M / NEO-8M (Hardware UART2: TX=17, RX=16)
* **Display**: 0.96" OLED SSD1306 (I2C: SDA=21, SCL=22)
* **Power**: 3.7V Li-Po battery with TP4056 charging circuit

---

## 2. Telemetry Payload Format

The wristband packages its sensor readings into standard JSON telemetry:

```json
{
  "eventId": "EVENT-WRIST-001-1728169200",
  "deviceId": "WRIST-001",
  "bpm": 148,
  "latitude": 22.572645,
  "longitude": 88.363892,
  "batteryLevel": 88,
  "timestamp": "2026-10-05T22:30:00Z"
}
```

---

## 3. Communication Paths

### Path A: BLE to Mobile App
1. The wristband advertises as `Wristband_ESP32_XX`.
2. The mobile app connects to the wristband via GATT Client.
3. The wristband streams pulse readings through the **Pulse Characteristic**.
4. When abnormal pulse is detected, the mobile app forwards the payload to `POST /api/incidents/wristband`.

### Path B: Direct Wi-Fi / LTE-M to Backend
When connected to Wi-Fi, the wristband dispatches directly to:
```http
POST /api/incidents/wristband
Content-Type: application/json

{
  "event_id": "EVENT-WRIST-001-1728169200",
  "device_id": "WRIST-001",
  "bpm": 152,
  "latitude": 22.572645,
  "longitude": 88.363892,
  "battery_level": 88
}
```

---

## 4. Configurable Medical Thresholds

> [!NOTE]
> Medical thresholds are NOT hard-coded universal facts. They are configurable in `backend/app/core/config.py`:
> * `ABNORMAL_BPM_LOW`: Default 45 BPM (Bradycardia trigger)
> * `ABNORMAL_BPM_HIGH`: Default 130 BPM (Tachycardia trigger)
