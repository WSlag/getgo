/**
 * Standalone app logo SVG for use in PWA install prompts and overlays.
 * Uses static gradient IDs (safe since these won't conflict in isolated contexts).
 */
export function AppLogo({ size = 48, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="pwaLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9A56" />
          <stop offset="100%" stopColor="#FF6B35" />
        </linearGradient>
        <linearGradient id="pwaAccentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD34E" />
          <stop offset="100%" stopColor="#FF9A56" />
        </linearGradient>
      </defs>

      <circle cx="20" cy="20" r="18" fill="url(#pwaLogoGrad)" />

      <g transform="translate(8, 10)">
        <rect x="2" y="4" width="14" height="10" rx="1.5" fill="white" opacity="0.95" />
        <path d="M16 7 L20 7 L20 11 L18 14 L16 14 Z" fill="white" opacity="0.95" />
        <circle cx="6" cy="15" r="2" fill="url(#pwaAccentGrad)" />
        <circle cx="14" cy="15" r="2" fill="url(#pwaAccentGrad)" />
        <line x1="0" y1="6" x2="2" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="0" y1="9" x2="2" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <rect x="17" y="8" width="2" height="2" rx="0.5" fill="url(#pwaAccentGrad)" opacity="0.8" />
        <line x1="5" y1="7" x2="13" y2="7" stroke="url(#pwaAccentGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        <line x1="5" y1="9" x2="13" y2="9" stroke="url(#pwaAccentGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        <line x1="5" y1="11" x2="11" y2="11" stroke="url(#pwaAccentGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  );
}

export default AppLogo;
