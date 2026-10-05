# Device Registration & Ownership Guide

This guide describes how external peripherals (ESP32 DevKit wristbands and ESP32-CAM cameras) are securely claimed and managed.

---

## 1. Ownership & Claiming Architecture

1. **Anti-Hijacking Protection**: Knowing a peripheral's public device name or MAC address does NOT grant ownership.
2. **Claiming Verification**: A device must be claimed using its secure pairing code (e.g. `123456`) displayed on the wristband screen or printed on the camera casing.
3. **Multi-Device Support**: A user can register multiple wristbands and cameras under their account (e.g. `Wristband-01`, `Wristband-02`, `AccidentCam-01`).
4. **Re-assignment / Unpairing**: If a user removes a device via `DELETE /api/devices/{id}`, that hardware becomes available to be claimed by another user.

---

## 2. Supported Connection Methods

* **BLE (Bluetooth Low Energy)**: Typically used by the battery-powered ESP32 DevKit Wristband.
* **Wi-Fi**: Used by ESP32-CAM to stream snapshots and transmit optical detection events over HTTP or WebSocket.
* **Internal Phone**: Managed directly through the phone's native camera and sensors.

---

## 3. Registration Flow

```http
POST /api/devices/register
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "device_name": "ESP32 DevKit Wristband",
  "device_type": "WRISTBAND",
  "connection_type": "BLE",
  "hardware_identifier": "ESP32-DEV-WRIST-A1B2",
  "pairing_code": "123456"
}
```

Response:
```json
{
  "device_id": "WRIST-001",
  "device_name": "ESP32 DevKit Wristband",
  "device_type": "WRISTBAND",
  "owner_user_id": "USER-001",
  "connection_type": "BLE",
  "registration_status": "CLAIMED",
  "connection_status": "DISCONNECTED",
  "battery_level": 100,
  "created_at": "2026-10-05T22:30:00Z"
}
```
