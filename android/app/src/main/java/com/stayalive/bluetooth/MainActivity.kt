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
        private const val PERMISSION_REQUEST_CODE = 1005
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(KeepAliveServicePlugin::class.java)
        
        requestNecessaryPermissions()
    }

    /**
     * Handles version-specific permission logic:
     * - Android 12+ (API 31+): Requires BLUETOOTH_SCAN, BLUETOOTH_CONNECT.
     * - Android 13+ (API 33+): Requires POST_NOTIFICATIONS.
     * - All: Requires FINE/COARSE LOCATION for Bluetooth scanning on many devices.
     */
    private fun requestNecessaryPermissions() {
        val permissions = mutableListOf<String>()

        // 1. Location (Core for discovery on all relevant Android versions)
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)

        // 2. Android 12 Bluetooth Permissions
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        }

        // 3. Android 13 Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            Log.i(TAG, "Requesting missing permissions: $missing")
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val deniedCount = grantResults.count { it != PackageManager.PERMISSION_GRANTED }
            if (deniedCount > 0) {
                Log.w(TAG, "$deniedCount permissions were denied by the user.")
                Toast.makeText(this, "برخی مجوزها رد شدند؛ اسکن و نوتیفیکیشن ممکن است با اختلال روبرو شوند.", Toast.LENGTH_LONG).show()
            } else {
                Log.i(TAG, "All requested permissions granted.")
            }
        }
    }
}
