package com.stayalive.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "KeepAliveServicePlugin")
class KeepAliveServicePlugin : Plugin() {

    companion object {
        private const val TAG = "KeepAlivePlugin"
    }

    @PluginMethod
    fun startService(call: PluginCall) {
        val ctx = context
        try {
            Log.i(TAG, "Request to start KeepAlive foreground service received from bridge.")
            val intent = Intent(ctx, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
            val res = JSObject()
            res.put("success", true)
            res.put("message", "سرویس پس‌زمینه با موفقیت اجرا شد")
            call.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground service: ${e.message}", e)
            call.reject("Failed to start foreground service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        val ctx = context
        try {
            Log.i(TAG, "Request to stop KeepAlive foreground service received from bridge.")
            val intent = Intent(ctx, KeepAliveService::class.java).apply {
                action = KeepAliveService.ACTION_STOP
            }
            ctx.startService(intent)
            val res = JSObject()
            res.put("success", true)
            res.put("message", "سرویس متوقف شد")
            call.resolve(res)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop foreground service: ${e.message}", e)
            call.reject("Failed to stop foreground service: ${e.message}", e)
        }
    }

    @PluginMethod
    fun isServiceRunning(call: PluginCall) {
        val res = JSObject()
        res.put("running", KeepAliveService.isServiceRunning)
        call.resolve(res)
    }

    @PluginMethod
    fun getPairedDevices(call: PluginCall) {
        val result = JSArray()
        try {
            val ctx = context

            // Check Bluetooth Connect permission on Android 12+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "BLUETOOTH_CONNECT permission not granted when reading bonded devices.")
                    val ret = JSObject()
                    ret.put("devices", result)
                    ret.put("permissionRequired", true)
                    call.resolve(ret)
                    return
                }
            }

            val bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
            if (bluetoothAdapter != null && bluetoothAdapter.isEnabled) {
                val bondedDevices = bluetoothAdapter.bondedDevices
                if (bondedDevices != null) {
                    for (device in bondedDevices) {
                        val item = JSObject()
                        val devName = try {
                            device.name ?: "دستگاه بلوتوث"
                        } catch (e: SecurityException) {
                            "دستگاه بلوتوث"
                        }
                        val devAddr = device.address ?: "00:00:00:00:00:00"

                        item.put("id", devAddr)
                        item.put("name", devName)
                        item.put("macAddress", devAddr)
                        item.put("connected", true)
                        item.put("batteryLevel", 90)
                        item.put("rssi", -52)
                        item.put("lastSeen", "جفت‌شده در بلوتوث گوشی")
                        item.put("isLocked", true)
                        result.put(item)
                    }
                }
            }

            val ret = JSObject()
            ret.put("devices", result)
            ret.put("permissionRequired", false)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query bonded bluetooth devices: ${e.message}", e)
            call.reject("Failed to get bonded bluetooth devices: ${e.message}", e)
        }
    }
}
