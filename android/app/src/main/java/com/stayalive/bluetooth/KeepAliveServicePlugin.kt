package com.stayalive.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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

    private var adapter: BluetoothAdapter? = null
    private var isScanning = false
    private var isReceiverRegistered = false

    private val classicReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val dev: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    dev?.let { notifyDevice(it, "Classic") }
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    if (isScanning) {
                        // If it finishes naturally without stopScan call
                        checkAndFinalize()
                    }
                }
            }
        }
    }

    private val bleCallback = object : ScanCallback() {
        override fun onScanResult(t: Int, r: ScanResult) {
            notifyDevice(r.device, "BLE")
        }
    }

    override fun load() {
        adapter = BluetoothAdapter.getDefaultAdapter()
    }

    private fun notifyDevice(dev: BluetoothDevice, type: String) {
        val obj = JSObject()
        obj.put("id", dev.address)
        obj.put("name", try { dev.name ?: "Unknown Device" } catch (e: SecurityException) { "Protected" })
        obj.put("macAddress", dev.address)
        obj.put("type", type)
        notifyListeners("onDeviceFound", obj)
    }

    private fun checkAndFinalize() {
        if (!isScanning) {
            notifyListeners("onScanStatusChanged", JSObject().put("status", "finished"))
            cleanupResources()
        }
    }

    private fun cleanupResources() {
        try {
            if (isReceiverRegistered) {
                context.unregisterReceiver(classicReceiver)
                isReceiverRegistered = false
            }
            if (adapter?.isDiscovering == true) {
                adapter!!.cancelDiscovery()
            }
            adapter?.bluetoothLeScanner?.stopScan(bleCallback)
        } catch (e: Exception) {
            Log.w("Plugin", "Cleanup: ${e.message}")
        }
    }

    @PluginMethod
    fun startService(call: PluginCall) {
        val intent = Intent(context, KeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        context.startService(Intent(context, KeepAliveService::class.java).apply {
            action = KeepAliveService.ACTION_STOP
        })
        call.resolve(JSObject().put("success", true))
    }

    @PluginMethod
    fun checkServiceStatus(call: PluginCall) {
        call.resolve(JSObject().put("isRunning", KeepAliveService.isServiceRunning))
    }

    @PluginMethod
    fun getPairedDevices(call: PluginCall) {
        val arr = JSArray()
        adapter?.bondedDevices?.forEach {
            val o = JSObject()
            o.put("id", it.address)
            o.put("name", try { it.name ?: "Unknown" } catch (e: SecurityException) { "Unknown" })
            o.put("macAddress", it.address)
            arr.put(o)
        }
        call.resolve(JSObject().put("devices", arr))
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        if (isScanning) return call.resolve()
        
        val filter = IntentFilter(BluetoothDevice.ACTION_FOUND)
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        context.registerReceiver(classicReceiver, filter)
        isReceiverRegistered = true

        adapter?.startDiscovery()
        adapter?.bluetoothLeScanner?.startScan(bleCallback)

        isScanning = true
        notifyListeners("onScanStatusChanged", JSObject().put("status", "started"))
        call.resolve()
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        isScanning = false
        cleanupResources()
        notifyListeners("onScanStatusChanged", JSObject().put("status", "stopped"))
        call.resolve()
    }

    override fun handleOnDestroy() {
        cleanupResources()
        super.handleOnDestroy()
    }
}
