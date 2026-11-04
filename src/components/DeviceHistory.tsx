import React from 'react';
import {
  History,
  Trash2,
  Headphones,
  Battery,
  Wifi,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { BluetoothDeviceInfo, Language, ActivityEvent } from '../types';
import { BluetoothService } from '../utils/bluetoothService';

interface DeviceHistoryProps {
  language: Language;
  devices: BluetoothDeviceInfo[];
  activeDeviceId: string;
  onSelectActiveDevice: (deviceId: string) => void;
  onUpdateDevices: (devices: BluetoothDeviceInfo[]) => void;
  onAddLog: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
}

export const DeviceHistory: React.FC<DeviceHistoryProps> = ({
  language,
  devices,
  activeDeviceId,
  onSelectActiveDevice,
  onUpdateDevices,
  onAddLog,
}) => {
  const isFa = language === 'fa';

  const handleRemoveDevice = (deviceId: string) => {
    const target = devices.find(d => d.id === deviceId);
    const updated = devices.filter(d => d.id !== deviceId);
    onUpdateDevices(updated);
    BluetoothService.saveDevices(updated);
    if (target) {
      onAddLog({
        type: 'disconnect',
        title: isFa ? 'حذف از تاریخچه' : 'Removed from History',
        detail: isFa ? `دستگاه "${target.name}" حذف شد.` : `Device ${target.name} removed.`,
      });
    }
  };

  const handleClearAll = () => {
    BluetoothService.clearAllDevices();
    onUpdateDevices([]);
    onAddLog({
      type: 'disconnect',
      title: isFa ? 'پاکسازی کامل تاریخچه' : 'History Cleared',
      detail: isFa ? 'سوابق تمام دستگاه‌ها پاک شد.' : 'All saved devices cleared.',
    });
  };

  const handleWebBluetoothScan = async () => {
    // 1. Try real Web Bluetooth API
    const scanned = await BluetoothService.requestWebBluetoothDevice();
    if (scanned) {
      const updated = [scanned, ...devices.filter(d => d.id !== scanned.id)];
      onUpdateDevices(updated);
      BluetoothService.saveDevices(updated);
      onSelectActiveDevice(scanned.id);
      onAddLog({
        type: 'connect',
        title: isFa ? 'اتصال مستقیم بلوتوث' : 'Bluetooth Device Connected',
        detail: isFa ? `دستگاه ${scanned.name} با موفقیت متصل گردید.` : `${scanned.name} connected via Web Bluetooth.`,
      });
      return;
    }

    // 2. Detect real browser connected audio output devices
    const realDevices = await BluetoothService.detectRealAudioDevices();
    if (realDevices.length > 0) {
      const existingIds = new Set(devices.map(d => d.id));
      const newDevices = realDevices.filter(d => !existingIds.has(d.id));
      if (newDevices.length > 0) {
        const updated = [...newDevices, ...devices];
        onUpdateDevices(updated);
        BluetoothService.saveDevices(updated);
        onSelectActiveDevice(newDevices[0].id);
        onAddLog({
          type: 'connect',
          title: isFa ? 'شناسایی خروجی صوتی سیستم' : 'Audio Output Detected',
          detail: isFa ? `دستگاه ${newDevices[0].name} شناسه صوتی سیستم دریافت نمود.` : `${newDevices[0].name} attached.`,
        });
        return;
      }
    }

    // 3. User cancelled or no device selected
    onAddLog({
      type: 'disconnect',
      title: isFa ? 'عدم انتخاب دستگاه' : 'No Device Selected',
      detail: isFa ? 'اسکن لغو شد یا هیچ دستگاه بلوتوث متصلی یافت نگردید.' : 'Scan cancelled or no device found.',
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Banner & Quick Scan Button */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-right">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Wifi className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {isFa ? 'جستجو و اتصال مستقیم به بلوتوث' : 'Scan & Pair Bluetooth Device'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {isFa ? 'اتصال مستقیم هندزفری از داخل اپلیکیشن' : 'Connect Bluetooth devices directly inside the app'}
            </p>
          </div>
        </div>

        <button
          onClick={handleWebBluetoothScan}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
        >
          <Wifi className="h-4 w-4" />
          <span>{isFa ? 'اسکن و اتصال دستگاه جدید' : 'Scan & Connect Device'}</span>
        </button>
      </div>

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <History className="h-5 w-5 text-cyan-400 shrink-0" />
          <h2 className="text-xs sm:text-base font-bold text-white truncate">
            {isFa ? 'دستگاه‌های ثبت‌شده' : 'Saved Devices'}
          </h2>
          <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 shrink-0 font-bold">
            {devices.length}
          </span>
        </div>

        {devices.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 text-xs font-bold transition-all shrink-0 whitespace-nowrap active:scale-95 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            <span>{isFa ? 'پاکسازی لیست' : 'Clear List'}</span>
          </button>
        )}
      </div>

      {/* Device History Cards */}
      {devices.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <History className="h-6 w-6" />
          </div>
          <p className="text-xs text-slate-400">
            {isFa ? 'هیچ دستگاهی ثبت نشده است.' : 'No devices saved.'}
          </p>
          <button
            onClick={handleWebBluetoothScan}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
          >
            <Wifi className="h-4 w-4" />
            <span>{isFa ? 'اسکن و افزودن هندزفری' : 'Scan & Add Headset'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => {
            const isActive = device.id === activeDeviceId;

            return (
              <div
                key={device.id}
                className={`rounded-2xl border p-3.5 space-y-3 transition-all ${
                  isActive
                    ? 'border-cyan-500/50 bg-slate-900/90 shadow-lg'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                {/* Top Row: Device Info & Trash Button */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center border shrink-0 ${
                      device.connected
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <Headphones className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {device.name}
                        </h4>
                        {isActive && (
                          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0 font-bold">
                            {isFa ? 'فعال' : 'Active'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 dir-ltr text-right block mt-0.5">
                        {device.macAddress}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDevice(device.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 transition-colors shrink-0"
                    title={isFa ? 'حذف' : 'Remove'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Bottom Row: Metadata & Select Action */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800/80 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
                    <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-emerald-400 flex items-center gap-1">
                      <Battery className="h-3 w-3" />
                      <span>{device.batteryLevel}%</span>
                    </span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-cyan-400 flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      <span>{device.rssi} dBm</span>
                    </span>
                    <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{device.lastSeen}</span>
                    </span>
                  </div>

                  {!isActive ? (
                    <button
                      onClick={() => onSelectActiveDevice(device.id)}
                      className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-colors shadow-sm shrink-0 flex items-center justify-center gap-1.5 mt-1 sm:mt-0"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isFa ? 'انتخاب دستگاه' : 'Select Device'}</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 px-2 py-1 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isFa ? 'دستگاه جاری' : 'Current Device'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
