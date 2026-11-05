import JSZip from 'jszip';

export interface CodeFile {
  path: string;
  name: string;
  content: string;
  language: string;
  description: string;
}

export const ANDROID_PROJECT_FILES: CodeFile[] = [
  {
    path: '.github/workflows/build-apk.yml',
    name: 'build-apk.yml',
    language: 'yaml',
    description: 'اکشن گیت‌هاب برای بیلد اتوماتیک فایل APK اندروید و ایجاد لینک دانلود',
    content: `name: Build Android APK (Bluetooth StayAlive)

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    name: Build Debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Java JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Grant Execute Permission for Gradlew
        run: chmod +x gradlew || chmod +x android/gradlew

      - name: Build Debug APK with Gradle
        run: |
          if [ -f "gradlew" ]; then
            ./gradlew assembleDebug --stacktrace
          else
            cd android && ./gradlew assembleDebug --stacktrace
          fi

      - name: Find and Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: BluetoothStayAlive-Debug-APK
          path: |
            **/build/outputs/apk/debug/*.apk
            **/build/outputs/apk/release/*.apk
          retention-days: 14`,
  },
  {
    path: 'app/src/main/java/com/stayalive/bluetooth/KeepAliveService.kt',
    name: 'KeepAliveService.kt',
    language: 'kotlin',
    description: 'سرویس پس‌زمینه با موتور صوتی "بدون تداخل" (No-Focus Mode) برای حفظ اتصال بلوتوث بدون کاهش صدای موسیقی یا اختلال در تماس.',
    content: `package com.stayalive.bluetooth

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.media.*
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class KeepAliveService : Service() {

    companion object {
        const val TAG = "KeepAliveService"
        const val CHANNEL_ID = "bt_stayalive_service_channel_final"
        const val NOTIFICATION_ID = 8001
        const val ACTION_STOP = "com.stayalive.bluetooth.ACTION_STOP"
        @Volatile var isServiceRunning: Boolean = false; private set
    }

    private var audioTrack: AudioTrack? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val isPlaying = AtomicBoolean(false)
    private var keepAliveThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BluetoothStayAlive::WakeLock").apply { setReferenceCounted(false) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopKeepAlive(); stopSelf(); return START_NOT_STICKY }
        promoteToForeground()
        startAudioStream()
        return START_STICKY
    }

    private fun promoteToForeground() {
        val notification = buildNotification("سرویس نگه‌دارنده بلوتوث فعال است")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        isServiceRunning = true
    }

    private fun startAudioStream() {
        if (isPlaying.get()) return
        isPlaying.set(true)
        wakeLock?.acquire(24 * 60 * 60 * 1000L)

        keepAliveThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT).coerceAtLeast(4096)
            try {
                audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                    .setAudioFormat(AudioFormat.Builder().setSampleRate(sampleRate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                    .setBufferSizeInBytes(bufferSize).setTransferMode(AudioTrack.MODE_STREAM).build()
                audioTrack?.play()
                val zeroBuffer = ShortArray(bufferSize / 2)
                while (isPlaying.get()) { audioTrack?.write(zeroBuffer, 0, zeroBuffer.size) }
            } catch (e: Exception) { Log.e(TAG, "Audio Error", e) } finally { releaseAudio() }
        }.apply { name = "AudioCarrier"; start() }
    }

    private fun stopKeepAlive() {
        isPlaying.set(false); isServiceRunning = false
        keepAliveThread?.interrupt(); keepAliveThread = null
        if (wakeLock?.isHeld == true) wakeLock?.release()
    }

    private fun releaseAudio() {
        try { audioTrack?.apply { if (state == AudioTrack.STATE_INITIALIZED) stop(); release() } } catch (e: Exception) {}
        audioTrack = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "MZ Bluetooth Keeper", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK }
        val pOpen = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stopInt = Intent(this, KeepAliveService::class.java).apply { action = ACTION_STOP }
        val pStop = PendingIntent.getService(this, 1, stopInt, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("MZ Bluetooth Keeper").setContentText(text).setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true).setContentIntent(pOpen).addAction(android.R.drawable.ic_menu_close_clear_cancel, "توقف", pStop).build()
    }

    override fun onDestroy() { stopKeepAlive(); super.onDestroy() }
}`,
  },
  {
    path: 'app/src/main/java/com/stayalive/bluetooth/KeepAliveServicePlugin.kt',
    name: 'KeepAliveServicePlugin.kt',
    language: 'kotlin',
    description: 'پل ارتباطی نهایی با پشتیبانی از بازخورد لمسی (Haptic Feedback)، اسکن دوگانه و رفع نشت حافظه.',
    content: `package com.stayalive.bluetooth

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.*
import android.os.*
import android.util.Log
import android.view.HapticFeedbackConstants
import com.getcapacitor.*
import com.getcapacitor.annotation.*

@CapacitorPlugin(name = "KeepAliveServicePlugin")
class KeepAliveServicePlugin : Plugin() {
    private var adapter: BluetoothAdapter? = null
    private var isScanning = false
    private var isReceiverRegistered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action == BluetoothDevice.ACTION_FOUND) {
                val dev: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                dev?.let { sendDev(it, "Classic") }
            }
        }
    }

    private val bleCallback = object : ScanCallback() {
        override fun onScanResult(t: Int, r: ScanResult) { sendDev(r.device, "BLE") }
    }

    override fun load() { adapter = BluetoothAdapter.getDefaultAdapter() }

    private fun sendDev(dev: BluetoothDevice, type: String) {
        val obj = JSObject()
        obj.put("id", dev.address); obj.put("name", try { dev.name ?: "Unknown" } catch (e: SecurityException) { "Protected" })
        obj.put("macAddress", dev.address); obj.put("type", type)
        notifyListeners("onDeviceFound", obj)
    }

    private fun cleanup() {
        try {
            if (isReceiverRegistered) { context.unregisterReceiver(receiver); isReceiverRegistered = false }
            if (adapter?.isDiscovering == true) adapter!!.cancelDiscovery()
            adapter?.bluetoothLeScanner?.stopScan(bleCallback)
        } catch (e: Exception) {}
    }

    @PluginMethod fun startService(call: PluginCall) {
        context.startForegroundService(Intent(context, KeepAliveService::class.java))
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod fun stopService(call: PluginCall) {
        context.startService(Intent(context, KeepAliveService::class.java).apply { action = KeepAliveService.ACTION_STOP })
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod fun checkServiceStatus(call: PluginCall) { call.resolve(JSObject().put("isRunning", KeepAliveService.isServiceRunning)) }

    @PluginMethod fun triggerHaptic(call: PluginCall) {
        val type = call.getString("type") ?: "impact"
        val view = bridge.activity.window.decorView
        bridge.activity.runOnUiThread {
            when (type) {
                "impact" -> view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                "success" -> view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                "warning" -> view.performHapticFeedback(HapticFeedbackConstants.REJECT_CONSTANT)
                else -> view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            }
        }
        call.resolve()
    }

    @PluginMethod fun getPairedDevices(call: PluginCall) {
        val arr = JSArray()
        adapter?.bondedDevices?.forEach {
            val o = JSObject(); o.put("id", it.address); o.put("name", it.name ?: "Unknown"); o.put("macAddress", it.address)
            arr.put(o)
        }
        call.resolve(JSObject().put("devices", arr))
    }

    @PluginMethod fun startScan(call: PluginCall) {
        if (isScanning) return call.resolve()
        context.registerReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_FOUND)); isReceiverRegistered = true
        adapter?.startDiscovery(); adapter?.bluetoothLeScanner?.startScan(bleCallback)
        isScanning = true; notifyListeners("onScanStatusChanged", JSObject().put("status", "started")); call.resolve()
    }

    @PluginMethod fun stopScan(call: PluginCall) {
        isScanning = false; cleanup()
        notifyListeners("onScanStatusChanged", JSObject().put("status", "stopped")); call.resolve()
    }

    override fun handleOnDestroy() { cleanup(); super.handleOnDestroy() }
}`,
  },
  {
    path: 'app/src/main/java/com/stayalive/bluetooth/MainActivity.kt',
    name: 'MainActivity.kt',
    language: 'kotlin',
    description: 'اکتیویتی اصلی با ثبت دستی پلاگین برای تضمین اتصال Capacitor به بخش Native.',
    content: `package com.stayalive.bluetooth

import android.Manifest
import android.content.pm.PackageManager
import android.os.*
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(KeepAliveServicePlugin::class.java)
        requestPermissions()
    }

    private fun requestPermissions() {
        val list = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) list.addAll(listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) list.add(Manifest.permission.POST_NOTIFICATIONS)
        val missing = list.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) { ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001) }
    }

    override fun onRequestPermissionsResult(rc: Int, p: Array<out String>, gr: IntArray) {
        super.onRequestPermissionsResult(rc, p, gr)
        if (rc == 1001 && gr.any { it != PackageManager.PERMISSION_GRANTED }) {
            Toast.makeText(this, "مجوزها رد شدند؛ عملکرد برنامه محدود خواهد بود.", Toast.LENGTH_LONG).show()
        }
    }
}`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    language: 'xml',
    description: 'مانیفست نهایی برنامه با تنظیمات صحیح پکیج.',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.stayalive.bluetooth">
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Bluetooth StayAlive"
        android:supportsRtl="true"
        android:theme="@style/Theme.BluetoothStayAlive">
        <activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".KeepAliveService" android:enabled="true" android:exported="false" android:foregroundServiceType="mediaPlayback" />
    </application>
</manifest>`,
  },
];

export async function generateAndDownloadProjectZip(): Promise<void> {
  const zip = new JSZip();
  for (const file of ANDROID_PROJECT_FILES) { zip.file(file.path, file.content); }
  
  const gradleProps = [
    'distributionBase=GRADLE_USER_HOME',
    'distributionPath=wrapper/dists',
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip',
    'networkTimeout=10000',
    'validateDistributionUrl=true',
    'zipStoreBase=GRADLE_USER_HOME',
    'zipStorePath=wrapper/dists',
    ''
  ].join('\n');
  
  zip.file('gradle/wrapper/gradle-wrapper.properties', gradleProps);
  zip.file('gradlew', '#!/bin/sh\nexec gradle "$@"\n');

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'BluetoothStayAlive-Android-Final-V4.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
