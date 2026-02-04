import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export function Logo({ className = "", showText = true, size = "default" }) {
  const uniqueId = useId();
  const logoGradientId = `logoGradient-${uniqueId}`;
  const accentGradientId = `accentGradient-${uniqueId}`;

  const sizes = {
    sm: { svg: 32, text: "text-xl" },
    default: { svg: 40, text: "text-2xl" },
    lg: { svg: 48, text: "text-3xl" },
  };

  const currentSize = sizes[size] || sizes.default;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo Icon */}
      <div className="relative">
        <svg
          width={currentSize.svg}
          height={currentSize.svg}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          {/* Gradient Definitions */}
          <defs>
            <linearGradient id={logoGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9A56" />
              <stop offset="100%" stopColor="#FF6B35" />
            </linearGradient>
            <linearGradient id={accentGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFD34E" />
              <stop offset="100%" stopColor="#FF9A56" />
            </linearGradient>
          </defs>

          {/* Background Circle */}
          <circle cx="20" cy="20" r="18" fill={`url(#${logoGradientId})`} />

          {/* Truck/Cargo Symbol */}
          <g transform="translate(8, 10)">
            {/* Cargo Container */}
            <rect x="2" y="4" width="14" height="10" rx="1.5" fill="white" opacity="0.95" />

            {/* Truck Cabin */}
            <path
              d="M16 7 L20 7 L20 11 L18 14 L16 14 Z"
              fill="white"
              opacity="0.95"
            />

            {/* Wheels */}
            <circle cx="6" cy="15" r="2" fill={`url(#${accentGradientId})`} />
            <circle cx="14" cy="15" r="2" fill={`url(#${accentGradientId})`} />

            {/* Speed Lines */}
            <line x1="0" y1="6" x2="2" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            <line x1="0" y1="9" x2="2" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

            {/* Window */}
            <rect x="17" y="8" width="2" height="2" rx="0.5" fill={`url(#${accentGradientId})`} opacity="0.8" />

            {/* Cargo Details */}
            <line x1="5" y1="7" x2="13" y2="7" stroke={`url(#${accentGradientId})`} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
            <line x1="5" y1="9" x2="13" y2="9" stroke={`url(#${accentGradientId})`} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
            <line x1="5" y1="11" x2="11" y2="11" stroke={`url(#${accentGradientId})`} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          </g>
        </svg>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-0.5">
            <span
              className={cn("font-black tracking-tight", currentSize.text)}
              style={{
                fontFamily: 'Outfit, sans-serif',
                background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 50%, #FF5722 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 2px 10px rgba(255, 107, 53, 0.2)',
              }}
            >
              Get
            </span>
            <span
              className={cn("font-black tracking-tight text-gray-900 dark:text-white", currentSize.text)}
              style={{
                fontFamily: 'Outfit, sans-serif',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              Go
            </span>
          </div>
          <p
            className="text-[10px] text-gray-500 dark:text-gray-400 tracking-wide font-medium"
            style={{ marginTop: '-2px' }}
          >
            YOUR CARGO MARKETPLACE
          </p>
        </div>
      )}
    </div>
  );
}

export default Logo;
