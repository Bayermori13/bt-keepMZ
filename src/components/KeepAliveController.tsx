import React, { useState, useEffect } from 'react';
import {
  Power,
  Volume2,
  VolumeX,
  Radio,
  Cpu,
} from 'lucide-react';
import { KeepAliveMode, Language, ActivityEvent } from '../types';
import { audioEngine } from '../utils/audioEngine';

interface KeepAliveControllerProps {
  language: Language;
  onAddLog: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  isActive: boolean;
  onToggleActive: () => void;
  uptimeSeconds: number;
}

export const KeepAliveController: React.FC<KeepAliveControllerProps> = ({
  language,
  onAddLog,
  isActive,
  onToggleActive,
  uptimeSeconds,
}) => {
  const isFa = language === 'fa';
  const [mode, setMode] = useState<KeepAliveMode>('pure_silence');
  const [frequencies, setFrequencies] = useState<number[]>(Array(20).fill(25));

  // Real-time audio frequency visualizer updater
  useEffect(() => {
    let animId: number;
    const updateFreq = () => {
      if (isActive) {
        const rawData = audioEngine.getVisualizerData();
        if (rawData && rawData.length > 0 && Array.from(rawData).some(v => v > 0)) {
          const sliced = Array.from(rawData).slice(0, 20).map(v => Math.max(15, (v / 255) * 100));
          setFrequencies(sliced);
        } else {
          // Organic active pulse animation
          setFrequencies(Array.from({ length: 20 }, () => Math.floor(Math.random() * 65) + 25));
        }
      }
      animId = requestAnimationFrame(updateFreq);
    };
    if (isActive) {
      animId = requestAnimationFrame(updateFreq);
    } else {
      setFrequencies(Array(20).fill(8));
    }
    return () => cancelAnimationFrame(animId);
  }, [isActive]);

  const handleModeChange = (newMode: KeepAliveMode) => {
    setMode(newMode);
    if (isActive) {
      audioEngine.start(newMode);
      onAddLog({
        type: 'keepalive',
        title: isFa ? 'تغییر نوع سیگنال' : 'Signal Mode Changed',
        detail: getModeLabel(newMode),
      });
    }
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeLabel = (m: KeepAliveMode) => {
    if (m === 'pure_silence') return isFa ? 'سکوت مطلق (PCM 0dB)' : 'Pure Digital Zero (0 dB)';
    if (m === 'sub_bass') return isFa ? 'فرکانس نامحسوس (۱۵ هرتز)' : 'Inaudible Sub-Bass (15 Hz)';
    return isFa ? 'تک‌پالس دوره‌ای (۳ ثانیه)' : 'Periodic Burst (3s)';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Status Bar: Crisp & Minimal */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <h2 className="text-base font-bold text-white">
            {isActive
              ? (isFa ? 'استریم فعال است' : 'Keep-Alive Active')
              : (isFa ? 'سرویس متوقف است' : 'Service Standby')}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
          <span>{isFa ? 'مدت کارکرد:' : 'Uptime:'}</span>
          <span className="font-bold text-cyan-400 tabular-nums">{formatUptime(uptimeSeconds)}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Tactile Power Switch & Spectrum */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col justify-between space-y-5">
          <div className="flex flex-col items-center justify-center py-4">
            <button
              onClick={onToggleActive}
              className={`relative flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-full transition-all duration-300 active:scale-95 shadow-xl ${
                isActive
                  ? 'bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 shadow-cyan-500/30 ring-4 ring-cyan-500/20'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700'
              }`}
              aria-label={isActive ? 'خاموش' : 'روشن'}
            >
              <div className="flex flex-col items-center">
                <Power className={`h-12 w-12 transition-transform ${isActive ? 'scale-105 text-slate-950' : 'text-slate-400'}`} />
                <span className="mt-1 text-xs font-bold tracking-tight">
                  {isActive
                    ? isFa ? 'فعال' : 'ON'
                    : isFa ? 'شروع' : 'START'}
                </span>
              </div>
            </button>
          </div>

          {/* Soundwave Frequency Monitor */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <Radio className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
                <span className="font-medium text-slate-300 text-xs">
                  {isFa ? 'خروجی فرکانس صوتی' : 'Audio Frequency'}
                </span>
              </div>
              <span className="font-mono text-[10px] text-cyan-400">
                {isActive ? '44.1 kHz · Active PCM' : 'Idle'}
              </span>
            </div>

            {/* Soundwave Bars */}
            <div className="flex h-8 items-end justify-between gap-1 px-1">
              {frequencies.map((val, idx) => (
                <div
                  key={idx}
                  className={`flex-1 rounded-t transition-all duration-75 ${
                    isActive
                      ? 'bg-gradient-to-t from-cyan-500 to-emerald-400'
                      : 'bg-slate-800 h-1'
                  }`}
                  style={{
                    height: isActive ? `${Math.max(10, val)}%` : '8%',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Mode Selector & Specs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Mode Selector */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
            <h3 className="text-xs font-bold text-white">
              {isFa ? 'نوع سیگنال سکوت' : 'Signal Mode'}
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => handleModeChange('pure_silence')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  mode === 'pure_silence'
                    ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                    : 'border-slate-800 hover:border-slate-750 bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${mode === 'pure_silence' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <VolumeX className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    {isFa ? 'سکوت مطلق (PCM 0dB)' : 'Pure Digital Zero (0 dB)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400">پیش‌فرض</span>
              </button>

              <button
                onClick={() => handleModeChange('sub_bass')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  mode === 'sub_bass'
                    ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                    : 'border-slate-800 hover:border-slate-750 bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${mode === 'sub_bass' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Volume2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    {isFa ? 'فرکانس نامحسوس (۱۵ هرتز)' : 'Inaudible Sub-Bass (15 Hz)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">&lt; 20Hz</span>
              </button>

              <button
                onClick={() => handleModeChange('periodic_ping')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                  mode === 'periodic_ping'
                    ? 'border-cyan-500/50 bg-cyan-950/20 text-white'
                    : 'border-slate-800 hover:border-slate-750 bg-slate-900 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${mode === 'periodic_ping' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <Radio className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold">
                    {isFa ? 'تک‌پالس دوره‌ای (۳ ثانیه)' : 'Periodic Burst (3s)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Ping</span>
              </button>
            </div>
          </div>

          {/* Technical Specs Card: Minimal & Sharp */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">
                {isFa ? 'مشخصات صوتی' : 'Audio Specifications'}
              </h3>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850">
                <span className="text-slate-400">{isFa ? 'نرخ نمونه‌برداری:' : 'Sample Rate:'}</span>
                <span className="text-cyan-300 font-semibold">{audioEngine.getSampleRate()} Hz PCM</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850">
                <span className="text-slate-400">{isFa ? 'وضعیت موتور صوتی:' : 'Audio Engine:'}</span>
                <span className={`font-semibold ${isActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isActive ? `${audioEngine.getContextState().toUpperCase()}` : (isFa ? 'متوقف' : 'Stopped')}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850">
                <span className="text-slate-400">{isFa ? 'تداخل:' : 'Interference:'}</span>
                <span className="text-emerald-400 font-semibold">0% (Zero Distortion)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
