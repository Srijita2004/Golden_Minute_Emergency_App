/*
  ========================================================================================
  UNIVERSAL GOLDEN MINUTE EMERGENCY RESPONSE SYSTEM — ESP32-CAM FIRMWARE
  ========================================================================================
  
  Target Board: AI-Thinker ESP32-CAM (OV2640 2MP Camera Sensor + 4MB PSRAM)
  Environment:  Arduino IDE 2.x / 1.8.x with ESP32 Arduino Core by Espressif
  
  HARDWARE & SYSTEM SPECIFICATIONS:
  - Hardware: AI-Thinker ESP32-CAM with OV2640 image sensor
  - Camera Mode: 640x480 VGA JPEG (utilizes 4MB on-board PSRAM)
  - Security / SSL: WiFiClientSecure with setInsecure() for lightweight TLS
  - Central ML Endpoint: /predict on Hugging Face Spaces (srij1-esp32-accident-brain)
  - Backend Endpoint: /api on Render (golden-minute-emergency-backend)
  
  OPERATIONAL PIPELINE:
  1. Boots and connects to local 2.4GHz Wi-Fi.
  2. Initializes OV2640 camera in high-speed 640x480 JPEG mode with PSRAM double buffering.
  3. Sends periodic heartbeat telemetry to Golden Minute backend:
     POST /api/devices/{DEVICE_ID}/heartbeat
  4. Periodically captures OV2640 JPEG frames every 2.0s and streams directly to ML:
     POST https://srij1-esp32-accident-brain.hf.space/predict (raw binary JPEG)
  5. Parses ML classification JSON:
     - Normal scene (accident == false): frame discarded, NO incident generated.
     - Confirmed hazard (accident == true):
       * Road Accident (type: "road_vehicle_accident") -> detection_status: "ACCIDENT_DETECTED"
       * Human Fall    (type: "human_fall_accident")   -> detection_status: "FALL_DETECTED"
       * Fire / Smoke  (type: "fire_smoke_accident")   -> detection_status: "FIRE_DETECTED"
  6. Dispatches ONE emergency incident with JPEG snapshot to Golden Minute backend:
     POST /api/incidents/camera (multipart/form-data)
  7. Backend maps device to registered user account (owner_user_id), records the incident,
     and fans out simultaneous emergency alerts to:
     - Incident Owner (Paired User)
     - Central Emergency Responders (Admin & Hospital accounts)
     across Web Push, FCM, and real-time SSE siren listeners.
  8. Enforces a 35-second cooldown to prevent duplicate flood alerts.
  ========================================================================================
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ========================================================================================
// ⚙️ 1. USER CONFIGURATION — SET THESE VALUES BEFORE FLASHING
// ========================================================================================

// 📶 Wi-Fi Network Credentials (2.4GHz only — ESP32 does not support 5GHz)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";          // <-- Enter your 2.4GHz Wi-Fi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";      // <-- Enter your Wi-Fi Password

// 🏷️ Device Identification
// MUST match either the "device_id" (e.g. CAM-001) or "hardware_identifier" 
// registered in your Golden Minute Web App under "My Devices".
const char* DEVICE_ID = "CAM-001";                     // <-- Match with registered Device ID

// 🛰️ Real Hardware GPS Option (Neo-6M / u-blox GPS module)
// 0 = Disabled (Default). No fake GPS coordinates are fabricated. Backend & UI
//     will accurately state "Location Unavailable".
// 1 = Enabled. Requires Neo-6M GPS wired to UART pins (TX to GPIO 13, RX to GPIO 12).
#define ENABLE_NEO6M_GPS 0

#if ENABLE_NEO6M_GPS
#include <TinyGPS++.h>
#define GPS_RX_PIN 13
#define GPS_TX_PIN 12
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
#endif

// 🌐 Cloud Endpoints
// Production Central ML Service on Hugging Face Spaces
const char* ML_PREDICT_URL = "https://srij1-esp32-accident-brain.hf.space/predict";

// Production Golden Minute Backend API on Render
const char* GOLDEN_MINUTE_API_URL = "https://golden-minute-emergency-backend.onrender.com/api";

// ⏱️ Operational Intervals (in milliseconds)
const unsigned long CAPTURE_INTERVAL_MS   = 2000;      // Capture frame every 2.0 seconds
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;     // Heartbeat telemetry every 30 seconds
const unsigned long INCIDENT_COOLDOWN_MS  = 35000;     // 35s cooldown to prevent alert flooding

// ========================================================================================
// 📷 2. AI-THINKER ESP32-CAM PIN CONFIGURATION (OV2640 SENSOR)
// ========================================================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_LED_PIN      4   // Onboard High-Power Flash LED (Active HIGH)
#define STATUS_LED_PIN    33   // Small Red Status LED on back of board (Active LOW)

// ========================================================================================
// ⏱️ INTERNAL RUNTIME STATE
// ========================================================================================
unsigned long lastCaptureTime   = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastIncidentTime  = 0;
bool isCameraInitialized        = false;

// ========================================================================================
// 🛰️ GPS COORDINATES RETRIEVAL (NO FAKE / STATIC GPS COORDINATES)
// ========================================================================================
bool getRealGpsCoordinates(float &latitude, float &longitude) {
#if ENABLE_NEO6M_GPS
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
  if (gps.location.isValid() && gps.location.age() < 5000) {
    latitude = (float)gps.location.lat();
    longitude = (float)gps.location.lng();
    return true;
  }
#endif
  // GPS module absent or searching for satellite lock
  return false;
}

// ========================================================================================
// 📶 WI-FI CONNECTION MANAGER
// ========================================================================================
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("📶 [WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink red LED
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, HIGH); // LED OFF (Active LOW)
    Serial.println();
    Serial.println("==================================================");
    Serial.println("✅ [WIFI] CONNECTED SUCCESSFULLY!");
    Serial.print("   IP Address : ");
    Serial.println(WiFi.localIP());
    Serial.print("   MAC Address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("   RSSI Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("==================================================");
  } else {
    Serial.println();
    Serial.println("⚠️ [WIFI] Connection failed. Will retry in main loop...");
  }
}

// ========================================================================================
// 📷 OV2640 CAMERA INITIALIZATION
// ========================================================================================
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("🧠 [MEMORY] 4MB PSRAM detected. Enabling 640x480 VGA JPEG double buffering.");
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 12;             // 10-63 (lower = higher fidelity)
    config.fb_count     = 2;
  } else {
    Serial.println("⚠️ [MEMORY] No PSRAM found. Constraining resolution to CIF (400x296).");
    config.frame_size   = FRAMESIZE_CIF;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ [CAMERA] Initialization failed with error 0x%x\n", err);
    return false;
  }

  sensor_t * s = esp_camera_sensor_get();
  // Calibrate OV2640 sensor exposure & contrast for outdoor/roadside monitoring
  s->set_brightness(s, 1);     // -2 to 2
  s->set_contrast(s, 1);       // -2 to 2
  s->set_saturation(s, 0);     // -2 to 2

  Serial.println("✅ [CAMERA] OV2640 Sensor ready.");
  return true;
}

// ========================================================================================
// 💓 HEARTBEAT TELEMETRY (/api/devices/{DEVICE_ID}/heartbeat)
// ========================================================================================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(GOLDEN_MINUTE_API_URL) + "/devices/" + String(DEVICE_ID) + "/heartbeat";

  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification for embedded TLS

  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("⚠️ [HEARTBEAT] Failed to initialize HTTPS connection");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  // Build JSON matching backend DeviceHeartbeatRequest schema
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<128> doc;
#endif

  doc["battery_level"] = 100;

  float lat = 0.0, lon = 0.0;
  if (getRealGpsCoordinates(lat, lon)) {
    doc["latitude"]  = lat;
    doc["longitude"] = lon;
  }

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("💓 [HEARTBEAT] Camera %s ONLINE (HTTP %d)\n", DEVICE_ID, httpCode);
  } else {
    Serial.printf("⚠️ [HEARTBEAT] Ping to backend returned HTTP %d\n", httpCode);
  }

  http.end();
}

// ========================================================================================
// 🚨 DISPATCH CONFIRMED EMERGENCY TO GOLDEN MINUTE BACKEND (/api/incidents/camera)
// ========================================================================================
void dispatchIncidentToBackend(const char* detectionStatus, float confidence, camera_fb_t* fb) {
  if (WiFi.status() != WL_CONNECTED || fb == NULL) return;

  String url = String(GOLDEN_MINUTE_API_URL) + "/incidents/camera";
  Serial.print("🚀 [DISPATCH] Uploading emergency incident to Golden Minute Backend: ");
  Serial.println(url);

  // Generate unique event ID for backend idempotency
  String eventId = "EVENT-CAM-" + String(DEVICE_ID) + "-" + String(millis());

  // Check for real GPS coordinates (omitted if no fix/hardware to prevent fake locations)
  float lat = 0.0, lon = 0.0;
  bool hasGpsFix = getRealGpsCoordinates(lat, lon);

  // Build multipart/form-data payload
  String boundary = "----GoldenMinuteESP32Cam" + String(millis());

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("❌ [DISPATCH] Failed to initialize HTTPS client");
    return;
  }

  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.setTimeout(15000);

  // 1. Text form fields
  String head = "";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"event_id\"\r\n\r\n" + eventId + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"device_id\"\r\n\r\n" + String(DEVICE_ID) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"detection_status\"\r\n\r\n" + String(detectionStatus) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"confidence\"\r\n\r\n" + String(confidence, 4) + "\r\n";

  // Only include latitude and longitude if genuine GPS lock exists
  if (hasGpsFix) {
    head += "--" + boundary + "\r\n";
    head += "Content-Disposition: form-data; name=\"latitude\"\r\n\r\n" + String(lat, 6) + "\r\n";

    head += "--" + boundary + "\r\n";
    head += "Content-Disposition: form-data; name=\"longitude\"\r\n\r\n" + String(lon, 6) + "\r\n";
  }

  // 2. Binary JPEG file attachment header
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"accident_snapshot.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  // 3. Multipart tail
  String tail = "\r\n--" + boundary + "--\r\n";

  size_t totalLen = head.length() + fb->len + tail.length();

  // Allocate payload from PSRAM if available, fallback to internal SRAM
  uint8_t * payload = psramFound() ? (uint8_t *)ps_malloc(totalLen) : (uint8_t *)malloc(totalLen);
  if (!payload) {
    Serial.println("❌ [DISPATCH] Memory allocation failed for multipart payload!");
    http.end();
    return;
  }

  memcpy(payload, head.c_str(), head.length());
  memcpy(payload + head.length(), fb->buf, fb->len);
  memcpy(payload + head.length() + fb->len, tail.c_str(), tail.length());

  int httpCode = http.POST(payload, totalLen);
  free(payload);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.println("==================================================");
    Serial.printf("🎉 [DISPATCH SUCCESS] Emergency Incident Logged! (HTTP %d)\n", httpCode);
    Serial.println("   Response: " + response);
    Serial.println("   Dual Alert Fan-Out Triggered: Owner + Hospitals notified.");
    Serial.println("==================================================");
  } else {
    Serial.printf("❌ [DISPATCH FAILED] Backend returned HTTP %d\n", httpCode);
  }

  http.end();
}

// ========================================================================================
// 🧠 PROCESS FRAME WITH ML (/predict)
// ========================================================================================
void processFrameWithML() {
  if (WiFi.status() != WL_CONNECTED) return;

  // 1. Capture OV2640 Frame
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ [CAMERA] Frame capture failed!");
    return;
  }

  Serial.printf("\n📸 [CAPTURE] Frame ready (%d bytes). Streaming to ML engine...\n", fb->len);

  // 2. Send Binary JPEG to Central ML Service
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, ML_PREDICT_URL)) {
    Serial.println("❌ [ML] Failed to begin HTTPS connection to ML service");
    esp_camera_fb_return(fb);
    return;
  }

  http.addHeader("Content-Type", "application/octet-stream");
  http.setTimeout(15000); // 15s timeout for deep neural model inference

  unsigned long t0 = millis();
  int httpCode = http.POST(fb->buf, fb->len);
  unsigned long latency = millis() - t0;

  if (httpCode == 200) {
    String response = http.getString();
    Serial.printf("⚡ [ML RESPONSE] %lu ms | HTTP %d\n", latency, httpCode);
    Serial.println("   Payload: " + response);

    // 3. Parse JSON Classification Output
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    StaticJsonDocument<512> doc;
#endif

    DeserializationError err = deserializeJson(doc, response);
    if (!err) {
      bool isAccident          = doc["accident"] | false;
      bool isEmergency         = doc["emergency"] | false;
      const char* rawType      = doc["type"]     | "non_accident";
      float score              = doc["score"]    | 0.0;
      const char* resultMsg    = doc["result"]   | "normal";

      // If accident or emergency confirmed by ML models
      if (isAccident || isEmergency) {
        String typeStr = String(rawType);
        typeStr.toLowerCase();

        // Map ML hazard classification to Golden Minute status
        String detectionStatus = "ACCIDENT_DETECTED";
        if (typeStr.indexOf("fire") >= 0) {
          detectionStatus = "FIRE_DETECTED";
        } else if (typeStr.indexOf("fall") >= 0) {
          detectionStatus = "FALL_DETECTED";
        } else {
          detectionStatus = "ACCIDENT_DETECTED";
        }

        Serial.println();
        Serial.println("🚨🚨🚨 ============================================== 🚨🚨🚨");
        Serial.printf("  EMERGENCY CONFIRMED: %s (%s)\n", detectionStatus.c_str(), rawType);
        Serial.printf("  Confidence Score   : %.2f%%\n", score * 100.0);
        Serial.printf("  Classification Msg : %s\n", resultMsg);
        Serial.println("🚨🚨🚨 ============================================== 🚨🚨🚨");

        // Visual alert on hardware: quick strobe of onboard flash LED
        digitalWrite(FLASH_LED_PIN, HIGH);
        delay(120);
        digitalWrite(FLASH_LED_PIN, LOW);

        // Enforce anti-flood cooldown
        unsigned long now = millis();
        if (now - lastIncidentTime >= INCIDENT_COOLDOWN_MS) {
          lastIncidentTime = now;
          // Dispatch incident and snapshot to Golden Minute backend
          dispatchIncidentToBackend(detectionStatus.c_str(), score, fb);
        } else {
          Serial.printf("⏳ [COOLDOWN] Skipping duplicate alert (%lus cooldown remaining)\n",
                        (INCIDENT_COOLDOWN_MS - (now - lastIncidentTime)) / 1000);
        }
      } else {
        Serial.println("🟢 [CLEAR] Normal scene. No accident detected.");
      }
    } else {
      Serial.printf("⚠️ [JSON] Deserialization error: %s\n", err.c_str());
    }
  } else {
    Serial.printf("❌ [ML API ERROR] POST failed: HTTP %d\n", httpCode);
  }

  http.end();
  esp_camera_fb_return(fb); // Free frame buffer back to camera driver
}

// ========================================================================================
// ⚡ ARDUINO SETUP
// ========================================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=================================================================");
  Serial.println("🚀 GOLDEN MINUTE — ESP32-CAM REAL OPTICAL HAZARD SENSOR");
  Serial.println("=================================================================");

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH); // Off (active low)
  digitalWrite(FLASH_LED_PIN, LOW);   // Off (active high)

#if ENABLE_NEO6M_GPS
  Serial.println("🛰️ [GPS] Initializing Neo-6M GPS on UART2 (RX:13, TX:12)...");
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
#else
  Serial.println("📍 [GPS] Hardware GPS disabled. Incidents will record 'Location Unavailable'.");
#endif

  // 1. Initialize OV2640 Camera
  isCameraInitialized = initCamera();
  if (!isCameraInitialized) {
    Serial.println("❌ Critical camera hardware fault. Halting.");
    while (true) {
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
      delay(200);
    }
  }

  // 2. Connect to Wi-Fi
  connectToWiFi();

  // 3. Send initial boot heartbeat to establish device connection
  sendHeartbeat();

  Serial.println("\n🟢 System active! Beginning real-time optical hazard detection loop...\n");
}

// ========================================================================================
// 🔄 ARDUINO MAIN LOOP
// ========================================================================================
void loop() {
  // Ensure Wi-Fi link remains active
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    delay(500);
    return;
  }

  unsigned long currentMillis = millis();

  // 1. Periodic Heartbeat ping (every 30 seconds)
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    sendHeartbeat();
  }

  // 2. Periodic Frame Capture & ML Inference (every 2.0 seconds)
  if (currentMillis - lastCaptureTime >= CAPTURE_INTERVAL_MS) {
    lastCaptureTime = currentMillis;
    processFrameWithML();
  }

  delay(10); // Yield CPU to FreeRTOS watchdog
}
