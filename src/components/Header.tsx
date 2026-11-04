import React from 'react';
import { Globe } from 'lucide-react';
import { Language } from '../types';
import { MzLogo } from './MzLogo';

interface HeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  activeSection: string;
  onSelectSection: (section: string) => void;
  isServiceActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  activeSection,
  onSelectSection,
  isServiceActive,
}) => {
  const isFa = language === 'fa';

  const navItems = [
    { id: 'controller', label: isFa ? 'کنترلر' : 'Controller' },
    { id: 'device', label: isFa ? 'هندزفری متصل' : 'Connected Device' },
    { id: 'history', label: isFa ? 'دستگاه‌ها و اسکن' : 'Devices & Scan' },
    { id: 'logs', label: isFa ? 'لاگ‌ها' : 'Logs' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo & Clean Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <MzLogo size={32} />
          <span className="text-sm sm:text-base font-bold text-white tracking-tight">
            {isFa ? 'نگه‌دارنده بلوتوث MZ' : 'MZ Bluetooth Keeper'}
          </span>
        </div>

        {/* Desktop 4 Tabs */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`whitespace-nowrap transition-colors hover:text-white py-1.5 ${
                activeSection === item.id ? 'text-cyan-400 font-bold border-b-2 border-cyan-400' : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Status Indicator & Language Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
            isServiceActive
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isServiceActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>{isServiceActive ? (isFa ? 'فعال' : 'Active') : (isFa ? 'خاموش' : 'Off')}</span>
          </div>

          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-mono text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Globe className="h-3 w-3 text-cyan-400" />
            <span>{isFa ? 'EN' : 'فا'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
