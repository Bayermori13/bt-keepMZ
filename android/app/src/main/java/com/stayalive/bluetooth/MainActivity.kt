package com.stayalive.bluetooth

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

        Log.i(TAG, "MainActivity launched. Checking Bluetooth and Notification runtime permissions...")
        checkAndRequestPermissions()
    }

    /**
     * Checks and requests runtime permissions required for:
     * - Bluetooth scanning & connecting (Android 12+)
     * - Location for Bluetooth discovery (Android 6.0+)
     * - Foreground Service Notifications (Android 13+)
     */
    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        // 1. Notification Permission for Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // 2. Bluetooth Connect & Scan for Android 12+ (API 31+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) 
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) 
                != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            }
        }

        // 3. Location Permissions for Bluetooth discovery
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
            != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) 
            != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (permissionsToRequest.isNotEmpty()) {
            Log.w(TAG, "Requesting missing permissions: $permissionsToRequest")
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        } else {
            Log.i(TAG, "All essential Bluetooth & Notification permissions are already granted.")
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            var allGranted = true
            for (i in permissions.indices) {
                val permissionName = permissions[i]
                val isGranted = grantResults.getOrNull(i) == PackageManager.PERMISSION_GRANTED
                if (isGranted) {
                    Log.i(TAG, "Permission granted: $permissionName")
                } else {
                    Log.e(TAG, "Permission DENIED by user: $permissionName")
                    allGranted = false
                }
            }

            if (!allGranted) {
                Toast.makeText(
                    this,
                    "مجوزهای بلوتوث و اعلان برای فعالیت دائمی برنامه در پس‌زمینه الزامی هستند.",
                    Toast.LENGTH_LONG
                ).show()
            } else {
                Log.i(TAG, "All required runtime permissions granted successfully.")
                Toast.makeText(
                    this,
                    "مجوزهای بلوتوث و اعلان با موفقیت تایید شدند.",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
