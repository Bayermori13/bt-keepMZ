/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { KeepAliveController } from './components/KeepAliveController';
import { ConnectedDevice } from './components/ConnectedDevice';
import { DeviceHistory } from './components/DeviceHistory';
import { ActivityLog } from './components/ActivityLog';
import { BluetoothDeviceInfo, ActivityEvent, Language } from './types';
import { BluetoothService } from './utils/bluetoothService';
import { audioEngine } from './utils/audioEngine';
import {
  Volume2,
  Headphones,
  History,
  Activity,
} from 'lucide-react';

import { NativeServiceBridge } from './utils/nativeServiceBridge';

const STORAGE_KEY_EVENTS = 'mz_bt_events_history_v5';

export default function App() {
  const [language, setLanguage] = useState<Language>('fa');
  const [activeSection, setActiveSection] = useState<'controller' | 'device' | 'history' | 'logs'>('controller');
  const [isServiceActive, setIsServiceActive] = useState<boolean>(true);
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  // Global Uptime timer that persists across tab navigation
  useEffect(() => {
    let timer: number;
    if (isServiceActive) {
      timer = window.setInterval(() => {
        setUptimeSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isServiceActive]);

  // Load real saved devices & saved events on initial mount
  useEffect(() => {
    const initDevices = async () => {
      // Check real service status from Native side
      const running = await NativeServiceBridge.isRunning();
      setIsServiceActive(running);

      let loadedDevices = BluetoothService.getSavedDevices();
      const nativePaired = await NativeServiceBridge.getPairedDevices();
      
      // Merge saved devices with real paired devices
      const existingIds = new Set(loadedDevices.map(d => d.id));
      const newFromNative = nativePaired.filter(d => !existingIds.has(d.id));
      
      if (newFromNative.length > 0) {
        loadedDevices = [...loadedDevices, ...newFromNative];
        BluetoothService.saveDevices(loadedDevices);
      }
      
      setDevices(loadedDevices);
      const initialActive = BluetoothService.getActiveDeviceId() || loadedDevices[0]?.id || '';
      setActiveDeviceId(initialActive);
    };

    initDevices();

    try {
      const savedEvents = localStorage.getItem(STORAGE_KEY_EVENTS);
      if (savedEvents) {
        setEvents(JSON.parse(savedEvents));
      }
    } catch {
      // Storage error
    }

    // Safely attempt audio engine init on user interaction
    const enableAudio = () => {
      if (isServiceActive) {
        try {
          audioEngine.start('pure_silence');
        } catch {
          // AudioContext autoplay deferred
        }
      }
    };

    window.addEventListener('touchstart', enableAudio, { once: true });
    window.addEventListener('click', enableAudio, { once: true });
  }, []);

  // Update HTML direction and language
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  const isFa = language === 'fa';

  const handleToggleLanguage = () => {
    setLanguage(prev => (prev === 'fa' ? 'en' : 'fa'));
  };

  const handleToggleService = async () => {
    if (isServiceActive) {
      audioEngine.stop();
      const success = await NativeServiceBridge.stop();
      if (success) {
        setIsServiceActive(false);
        handleAddLog({
          type: 'keepalive',
          title: isFa ? 'سرویس متوقف شد' : 'Service Stopped',
          detail: isFa ? 'سرویس پس‌زمینه و نوتیفیکیشن غیرفعال شدند.' : 'Foreground service and notification removed.',
        });
      }
    } else {
      const success = await NativeServiceBridge.start();
      if (success) {
        audioEngine.start('pure_silence');
        setIsServiceActive(true);
        handleAddLog({
          type: 'keepalive',
          title: isFa ? 'سرویس فعال شد' : 'Service Started',
          detail: isFa ? 'سرویس پس‌زمینه با نوتیفیکیشن ثابت اجرا شد.' : 'Foreground service active with persistent notification.',
        });
      } else {
        handleAddLog({
          type: 'disconnect',
          title: isFa ? 'خطا در اجرا' : 'Start Error',
          detail: isFa ? 'سرویس پس‌زمینه اجرا نشد. مجوزها را چک کنید.' : 'Failed to start native service. Check permissions.',
        });
      }
    }
  };

  const handleAddLog = (eventData: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const newEvent: ActivityEvent = {
      id: `ev-${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      ...eventData,
    };
    setEvents(prev => {
      const updated = [newEvent, ...prev.slice(0, 99)];
      try {
        localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(updated));
      } catch {
        // Storage full
      }
      return updated;
    });
  };

  const handleClearLogs = () => {
    setEvents([]);
    try {
      localStorage.removeItem(STORAGE_KEY_EVENTS);
    } catch {
      // Cleaned
    }
  };

  const handleUpdateDevice = (updatedDevice: BluetoothDeviceInfo) => {
    const updated = devices.map(d => d.id === updatedDevice.id ? updatedDevice : d);
    setDevices(updated);
    BluetoothService.saveDevices(updated);
  };

  const handleSelectActiveDevice = (deviceId: string) => {
    setActiveDeviceId(deviceId);
    BluetoothService.setActiveDeviceId(deviceId);
  };

  const activeDevice = devices.find(d => d.id === activeDeviceId) || devices.find(d => d.connected) || devices[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Header */}
      <Header
        language={language}
        onToggleLanguage={handleToggleLanguage}
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec as typeof activeSection)}
        isServiceActive={isServiceActive}
      />

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 md:pb-8">
        {activeSection === 'controller' && (
          <KeepAliveController
            language={language}
            onAddLog={handleAddLog}
            isActive={isServiceActive}
            onToggleActive={handleToggleService}
            uptimeSeconds={uptimeSeconds}
          />
        )}

        {activeSection === 'device' && (
          <ConnectedDevice
            language={language}
            device={activeDevice}
            isServiceActive={isServiceActive}
            onUpdateDevice={handleUpdateDevice}
            onAddLog={handleAddLog}
          />
        )}

        {activeSection === 'history' && (
          <DeviceHistory
            language={language}
            devices={devices}
            activeDeviceId={activeDeviceId}
            onSelectActiveDevice={handleSelectActiveDevice}
            onUpdateDevices={setDevices}
            onAddLog={handleAddLog}
          />
        )}

        {activeSection === 'logs' && (
          <ActivityLog
            language={language}
            events={events}
            onClearLogs={handleClearLogs}
            onAddLog={handleAddLog}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar: Exactly 4 Clean, Separated Tabs */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur-xl px-2 py-1 shadow-2xl"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-4 items-center">
          <button
            onClick={() => setActiveSection('controller')}
            className={`flex flex-col items-center justify-center py-1.5 transition-colors ${
              activeSection === 'controller' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="h-5 w-5" />
            <span className="text-[10px] mt-1">{isFa ? 'کنترلر' : 'Control'}</span>
          </button>

          <button
            onClick={() => setActiveSection('device')}
            className={`flex flex-col items-center justify-center py-1.5 transition-colors ${
              activeSection === 'device' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Headphones className="h-5 w-5" />
            <span className="text-[10px] mt-1">{isFa ? 'هندزفری' : 'Device'}</span>
          </button>

          <button
            onClick={() => setActiveSection('history')}
            className={`flex flex-col items-center justify-center py-1.5 transition-colors ${
              activeSection === 'history' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-5 w-5" />
            <span className="text-[10px] mt-1">{isFa ? 'دستگاه‌ها و اسکن' : 'Devices'}</span>
          </button>

          <button
            onClick={() => setActiveSection('logs')}
            className={`flex flex-col items-center justify-center py-1.5 transition-colors ${
              activeSection === 'logs' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-5 w-5" />
            <span className="text-[10px] mt-1">{isFa ? 'لاگ‌ها' : 'Logs'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
