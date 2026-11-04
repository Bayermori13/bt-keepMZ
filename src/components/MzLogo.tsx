import React from 'react';

interface MzLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const MzLogo: React.FC<MzLogoProps> = ({
  size = 36,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 108 108"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md"
      >
        {/* Background rounded rect */}
        <rect width="108" height="108" rx="26" fill="#090D16" />
        <rect
          x="1.5"
          y="1.5"
          width="105"
          height="105"
          rx="24.5"
          stroke="#1E293B"
          strokeWidth="1.5"
        />

        {/* Center Tech Atmosphere Glow */}
        <circle cx="54" cy="54" r="36" fill="#0E1E2E" />
        <circle cx="54" cy="54" r="30" stroke="#164E63" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

        {/* Bluetooth Node Crest */}
        <path
          d="M48 27L54 32L51 35M54 32L60 27M54 23V37"
          stroke="#38BDF8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left and right soundwave arcs */}
        <path
          d="M42 28C40 30.5 40 33.5 42 36"
          stroke="#06B6D4"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M66 28C68 30.5 68 33.5 66 36"
          stroke="#10B981"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Stylized 'M' Glyph */}
        <path
          d="M27 45V73"
          stroke="#06B6D4"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M27 45L40 61L51 45"
          stroke="#38BDF8"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M51 45V73"
          stroke="#06B6D4"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* Stylized 'Z' Glyph */}
        <path
          d="M59 45H81"
          stroke="#10B981"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M79 46L61 72"
          stroke="#34D399"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M59 73H81"
          stroke="#10B981"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* Tech Core Accent */}
        <circle cx="54" cy="59" r="1.8" fill="#F0FDFA" />

        {/* Bottom Baseline Bar */}
        <path
          d="M34 81H74"
          stroke="#155E75"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
            <span className="font-mono text-cyan-400 font-extrabold">MZ</span>
            <span className="text-slate-200">Bluetooth Keeper</span>
          </span>
        </div>
      )}
    </div>
  );
};
