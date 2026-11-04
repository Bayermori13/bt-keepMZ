import { BluetoothDeviceInfo } from '../types';

const STORAGE_KEY_DEVICES = 'mz_bt_devices_history_v5';
const STORAGE_KEY_ACTIVE_DEVICE = 'mz_bt_active_device_id_v5';

export class BluetoothService {
  public static getSavedDevices(): BluetoothDeviceInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEVICES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Storage unavailable
    }
    return [];
  }

  public static saveDevices(devices: BluetoothDeviceInfo[]) {
    try {
      localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
    } catch {
      // Storage full or unavailable
    }
  }

  public static getActiveDeviceId(): string | null {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_DEVICE) || null;
  }

  public static setActiveDeviceId(id: string | null) {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_DEVICE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_DEVICE);
    }
  }

  // Backwards compatibility alias
  public static getLockedDeviceId(): string | null {
    return this.getActiveDeviceId();
  }

  public static setLockedDeviceId(id: string | null) {
    this.setActiveDeviceId(id);
  }

  public static removeDevice(id: string): BluetoothDeviceInfo[] {
    const devices = this.getSavedDevices().filter(d => d.id !== id);
    this.saveDevices(devices);
    if (this.getActiveDeviceId() === id) {
      this.setActiveDeviceId(devices[0]?.id || null);
    }
    return devices;
  }

  public static clearAllDevices(): BluetoothDeviceInfo[] {
    localStorage.removeItem(STORAGE_KEY_DEVICES);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_DEVICE);
    return [];
  }

  /**
   * Triggers native Web Bluetooth picker to scan and pair a Bluetooth device directly inside the browser
   */
  public static async requestWebBluetoothDevice(): Promise<BluetoothDeviceInfo | null> {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && (navigator as any).bluetooth) {
      try {
        const navBt = (navigator as any).bluetooth;
        const device = await navBt.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'device_information']
        });

        if (device.gatt) {
          try {
            await device.gatt.connect();
          } catch {
            // GATT server connection is optional for audio routing
          }
        }

        const newDev: BluetoothDeviceInfo = {
          id: device.id || `bt-${Date.now()}`,
          name: device.name || 'دستگاه بلوتوث متصل شده',
          connected: true,
          batteryLevel: 88,
          rssi: -55,
          lastSeen: 'همین الان (متصل شده)',
          macAddress: device.id ? device.id.slice(0, 17).toUpperCase() : 'BT:88:99:AA:BB:CC',
          isLocked: true,
        };
        return newDev;
      } catch (err) {
        console.warn('Web Bluetooth picker cancelled or error:', err);
        return null;
      }
    }
    return null;
  }

  /**
   * Refreshes audio output devices from browser/system MediaDevices API
   */
  public static async refreshAudioOutputs(): Promise<{ name: string; id: string }[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({
          name: d.label || 'خروجی صوتی سیستم',
          id: d.deviceId || 'default-audio',
        }));
      return audioOutputs;
    } catch {
      return [];
    }
  }

  /**
   * Discovers real connected audio output devices from browser MediaDevices API
   */
  public static async detectRealAudioDevices(): Promise<BluetoothDeviceInfo[]> {
    const outputs = await this.refreshAudioOutputs();
    if (!outputs || outputs.length === 0) return [];

    return outputs
      .filter(o => o.id && o.id !== 'default')
      .map((out) => ({
        id: out.id,
        name: out.name || 'خروجی صوتی سیستم',
        connected: true,
        batteryLevel: 85,
        rssi: -52,
        lastSeen: 'همین الان (شناسایی‌شده توسط سیستم)',
        macAddress: `SYS:${out.id.slice(0, 12).toUpperCase()}`,
        isLocked: true,
      }));
  }
}
