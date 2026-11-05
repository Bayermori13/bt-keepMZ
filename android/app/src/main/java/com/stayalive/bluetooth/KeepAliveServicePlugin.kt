package com.stayalive.bluetooth

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.*
import android.content.pm.PackageManager
import android.os.*
import android.util.Log
import android.view.HapticFeedbackConstants
import androidx.core.content.ContextCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.*

@CapacitorPlugin(name = "KeepAliveServicePlugin")
class KeepAliveServicePlugin : Plugin() {

    companion object {
        private const val TAG = "KeepAlivePlugin"
    }

    private var adapter: BluetoothAdapter? = null
    private var isScanning = false
    private var isReceiverRegistered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            try {
                if (intent?.action == BluetoothDevice.ACTION_FOUND) {
                    val dev: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    dev?.let { sendDev(it, "Classic") }
                } else if (intent?.action == BluetoothAdapter.ACTION_DISCOVERY_FINISHED) {
                    Log.i(TAG, "Classic discovery cycle finished naturally.")
                    if (!isScanning) cleanup()
                }
            } catch (e: Exception) {
                Log.e(TAG, "BroadcastReceiver error: ${e.message}")
            }
        }
    }

    private val bleCallback = object : ScanCallback() {
        override fun onScanResult(t: Int, r: ScanResult) {
            sendDev(r.device, "BLE")
        }
        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed with error code: $errorCode")
        }
    }

    override fun load() {
        Log.i(TAG, "Plugin Loaded and Initialized.")
        adapter = BluetoothAdapter.getDefaultAdapter()
    }

    private fun sendDev(dev: BluetoothDevice, type: String) {
        val obj = JSObject()
        obj.put("id", dev.address)
        val name = try {
            dev.name ?: "Unknown Device"
        } catch (e: SecurityException) {
            "Protected Device"
        }
        obj.put("name", name)
        obj.put("macAddress", dev.address)
        obj.put("type", type)
        notifyListeners("onDeviceFound", obj)
    }

    private fun cleanup() {
        try {
            if (isReceiverRegistered) {
                context.unregisterReceiver(receiver)
                isReceiverRegistered = false
                Log.i(TAG, "Classic Discovery Receiver unregistered.")
            }
            if (adapter?.isDiscovering == true) {
                adapter!!.cancelDiscovery()
                Log.i(TAG, "Classic Discovery cancelled.")
            }
            adapter?.bluetoothLeScanner?.stopScan(bleCallback)
            Log.i(TAG, "BLE Scanner stopped.")
        } catch (e: Exception) {
            Log.w(TAG, "Resource cleanup warning: ${e.message}")
        }
    }

    @PluginMethod
    fun startService(call: PluginCall) {
        try {
            Log.i(TAG, "startService requested from JS.")
            val intent = Intent(context, KeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start service: ${e.message}")
            call.reject("Failed to start service", e)
        }
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        try {
            Log.i(TAG, "stopService requested from JS.")
            context.startService(Intent(context, KeepAliveService::class.java).apply {
                action = KeepAliveService.ACTION_STOP
            })
            call.resolve(JSObject().put("success", true))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop service: ${e.message}")
            call.reject("Failed to stop service", e)
        }
    }

    @PluginMethod
    fun checkServiceStatus(call: PluginCall) {
        val running = KeepAliveService.isServiceRunning
        Log.d(TAG, "Service status check: running=$running")
        call.resolve(JSObject().put("isRunning", running))
    }

    @PluginMethod
    fun triggerHaptic(call: PluginCall) {
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

    @PluginMethod
    fun getPairedDevices(call: PluginCall) {
        val arr = JSArray()
        try {
            adapter?.bondedDevices?.forEach {
                val o = JSObject()
                o.put("id", it.address)
                val name = try { it.name ?: "Unknown" } catch (e: SecurityException) { "Unknown" }
                o.put("name", name)
                o.put("macAddress", it.address)
                arr.put(o)
            }
            Log.i(TAG, "Found ${arr.length()} bonded devices.")
            call.resolve(JSObject().put("devices", arr))
        } catch (e: Exception) {
            Log.e(TAG, "Error getting bonded devices: ${e.message}")
            call.reject("Failed to get paired devices", e)
        }
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        if (isScanning) {
            Log.d(TAG, "Scan already in progress.")
            return call.resolve()
        }

        try {
            Log.i(TAG, "Starting dual scan (Classic + BLE).")
            val filter = IntentFilter(BluetoothDevice.ACTION_FOUND).apply {
                addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
            }
            context.registerReceiver(receiver, filter)
            isReceiverRegistered = true

            adapter?.startDiscovery()
            adapter?.bluetoothLeScanner?.startScan(bleCallback)

            isScanning = true
            notifyListeners("onScanStatusChanged", JSObject().put("status", "started"))
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Error starting scan: ${e.message}")
            cleanup()
            call.reject("Scan error", e)
        }
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        Log.i(TAG, "stopScan requested from JS.")
        isScanning = false
        cleanup()
        notifyListeners("onScanStatusChanged", JSObject().put("status", "stopped"))
        call.resolve()
    }

    override fun handleOnDestroy() {
        Log.i(TAG, "Plugin Destroyed. Cleaning up.")
        cleanup()
        super.handleOnDestroy()
    }
}
