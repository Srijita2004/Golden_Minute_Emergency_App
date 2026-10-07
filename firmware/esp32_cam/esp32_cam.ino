/*
  GOLDEN MINUTE EMERGENCY RESPONSE SYSTEM
  AI-THINKER ESP32-CAM + OV2640

  Registered Golden Minute Device:
  DEVICE_ID = CAM-002

  CURRENT HARDWARE:
  - AI-Thinker ESP32-CAM
  - OV2640
  - Wi-Fi
  - NO GPS currently

  FLOW:
  ESP32-CAM
      -> Capture JPEG
      -> ML /predict
      -> If emergency detected
      -> POST /api/incidents/camera
      -> Backend resolves CAM-002 owner
      -> Owner + Hospital/Admin alert pipeline

  IMPORTANT:
  - No fake GPS coordinates.
  - Neo-6M is disabled for now.
  - latitude/longitude are omitted when GPS is unavailable.
*/

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ============================================================
// 1. USER CONFIGURATION
// ============================================================

// CHANGE ONLY THESE TWO VALUES FOR YOUR CURRENT 2.4 GHz WI-FI
const char* WIFI_SSID     = "SRIJITA-2.4G";
const char* WIFI_PASSWORD = "9007481498";

// YOUR ACTUAL REGISTERED GOLDEN MINUTE CAMERA
const char* DEVICE_ID = "CAM-002";

// GPS IS NOT CONNECTED NOW
#define ENABLE_NEO6M_GPS 0

#if ENABLE_NEO6M_GPS
#include <TinyGPS++.h>

#define GPS_RX_PIN 13
#define GPS_TX_PIN 12

HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
#endif

// ============================================================
// 2. CLOUD ENDPOINTS
// ============================================================

const char* ML_PREDICT_URL =
  "https://srij1-esp32-accident-brain.hf.space/predict";

const char* GOLDEN_MINUTE_API_URL =
  "https://golden-minute-emergency-backend.onrender.com/api";

// ============================================================
// 3. TIMINGS
// ============================================================

const unsigned long CAPTURE_INTERVAL_MS   = 2000UL;
const unsigned long HEARTBEAT_INTERVAL_MS = 30000UL;
const unsigned long INCIDENT_COOLDOWN_MS  = 35000UL;

const uint32_t ML_TIMEOUT_MS       = 20000;
const uint32_t BACKEND_TIMEOUT_MS  = 20000;

// ============================================================
// 4. AI-THINKER ESP32-CAM PIN MAP
// ============================================================

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

#define FLASH_LED_PIN      4
#define STATUS_LED_PIN    33

// ============================================================
// 5. RUNTIME STATE
// ============================================================

unsigned long lastCaptureTime   = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastIncidentTime  = 0;

bool cameraReady = false;

// Prevent millis() rollover from causing cooldown problems.
bool incidentWasSent = false;

// ============================================================
// 6. GPS
// ============================================================

bool getRealGpsCoordinates(double &latitude, double &longitude) {

#if ENABLE_NEO6M_GPS

  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  if (
      gps.location.isValid() &&
      gps.location.age() < 5000
     ) {

    latitude  = gps.location.lat();
    longitude = gps.location.lng();

    return true;
  }

#endif

  // No GPS / no valid satellite fix.
  // NEVER generate fake coordinates.
  return false;
}

// ============================================================
// 7. WI-FI
// ============================================================

void connectToWiFi() {

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.println("============================================");
  Serial.println("[WIFI] Connecting...");
  Serial.print("[WIFI] SSID: ");
  Serial.println(WIFI_SSID);
  Serial.println("============================================");

  WiFi.mode(WIFI_STA);

  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);

  WiFi.disconnect();
  delay(300);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (
      WiFi.status() != WL_CONNECTED &&
      attempts < 40
      ) {

    digitalWrite(
      STATUS_LED_PIN,
      !digitalRead(STATUS_LED_PIN)
    );

    Serial.print(".");

    delay(500);
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    digitalWrite(STATUS_LED_PIN, HIGH);

    Serial.println("============================================");
    Serial.println("[WIFI] CONNECTED");
    Serial.print("[WIFI] IP  : ");
    Serial.println(WiFi.localIP());

    Serial.print("[WIFI] MAC : ");
    Serial.println(WiFi.macAddress());

    Serial.print("[WIFI] RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    Serial.println("============================================");

  } else {

    digitalWrite(STATUS_LED_PIN, LOW);

    Serial.println(
      "[WIFI] Connection failed. Main loop will retry."
    );
  }
}

// ============================================================
// 8. CAMERA INITIALIZATION
// ============================================================

bool initCamera() {

  camera_config_t config = {};

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

    Serial.println(
      "[MEMORY] PSRAM detected."
    );

    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count     = 2;

#if defined(CAMERA_GRAB_LATEST)
    config.grab_mode = CAMERA_GRAB_LATEST;
#endif

#if defined(CAMERA_FB_IN_PSRAM)
    config.fb_location = CAMERA_FB_IN_PSRAM;
#endif

  } else {

    Serial.println(
      "[MEMORY] PSRAM NOT detected."
    );

    config.frame_size   = FRAMESIZE_CIF;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {

    Serial.printf(
      "[CAMERA] Initialization FAILED: 0x%x\n",
      err
    );

    return false;
  }

  sensor_t* sensor = esp_camera_sensor_get();

  if (sensor != nullptr) {

    sensor->set_framesize(
      sensor,
      psramFound() ? FRAMESIZE_VGA : FRAMESIZE_CIF
    );

    sensor->set_brightness(sensor, 0);
    sensor->set_contrast(sensor, 0);
    sensor->set_saturation(sensor, 0);
  }

  // Throw away first frame after camera startup.
  camera_fb_t* warmup = esp_camera_fb_get();

  if (warmup != nullptr) {
    esp_camera_fb_return(warmup);
  }

  Serial.println(
    "[CAMERA] OV2640 ready."
  );

  return true;
}

// ============================================================
// 9. HEARTBEAT
// ============================================================

void sendHeartbeat() {

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String url =
    String(GOLDEN_MINUTE_API_URL) +
    "/devices/" +
    String(DEVICE_ID) +
    "/heartbeat";

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, url)) {

    Serial.println(
      "[HEARTBEAT] HTTPS initialization failed."
    );

    return;
  }

  http.setTimeout(BACKEND_TIMEOUT_MS);

  http.addHeader(
    "Content-Type",
    "application/json"
  );

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<192> doc;
#endif

  /*
    DeviceHeartbeatRequest verified by the implementation
    described earlier.

    ESP32-CAM has no real battery measurement circuit here,
    so this is simply the current prototype telemetry value.
  */

  doc["battery_level"] = 100;

  double latitude  = 0.0;
  double longitude = 0.0;

  bool hasGps =
    getRealGpsCoordinates(
      latitude,
      longitude
    );

  if (hasGps) {

    doc["latitude"]  = latitude;
    doc["longitude"] = longitude;
  }

  String body;

  serializeJson(
    doc,
    body
  );

  int code = http.POST(body);

  if (code >= 200 && code < 300) {

    Serial.print(
      "[HEARTBEAT] CAM-002 ONLINE. HTTP "
    );

    Serial.println(code);

  } else {

    Serial.print(
      "[HEARTBEAT] FAILED. HTTP "
    );

    Serial.println(code);

    String response = http.getString();

    if (response.length() > 0) {

      Serial.print(
        "[HEARTBEAT] Server: "
      );

      Serial.println(response);
    }
  }

  http.end();
}

// ============================================================
// 10. EVENT ID
// ============================================================

String createEventId() {

  String mac = WiFi.macAddress();

  mac.replace(":", "");

  String eventId =
    "EVENT-" +
    String(DEVICE_ID) +
    "-" +
    mac +
    "-" +
    String((uint32_t)millis());

  return eventId;
}

// ============================================================
// 11. INCIDENT DISPATCH
// ============================================================

bool dispatchIncidentToBackend(
  const char* detectionStatus,
  float confidence,
  camera_fb_t* fb
) {

  if (
      WiFi.status() != WL_CONNECTED ||
      fb == nullptr ||
      fb->buf == nullptr ||
      fb->len == 0
     ) {

    return false;
  }

  String url =
    String(GOLDEN_MINUTE_API_URL) +
    "/incidents/camera";

  String eventId =
    createEventId();

  double latitude  = 0.0;
  double longitude = 0.0;

  bool hasGps =
    getRealGpsCoordinates(
      latitude,
      longitude
    );

  String boundary =
    "----GoldenMinuteBoundary" +
    String((uint32_t)millis());

  String head;

  head.reserve(1000);

  // EVENT ID
  head += "--";
  head += boundary;
  head += "\r\n";

  head +=
    "Content-Disposition: form-data; "
    "name=\"event_id\"\r\n\r\n";

  head += eventId;
  head += "\r\n";

  // DEVICE ID
  head += "--";
  head += boundary;
  head += "\r\n";

  head +=
    "Content-Disposition: form-data; "
    "name=\"device_id\"\r\n\r\n";

  head += DEVICE_ID;
  head += "\r\n";

  // DETECTION STATUS
  head += "--";
  head += boundary;
  head += "\r\n";

  head +=
    "Content-Disposition: form-data; "
    "name=\"detection_status\"\r\n\r\n";

  head += detectionStatus;
  head += "\r\n";

  // CONFIDENCE
  head += "--";
  head += boundary;
  head += "\r\n";

  head +=
    "Content-Disposition: form-data; "
    "name=\"confidence\"\r\n\r\n";

  head += String(confidence, 6);
  head += "\r\n";

  // GPS ONLY WHEN REAL FIX EXISTS
  if (hasGps) {

    head += "--";
    head += boundary;
    head += "\r\n";

    head +=
      "Content-Disposition: form-data; "
      "name=\"latitude\"\r\n\r\n";

    head += String(latitude, 6);
    head += "\r\n";

    head += "--";
    head += boundary;
    head += "\r\n";

    head +=
      "Content-Disposition: form-data; "
      "name=\"longitude\"\r\n\r\n";

    head += String(longitude, 6);
    head += "\r\n";
  }

  // IMAGE
  head += "--";
  head += boundary;
  head += "\r\n";

  head +=
    "Content-Disposition: form-data; "
    "name=\"image\"; "
    "filename=\"esp32cam_snapshot.jpg\"\r\n";

  head +=
    "Content-Type: image/jpeg\r\n\r\n";

  String tail;

  tail =
    "\r\n--" +
    boundary +
    "--\r\n";

  size_t totalLength =
    head.length() +
    fb->len +
    tail.length();

  Serial.println();
  Serial.println(
    "============================================"
  );

  Serial.println(
    "[INCIDENT] Uploading confirmed emergency..."
  );

  Serial.print(
    "[INCIDENT] Event ID: "
  );

  Serial.println(eventId);

  Serial.print(
    "[INCIDENT] Device: "
  );

  Serial.println(DEVICE_ID);

  Serial.print(
    "[INCIDENT] Type: "
  );

  Serial.println(detectionStatus);

  if (hasGps) {

    Serial.print(
      "[INCIDENT] GPS: "
    );

    Serial.print(latitude, 6);
    Serial.print(", ");
    Serial.println(longitude, 6);

  } else {

    Serial.println(
      "[INCIDENT] GPS: LOCATION UNAVAILABLE"
    );
  }

  uint8_t* payload = nullptr;

  if (psramFound()) {

    payload =
      (uint8_t*)ps_malloc(totalLength);

  } else {

    payload =
      (uint8_t*)malloc(totalLength);
  }

  if (payload == nullptr) {

    Serial.println(
      "[INCIDENT] Multipart memory allocation FAILED."
    );

    return false;
  }

  size_t offset = 0;

  memcpy(
    payload + offset,
    head.c_str(),
    head.length()
  );

  offset += head.length();

  memcpy(
    payload + offset,
    fb->buf,
    fb->len
  );

  offset += fb->len;

  memcpy(
    payload + offset,
    tail.c_str(),
    tail.length()
  );

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, url)) {

    Serial.println(
      "[INCIDENT] HTTPS initialization FAILED."
    );

    free(payload);

    return false;
  }

  http.setTimeout(BACKEND_TIMEOUT_MS);

  http.addHeader(
    "Content-Type",
    "multipart/form-data; boundary=" +
    boundary
  );

  int code =
    http.POST(
      payload,
      totalLength
    );

  free(payload);

  bool success =
    (code >= 200 && code < 300);

  if (success) {

    String response =
      http.getString();

    Serial.println(
      "[INCIDENT] SUCCESS."
    );

    Serial.print(
      "[INCIDENT] HTTP "
    );

    Serial.println(code);

    Serial.print(
      "[INCIDENT] Backend response: "
    );

    Serial.println(response);

  } else {

    Serial.print(
      "[INCIDENT] FAILED. HTTP "
    );

    Serial.println(code);

    String response =
      http.getString();

    if (response.length() > 0) {

      Serial.print(
        "[INCIDENT] Server response: "
      );

      Serial.println(response);
    }
  }

  http.end();

  Serial.println(
    "============================================"
  );

  return success;
}

// ============================================================
// 12. ML PROCESSING
// ============================================================

void processFrameWithML() {

  if (
      WiFi.status() != WL_CONNECTED ||
      !cameraReady
     ) {

    return;
  }

  camera_fb_t* fb =
    esp_camera_fb_get();

  if (fb == nullptr) {

    Serial.println(
      "[CAMERA] Frame capture FAILED."
    );

    return;
  }

  if (
      fb->buf == nullptr ||
      fb->len == 0
     ) {

    Serial.println(
      "[CAMERA] Empty frame."
    );

    esp_camera_fb_return(fb);

    return;
  }

  Serial.println();

  Serial.print(
    "[CAPTURE] JPEG: "
  );

  Serial.print(fb->len);

  Serial.println(" bytes");

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;

  if (!http.begin(client, ML_PREDICT_URL)) {

    Serial.println(
      "[ML] HTTPS initialization FAILED."
    );

    esp_camera_fb_return(fb);

    return;
  }

  http.setTimeout(ML_TIMEOUT_MS);

  http.addHeader(
    "Content-Type",
    "application/octet-stream"
  );

  unsigned long start =
    millis();

  int code =
    http.POST(
      fb->buf,
      fb->len
    );

  unsigned long latency =
    millis() - start;

  if (code != 200) {

    Serial.print(
      "[ML] Request FAILED. HTTP "
    );

    Serial.println(code);

    String errorResponse =
      http.getString();

    if (errorResponse.length() > 0) {

      Serial.print(
        "[ML] Response: "
      );

      Serial.println(errorResponse);
    }

    http.end();

    esp_camera_fb_return(fb);

    return;
  }

  String response =
    http.getString();

  http.end();

  Serial.print(
    "[ML] HTTP 200 | "
  );

  Serial.print(latency);

  Serial.println(" ms");

  Serial.print(
    "[ML] "
  );

  Serial.println(response);

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<1024> doc;
#endif

  DeserializationError jsonError =
    deserializeJson(
      doc,
      response
    );

  if (jsonError) {

    Serial.print(
      "[ML] JSON parse FAILED: "
    );

    Serial.println(
      jsonError.c_str()
    );

    esp_camera_fb_return(fb);

    return;
  }

  bool accident =
    doc["accident"] | false;

  bool emergency =
    doc["emergency"] | false;

  const char* rawType =
    doc["type"] | "non_accident";

  const char* result =
    doc["result"] | "normal";

  float score =
    doc["score"] | 0.0f;

  /*
    Some inference implementations expose confidence
    separately. If score is missing/zero, use confidence.
  */

  if (
      score <= 0.0f &&
      !doc["confidence"].isNull()
     ) {

    score =
      doc["confidence"].as<float>();
  }

  if (!(accident || emergency)) {

    Serial.println(
      "[ML] NORMAL SCENE — no incident."
    );

    esp_camera_fb_return(fb);

    return;
  }

  String type =
    String(rawType);

  type.toLowerCase();

  String detectionStatus;

  if (
      type.indexOf("fire") >= 0 ||
      type.indexOf("smoke") >= 0
     ) {

    detectionStatus =
      "FIRE_DETECTED";

  } else if (
      type.indexOf("fall") >= 0
     ) {

    detectionStatus =
      "FALL_DETECTED";

  } else {

    detectionStatus =
      "ACCIDENT_DETECTED";
  }

  Serial.println();
  Serial.println(
    "********************************************"
  );

  Serial.println(
    "          EMERGENCY CONFIRMED"
  );

  Serial.print(
    "Type       : "
  );

  Serial.println(rawType);

  Serial.print(
    "Status     : "
  );

  Serial.println(detectionStatus);

  Serial.print(
    "Confidence : "
  );

  Serial.println(score, 4);

  Serial.print(
    "Result     : "
  );

  Serial.println(result);

  Serial.println(
    "********************************************"
  );

  // Short visual confirmation
  digitalWrite(
    FLASH_LED_PIN,
    HIGH
  );

  delay(100);

  digitalWrite(
    FLASH_LED_PIN,
    LOW
  );

  unsigned long now =
    millis();

  bool cooldownFinished =
    !incidentWasSent ||
    (unsigned long)(
      now - lastIncidentTime
    ) >= INCIDENT_COOLDOWN_MS;

  if (!cooldownFinished) {

    unsigned long elapsed =
      now - lastIncidentTime;

    unsigned long remaining =
      INCIDENT_COOLDOWN_MS - elapsed;

    Serial.print(
      "[COOLDOWN] Duplicate suppressed. "
    );

    Serial.print(
      remaining / 1000
    );

    Serial.println(
      " seconds remaining."
    );

    esp_camera_fb_return(fb);

    return;
  }

  /*
    IMPORTANT:
    Set cooldown only after successful backend creation.
    If backend is temporarily unavailable, a failed request
    should not silently suppress the emergency for 35 seconds.
  */

  bool sent =
    dispatchIncidentToBackend(
      detectionStatus.c_str(),
      score,
      fb
    );

  if (sent) {

    lastIncidentTime =
      millis();

    incidentWasSent =
      true;

    Serial.println(
      "[ALERT] Incident accepted by Golden Minute backend."
    );

  } else {

    Serial.println(
      "[ALERT] Backend did NOT accept incident."
    );
  }

  esp_camera_fb_return(fb);
}

// ============================================================
// 13. SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(1200);

  Serial.println();
  Serial.println(
    "============================================"
  );

  Serial.println(
    " GOLDEN MINUTE — ESP32-CAM"
  );

  Serial.println(
    " Registered Device: CAM-002"
  );

  Serial.println(
    "============================================"
  );

  pinMode(
    STATUS_LED_PIN,
    OUTPUT
  );

  pinMode(
    FLASH_LED_PIN,
    OUTPUT
  );

  digitalWrite(
    STATUS_LED_PIN,
    HIGH
  );

  digitalWrite(
    FLASH_LED_PIN,
    LOW
  );

#if ENABLE_NEO6M_GPS

  Serial.println(
    "[GPS] Neo-6M enabled."
  );

  gpsSerial.begin(
    9600,
    SERIAL_8N1,
    GPS_RX_PIN,
    GPS_TX_PIN
  );

#else

  Serial.println(
    "[GPS] Disabled."
  );

  Serial.println(
    "[GPS] No fake coordinates will be sent."
  );

#endif

  cameraReady =
    initCamera();

  if (!cameraReady) {

    Serial.println(
      "[FATAL] Camera initialization failed."
    );

    while (true) {

      digitalWrite(
        STATUS_LED_PIN,
        !digitalRead(STATUS_LED_PIN)
      );

      delay(250);
    }
  }

  connectToWiFi();

  if (WiFi.status() == WL_CONNECTED) {

    sendHeartbeat();

    // Prevent another heartbeat immediately after boot.
    lastHeartbeatTime =
      millis();
  }

  Serial.println();
  Serial.println(
    "[SYSTEM] Golden Minute camera active."
  );

  Serial.println(
    "[SYSTEM] Device ID: CAM-002"
  );

  Serial.println(
    "[SYSTEM] Waiting for ML detections..."
  );
}

// ============================================================
// 14. MAIN LOOP
// ============================================================

void loop() {

#if ENABLE_NEO6M_GPS

  // Continuously feed GPS parser when enabled.
  while (gpsSerial.available() > 0) {

    gps.encode(
      gpsSerial.read()
    );
  }

#endif

  if (
      WiFi.status() != WL_CONNECTED
     ) {

    Serial.println(
      "[WIFI] Connection lost."
    );

    connectToWiFi();

    delay(500);

    return;
  }

  unsigned long now =
    millis();

  if (
      (unsigned long)(
        now - lastHeartbeatTime
      ) >= HEARTBEAT_INTERVAL_MS
     ) {

    lastHeartbeatTime =
      now;

    sendHeartbeat();
  }

  if (
      (unsigned long)(
        now - lastCaptureTime
      ) >= CAPTURE_INTERVAL_MS
     ) {

    lastCaptureTime =
      now;

    processFrameWithML();
  }

  delay(10);
}