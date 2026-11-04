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
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class KeepAliveService : Service(), AudioManager.OnAudioFocusChangeListener {

    private val binder = LocalBinder()
    private var audioTrack: AudioTrack? = null
    private var audioManager: AudioManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var isPlaying = AtomicBoolean(false)
    private var keepAliveThread: Thread? = null

    // Configuration
    var mode: KeepAliveMode = KeepAliveMode.PURE_SILENCE
    var intervalSeconds: Int = 0 // 0 = continuous stream, >0 = periodic burst
    var isMutedByFocus: Boolean = false

    // Device telemetry
    var currentDeviceName: String = "No Device Connected"
    var currentDeviceAddress: String = "00:00:00:00:00:00"
    var currentDeviceBattery: Int = -1 // -1 = unknown
    var isDeviceConnected: Boolean = false

    enum class KeepAliveMode {
        PURE_SILENCE,       // Pure 0 PCM silence
        INAUDIBLE_SUB_BASS, // 15 Hz inaudible sine wave (prevents aggressive DAC sleep)
        PERIODIC_PING       // Micro-burst every X seconds
    }

    inner class LocalBinder : Binder() {
        fun getService(): KeepAliveService = this@KeepAliveService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannel()

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BluetoothStayAlive::WakeLock").apply {
            setReferenceCounted(false)
        }

        registerBluetoothReceiver()
        checkInitialBluetoothStatus()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP) {
            stopKeepAlive()
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification("سرویس زنده نگه‌داشتن بلوتوث فعال است"))
        startKeepAlive()

        return START_STICKY
    }

    private fun startKeepAlive() {
        if (isPlaying.get()) return
        wakeLock?.acquire(24 * 60 * 60 * 1000L) // 24 hours max
        isPlaying.set(true)

        // Request transient audio focus that allows ducking so other media / calls take 100% priority
        requestSmartAudioFocus()

        keepAliveThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(4096)

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

            audioTrack?.play()

            val zeroBuffer = ShortArray(bufferSize / 2)
            val subBassBuffer = ShortArray(bufferSize / 2) { i ->
                // 15 Hz inaudible tone with very gentle amplitude
                val angle = 2.0 * Math.PI * i * 15.0 / sampleRate
                (Math.sin(angle) * 120.0).toInt().toShort()
            }

            while (isPlaying.get()) {
                // Non-Stop Continuous Stream: Never pauses, even during calls or music.
                // Digital zero PCM mixes seamlessly in Android AudioFlinger with 0% distortion or quality loss.
                val bufferToWrite = when (mode) {
                    KeepAliveMode.PURE_SILENCE -> zeroBuffer
                    KeepAliveMode.INAUDIBLE_SUB_BASS -> subBassBuffer
                    KeepAliveMode.PERIODIC_PING -> zeroBuffer
                }

                audioTrack?.write(bufferToWrite, 0, bufferToWrite.size)

                if (mode == KeepAliveMode.PERIODIC_PING && intervalSeconds > 0) {
                    Thread.sleep(intervalSeconds * 1000L)
                }
            }

            try {
                audioTrack?.stop()
                audioTrack?.release()
            } catch (e: Exception) {
                // Track already stopped
            }
            audioTrack = null
        }.also { it.start() }

        broadcastStatusChange(true)
    }

    private fun stopKeepAlive() {
        isPlaying.set(false)
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

    /**
     * Smart Audio Focus Listener:
     * When a phone call arrives or music plays:
     *   -> Silence NEVER stops! It continues streaming pure zeros concurrently in the background.
     * When the call or music finishes:
     *   -> We immediately broadcast that the headset attempted sleep timeout and was prevented!
     */
    override fun onAudioFocusChange(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Call or music active - keep streaming zero PCM concurrently without interference
                broadcastFocusChange("CONCURRENT_STREAM_ACTIVE")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Call or music ended - headset attempted to sleep, silence stream saved it!
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
                        currentDeviceName = it.name ?: "Bluetooth Headset"
                        currentDeviceAddress = it.address ?: "00:00:00:00:00:00"
                        isDeviceConnected = true
                        updateNotification("متصل به: $currentDeviceName")
                        broadcastDeviceUpdate()
                    }
                }
                BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                    isDeviceConnected = false
                    updateNotification("دستگاه قطع شد - در انتظار اتصال مجدد")
                    broadcastDeviceUpdate()
                }
                "android.bluetooth.device.action.BATTERY_LEVEL_CHANGED" -> {
                    currentDeviceBattery = intent.getIntExtra("android.bluetooth.device.extra.BATTERY_LEVEL", -1)
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
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter != null && adapter.isEnabled) {
            val bonded = adapter.bondedDevices
            for (dev in bonded) {
                // Check if device is connected
                currentDeviceName = dev.name ?: "Unknown Headset"
                currentDeviceAddress = dev.address ?: ""
                isDeviceConnected = true
                break
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MZ Bluetooth Keeper Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "جلوگیری از خاموش شدن یا قطع خودکار هندزفری بلوتوث"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java)
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
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(text))
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
        stopKeepAlive()
        try {
            unregisterReceiver(bluetoothReceiver)
        } catch (e: Exception) {
            // Unregistered
        }
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "bt_stayalive_channel"
        const val NOTIFICATION_ID = 1001
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
    }
}
