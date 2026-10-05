# Firebase Cloud Messaging (FCM) Setup Guide

This guide walks through configuring Firebase Cloud Messaging for the **AI-Based Accident Detection & Emergency Response System**.

---

## 1. Create Firebase Project

1. Visit [Firebase Console](https://console.firebase.google.com/).
2. Create a project named `Universal-Golden-Minute`.
3. Navigate to **Project Settings > Cloud Messaging**.
4. Enable the **Firebase Cloud Messaging API (V1)**.
5. Under **Service Accounts**, click **Generate New Private Key** to download the `firebase-adminsdk.json` file.

---

## 2. Configure Backend Credentials

1. Place `firebase-adminsdk.json` into `backend/app/core/credentials/`.
2. In `backend/.env`, set:
```env
FIREBASE_CREDENTIALS_PATH="backend/app/core/credentials/firebase-adminsdk.json"
FCM_SERVER_KEY="<YOUR_FCM_SERVER_KEY>"
```

---

## 3. Registering Mobile Devices

When a user logs into the mobile app, the app obtains the FCM registration token and calls:
```http
POST /api/notifications/register-device
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json

{
  "platform": "ANDROID",
  "fcm_token": "fcm_token_string_from_device",
  "device_name": "Samsung Galaxy S24"
}
```

The backend stores this token in `notification_tokens` linked to the user's `user_id`. When that user's wristband or camera detects an incident, high-priority notifications are automatically dispatched to this registered token.
