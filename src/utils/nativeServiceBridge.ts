import { registerPlugin } from '@capacitor/core';
import { BluetoothDeviceInfo } from '../types';

interface KeepAliveServicePluginInterface {
  startService(): Promise<{ success?: boolean; message?: string }>;
  stopService(): Promise<{ success?: boolean; message?: string }>;
  isServiceRunning(): Promise<{ running: boolean }>;
  getPairedDevices(): Promise<{ devices: BluetoothDeviceInfo[]; permissionRequired?: boolean }>;
}

const KeepAliveServicePlugin = registerPlugin<KeepAliveServicePluginInterface>('KeepAliveServicePlugin');

export const NativeServiceBridge = {
  async start(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        await KeepAliveServicePlugin.startService();
      }
    } catch (e) {
      console.warn('Native foreground service start failed (web preview mode):', e);
    }
  },

  async stop(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        await KeepAliveServicePlugin.stopService();
      }
    } catch (e) {
      console.warn('Native foreground service stop failed (web preview mode):', e);
    }
  },

  async isRunning(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const res = await KeepAliveServicePlugin.isServiceRunning();
        return !!res?.running;
      }
    } catch (e) {
      console.warn('Native isRunning check failed:', e);
    }
    return false;
  },

  async getPairedDevices(): Promise<BluetoothDeviceInfo[]> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor) {
        const res = await KeepAliveServicePlugin.getPairedDevices();
        return res?.devices || [];
      }
    } catch (e) {
      console.warn('Failed to load native paired bluetooth devices:', e);
    }
    return [];
  }
};
