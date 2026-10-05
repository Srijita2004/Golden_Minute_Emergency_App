# Bluetooth Low Energy (BLE) Integration Documentation

This document specifies the GATT profile architecture for communicating with the ESP32 DevKit Wristband.

---

## 1. GATT Service & Characteristic Specifications

Configurable placeholders are defined in `backend/app/core/config.py`:

```
┌────────────────────────────────────────────────────────┐
│             EMERGENCY BIOMETRICS GATT SERVICE          │
│        UUID: <CONFIGURE_BLE_SERVICE_UUID_LATER>        │
└───────────────────────────┬────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  PULSE MEASUREMENT CHAR      │        │  GPS COORDINATE CHAR         │
│  UUID: <CONFIGURE_PULSE>     │        │  UUID: <CONFIGURE_GPS>       │
│  Properties: NOTIFY, READ    │        │  Properties: NOTIFY, READ    │
│  Payload: 2 bytes (uint16_t) │        │  Payload: 8 bytes (int32x2)  │
└──────────────────────────────┘        └──────────────────────────────┘
```

### Standard Configuration Values
* **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b` *(Default placeholder)*
* **Pulse Characteristic UUID**: `beb5483e-36e1-4688-b7f5-ea07361b26a8` *(Default placeholder)*
* **GPS Characteristic UUID**: `beb5483e-36e1-4688-b7f5-ea07361b26a9` *(Default placeholder)*

---

## 2. Telemetry Packet Structure (Binary Optimization)

For battery-conscious BLE peripheral streaming:
```
Byte 0: Heart Rate (BPM, uint8_t)
Byte 1: Battery Level (0–100, uint8_t)
Byte 2-5: Latitude * 10^6 (int32_t, Little-Endian)
Byte 6-9: Longitude * 10^6 (int32_t, Little-Endian)
Byte 10: Status Flags (Bit 0: SOS Pressed, Bit 1: Abnormal BPM)
```

The app's `BleDeviceManager` adapter converts these raw bytes into JSON and forwards them to the incident pipeline.
