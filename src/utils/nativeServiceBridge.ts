import { registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { BluetoothDeviceInfo } from '../types';

interface KeepAliveServicePluginInterface {
  startService(): Promise<{ success: boolean }>;
  stopService(): Promise<{ success: boolean }>;
  checkServiceStatus(): Promise<{ isRunning: boolean }>;
  getPairedDevices(): Promise<{ devices: BluetoothDeviceInfo[] }>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  triggerHaptic(options: { type: 'impact' | 'success' | 'warning' }): Promise<void>;
  
  addListener(eventName: 'onDeviceFound', listenerFunc: (device: BluetoothDeviceInfo & { type: string }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(eventName: 'onScanStatusChanged', listenerFunc: (data: { status: string }) => void): Promise<PluginListenerHandle> & PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

// Important: Explicitly use the name from @CapacitorPlugin in Kotlin
const KeepAliveServicePlugin = registerPlugin<KeepAliveServicePluginInterface>('KeepAliveServicePlugin');

export const NativeServiceBridge = {
  async haptic(type: 'impact' | 'success' | 'warning' = 'impact') {
    try {
      await KeepAliveServicePlugin.triggerHaptic({ type });
    } catch {
      // Ignore if not supported or implemented
    }
  },

  async start(): Promise<boolean> {
    try {
      this.haptic('success');
      const res = await KeepAliveServicePlugin.startService();
      return res.success;
    } catch (e) {
      console.error('[NativeBridge] startService failed:', e);
      return false;
    }
  },

  async stop(): Promise<boolean> {
    try {
      this.haptic('impact');
      const res = await KeepAliveServicePlugin.stopService();
      return res.success;
    } catch (e) {
      console.error('[NativeBridge] stopService failed:', e);
      return false;
    }
  },

  async isRunning(): Promise<boolean> {
    try {
      const res = await KeepAliveServicePlugin.checkServiceStatus();
      return res.isRunning;
    } catch (e) {
      // This is expected on web preview, don't spam console
      if (!(e as any).message?.includes('not implemented')) {
        console.warn('[NativeBridge] checkServiceStatus failed:', e);
      }
      return false;
    }
  },

  async getPairedDevices(): Promise<BluetoothDeviceInfo[]> {
    try {
      const res = await KeepAliveServicePlugin.getPairedDevices();
      return res.devices || [];
    } catch (e) {
      console.error('[NativeBridge] getPairedDevices failed:', e);
      return [];
    }
  },

  async startScan(): Promise<void> {
    try {
      this.haptic('impact');
      await KeepAliveServicePlugin.startScan();
    } catch (e) {
      console.error('[NativeBridge] startScan failed:', e);
      throw e;
    }
  },

  async stopScan(): Promise<void> {
    try {
      await KeepAliveServicePlugin.stopScan();
    } catch (e) {
      console.error('[NativeBridge] stopScan failed:', e);
    }
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
    try {
      await KeepAliveServicePlugin.removeAllListeners();
    } catch (e) {
      console.error('[NativeBridge] removeAllListeners failed:', e);
    }
  }
};
