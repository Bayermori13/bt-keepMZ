import React, { useState } from 'react';
import {
  Activity,
  Trash2,
  PhoneCall,
  Volume2,
  Bluetooth,
  Battery,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { ActivityEvent, Language } from '../types';

interface ActivityLogProps {
  language: Language;
  events: ActivityEvent[];
  onClearLogs: () => void;
  onAddLog?: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  language,
  events,
  onClearLogs,
}) => {
  const isFa = language === 'fa';
  const [filter, setFilter] = useState<'all' | 'prevented' | 'disconnect' | 'media'>('all');

  const filteredEvents = events.filter(e => {
    if (filter === 'prevented') return e.type === 'prevented_disconnect' || e.preventedDisconnect;
    if (filter === 'disconnect') return e.type === 'disconnect' || e.type === 'signal_drop';
    if (filter === 'media') return e.type === 'concurrent_media';
    return true;
  });

  const getEventBadge = (event: ActivityEvent) => {
    if (event.preventedDisconnect || event.type === 'prevented_disconnect') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
          <ShieldCheck className="h-3 w-3" />
          <span>{isFa ? 'نگه‌داری فعال' : 'Prevented'}</span>
        </span>
      );
    }
    if (event.type === 'disconnect') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded">
          <ShieldAlert className="h-3 w-3" />
          <span>{isFa ? 'قطع ارتباط' : 'Drop'}</span>
        </span>
      );
    }
    if (event.type === 'concurrent_media') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-950/60 border border-purple-500/30 px-1.5 py-0.5 rounded">
          <Volume2 className="h-3 w-3" />
          <span>{isFa ? 'میکس هم‌زمان' : 'Mix'}</span>
        </span>
      );
    }
    return null;
  };

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'prevented_disconnect':
        return <ShieldCheck className="h-4 w-4 text-emerald-400" />;
      case 'disconnect':
        return <Bluetooth className="h-4 w-4 text-rose-400" />;
      case 'concurrent_media':
        return <PhoneCall className="h-4 w-4 text-purple-400" />;
      case 'signal_drop':
        return <Wifi className="h-4 w-4 text-amber-400" />;
      case 'connect':
        return <Bluetooth className="h-4 w-4 text-cyan-400" />;
      case 'battery':
        return <Battery className="h-4 w-4 text-cyan-400" />;
      default:
        return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header and Filter Tabs */}
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            {isFa ? 'لاگ رویدادها' : 'Activity Logs'}
          </h2>
          <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30">
            {filteredEvents.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFa ? 'همه' : 'All'}
            </button>
            <button
              onClick={() => setFilter('prevented')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'prevented' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFa ? 'نگه‌داری' : 'Rescues'}
            </button>
            <button
              onClick={() => setFilter('disconnect')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === 'disconnect' ? 'bg-rose-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFa ? 'قطعی' : 'Drops'}
            </button>
          </div>

          {events.length > 0 && (
            <button
              onClick={onClearLogs}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-800 hover:border-rose-900 bg-slate-900 transition-colors"
              title={isFa ? 'پاکسازی' : 'Clear'}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 py-10 text-center text-xs text-slate-400">
            {isFa ? 'هنوز رویدادی ثبت نشده است.' : 'No activity recorded yet.'}
          </div>
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className={`p-3 rounded-xl border transition-colors ${
                event.preventedDisconnect
                  ? 'border-emerald-500/30 bg-slate-900/80'
                  : event.type === 'disconnect'
                  ? 'border-rose-500/30 bg-slate-900/80'
                  : 'border-slate-800 bg-slate-950/70'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 rounded-lg p-1.5 border shrink-0 ${
                  event.preventedDisconnect
                    ? 'bg-emerald-500/20 border-emerald-500/40'
                    : event.type === 'disconnect'
                    ? 'bg-rose-500/20 border-rose-500/40'
                    : 'bg-slate-900 border-slate-800'
                }`}>
                  {getEventIcon(event.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">
                        {event.title}
                      </span>
                      {getEventBadge(event)}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0">
                      {event.rssi !== undefined && (
                        <span className="text-cyan-400">
                          {event.rssi} dBm
                        </span>
                      )}
                      <span>{event.timestamp}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {event.detail}
                  </p>

                  {event.disconnectReason && (
                    <div className="mt-1.5 text-[10px] text-rose-300 bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded inline-block font-mono">
                      {isFa ? 'علت:' : 'Reason:'} {event.disconnectReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
