# Emergency Notification & Alarm System Documentation
## Legitimate Strongest Android/iOS Alert Architecture

Emergency notification delivery is the most critical requirement of the **Universal Golden Minute Emergency Response System**. When a severe hazard (road accident, human fall, combustion fire, or critical cardiac arrhythmia) occurs, authorized user devices must be alerted urgently.

---

## 1. Operating System Capabilities vs. Government Infrastructure

> [!IMPORTANT]
> **No Magic Bypasses**: Government Wireless Emergency Alerts (WEA / CMAS) and Presidential Alerts operate through privileged baseband radio firmware and carrier cell-broadcast infrastructure that are strictly inaccessible to normal Android and iOS third-party applications.
>
> Normal applications cannot arbitrarily bypass operating system security models, locked bootloaders, or silent hardware switches. Attempting undocumented root exploits or private APIs violates Google Play and Apple App Store policies.
>
> Our architecture implements the **STRONGEST LEGITIMATE EMERGENCY BEHAVIOR** permitted by the Android and iOS platforms.

---

## 2. Strongest Legitimate Android Alert Implementation

### A. High-Priority FCM Push Message
All emergency notifications use `priority: "high"`:
```json
{
  "message": {
    "topic": "user_emergencies",
    "android": {
      "priority": "HIGH",
      "notification": {
        "channel_id": "emergency_channel_high",
        "sound": "emergency_siren",
        "notification_priority": "PRIORITY_MAX",
        "default_vibrate_timings": true,
        "visibility": "PUBLIC"
      }
    },
    "data": {
      "incidentId": "INC-2026-0001",
      "incidentType": "ROAD_ACCIDENT",
      "latitude": "22.572645",
      "longitude": "88.363892",
      "detectedAt": "2026-10-05T22:30:00Z"
    }
  }
}
```

### B. High-Importance Notification Channel
On Android 8.0+ (API 26+), notifications are governed by Channels. The app initializes:
* **Channel ID**: `emergency_channel_high`
* **Importance**: `NotificationManager.IMPORTANCE_HIGH` (or `IMPORTANCE_MAX`)
* **Sound**: Custom emergency siren audio resource (`R.raw.emergency_siren`)
* **Vibration**: Pattern `[0, 500, 250, 500, 250, 500, 250, 1000]`
* **Lock Screen Visibility**: `Notification.VISIBILITY_PUBLIC` (displays content on locked screen)
* **Category**: `Notification.CATEGORY_ALARM` or `Notification.CATEGORY_EMERGENCY`

### C. Full-Screen Intent (Lock Screen Display)
Where permitted by Android 10+ (API 29+) policy and granted by the user:
* Declare `USE_FULL_SCREEN_INTENT` permission in `AndroidManifest.xml`.
* When an alarm arrives while the phone is locked, Android immediately launches the **Incident Alarm Screen** in full screen, allowing the user to view the accident snapshot and GPS map without unlocking first.

### D. Deep Linking
Tapping the notification immediately passes `incidentId` via deep link URL:
```
goldenminute://incident/INC-2026-0001
```
directly opening the exact incident view.

---

## 3. Platform & OEM Constraints Matrix

| Condition | Android Behavior | Required User / System Setting |
| :--- | :--- | :--- |
| **App in Foreground** | In-app Audio Siren + Animated Red Banner | User gesture allowed audio |
| **App in Background** | Heads-up banner + Custom Siren Audio + Vibration | Notification permission granted |
| **Screen Locked** | Lock-screen prominent card + Full-screen intent | Full-screen intent permission enabled |
| **Do Not Disturb (DND)** | Standard apps are silenced unless user grants DND Access | Settings -> Apps -> Special App Access -> Do Not Disturb Access |
| **Battery Saver / Doze** | FCM High-Priority messages wake the CPU from Doze | Battery Optimization: "Unrestricted" recommended |
| **OEM Aggressive Killers** (MIUI, ColorOS, EMUI) | Background tasks may be killed if app is not autostarted | User must enable "Autostart" and disable aggressive battery saving |

---

## 4. Token Resolution & User Privacy Isolation

Under **Rule K (Device Ownership)**:
1. When `WRIST-001` or `CAM-001` triggers an alert, the backend resolves `owner_user_id`.
2. The backend queries `notification_tokens` **only for that owner**.
3. Push alerts are dispatched **exclusively to the owner's authorized phones**.
4. Unrelated users never receive private emergency coordinates, snapshots, or medical telemetry.
