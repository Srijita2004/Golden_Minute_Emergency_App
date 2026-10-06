package org.goldenminute.hospitalreceiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

class GoldenMinuteFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "GM_FCM_Service"
        const val CHANNEL_ID = "golden_minute_emergency_channel"
        const val CHANNEL_NAME = "Golden Minute Emergency Alerts"
        
        // Incident deduplication cache (stores recently notified incident IDs with expiry)
        private val seenIncidents = ConcurrentHashMap<String, Long>()
        private const val DEDUP_WINDOW_MS = 60_000L // 1 minute window
    }

    override fun onCreate() {
        super.onCreate()
        createEmergencyNotificationChannel()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "📡 Incoming FCM Emergency Message from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val incidentId = data["incidentId"] ?: data["incident_id"] ?: "INC-${System.currentTimeMillis()}"
        val incidentType = data["incidentType"] ?: data["incident_type"] ?: "EMERGENCY"
        val sourceType = data["sourceType"] ?: data["source_type"] ?: "SYSTEM"
        val latitude = data["latitude"]?.toDoubleOrNull()
        val longitude = data["longitude"]?.toDoubleOrNull()
        val bpm = data["bpm"]?.toIntOrNull()
        val confidence = data["confidence"]?.toDoubleOrNull()
        val imageUrl = data["imageUrl"] ?: data["image_url"]

        // 1. Deduplication Check
        val now = System.currentTimeMillis()
        val lastSeen = seenIncidents[incidentId]
        if (lastSeen != null && (now - lastSeen) < DEDUP_WINDOW_MS) {
            Log.w(TAG, "⚠️ Deduplicating repeated FCM notification for Incident: $incidentId")
            return
        }
        seenIncidents[incidentId] = now

        // 2. Acquire High-Priority WakeLock to awaken sleeping/locked hardware
        val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "GoldenMinute:EmergencyAlertWakeLock"
        )
        wakeLock?.acquire(10_000L) // 10 seconds timeout

        // 3. Dispatch Full-Screen Lockscreen Alert & Notification
        dispatchEmergencyNotification(
            incidentId = incidentId,
            incidentType = incidentType,
            sourceType = sourceType,
            latitude = latitude,
            longitude = longitude,
            bpm = bpm,
            confidence = confidence,
            imageUrl = imageUrl
        )
    }

    private fun dispatchEmergencyNotification(
        incidentId: String,
        incidentType: String,
        sourceType: String,
        latitude: Double?,
        longitude: Double?,
        bpm: Int?,
        confidence: Double?,
        imageUrl: String?
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createEmergencyNotificationChannel()

        // Target intent for Fullscreen Lockscreen Activity
        val alertIntent = Intent(this, EmergencyAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("incident_id", incidentId)
            putExtra("incident_type", incidentType)
            putExtra("source_type", sourceType)
            if (latitude != null) putExtra("latitude", latitude)
            if (longitude != null) putExtra("longitude", longitude)
            if (bpm != null) putExtra("bpm", bpm)
            if (confidence != null) putExtra("confidence", confidence)
            if (imageUrl != null) putExtra("image_url", imageUrl)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            incidentId.hashCode(),
            alertIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Alarm Ringtone & Vibration Pattern
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200)

        val readableHazard = incidentType.replace('_', ' ')
        val bodyText = buildString {
            append("Source: $sourceType • ")
            if (latitude != null && longitude != null) {
                append("GPS: %.4f, %.4f • ".format(latitude, longitude))
            }
            if (bpm != null) {
                append("Pulse: $bpm BPM • ")
            }
            append("Immediate trauma team response required.")
        }

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("🚨 EMERGENCY: $readableHazard")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(alarmSound)
            .setVibrate(vibrationPattern)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_view,
                "REVIEW & ACKNOWLEDGE",
                fullScreenPendingIntent
            )

        val notificationId = incidentId.hashCode()
        notificationManager.notify(notificationId, notificationBuilder.build())
        Log.i(TAG, "🚨 [HOSPITAL RECEIVER] Emergency Notification dispatched successfully for: $incidentId")
    }

    private fun createEmergencyNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "High-priority alarms and life-critical accident alerts for hospital staff."
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    setBypassDnd(true) // Emergency channel bypasses Do Not Disturb if system allows

                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                    val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    setSound(alarmSound, audioAttributes)
                }
                notificationManager.createNotificationChannel(channel)
                Log.d(TAG, "✅ Emergency Notification Channel created with USAGE_ALARM attributes.")
            }
        }
    }

    override fun onNewToken(token: String) {
        Log.i(TAG, "🔑 New FCM Registration Token received: $token")
        val prefs = getSharedPreferences("golden_minute_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()

        // Sync with backend if logged in
        val authToken = prefs.getString("auth_token", null)
        val backendUrl = prefs.getString("backend_url", "https://golden-minute-emergency-backend.onrender.com") ?: ""
        if (!authToken.isNullOrEmpty()) {
            registerTokenWithBackend(backendUrl, token, authToken)
        }
    }

    private fun registerTokenWithBackend(baseUrl: String, fcmToken: String, authToken: String) {
        Thread {
            try {
                val client = OkHttpClient()
                val json = JSONObject().apply {
                    put("token", fcmToken)
                    put("platform", "android")
                    put("device_info", "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})")
                }
                val body = json.toString().toRequestBody("application/json".toMediaTypeOrNull())
                val request = Request.Builder()
                    .url("${baseUrl.trimEnd('/')}/api/notifications/register-token")
                    .addHeader("Authorization", "Bearer $authToken")
                    .post(body)
                    .build()

                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        Log.i(TAG, "✅ Device Token successfully registered with Golden Minute backend.")
                    } else {
                        Log.e(TAG, "❌ Failed to register token with backend: HTTP ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception registering token with backend", e)
            }
        }.start()
    }
}
