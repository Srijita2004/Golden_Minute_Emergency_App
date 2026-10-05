# WHAT OUR HARDWARE TEAM MUST PROVIDE
## Pre-Integration Hardware Specification Checklist

> [!IMPORTANT]
> **Status**: SOFTWARE & MOCK ADAPTER ARCHITECTURE 100% COMPLETED.
> Physical hardware integration remains marked as **PENDING BENCH TESTING** until the hardware engineering team delivers physical prototypes and confirms the specifications below.

---

### Hardware Team Action Checklist

- [ ] **1. Exact ESP32 DevKit Model**
  * Specify exact chip revision (e.g. ESP32-WROOM-32D, ESP32-WROVER-E, ESP32-S3).
  * Flash size (4 MB vs. 8 MB) and external PSRAM availability.

- [ ] **2. Exact ESP32-CAM Model**
  * Specific board manufacturer (AI-Thinker, TTGO T-Journal, or custom PCB).
  * Camera sensor model (OV2640 vs. OV3660 vs. OV5640).
  * Lens field of view (66° standard vs. 120° wide-angle / fish-eye).

- [ ] **3. BLE Capabilities**
  * Bluetooth specification version supported by firmware (BLE 4.2 vs. BLE 5.0).
  * Maximum Transmission Unit (MTU) size supported (default: 23 bytes, recommended negotiated MTU: 256 bytes).

- [ ] **4. BLE Service UUID**
  * Provide production 128-bit Service UUID to replace `<CONFIGURE_BLE_SERVICE_UUID_LATER>`.

- [ ] **5. BLE Characteristic UUID(s)**
  * Pulse Measurement Characteristic UUID (Properties: `NOTIFY`, `READ`).
  * GPS Latitude & Longitude Characteristic UUID (Properties: `NOTIFY`, `READ`).
  * Emergency SOS Button Characteristic UUID (Properties: `INDICATE` or `NOTIFY`).

- [ ] **6. Device Identification & Claiming Method**
  * Physical MAC address vs. Factory burned serial number (e.g. `WRIST-XXXXXXXXXXXX`).
  * Pairing code verification mechanism (OLED 6-digit PIN display vs. QR code sticker on casing).

- [ ] **7. Wristband Data Payload Structure**
  * Binary struct vs. JSON payload.
  * Confirmation of byte endianness (Little-Endian vs. Big-Endian) if transmitting binary GATT packets.

- [ ] **8. GPS Data Format**
  * Raw NMEA-0183 sentences (`$GPGGA`, `$GPRMC`) vs. Pre-parsed decimal floating-point degrees (`WGS-84`).
  * Baud rate configuration between GPS module and ESP32 UART (e.g. 9600 vs. 115200 baud).

- [ ] **9. Camera Communication Method**
  * Direct Wi-Fi station mode HTTP POST to backend `/api/incidents/camera`.
  * Local Wi-Fi Access Point mode vs. cellular LTE-M / NB-IoT modem bridge.

- [ ] **10. Camera Image Format & Resolution**
  * Resolution: QVGA (320x240), VGA (640x480), or SVGA (800x600).
  * Compression quality: JPEG quality index (10–63).
  * Frame rate during optical streaming (recommended: 15–30 FPS).

- [ ] **11. Camera Detection Payload**
  * Fields to confirm: `event_id` (idempotency key), `device_id`, `detection_status`, `confidence`, `latitude`, `longitude`, `timestamp`.

- [ ] **12. Edge ML Model Format (If Running On-Device)**
  * TensorFlow Lite for Microcontrollers (`.tflite`) vs. ESP-DL / Edge Impulse INT8 quantized model.
  * *Note: If edge device only captures images, backend natively executes `road_expanded_best.pt` via PyTorch.*

- [ ] **13. Model Input / Output Specifications**
  * Input tensor dimensions: `[1, 3, 640, 640]` normalized RGB `[0.0, 1.0]`.
  * Output classes expected: `vehicle_incident`, `human_incident`, `Fall-Detected`.

- [ ] **14. Device Authentication Configuration**
  * Pre-shared API Key (PSK) or mTLS client certificates embedded in ESP32 secure flash.

- [ ] **15. Backend Network Configuration**
  * Static LAN IP address or DNS domain reachable by the ESP32 boards on the local deployment subnet.
  * Wi-Fi SSID and WPA2/WPA3 passphrase provisioning method (SmartConfig, BLE provisioning, or captive portal).

---

> [!CAUTION]
> **Bench Testing Verification Requirement**: Do not sign off hardware deployment until physical ESP32 boards have executed at least 50 consecutive end-to-end incident dispatches against the `/api/incidents/*` endpoints with zero dropped frames or duplicate incident anomalies.
