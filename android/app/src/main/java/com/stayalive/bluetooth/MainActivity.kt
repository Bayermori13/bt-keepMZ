package com.stayalive.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private var isServiceRunning = false
    private lateinit var statusText: TextView
    private lateinit var deviceNameText: TextView
    private lateinit var batteryText: TextView
    private lateinit var focusStateText: TextView
    private lateinit var toggleButton: Button

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                KeepAliveService.ACTION_STATUS_CHANGED -> {
                    isServiceRunning = intent.getBooleanExtra(KeepAliveService.EXTRA_IS_ACTIVE, false)
                    updateUI()
                }
                KeepAliveService.ACTION_FOCUS_CHANGED -> {
                    val focus = intent.getStringExtra(KeepAliveService.EXTRA_FOCUS_STATE) ?: "ACTIVE"
                    focusStateText.text = if (focus == "PAUSED_FOR_EXTERNAL_AUDIO") {
                        "پخش سکوت موقتا متوقف شد (تماس یا موزیک در حال پخش است)"
                    } else {
                        "پخش سکوت فعال است (هندزفری بیدار نگه داشته شده)"
                    }
                }
                KeepAliveService.ACTION_DEVICE_UPDATED -> {
                    val name = intent.getStringExtra(KeepAliveService.EXTRA_DEV_NAME) ?: "Unknown"
                    val battery = intent.getIntExtra(KeepAliveService.EXTRA_DEV_BATTERY, -1)
                    val connected = intent.getBooleanExtra(KeepAliveService.EXTRA_DEV_CONNECTED, false)
                    
                    deviceNameText.text = if (connected) name else "دستگاهی متصل نیست"
                    batteryText.text = if (battery >= 0) "$battery%" else "نامشخص"
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.tvServiceStatus)
        deviceNameText = findViewById(R.id.tvDeviceName)
        batteryText = findViewById(R.id.tvBatteryLevel)
        focusStateText = findViewById(R.id.tvFocusState)
        toggleButton = findViewById(R.id.btnToggleKeepAlive)

        checkAndRequestPermissions()

        toggleButton.setOnClickListener {
            if (isServiceRunning) {
                stopKeepAliveService()
            } else {
                startKeepAliveService()
            }
        }

        val filter = IntentFilter().apply {
            addAction(KeepAliveService.ACTION_STATUS_CHANGED)
            addAction(KeepAliveService.ACTION_FOCUS_CHANGED)
            addAction(KeepAliveService.ACTION_DEVICE_UPDATED)
        }
        registerReceiver(statusReceiver, filter)
    }

    private fun checkAndRequestPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.BLUETOOTH_SCAN)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toTypedArray(), 101)
        }
    }

    private fun startKeepAliveService() {
        val serviceIntent = Intent(this, KeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        isServiceRunning = true
        updateUI()
        Toast.makeText(this, "سرویس فعال شد - هندزفری خاموش نمی‌شود", Toast.LENGTH_SHORT).show()
    }

    private fun stopKeepAliveService() {
        val serviceIntent = Intent(this, KeepAliveService::class.java).apply {
            action = KeepAliveService.ACTION_STOP
        }
        startService(serviceIntent)
        isServiceRunning = false
        updateUI()
        Toast.makeText(this, "سرویس متوقف شد", Toast.LENGTH_SHORT).show()
    }

    private fun updateUI() {
        if (isServiceRunning) {
            statusText.text = "فعال (در حال زنده نگه‌داشتن اتصال)"
            statusText.setTextColor(ContextCompat.getColor(this, android.R.color.holo_green_light))
            toggleButton.text = "خاموش کردن سرویس"
        } else {
            statusText.text = "غیرفعال"
            statusText.setTextColor(ContextCompat.getColor(this, android.R.color.darker_gray))
            toggleButton.text = "روشن کردن سرویس"
        }
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(statusReceiver)
        } catch (e: Exception) {
            // Unregistered
        }
        super.onDestroy()
    }
}
