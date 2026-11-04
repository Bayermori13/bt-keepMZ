export type KeepAliveMode = 'pure_silence' | 'sub_bass' | 'periodic_ping';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel: number | null; // 0 - 100 or null if unknown
  rssi: number; // e.g. -55 dBm
  lastSeen: string;
  macAddress?: string;
  isLocked: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'connect' | 'disconnect' | 'prevented_disconnect' | 'concurrent_media' | 'keepalive' | 'battery' | 'signal_drop';
  title: string;
  detail: string;
  rssi?: number;
  batteryLevel?: number | null;
  disconnectReason?: string;
  preventedDisconnect?: boolean;
}

export type Language = 'fa' | 'en';
