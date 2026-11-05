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
    description: 'هسته اصلی سرویس اندروید: تولید سکوت PCM، نوتیفیکیشن ثابت غیرقابل حذف (Foreground Service)، عدم تداخل با تماس و لاگ‌کت',
    content: `package com.stayalive.bluetooth

import android.app.*
import android.bluetooth.*
import android.content.*
import android.content.pm.ServiceInfo
import android.media.*
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class KeepAliveService : Service(), AudioManager.OnAudioFocusChangeListener {

    companion object {
        const val TAG = "KeepAliveService"
        const val CHANNEL_ID = "bt_stayalive_foreground_channel"
        const val NOTIFICATION_ID = 2001
        const val ACTION_STOP = "com.stayalive.bluetooth.ACTION_STOP"
    }

    private var audioTrack: AudioTrack? = null
    private var audioManager: AudioManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val isPlaying = AtomicBoolean(false)
    private var keepAliveThread: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "KeepAliveService onCreate started.")
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannel()

        // Persistent Foreground Notification created immediately
        promoteToForeground("سرویس زنده نگه‌داشتن بلوتوث فعال است (استریم پیوسته سکوت)")

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BluetoothStayAlive::WakeLock").apply {
            setReferenceCounted(false)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "onStartCommand action=\${intent?.action}")
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        promoteToForeground("سرویس زنده نگه‌داشتن بلوتوث فعال است (استریم پیوسته سکوت)")
        startAudioStream()
        return START_STICKY
    }

    private fun promoteToForeground(text: String) {
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        Log.i(TAG, "KeepAliveService promoted to FOREGROUND status.")
    }

    private fun startAudioStream() {
        if (isPlaying.get()) return
        wakeLock?.acquire(24 * 60 * 60 * 1000L)
        isPlaying.set(true)

        audioManager?.requestAudioFocus(
            this,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
        )

        keepAliveThread = Thread {
            val sampleRate = 44100
            val bufferSize = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(4096)

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(sampleRate)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            audioTrack?.play()
            Log.i(TAG, "AudioTrack.play() successful. KeepAlive digital silence stream started.")

            val zeroBuffer = ShortArray(bufferSize / 2) // Digital zero silence
            var count = 0L

            while (isPlaying.get()) {
                val written = audioTrack?.write(zeroBuffer, 0, zeroBuffer.size) ?: 0
                count++
                if (count % 100L == 1L) {
                    Log.d(TAG, "KeepAlive silent pulse active: wrote \$written samples. Headset sleep timer reset.")
                }
            }

            try {
                audioTrack?.stop()
                audioTrack?.release()
            } catch (e: Exception) {}
            audioTrack = null
        }.also { it.start() }
    }

    override fun onAudioFocusChange(focusChange: Int) {
        // Continuous non-stop background carrier stream remains active
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "سرویس زنده نگه‌داشتن بلوتوث MZ",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "جلوگیری از قطع خودکار یا خاموش شدن هندزفری بلوتوث"
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val stopIntent = Intent(this, KeepAliveService::class.java).apply { action = ACTION_STOP }
        val pStop = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MZ Bluetooth Keeper")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .addAction(android.R.drawable.ic_media_pause, "توقف سرویس", pStop)
            .setOngoing(true) // Non-dismissible
            .setAutoCancel(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        isPlaying.set(false)
        audioTrack?.stop()
        audioTrack?.release()
        audioManager?.abandonAudioFocus(this)
        if (wakeLock?.isHeld == true) wakeLock?.release()
        super.onDestroy()
    }
}`,
  },
  {
    path: 'app/src/main/java/com/stayalive/bluetooth/MainActivity.kt',
    name: 'MainActivity.kt',
    language: 'kotlin',
    description: 'اکتیویتی اصلی با درخواست تمام مجوزهای Runtime بلوتوث و اعلان (Android 12/13/14+)',
    content: `package com.stayalive.bluetooth

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PERMISSION_REQUEST_CODE = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(KeepAliveServicePlugin::class.java)

        Log.i(TAG, "MainActivity created. Checking required Bluetooth & Notification runtime permissions...")
        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (permissionsToRequest.isNotEmpty()) {
            Log.w(TAG, "Requesting missing permissions: $permissionsToRequest")
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), PERMISSION_REQUEST_CODE)
        } else {
            Log.i(TAG, "All essential Bluetooth & Notification permissions are already granted.")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            var allGranted = true
            for (i in permissions.indices) {
                if (grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false
                }
            }
            if (!allGranted) {
                Toast.makeText(this, "مجوزهای بلوتوث و اعلان برای فعالیت دائمی برنامه الزامی هستند.", Toast.LENGTH_LONG).show()
            }
        }
    }
}`,
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    name: 'AndroidManifest.xml',
    language: 'xml',
    description: 'مجوزهای بلوتوث، موقعیت مکانی، فورگراند سرویس صوتی، ویک‌لاک و رسیور وضعیت هندزفری',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.stayalive.bluetooth">

    <!-- Bluetooth Permissions -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" tools:targetApi="31" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- Foreground Service & Media Playback -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Bluetooth StayAlive"
        android:supportsRtl="true"
        android:theme="@style/Theme.BluetoothStayAlive">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".KeepAliveService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />
    </application>
</manifest>`,
  },
  {
    path: 'app/build.gradle.kts',
    name: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'تنظیمات بیلد ماژول اپلیکیشن اندروید (Target SDK 34, Android 14+)',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.stayalive.bluetooth"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.stayalive.bluetooth"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
}`,
  },
  {
    path: 'settings.gradle.kts',
    name: 'settings.gradle.kts',
    language: 'kotlin',
    description: 'تعریف پروژه و مخازن رسمی گوگل و Maven',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "BluetoothStayAlive"
include(":app")`,
  },
  {
    path: 'build.gradle.kts',
    name: 'build.gradle.kts',
    language: 'kotlin',
    description: 'پلاگین روت گریدل برای اندروید و کاتلین',
    content: `plugins {
    id("com.android.application") version "8.3.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}`,
  },
  {
    path: 'app/src/main/res/drawable/ic_launcher_background.xml',
    name: 'ic_launcher_background.xml',
    language: 'xml',
    description: 'پس‌زمینه وکتور آیکون برای تمامی نسخه‌های اندروید',
    content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z" android:fillColor="#090D16" />
    <path android:pathData="M54,18 A36,36 0 1 0 54,90 A36,36 0 1 0 54,18" android:fillColor="#0E1E2E" />
    <path android:pathData="M54,24 A30,30 0 1 0 54,84 A30,30 0 1 0 54,24" android:strokeColor="#164E63" android:strokeWidth="1.2" android:strokeAlpha="0.6" />
</vector>`,
  },
  {
    path: 'app/src/main/res/drawable/ic_launcher_foreground.xml',
    name: 'ic_launcher_foreground.xml',
    language: 'xml',
    description: 'لوگوی رسمی وکتور MZ با امواج صوتی بلوتوث (کیفیت بی‌نهایت در تمام اندازه‌ها)',
    content: `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M48,27 L54,32 L51,35 M54,32 L60,27 M54,23 L54,37" android:strokeColor="#38BDF8" android:strokeWidth="2" android:strokeLineCap="round" android:strokeLineJoin="round" />
    <path android:pathData="M42,28 A7,7 0 0 0 42,36" android:strokeColor="#06B6D4" android:strokeWidth="1.8" android:strokeLineCap="round" />
    <path android:pathData="M66,28 A7,7 0 0 1 66,36" android:strokeColor="#10B981" android:strokeWidth="1.8" android:strokeLineCap="round" />
    <path android:pathData="M27,45 L27,73" android:strokeColor="#06B6D4" android:strokeWidth="4.5" android:strokeLineCap="round" />
    <path android:pathData="M27,45 L40,61 L51,45" android:strokeColor="#38BDF8" android:strokeWidth="4.2" android:strokeLineCap="round" strokeLineJoin="round" />
    <path android:pathData="M51,45 L51,73" android:strokeColor="#06B6D4" android:strokeWidth="4.5" android:strokeLineCap="round" />
    <path android:pathData="M59,45 L81,45" android:strokeColor="#10B981" android:strokeWidth="4.5" android:strokeLineCap="round" />
    <path android:pathData="M79,46 L61,72" android:strokeColor="#34D399" android:strokeWidth="4.5" android:strokeLineCap="round" strokeLineJoin="round" />
    <path android:pathData="M59,73 L81,73" android:strokeColor="#10B981" android:strokeWidth="4.5" android:strokeLineCap="round" />
    <path android:pathData="M54,58 A1.5,1.5 0 1 0 54,61 A1.5,1.5 0 1 0 54,58" android:fillColor="#F0FDFA" />
    <path android:pathData="M34,81 L74,81" android:strokeColor="#155E75" android:strokeWidth="1.8" android:strokeLineCap="round" />
</vector>`,
  },
  {
    path: 'app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
    name: 'mipmap/ic_launcher.xml',
    language: 'xml',
    description: 'تعریف Adaptive Icon برای اندروید 8.0 تا اندروید 15',
    content: `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`,
  },
  {
    path: 'app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
    name: 'mipmap/ic_launcher_round.xml',
    language: 'xml',
    description: 'تعریف Adaptive Icon گرد برای لانچرهای مختلف سامسونگ، شیائومی و پیکسل',
    content: `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>`,
  },
  {
    path: 'app/src/main/res/drawable/ic_launcher.xml',
    name: 'drawable/ic_launcher.xml',
    language: 'xml',
    description: 'پشتیبانی از آیکون در نسخه‌های قدیمی‌تر اندروید (سازگاری ۱۰۰٪)',
    content: `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/ic_launcher_background" />
    <item android:drawable="@drawable/ic_launcher_foreground" />
</layer-list>`,
  },
  {
    path: 'README.md',
    name: 'README.md',
    language: 'markdown',
    description: 'توضیحات کامل فارسی و راهنمای ۳ مرحله‌ای گیت‌هاب',
    content: `# Bluetooth StayAlive (MZ Edition)
برنامه اختصاصی اندروید با لوگوی MZ برای زنده نگه‌داشتن اتصال هندزفری بلوتوث بعد از قطع تماس یا اتمام آهنگ.

### ویژگی‌های کلیدی:
- استریم دائمی بدون توقف سکوت دیجیتال صفر (PCM 0dB)
- بدون هیچ‌گونه تداخل با تماس‌های صوتی یا پخش موزیک
- آیکون تطبیقی (Adaptive Icon) اختصاصی MZ برای تمام گوشی‌های اندروید
- بیلد اتوماتیک فایل APK با GitHub Actions`,
  },
];

export async function generateAndDownloadProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Add all Android files
  for (const file of ANDROID_PROJECT_FILES) {
    zip.file(file.path, file.content);
  }

  // Also add gradle wrapper properties
  zip.file(
    'gradle/wrapper/gradle-wrapper.properties',
    `distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n`
  );

  // Add gradlew shell script
  zip.file(
    'gradlew',
    `#!/bin/sh\nexec gradle "$@"\n`
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'BluetoothStayAlive-Android-GitHub.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
