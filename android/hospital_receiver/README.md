# Golden Minute — Native Android Hospital Emergency Receiver

This native Android application serves as a dedicated, high-priority emergency alert receiver for hospitals and trauma response teams using the **Golden Minute** accident response network.

---

## Architecture Overview

```
Confirmed Incident (Phone AI / ESP32-CAM / Wristband)
                 │
                 ▼
       Golden Minute Backend
                 │
                 ▼
       Firebase Cloud Messaging (FCM)
                 │
                 ▼
  Golden Minute Hospital Receiver
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
Emergency Channel       Full-Screen Lockscreen Alert
(USAGE_ALARM)           (Wakes display & plays continuous siren)
```

---

## Capabilities & Permissions

1. **Lock-Screen Full Screen Alert:**
   Uses `setShowWhenLocked(true)` and `setTurnScreenOn(true)` via `USE_FULL_SCREEN_INTENT` to wake up locked devices immediately upon incoming trauma incidents.

2. **High-Priority USAGE_ALARM Audio Channel:**
   Notifications are delivered on a dedicated `NotificationChannel` with `AudioAttributes.USAGE_ALARM` and bypass-DND capability.

3. **Continuous Siren & Waveform Vibration:**
   Plays loop siren tone and continuous multi-stage vibration pattern `longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200)` until explicitly acknowledged.

4. **Incident Deduplication:**
   Incoming notifications are deduplicated against a high-frequency time cache using the unique `incidentId`.

5. **Acknowledge Workflow:**
   Clicking **"STOP SIREN & ACKNOWLEDGE ALERT"** immediately silences hardware audio/vibration and dispatches an authenticated PATCH request to `/api/incidents/{incidentId}/status` marking the incident `ACKNOWLEDGED`.

---

## How to Build & Install

1. Open this folder in **Android Studio** (`File > Open > android/hospital_receiver`).
2. Add your Firebase `google-services.json` into the `app/` directory (or use default configuration).
3. Build the APK:
   ```bash
   ./gradlew assembleDebug
   ```
4. Install on device:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. Launch the app, enter your Hospital Admin credentials, and tap **"AUTHENTICATE & ARM RECEIVER"**.
