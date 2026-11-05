package com.stayalive.bluetooth

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class KeepAliveService : Service(), AudioManager.OnAudioFocusChangeListener {

    companion object {
        const val TAG = "KeepAliveService"
        const val CHANNEL_ID = "bt_stayalive_foreground_channel"
        const val NOTIFICATION_ID = 2001

        const val ACTION_STOP = "com.stayalive.bluetooth.ACTION_STOP"
        const val ACTION_STATUS_CHANGED = "com.stayalive.bluetooth.STATUS_CHANGED"
        const val ACTION_FOCUS_CHANGED = "com.stayalive.bluetooth.FOCUS_CHANGED"
        const val ACTION_DEVICE_UPDATED = "com.stayalive.bluetooth.DEVICE_UPDATED"

        const val EXTRA_IS_ACTIVE = "extra_is_active"
        const val EXTRA_FOCUS_STATE = "extra_focus_state"
        const val EXTRA_DEV_NAME = "extra_dev_name"
        const val EXTRA_DEV_ADDR = "extra_dev_addr"
        const val EXTRA_DEV_BATTERY = "extra_dev_battery"
        const val EXTRA_DEV_CONNECTED = "extra_dev_connected"

        @Volatile
        var isServiceRunning: Boolean = false
            private set
    }

    private val binder = LocalBinder()
    private var audioTrack: AudioTrack? = null
    private var audioManager: AudioManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val isPlaying = AtomicBoolean(false)
    private var keepAliveThread: Thread? = null

    // Service Configuration
    var mode: KeepAliveMode = KeepAliveMode.PURE_SILENCE
    var intervalSeconds: Int = 0 // 0 = continuous stream, >0 = periodic burst
    var isMutedByFocus: Boolean = false

    // Device telemetry
    var currentDeviceName: String = "در انتظار اتصال دستگاه"
    var currentDeviceAddress: String = ""
    var currentDeviceBattery: Int = -1 // -1 = unknown
    var isDeviceConnected: Boolean = false

    enum class KeepAliveMode {
        PURE_SILENCE,       // Pure 0 PCM digital silence
        INAUDIBLE_SUB_BASS, // 15 Hz inaudible sine wave (prevents aggressive DAC sleep)
        PERIODIC_PING       // Micro-burst every X seconds
    }

    inner class LocalBinder : Binder() {
        fun getService(): KeepAliveService = this@KeepAliveService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "KeepAliveService onCreate started.")

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // 1. Create Notification Channel immediately
        createNotificationChannel()

        // 2. Start Foreground immediately in onCreate to satisfy Android OS 8+ requirement
        promoteToForeground("سرویس زنده نگه‌داشتن بلوتوث فعال است (استریم پیوسته سکوت)")

        // 3. Acquire Partial WakeLock to keep CPU running when screen turns off
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BluetoothStayAlive::WakeLock").apply {
            setReferenceCounted(false)
        }

        registerBluetoothReceiver()
        checkInitialBluetoothStatus()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "KeepAliveService onStartCommand invoked. action=${intent?.action}")

        val action = intent?.action
        if (action == ACTION_STOP) {
            Log.i(TAG, "KeepAliveService received ACTION_STOP. Terminating service...")
            stopKeepAlive()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
            return START_NOT_STICKY
        }

        // Ensure foreground notification remains persistent and updated
        promoteToForeground(
            if (isDeviceConnected) "متصل به: $currentDeviceName (پخش سکوت فعال)"
            else "سرویس زنده نگه‌داشتن بلوتوث فعال است (استریم پیوسته)"
        )

        startKeepAlive()

        return START_STICKY
    }

    /**
     * Promotes this service to Android Foreground Service status with a non-dismissible notification.
     */
    private fun promoteToForeground(contentText: String) {
        val notification = buildNotification(contentText)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isServiceRunning = true
            Log.i(TAG, "Successfully bound to FOREGROUND with non-dismissible notification.")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}", e)
        }
    }

    /**
     * Creates the Android 8.0+ (Oreo) Notification Channel
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "سرویس زنده نگه‌داشتن بلوتوث MZ",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "جلوگیری از قطع خودکار یا خاموش شدن هندزفری‌های بلوتوث با ارسال سکوت دیجیتال"
                    setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                }
                manager.createNotificationChannel(channel)
                Log.i(TAG, "NotificationChannel created: $CHANNEL_ID")
            }
        }
    }

    /**
     * Builds the persistent, non-dismissible Foreground Notification
     */
    private fun buildNotification(contentText: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val stopIntent = Intent(this, KeepAliveService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MZ Bluetooth Keeper")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "توقف سرویس", stopPendingIntent)
            .setOngoing(true) // Cannot be dismissed by swiping away
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    /**
     * Initializes AudioTrack and streams silent 16-bit PCM samples to prevent the Bluetooth DAC from sleeping.
     */
    private fun startKeepAlive() {
        if (isPlaying.get()) {
            Log.i(TAG, "startKeepAlive called but audio stream is already running.")
            return
        }

        wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24 hours max
        isPlaying.set(true)
        isServiceRunning = true

        requestSmartAudioFocus()

        keepAliveThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(4096)

            Log.i(TAG, "AudioTrack configuration: sampleRate=$sampleRate, bufferSize=$bufferSize bytes")

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(audioAttributes)
                .setAudioFormat(audioFormat)
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            try {
                audioTrack?.play()
                Log.i(TAG, "AudioTrack playback started successfully. Continuous silent stream is active.")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start AudioTrack playback", e)
            }

            val zeroBuffer = ShortArray(bufferSize / 2) // Pure zeros (digital silence)
            val subBassBuffer = ShortArray(bufferSize / 2) { i ->
                // 15 Hz inaudible sine wave
                val angle = 2.0 * Math.PI * i * 15.0 / sampleRate
                (Math.sin(angle) * 120.0).toInt().toShort()
            }

            var pulseCounter = 0L
            while (isPlaying.get()) {
                val bufferToWrite = when (mode) {
                    KeepAliveMode.PURE_SILENCE -> zeroBuffer
                    KeepAliveMode.INAUDIBLE_SUB_BASS -> subBassBuffer
                    KeepAliveMode.PERIODIC_PING -> zeroBuffer
                }

                val written = audioTrack?.write(bufferToWrite, 0, bufferToWrite.size) ?: 0
                pulseCounter++

                // Explicit log every ~100 writes (approx every 5-10 seconds) for Logcat inspection
                if (pulseCounter % 100L == 1L) {
                    Log.d(
                        TAG,
                        "KeepAlive silent pulse active: wrote $written shorts (mode=$mode, pulsesSent=$pulseCounter). Bluetooth A2DP audio link kept alive."
                    )
                }

                if (mode == KeepAliveMode.PERIODIC_PING && intervalSeconds > 0) {
                    Thread.sleep(intervalSeconds * 1000L)
                }
            }

            try {
                audioTrack?.stop()
                audioTrack?.release()
                Log.i(TAG, "AudioTrack stopped and released.")
            } catch (e: Exception) {
                Log.w(TAG, "Exception during AudioTrack cleanup", e)
            }
            audioTrack = null
        }.apply {
            name = "KeepAlive-AudioTrack-Thread"
            start()
        }

        broadcastStatusChange(true)
    }

    private fun stopKeepAlive() {
        Log.i(TAG, "Stopping KeepAlive audio stream...")
        isPlaying.set(false)
        isServiceRunning = false
        keepAliveThread?.interrupt()
        keepAliveThread = null

        audioManager?.abandonAudioFocus(this)

        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }

        broadcastStatusChange(false)
    }

    private fun requestSmartAudioFocus() {
        // Request audio focus with MAY_DUCK so Android allows concurrent mixing
        audioManager?.requestAudioFocus(
            this,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
        )
    }

    override fun onAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                Log.d(TAG, "Audio focus transient ducking: call or music active, stream continues concurrently.")
                broadcastFocusChange("CONCURRENT_STREAM_ACTIVE")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.i(TAG, "Audio focus returned: prevented headset auto-sleep timeout!")
                broadcastFocusChange("PREVENTED_DISCONNECT_HEADSET_SAVED")
            }
        }
    }

    private val bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothDevice.ACTION_ACL_CONNECTED -> {
                    val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    device?.let {
                        currentDeviceName = try { it.name ?: "هندزفری بلوتوث" } catch (e: SecurityException) { "هندزفری بلوتوث" }
                        currentDeviceAddress = it.address ?: ""
                        isDeviceConnected = true
                        Log.i(TAG, "Bluetooth device connected: $currentDeviceName ($currentDeviceAddress)")
                        updateNotification("متصل به: $currentDeviceName (پخش سکوت فعال)")
                        broadcastDeviceUpdate()
                    }
                }
                BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                    isDeviceConnected = false
                    Log.i(TAG, "Bluetooth device disconnected. Waiting for reconnection...")
                    updateNotification("دستگاه قطع شد - در انتظار اتصال مجدد")
                    broadcastDeviceUpdate()
                }
                "android.bluetooth.device.action.BATTERY_LEVEL_CHANGED" -> {
                    currentDeviceBattery = intent.getIntExtra("android.bluetooth.device.extra.BATTERY_LEVEL", -1)
                    Log.d(TAG, "Device battery level updated: $currentDeviceBattery%")
                    broadcastDeviceUpdate()
                }
            }
        }
    }

    private fun registerBluetoothReceiver() {
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
            addAction("android.bluetooth.device.action.BATTERY_LEVEL_CHANGED")
        }
        registerReceiver(bluetoothReceiver, filter)
    }

    private fun checkInitialBluetoothStatus() {
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
            if (adapter != null && adapter.isEnabled) {
                val bonded = adapter.bondedDevices
                if (bonded != null) {
                    for (dev in bonded) {
                        currentDeviceName = dev.name ?: "هندزفری بلوتوث"
                        currentDeviceAddress = dev.address ?: ""
                        isDeviceConnected = true
                        Log.i(TAG, "Initial bonded device identified: $currentDeviceName ($currentDeviceAddress)")
                        break
                    }
                }
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Bluetooth permission not yet granted during initial check: ${e.message}")
        }
    }

    private fun broadcastStatusChange(active: Boolean) {
        val intent = Intent(ACTION_STATUS_CHANGED).apply {
            putExtra(EXTRA_IS_ACTIVE, active)
        }
        sendBroadcast(intent)
    }

    private fun broadcastFocusChange(reason: String) {
        val intent = Intent(ACTION_FOCUS_CHANGED).apply {
            putExtra(EXTRA_FOCUS_STATE, reason)
        }
        sendBroadcast(intent)
    }

    private fun broadcastDeviceUpdate() {
        val intent = Intent(ACTION_DEVICE_UPDATED).apply {
            putExtra(EXTRA_DEV_NAME, currentDeviceName)
            putExtra(EXTRA_DEV_ADDR, currentDeviceAddress)
            putExtra(EXTRA_DEV_BATTERY, currentDeviceBattery)
            putExtra(EXTRA_DEV_CONNECTED, isDeviceConnected)
        }
        sendBroadcast(intent)
    }

    override fun onDestroy() {
        Log.i(TAG, "KeepAliveService onDestroy invoked.")
        stopKeepAlive()
        try {
            unregisterReceiver(bluetoothReceiver)
        } catch (e: Exception) {
            // Already unregistered
        }
        super.onDestroy()
    }
}
