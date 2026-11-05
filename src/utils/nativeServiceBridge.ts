import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { BluetoothDeviceInfo } from '../types';

interface KeepAliveServicePluginInterface {
  startService(): Promise<{ success: boolean }>;
  stopService(): Promise<{ success: boolean }>;
  checkServiceStatus(): Promise<{ isRunning: boolean }>;
  getPairedDevices(): Promise<{ devices: BluetoothDeviceInfo[] }>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  
  addListener(eventName: 'onDeviceFound', listenerFunc: (device: BluetoothDeviceInfo & { type: string }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(eventName: 'onScanStatusChanged', listenerFunc: (data: { status: string }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

const KeepAliveServicePlugin = registerPlugin<KeepAliveServicePluginInterface>('KeepAliveServicePlugin');

export const NativeServiceBridge = {
  async start(): Promise<boolean> {
    try {
      const res = await KeepAliveServicePlugin.startService();
      return res.success;
    } catch (e) {
      console.warn('Native service start failed:', e);
      return false;
    }
  },

  async stop(): Promise<boolean> {
    try {
      const res = await KeepAliveServicePlugin.stopService();
      return res.success;
    } catch (e) {
      console.warn('Native service stop failed:', e);
      return false;
    }
  },

  async isRunning(): Promise<boolean> {
    try {
      const res = await KeepAliveServicePlugin.checkServiceStatus();
      return res.isRunning;
    } catch (e) {
      return false;
    }
  },

  async getPairedDevices(): Promise<BluetoothDeviceInfo[]> {
    try {
      const res = await KeepAliveServicePlugin.getPairedDevices();
      return res.devices || [];
    } catch (e) {
      console.warn('Failed to load native paired devices:', e);
      return [];
    }
  },

  async startScan(): Promise<void> {
    await KeepAliveServicePlugin.startScan();
  },

  async stopScan(): Promise<void> {
    await KeepAliveServicePlugin.stopScan();
  },

  onDeviceFound(callback: (device: BluetoothDeviceInfo) => void): PluginListenerHandle {
    return KeepAliveServicePlugin.addListener('onDeviceFound', (device) => {
      callback(device);
    });
  },

  onScanStatusChanged(callback: (status: string) => void): PluginListenerHandle {
    return KeepAliveServicePlugin.addListener('onScanStatusChanged', (data) => {
      callback(data.status);
    });
  },

  async removeAllListeners() {
    await KeepAliveServicePlugin.removeAllListeners();
  }
};
