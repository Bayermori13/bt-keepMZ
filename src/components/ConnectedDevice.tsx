import React, { useState } from 'react';
import {
  Headphones,
  Battery,
  Wifi,
  RefreshCw,
  Radio,
  ShieldCheck,
  Power,
} from 'lucide-react';
import { BluetoothDeviceInfo, Language, ActivityEvent } from '../types';
import { BluetoothService } from '../utils/bluetoothService';

interface ConnectedDeviceProps {
  language: Language;
  device: BluetoothDeviceInfo | null;
  isServiceActive: boolean;
  onUpdateDevice: (device: BluetoothDeviceInfo) => void;
  onAddLog: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
}

export const ConnectedDevice: React.FC<ConnectedDeviceProps> = ({
  language,
  device,
  isServiceActive,
  onUpdateDevice,
  onAddLog,
}) => {
  const isFa = language === 'fa';
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await BluetoothService.refreshAudioOutputs();
      if (device) {
        const updated = {
          ...device,
          lastSeen: isFa ? 'همین الان' : 'Just now',
        };
        onUpdateDevice(updated);
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleToggleConnection = () => {
    if (!device) return;
    const nextState = !device.connected;
    const updated = {
      ...device,
      connected: nextState,
      lastSeen: nextState ? (isFa ? 'همین الان' : 'Just now') : (isFa ? 'لحظاتی پیش' : 'Moments ago'),
    };
    onUpdateDevice(updated);

    onAddLog({
      type: nextState ? 'connect' : 'disconnect',
      title: nextState
        ? (isFa ? 'اتصال مجدد هندزفری' : 'Headset Connected')
        : (isFa ? 'قطع ارتباط هندزفری' : 'Headset Disconnected'),
      detail: nextState
        ? (isFa ? `هندزفری ${device.name} متصل شد.` : `${device.name} connected.`)
        : (isFa ? `ارتباط ${device.name} قطع شد.` : `${device.name} disconnected.`),
      rssi: device.rssi,
      batteryLevel: device.batteryLevel,
      disconnectReason: nextState ? undefined : (isFa ? 'قطع توسط کاربر' : 'Manual Disconnect'),
    });
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -60) return { label: isFa ? 'عالی' : 'Excellent', bars: 4, color: 'text-emerald-400' };
    if (rssi >= -75) return { label: isFa ? 'خوب' : 'Good', bars: 3, color: 'text-cyan-400' };
    if (rssi >= -85) return { label: isFa ? 'متوسط' : 'Fair', bars: 2, color: 'text-amber-400' };
    return { label: isFa ? 'ضعیف' : 'Weak', bars: 1, color: 'text-rose-400' };
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return 'text-slate-400';
    if (level > 50) return 'text-emerald-400';
    if (level > 20) return 'text-amber-400';
    return 'text-rose-400';
  };

  if (!device) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-4 max-w-xl mx-auto">
        <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
          <Headphones className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">
            {isFa ? 'هیچ هندزفری متصل نیست' : 'No Headset Connected'}
          </h3>
          <p className="text-xs text-slate-400">
            {isFa ? 'هندزفری خود را از طریق بلوتوث گوشی متصل کنید.' : 'Connect your headset via Bluetooth settings.'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>{isFa ? 'بررسی اتصال' : 'Check Connection'}</span>
        </button>
      </div>
    );
  }

  const signal = getSignalStrength(device.rssi);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Sleek Top Title & Refresh */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Headphones className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            {isFa ? 'هندزفری متصل' : 'Connected Headset'}
          </h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
        </button>
      </div>

      {/* Main Luxury Device Card */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-6 shadow-xl space-y-5">
        {/* Device Identity Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Headphones className="h-6 w-6 sm:h-7 sm:w-7" />
              {device.connected && isServiceActive && (
                <span className="absolute bottom-1 right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-bold text-white leading-snug">
                  {device.name}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  device.connected && isServiceActive
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/30'
                    : device.connected
                    ? 'bg-amber-950/70 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {device.connected
                    ? (isServiceActive
                        ? (isFa ? 'متصل و بیدارباش' : 'Connected & Active')
                        : (isFa ? 'متصل (سرویس خاموش)' : 'Connected (Standby)'))
                    : (isFa ? 'قطع ارتباط' : 'Disconnected')}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                {device.macAddress}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleConnection}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              device.connected
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
          >
            {device.connected ? (isFa ? 'قطع ارتباط' : 'Disconnect') : (isFa ? 'اتصال مجدد' : 'Connect')}
          </button>
        </div>

        {/* 4 Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Battery */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isFa ? 'شارژ باتری' : 'Battery'}</span>
              <Battery className={`h-3.5 w-3.5 ${getBatteryColor(device.batteryLevel)}`} />
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {device.batteryLevel !== null ? `${device.batteryLevel}%` : '—'}
            </div>
            <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  (device.batteryLevel ?? 0) > 50
                    ? 'bg-emerald-400'
                    : (device.batteryLevel ?? 0) > 20
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${device.batteryLevel ?? 0}%` }}
              />
            </div>
          </div>

          {/* RSSI Signal */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isFa ? 'سیگنال' : 'Signal'}</span>
              <Wifi className={`h-3.5 w-3.5 ${signal.color}`} />
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {device.rssi} <span className="text-[10px] text-slate-500 font-normal">dBm</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>{signal.label}</span>
              <div className="flex items-end gap-0.5 h-2">
                {[1, 2, 3, 4].map(b => (
                  <div
                    key={b}
                    className={`w-1 rounded-sm ${b <= signal.bars ? 'bg-cyan-400' : 'bg-slate-800'}`}
                    style={{ height: `${b * 25}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Audio Profile */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isFa ? 'پروتکل صوتی' : 'Profile'}</span>
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="text-sm font-bold font-mono text-cyan-300 mt-1">
              A2DP Sink
            </div>
            <span className="text-[10px] text-slate-500 mt-2 block">
              44.1 kHz PCM
            </span>
          </div>

          {/* Anti-Sleep Link */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isFa ? 'حالت ضدافت' : 'Anti-Disconnect'}</span>
              <ShieldCheck className={`h-3.5 w-3.5 ${isServiceActive ? 'text-emerald-400' : 'text-amber-500'}`} />
            </div>
            <div className={`text-sm font-bold font-mono mt-1 ${isServiceActive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isServiceActive ? (isFa ? 'پخش سکوت فعال' : 'Silent Stream On') : (isFa ? 'سرویس خاموش' : 'Service Stopped')}
            </div>
            <span className={`text-[10px] mt-2 block ${isServiceActive ? 'text-emerald-300/80' : 'text-slate-400'}`}>
              {isServiceActive ? (isFa ? 'پیوسته بدون قطعی' : 'Continuous Stream') : (isFa ? 'در حالت استندبای' : 'Standby Mode')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
