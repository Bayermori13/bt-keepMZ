package com.stayalive.bluetooth

import android.content.Intent
import android.os.Build
import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import com.getcapacitor.PluginCall

@CapacitorPlugin(name = "KeepAliveServicePlugin")
class KeepAliveServicePlugin : Plugin() {
    @PluginMethod
    fun startService(call: PluginCall) {
        val context = context
        try {
            val intent = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to start foreground service", e)
        }
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        val context = context
        try {
            val intent = Intent(context, KeepAliveService::class.java).apply {
                action = KeepAliveService.ACTION_STOP
            }
            context.startService(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to stop foreground service", e)
        }
    }

    @PluginMethod
    fun getPairedDevices(call: PluginCall) {
        val result = com.getcapacitor.JSArray()
        try {
            val bluetoothAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
            if (bluetoothAdapter != null) {
                val bondedDevices = bluetoothAdapter.bondedDevices
                if (bondedDevices != null) {
                    for (device in bondedDevices) {
                        val item = com.getcapacitor.JSObject()
                        item.put("id", device.address)
                        item.put("name", device.name ?: "Unknown Bluetooth Device")
                        item.put("macAddress", device.address)
                        item.put("connected", true)
                        item.put("batteryLevel", 90)
                        item.put("rssi", -52)
                        item.put("lastSeen", "جفت‌شده در بلوتوث گوشی")
                        item.put("isLocked", true)
                        result.put(item)
                    }
                }
            }
            val ret = com.getcapacitor.JSObject()
            ret.put("devices", result)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Failed to get bonded bluetooth devices", e)
        }
    }
}
