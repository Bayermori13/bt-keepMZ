import React, { useState } from 'react';
import {
  GitBranch,
  Download,
  Copy,
  Check,
  Code2,
  Cpu,
  FileCode,
  X,
} from 'lucide-react';
import { Language } from '../types';
import { ANDROID_PROJECT_FILES } from '../utils/zipExporter';
import { MzLogo } from './MzLogo';

interface GitHubBuildGuideProps {
  language: Language;
  onDownloadZip: () => void;
  isDownloadingZip: boolean;
  onClose?: () => void;
}

export const GitHubBuildGuide: React.FC<GitHubBuildGuideProps> = ({
  language,
  onDownloadZip,
  isDownloadingZip,
  onClose,
}) => {
  const isFa = language === 'fa';
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmdIndex, setCopiedCmdIndex] = useState<number | null>(null);

  const selectedFile = ANDROID_PROJECT_FILES[selectedFileIndex];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyCmd = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCmdIndex(index);
    setTimeout(() => setCopiedCmdIndex(null), 2000);
  };

  const gitCommands = [
    {
      title: isFa ? '۱. مقداردهی اولیه و افزودن فایل‌ها' : '1. Initialize & Stage',
      cmd: 'git init\ngit add .\ngit commit -m "Add Bluetooth StayAlive project"',
    },
    {
      title: isFa ? '۲. لینک کردن ریپازیتوری گیت‌هاب' : '2. Link GitHub Repo',
      cmd: 'git branch -M main\ngit remote add origin https://github.com/USER/bluetooth-stayalive.git',
    },
    {
      title: isFa ? '۳. ارسال به گیت‌هاب و بیلد خودکار' : '3. Push to Build APK',
      cmd: 'git push -u origin main',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Action Card */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-4 sm:p-6 shadow-xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <MzLogo size={62} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-slate-950">
                ✓
              </span>
            </div>

            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {isFa ? 'پروژه اندروید با آیکون اختصاصی MZ' : 'Android Project with Custom MZ Icon'}
                </h2>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                  Adaptive Vector
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                {isFa
                  ? 'آیکون اختصاصی وکتور MZ با فرمت Adaptive Icon برای تمامی گوشی‌های اندروید (سامسونگ، شیائومی، پیکسل، هواوی و...) با کیفیت بی‌نهایت تنظیم شده و تحت هیچ شرایطی تار یا خراب نمی‌شود.'
                  : 'Vector Adaptive Icon MZ configured for all Android screen densities and launcher shapes without clipping or distortion.'}
              </p>
            </div>
          </div>

          <button
            onClick={onDownloadZip}
            disabled={isDownloadingZip}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap self-stretch lg:self-auto"
          >
            <Download className="h-4 w-4 text-slate-950" />
            <span>
              {isDownloadingZip
                ? isFa ? 'در حال زیپ کردن...' : 'Generating ZIP...'
                : isFa ? 'دانلود بسته کامل پروژه (ZIP)' : 'Download Project ZIP'}
            </span>
          </button>
        </div>
      </div>

      {/* 3-Step Guide */}
      <div className="space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-cyan-400" />
          <span>{isFa ? 'دستورات پوش به گیت‌هاب برای بیلد خودکار' : 'Push Commands for GitHub Actions'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {gitCommands.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="text-[11px] font-semibold text-white block mb-1.5">
                  {item.title}
                </span>
                <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-850 font-mono text-[10px] text-cyan-300 leading-relaxed overflow-x-auto whitespace-pre">
                  {item.cmd}
                </div>
              </div>

              <button
                onClick={() => handleCopyCmd(item.cmd, index)}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-medium border border-slate-800 bg-slate-800 hover:bg-slate-750 text-slate-200 transition-colors"
              >
                {copiedCmdIndex === index ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">{isFa ? 'کپی شد!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-slate-400" />
                    <span className="text-[11px]">{isFa ? 'کپی دستور' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-start gap-2">
          <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <span className="font-bold">
              {isFa ? 'محل دانلود APK در گیت‌هاب:' : 'Where to download APK:'}
            </span>{' '}
            {isFa
              ? 'پس از پوش، در تب Actions ریپازیتوری خود، وارد بیلد "Build Android APK" شوید و از بخش Artifacts در پایین صفحه، فایل BluetoothStayAlive-Debug-APK را دانلود و نصب کنید.'
              : 'Go to your repo\'s Actions tab > Build Android APK > Artifacts > download BluetoothStayAlive-Debug-APK.'}
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              {isFa ? 'سورس‌کدهای پروژه اندروید' : 'Source Code Files'}
            </h3>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs text-white transition-colors self-end sm:self-auto"
          >
            {copiedCode ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">{isFa ? 'کپی شد!' : 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" />
                <span className="text-[11px]">{isFa ? 'کپی این فایل' : 'Copy'}</span>
              </>
            )}
          </button>
        </div>

        {/* Tab row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {ANDROID_PROJECT_FILES.map((file, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedFileIndex(idx)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors ${
                selectedFileIndex === idx
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileCode className="h-3 w-3" />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        {/* Selected file description */}
        <div className="text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-850">
          <span className="font-mono text-cyan-400 truncate">{selectedFile.path}</span>
          <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">{selectedFile.language}</span>
        </div>

        {/* Code Preview */}
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-[360px] leading-relaxed select-text" dir="ltr">
          <pre>{selectedFile.content}</pre>
        </div>
      </div>
    </div>
  );
};
