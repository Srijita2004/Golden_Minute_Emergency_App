/*
  ========================================================================================
  UNIVERSAL GOLDEN MINUTE EMERGENCY RESPONSE SYSTEM — ESP32-CAM FIRMWARE
  ========================================================================================
  
  Target Board: AI-Thinker ESP32-CAM (OV2640 2MP Camera Sensor + 4MB PSRAM)
  Environment:  Arduino IDE 2.x / 1.8.x with ESP32 Arduino Core by Espressif
  
  REQUIRED FLOW IMPLEMENTED:
  1. ESP32-CAM boots & connects to Wi-Fi.
  2. Initializes OV2640 camera in high-speed JPEG mode.
  3. Sends periodic heartbeats to Golden Minute Backend (/api/devices/{DEVICE_ID}/heartbeat).
  4. Periodically captures JPEG frames from OV2640 sensor.
  5. Sends raw JPEG binary stream to Central ML Service (/predict).
  6. Parses JSON detection output (Road collision / Human fall / Fire detection).
  7. If emergency is confirmed (accident == true):
     - Dispatches incident data + snapshot + device ID to Golden Minute Backend (/api/incidents/camera).
     - Activates on-board visual alert.
     - Observes cooldown period to prevent duplicate flood alerts.
  ========================================================================================
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ========================================================================================
// ⚙️ 1. USER CONFIGURATION — EDIT THESE VALUES BEFORE UPLOADING
// ========================================================================================

// Wi-Fi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";          // <-- Enter your 2.4GHz Wi-Fi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";      // <-- Enter your Wi-Fi Password

// Central ML Service API URL (from "ML_project" or Deployed Cloud Service)
// Local example:   "http://192.168.1.100:5000/predict"
// Deployed example: "https://<your-ml-service>.hf.space/predict"
const char* ML_PREDICT_URL = "http://192.168.1.100:5000/predict";

// Golden Minute Application Backend API URL
// Local example:   "http://192.168.1.100:8000/api"
// Deployed example: "https://<your-backend-domain>/api"
const char* GOLDEN_MINUTE_API_URL = "http://192.168.1.100:8000/api";

// Device Identification (Must match the registered Device ID in the Golden Minute Web App)
const char* DEVICE_ID = "CAM-001";                     // <-- Match with device_id in MyDevices

// Optional Static GPS Coordinates (for fixed roadside, pole, or gate installation)
const char* CAMERA_LATITUDE  = "22.580120";            // <-- Enter camera latitude (or leave default)
const char* CAMERA_LONGITUDE = "88.371250";            // <-- Enter camera longitude (or leave default)

// Operational Timers (in milliseconds)
const unsigned long CAPTURE_INTERVAL_MS   = 2000;      // Capture frame every 2.0 seconds
const unsigned long HEARTBEAT_INTERVAL_MS = 30000;     // Heartbeat ping every 30 seconds
const unsigned long INCIDENT_COOLDOWN_MS  = 35000;     // 35s cooldown after accident to prevent duplicates

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

#define FLASH_LED_PIN      4   // Onboard High-Power Flash LED
#define STATUS_LED_PIN    33   // Small Red Status LED on back (Active LOW)

// ========================================================================================
// ⏱️ INTERNAL STATE VARIABLES
// ========================================================================================
unsigned long lastCaptureTime   = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastIncidentTime  = 0;
bool isCameraInitialized        = false;

// ========================================================================================
// 📶 WI-FI CONNECTION HELPER
// ========================================================================================
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Toggle red LED
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
    Serial.println("❌ [WIFI] Connection failed. Retrying in background...");
  }
}

// ========================================================================================
// 📷 CAMERA INITIALIZATION
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

  // Frame resolution: VGA (640x480) matches YOLOv8 640p native input
  if (psramFound()) {
    Serial.println("🧠 [MEMORY] PSRAM detected (4MB). Enabling high-speed double-buffering.");
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 12;             // 10-63 (lower = sharper)
    config.fb_count     = 2;
  } else {
    Serial.println("⚠️ [MEMORY] No PSRAM found. Using internal SRAM constraints.");
    config.frame_size   = FRAMESIZE_CIF;  // 400x296
    config.jpeg_quality = 15;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ [CAMERA] Initialization failed with error 0x%x\n", err);
    return false;
  }

  sensor_t * s = esp_camera_sensor_get();
  // OV2640 Sensor Tunings for clear roadside contrast
  s->set_brightness(s, 1);     // -2 to 2
  s->set_contrast(s, 1);       // -2 to 2
  s->set_saturation(s, 0);     // -2 to 2

  Serial.println("✅ [CAMERA] OV2640 Camera initialized successfully (640x480 JPEG).");
  return true;
}

// ========================================================================================
// 💓 HEARTBEAT TELEMETRY (Notifies Golden Minute Backend that camera is ONLINE)
// ========================================================================================
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  String url = String(GOLDEN_MINUTE_API_URL) + "/devices/" + String(DEVICE_ID) + "/heartbeat";
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["status"]        = "CONNECTED";
  doc["battery_level"] = 100;

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("💓 [HEARTBEAT] Ping sent. Camera status: CONNECTED (HTTP %d)\n", httpCode);
  } else {
    Serial.printf("⚠️ [HEARTBEAT] Device ping returned HTTP %d\n", httpCode);
  }
  http.end();
}

// ========================================================================================
// 🚨 DISPATCH INCIDENT TO GOLDEN MINUTE BACKEND (/api/incidents/camera)
// ========================================================================================
void dispatchIncidentToBackend(const char* detectionType, float confidence, camera_fb_t* fb) {
  if (WiFi.status() != WL_CONNECTED || fb == NULL) return;

  String url = String(GOLDEN_MINUTE_API_URL) + "/incidents/camera";
  Serial.print("🚀 [DISPATCH] Forwarding incident to Golden Minute Backend: ");
  Serial.println(url);

  // Generate unique event ID for backend idempotency
  String eventId = "EVENT-CAM-" + String(DEVICE_ID) + "-" + String(millis());

  // Determine detection status string
  String detectionStatus = "ACCIDENT_DETECTED";
  String typeStr = String(detectionType);
  if (typeStr.indexOf("fire") >= 0) {
    detectionStatus = "FIRE_DETECTED";
  } else if (typeStr.indexOf("fall") >= 0) {
    detectionStatus = "FALL_DETECTED";
  }

  // Construct Multipart Form Data
  String boundary = "----ESP32CamBoundary" + String(millis());
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.setTimeout(15000);

  // Body header fields
  String head = "";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"event_id\"\r\n\r\n" + eventId + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"device_id\"\r\n\r\n" + String(DEVICE_ID) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"detection_status\"\r\n\r\n" + detectionStatus + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"confidence\"\r\n\r\n" + String(confidence, 4) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"latitude\"\r\n\r\n" + String(CAMERA_LATITUDE) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"longitude\"\r\n\r\n" + String(CAMERA_LONGITUDE) + "\r\n";

  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"accident_snapshot.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";

  // Calculate total payload size
  size_t totalLen = head.length() + fb->len + tail.length();

  // Stream data in memory-safe chunks
  uint8_t * payload = (uint8_t *)malloc(totalLen);
  if (!payload) {
    Serial.println("❌ [DISPATCH] Out of memory creating multipart payload!");
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
    Serial.println("==================================================");
  } else {
    Serial.printf("❌ [DISPATCH FAILED] Backend returned HTTP %d\n", httpCode);
  }

  http.end();
}

// ========================================================================================
// 🧠 SEND FRAME TO ML "/predict" AND PROCESS RESULT
// ========================================================================================
void processFrameWithML() {
  if (WiFi.status() != WL_CONNECTED) return;

  // Capture frame
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ [CAMERA] Frame capture failed!");
    return;
  }

  Serial.printf("\n📸 [CAPTURE] Frame ready (%d bytes). Posting to ML API...\n", fb->len);

  HTTPClient http;
  http.begin(ML_PREDICT_URL);
  http.addHeader("Content-Type", "application/octet-stream");
  http.setTimeout(8000); // 8s timeout

  unsigned long t0 = millis();
  int httpCode = http.POST(fb->buf, fb->len);
  unsigned long latency = millis() - t0;

  if (httpCode == 200) {
    String response = http.getString();
    Serial.printf("⚡ [ML RESPONSE] %d ms | HTTP %d\n", latency, httpCode);
    Serial.println("   Payload: " + response);

    // Parse JSON
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err) {
      bool isAccident          = doc["accident"] | false;
      const char* accidentType = doc["type"]     | "non_accident";
      float score              = doc["score"]    | 0.0;
      const char* resultMsg    = doc["result"]   | "normal";

      if (isAccident) {
        Serial.println();
        Serial.println("🚨🚨🚨 ============================================== 🚨🚨🚨");
        Serial.printf("  EMERGENCY HAZARD CONFIRMED: %s\n", accidentType);
        Serial.printf("  Confidence Score : %.2f%%\n", score * 100.0);
        Serial.printf("  Classification   : %s\n", resultMsg);
        Serial.println("🚨🚨🚨 ============================================== 🚨🚨🚨");

        // Blink flash LED to signal visual emergency confirmation
        digitalWrite(FLASH_LED_PIN, HIGH);
        delay(100);
        digitalWrite(FLASH_LED_PIN, LOW);

        // Check incident cooldown (35 seconds)
        unsigned long now = millis();
        if (now - lastIncidentTime >= INCIDENT_COOLDOWN_MS) {
          lastIncidentTime = now;
          // Dispatch into Golden Minute Emergency App Pipeline
          dispatchIncidentToBackend(accidentType, score, fb);
        } else {
          Serial.printf("⏳ [COOLDOWN] Skipping duplicate dispatch (%lus remaining)\n",
                        (INCIDENT_COOLDOWN_MS - (now - lastIncidentTime)) / 1000);
        }
      } else {
        Serial.println("🟢 [CLEAR] Normal scene. No accident detected.");
      }
    } else {
      Serial.printf("⚠️ [JSON] Parse failed: %s\n", err.c_str());
    }
  } else {
    Serial.printf("❌ [ML API ERROR] POST failed: HTTP %d\n", httpCode);
  }

  http.end();
  esp_camera_fb_return(fb); // Release frame buffer back to camera driver
}

// ========================================================================================
// ⚡ ARDUINO SETUP
// ========================================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=================================================================");
  Serial.println("🚀 UNIVERSAL GOLDEN MINUTE — ESP32-CAM EMERGENCY OPTICAL SENSOR");
  Serial.println("=================================================================");

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH); // Off
  digitalWrite(FLASH_LED_PIN, LOW);   // Off

  // 1. Initialize Camera
  isCameraInitialized = initCamera();
  if (!isCameraInitialized) {
    Serial.println("❌ Critical camera fault. Halting.");
    while (true) {
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
      delay(200);
    }
  }

  // 2. Connect to Wi-Fi
  connectToWiFi();

  // 3. Send initial registration heartbeat
  sendHeartbeat();

  Serial.println("\n🟢 System active! Beginning real-time hazard detection loop...\n");
}

// ========================================================================================
// 🔄 ARDUINO LOOP
// ========================================================================================
void loop() {
  // Verify network connectivity
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    delay(500);
    return;
  }

  unsigned long currentMillis = millis();

  // 1. Send periodic heartbeat ping (every 30s)
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    sendHeartbeat();
  }

  // 2. Capture & send optical frame to ML engine (every 2.0s)
  if (currentMillis - lastCaptureTime >= CAPTURE_INTERVAL_MS) {
    lastCaptureTime = currentMillis;
    processFrameWithML();
  }

  delay(10); // Yield to FreeRTOS watchdog
}
