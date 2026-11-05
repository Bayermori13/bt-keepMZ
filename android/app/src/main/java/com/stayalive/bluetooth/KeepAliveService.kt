package com.stayalive.bluetooth

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class KeepAliveService : Service() {

    companion object {
        const val TAG = "KeepAliveService"
        const val CHANNEL_ID = "bt_stayalive_service_channel_v4"
        const val NOTIFICATION_ID = 8001
        const val ACTION_STOP = "com.stayalive.bluetooth.ACTION_STOP"
        
        @Volatile
        var isServiceRunning: Boolean = false
            private set
    }

    private var audioTrack: AudioTrack? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val isPlaying = AtomicBoolean(false)
    private var keepAliveThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "KeepAlive Service Created")
        createNotificationChannel()

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BluetoothStayAlive::WakeLock").apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            Log.i(TAG, "Stop action received")
            stopKeepAlive()
            stopSelf()
            return START_NOT_STICKY
        }

        // 1. Promote to Foreground Service status (Required for background survival)
        promoteToForeground()
        
        // 2. Start the Silent Audio Carrier Stream
        startAudioCarrierStream()

        return START_STICKY
    }

    private fun promoteToForeground() {
        val notification = buildNotification("سرویس نگه‌دارنده بلوتوث در حال اجراست")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isServiceRunning = true
        } catch (e: Exception) {
            Log.e(TAG, "startForeground error", e)
        }
    }

    /**
     * Final Audio Strategy:
     * - We avoid requesting Audio Focus altogether. This ensures we NEVER duck music or interrupt calls.
     * - Most Android versions allow AudioTrack playback without focus (it just mixes in).
     * - By writing digital silence (0s), we maintain an active PCM stream which keeps the Bluetooth
     *   A2DP hardware busy and prevents the headset from entering power-save mode.
     */
    private fun startAudioCarrierStream() {
        if (isPlaying.get()) return
        
        isPlaying.set(true)
        wakeLock?.acquire(24 * 60 * 60 * 1000L) // Limit to 24h
        
        keepAliveThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(4096)

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA) // Targets A2DP automatically
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()

            val audioFormat = AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()

            try {
                audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(audioAttributes)
                    .setAudioFormat(audioFormat)
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

                audioTrack?.play()
                Log.i(TAG, "AudioTrack playing Silent Carrier (No Focus mode)...")

                val zeroBuffer = ShortArray(bufferSize / 2)
                
                while (isPlaying.get()) {
                    // Constant stream of 0s keeps the BT link alive
                    audioTrack?.write(zeroBuffer, 0, zeroBuffer.size)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Carrier stream error", e)
            } finally {
                releaseAudioResources()
            }
        }.apply { 
            name = "AudioCarrierThread"
            start() 
        }
    }

    private fun stopKeepAlive() {
        Log.i(TAG, "Stopping service resources")
        isPlaying.set(false)
        isServiceRunning = false
        
        keepAliveThread?.interrupt()
        keepAliveThread = null

        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }

    private fun releaseAudioResources() {
        try {
            audioTrack?.apply {
                if (state == AudioTrack.STATE_INITIALIZED) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Resource release error", e)
        }
        audioTrack = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "MZ Bluetooth Keeper"
            val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW).apply {
                description = "سرویس زنده نگه‌داشتن بلوتوث"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
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
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("MZ Bluetooth Keeper")
            .setContentText(contentText)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "توقف سرویس", stopPendingIntent)
            .build()
    }

    override fun onDestroy() {
        stopKeepAlive()
        super.onDestroy()
    }
}
