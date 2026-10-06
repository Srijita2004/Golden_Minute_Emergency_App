package org.goldenminute.hospitalreceiver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var backendUrlInput: EditText
    private lateinit var loginButton: Button
    private lateinit var testAlertButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(createMainLayout())

        requestEmergencyPermissions()
        refreshReceiverStatus()
    }

    private fun createMainLayout(): android.view.View {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.parseColor("#090D16"))
            setPadding(40, 48, 40, 48)
        }

        val header = TextView(this).apply {
            text = "GOLDEN MINUTE\nHospital Emergency Receiver"
            textSize = 22f
            setTextColor(android.graphics.Color.WHITE)
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 32)
        }
        root.addView(header)

        statusText = TextView(this).apply {
            text = "Checking receiver readiness..."
            textSize = 13f
            setTextColor(android.graphics.Color.parseColor("#34D399")) // Emerald
            setBackgroundColor(android.graphics.Color.parseColor("#131C2E"))
            setPadding(24, 24, 24, 24)
        }
        root.addView(statusText)

        val sectionLabel = TextView(this).apply {
            text = "\nHospital / Admin Authentication"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#94A3B8"))
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        root.addView(sectionLabel)

        backendUrlInput = EditText(this).apply {
            hint = "Backend URL"
            setText(getSharedPreferences("golden_minute_prefs", Context.MODE_PRIVATE)
                .getString("backend_url", "https://golden-minute-emergency-backend.onrender.com"))
            setTextColor(android.graphics.Color.WHITE)
            textSize = 12f
        }
        root.addView(backendUrlInput)

        emailInput = EditText(this).apply {
            hint = "Hospital Admin Email"
            setTextColor(android.graphics.Color.WHITE)
            textSize = 13f
        }
        root.addView(emailInput)

        passwordInput = EditText(this).apply {
            hint = "Password"
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            setTextColor(android.graphics.Color.WHITE)
            textSize = 13f
        }
        root.addView(passwordInput)

        loginButton = Button(this).apply {
            text = "AUTHENTICATE & ARM RECEIVER"
            setBackgroundColor(android.graphics.Color.parseColor("#4F46E5")) // Indigo
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                performLogin()
            }
        }
        root.addView(loginButton)

        testAlertButton = Button(this).apply {
            text = "🚨 TEST LOCAL EMERGENCY SIREN & LOCKSCREEN"
            setBackgroundColor(android.graphics.Color.parseColor("#DC2626")) // Red
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                triggerLocalTestAlert()
            }
        }
        val testParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 40
        }
        root.addView(testAlertButton, testParams)

        return root
    }

    private fun requestEmergencyPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }
    }

    private fun refreshReceiverStatus() {
        val prefs = getSharedPreferences("golden_minute_prefs", Context.MODE_PRIVATE)
        val token = prefs.getString("auth_token", null)
        val fcmToken = prefs.getString("fcm_token", null)

        val status = buildString {
            append("• PUSH ENGINE: Firebase Cloud Messaging\n")
            append("• CHANNEL: Highest Priority (USAGE_ALARM)\n")
            if (token != null) {
                append("• AUTH: Hospital Authenticated ✓\n")
            } else {
                append("• AUTH: Pending Credentials (Enter email/pass)\n")
            }
            if (fcmToken != null) {
                append("• DEVICE TOKEN: Registered (${fcmToken.take(12)}...)\n")
                append("• STATUS: ARMED & LISTENING FOR EMERGENCIES")
            } else {
                append("• DEVICE TOKEN: Awaiting FCM Handshake...")
            }
        }
        statusText.text = status

        // Fetch FCM token if null
        if (fcmToken == null) {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful && task.result != null) {
                    val newToken = task.result
                    prefs.edit().putString("fcm_token", newToken).apply()
                    refreshReceiverStatus()
                }
            }
        }
    }

    private fun performLogin() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString().trim()
        val baseUrl = backendUrlInput.text.toString().trim()

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please enter email and password", Toast.LENGTH_SHORT).show()
            return
        }

        loginButton.isEnabled = false
        loginButton.text = "Authenticating..."

        Thread {
            try {
                val client = OkHttpClient()
                val json = JSONObject().apply {
                    put("email", email)
                    put("password", password)
                }
                val body = json.toString().toRequestBody("application/json".toMediaTypeOrNull())
                val request = Request.Builder()
                    .url("${baseUrl.trimEnd('/')}/api/auth/login")
                    .post(body)
                    .build()

                client.newCall(request).execute().use { response ->
                    val respStr = response.body?.string() ?: ""
                    if (response.isSuccessful) {
                        val respJson = JSONObject(respStr)
                        val token = respJson.getString("access_token")
                        val userObj = respJson.getJSONObject("user")
                        val role = userObj.optString("role", "USER")

                        if (role.uppercase() != "ADMIN" && role.uppercase() != "HOSPITAL") {
                            runOnUiThread {
                                Toast.makeText(this, "Account role ($role) is not authorized for Hospital Receiver.", Toast.LENGTH_LONG).show()
                                loginButton.isEnabled = true
                                loginButton.text = "AUTHENTICATE & ARM RECEIVER"
                            }
                            return@use
                        }

                        val prefs = getSharedPreferences("golden_minute_prefs", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("auth_token", token)
                            .putString("backend_url", baseUrl)
                            .putString("user_role", role)
                            .apply()

                        // Sync FCM Token with backend
                        val fcmToken = prefs.getString("fcm_token", null)
                        if (fcmToken != null) {
                            registerTokenWithBackend(baseUrl, fcmToken, token)
                        }

                        runOnUiThread {
                            Toast.makeText(this, "Hospital Command Armed Successfully!", Toast.LENGTH_SHORT).show()
                            loginButton.isEnabled = true
                            loginButton.text = "RECEIVER ARMED & ACTIVE"
                            refreshReceiverStatus()
                        }
                    } else {
                        runOnUiThread {
                            Toast.makeText(this, "Login failed: HTTP ${response.code}", Toast.LENGTH_SHORT).show()
                            loginButton.isEnabled = true
                            loginButton.text = "AUTHENTICATE & ARM RECEIVER"
                        }
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    loginButton.isEnabled = true
                    loginButton.text = "AUTHENTICATE & ARM RECEIVER"
                }
            }
        }.start()
    }

    private fun registerTokenWithBackend(baseUrl: String, fcmToken: String, authToken: String) {
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

        client.newCall(request).execute().close()
    }

    private fun triggerLocalTestAlert() {
        val testIntent = Intent(this, EmergencyAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("incident_id", "TEST-TRAUMA-${System.currentTimeMillis()}")
            putExtra("incident_type", "ROAD_ACCIDENT")
            putExtra("source_type", "PHONE_AI")
            putExtra("latitude", 22.5726)
            putExtra("longitude", 88.3639)
            putExtra("confidence", 0.94)
        }
        startActivity(testIntent)
    }
}
