package org.goldenminute.hospitalreceiver

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class EmergencyAlertActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var isAlarmSilenced = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Wake screen and show over Keyguard / Lockscreen
        configureLockScreenDisplay()

        // 2. Set UI layout programmatically
        val layout = createAlertLayout()
        setContentView(layout)

        // 3. Start high-priority Siren Audio & Vibration
        startEmergencyAlarm()
    }

    private fun configureLockScreenDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }

    private fun createAlertLayout(): android.view.View {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#7F1D1D")) // Deep emergency red
            setPadding(48, 64, 48, 64)
            gravity = android.view.Gravity.CENTER_HORIZONTAL
        }

        val incidentId = intent.getStringExtra("incident_id") ?: "INC-TEST"
        val incidentType = intent.getStringExtra("incident_type") ?: "EMERGENCY"
        val sourceType = intent.getStringExtra("source_type") ?: "UNKNOWN"
        val lat = intent.getDoubleExtra("latitude", 0.0)
        val lon = intent.getDoubleExtra("longitude", 0.0)
        val bpm = intent.getIntExtra("bpm", 0)

        val headerText = TextView(this).apply {
            text = "🚨 CRITICAL TRAUMA ALERT"
            textSize = 24f
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.CENTER
        }
        root.addView(headerText)

        val typeText = TextView(this).apply {
            text = incidentType.replace('_', ' ')
            textSize = 28f
            setTextColor(android.graphics.Color.parseColor("#FDE047")) // Bright warning yellow
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.CENTER
            setPadding(0, 16, 0, 16)
        }
        root.addView(typeText)

        val detailsCard = TextView(this).apply {
            text = buildString {
                append("Incident ID: $incidentId\n")
                append("Hardware Source: $sourceType\n")
                if (lat != 0.0 && lon != 0.0) {
                    append("Location: %.4f, %.4f\n".format(lat, lon))
                }
                if (bpm > 0) {
                    append("Heart Rate: $bpm BPM (Cardiac Alert)\n")
                }
                append("Status: ACTIVE (Trauma Response Needed)")
            }
            textSize = 15f
            setTextColor(android.graphics.Color.parseColor("#F3F4F6"))
            setBackgroundColor(android.graphics.Color.parseColor("#18181B"))
            setPadding(32, 32, 32, 32)
        }
        root.addView(detailsCard)

        // Google Maps Button if coordinates exist
        if (lat != 0.0 && lon != 0.0) {
            val mapsButton = Button(this).apply {
                text = "📍 Open Incident in Google Maps"
                setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
                setTextColor(android.graphics.Color.WHITE)
                setOnClickListener {
                    val mapUri = Uri.parse("geo:$lat,$lon?q=$lat,$lon(Emergency+Incident)")
                    val mapIntent = Intent(Intent.ACTION_VIEW, mapUri)
                    startActivity(mapIntent)
                }
            }
            root.addView(mapsButton)
        }

        // Prominent STOP SIREN & ACKNOWLEDGE Button
        val ackButton = Button(this).apply {
            text = "STOP SIREN & ACKNOWLEDGE ALERT"
            textSize = 16f
            setTextColor(android.graphics.Color.parseColor("#991B1B"))
            setBackgroundColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 32, 0, 32)
            setOnClickListener {
                acknowledgeEmergency(incidentId)
            }
        }
        val params = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 48
        }
        root.addView(ackButton, params)

        return root
    }

    private fun startEmergencyAlarm() {
        try {
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alarmUri)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }

            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) // Loop at 0
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopEmergencyAlarm() {
        if (isAlarmSilenced) return
        isAlarmSilenced = true

        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null

            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun acknowledgeEmergency(incidentId: String) {
        stopEmergencyAlarm()

        // Cancel status notification
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(incidentId.hashCode())

        // Post ACKNOWLEDGED status to Golden Minute backend
        val prefs = getSharedPreferences("golden_minute_prefs", Context.MODE_PRIVATE)
        val authToken = prefs.getString("auth_token", null)
        val backendUrl = prefs.getString("backend_url", "https://golden-minute-emergency-backend.onrender.com") ?: ""

        if (!authToken.isNullOrEmpty() && incidentId.isNotEmpty()) {
            Thread {
                try {
                    val client = OkHttpClient()
                    val json = JSONObject().apply {
                        put("status", "ACKNOWLEDGED")
                    }
                    val body = json.toString().toRequestBody("application/json".toMediaTypeOrNull())
                    val request = Request.Builder()
                        .url("${backendUrl.trimEnd('/')}/api/incidents/$incidentId/status")
                        .addHeader("Authorization", "Bearer $authToken")
                        .patch(body)
                        .build()

                    client.newCall(request).execute().use { response ->
                        runOnUiThread {
                            if (response.isSuccessful) {
                                Toast.makeText(this, "Alert Acknowledged on Server.", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(this, "Acknowledged locally (Server status: ${response.code})", Toast.LENGTH_SHORT).show()
                            }
                            finish()
                        }
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        Toast.makeText(this, "Alarm Silenced. Response recorded.", Toast.LENGTH_SHORT).show()
                        finish()
                    }
                }
            }.start()
        } else {
            Toast.makeText(this, "Alarm Silenced & Acknowledged.", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopEmergencyAlarm()
    }
}
