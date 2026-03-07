import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Slide data ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'welcome',
    bg: 'linear-gradient(135deg, #F97316 0%, #FB923C 40%, #FBBF24 100%)',
    orbColor: 'rgba(251,191,36,0.45)',
    orbColor2: 'rgba(253,230,138,0.3)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M1 3h11v9H1zM12 6h4l3 3v3h-7V6zM5.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    iconViewBox: '0 0 20 18',
    headline: 'Welcome to GetGo PH',
    sub: "The Philippines' cargo marketplace. Connect shippers and truckers instantly.",
    pills: ['Cargo Listings', 'Truck Bookings', 'Real-time Tracking'],
  },
  {
    id: 'ship',
    bg: 'linear-gradient(135deg, #9333EA 0%, #C026D3 50%, #EC4899 100%)',
    orbColor: 'rgba(236,72,153,0.4)',
    orbColor2: 'rgba(192,38,211,0.3)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M10 1L20 6v10L10 21 0 16V6L10 1zM10 1v10M0 6l10 5M20 6l-10 5M5 3.5l10 5',
    iconViewBox: '0 0 20 22',
    headline: 'Ship Smarter, Faster',
    sub: 'Real-time tracking and instant booking confirmations for your cargo.',
    pills: ['Instant Quotes', 'Live GPS', 'Verified Drivers'],
  },
  {
    id: 'coverage',
    bg: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 50%, #06B6D4 100%)',
    orbColor: 'rgba(6,182,212,0.4)',
    orbColor2: 'rgba(14,165,233,0.3)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M10 1C6.686 1 4 3.686 4 7c0 5 6 12 6 12s6-7 6-12c0-3.314-2.686-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z',
    iconViewBox: '0 0 20 21',
    headline: 'Nationwide Coverage',
    sub: 'From Luzon to Mindanao, trusted carriers across the Philippines.',
    pills: ['24/7 Support', 'Secure Payments', 'Insurance Options'],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function HeroCarousel({ isMobile = false, onEarnAsBrokerClick }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const pauseTimer = useRef(null);
  const total = SLIDES.length;

  const resumeAfterPause = useCallback(() => {
    clearTimeout(pauseTimer.current);
    setIsPaused(true);
    pauseTimer.current = setTimeout(() => setIsPaused(false), 8000);
  }, []);

  const goTo = useCallback((idx) => {
    setCurrent(((idx % total) + total) % total);
    resumeAfterPause();
  }, [total, resumeAfterPause]);

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % total), 5000);
    return () => clearInterval(id);
  }, [isPaused, total]);

  useEffect(() => () => clearTimeout(pauseTimer.current), []);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    delta < 0 ? next() : prev();
  };

  const height = isMobile ? 200 : 240;
  // On mobile, arrows sit outside the card; on desktop they sit inside
  const arrowOffset = isMobile ? '-16px' : '14px';

  return (
    <div
      style={{
        position: 'relative',
        // Extra horizontal space on mobile so the outside arrows are visible
        margin: isMobile ? `0 20px ${12}px` : `0 0 ${16}px`,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: isMobile ? '16px' : '20px',
          overflow: 'hidden',
          height: `${height}px`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slides track */}
        <div
          style={{
            display: 'flex',
            width: `${total * 100}%`,
            height: '100%',
            transform: `translateX(-${(current * 100) / total}%)`,
            transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
          }}
        >
          {SLIDES.map((slide) => (
            <Slide
              key={slide.id}
              slide={slide}
              total={total}
              isMobile={isMobile}
            />
          ))}
        </div>

        {/* Dot indicators */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 10,
          }}
        >
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => goTo(i)}
              style={{
                width: i === current ? '22px' : '8px',
                height: '8px',
                borderRadius: '999px',
                background: i === current ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'width 300ms ease, background 300ms ease',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Arrows inside card on desktop */}
        {!isMobile && (
          <>
            <NavArrow direction="left" onClick={prev} isMobile={false} inside />
            <NavArrow direction="right" onClick={next} isMobile={false} inside />
          </>
        )}
      </div>

      {/* Arrows outside card on mobile — positioned relative to wrapper */}
      {isMobile && (
        <>
          <NavArrow direction="left" onClick={prev} isMobile={true} offset={arrowOffset} cardHeight={height} />
          <NavArrow direction="right" onClick={next} isMobile={true} offset={arrowOffset} cardHeight={height} />
        </>
      )}
    </div>
  );
}

// ─── Individual Slide ───────────────────────────────────────────────────────

function Slide({ slide, total, isMobile }) {
  const { bg, orbColor, orbColor2, iconBg, iconBorder, iconPath, iconViewBox, headline, sub, pills } = slide;
  // Show max 2 pills on mobile to avoid overflow
  const visiblePills = isMobile ? pills.slice(0, 2) : pills;

  return (
    <div
      style={{
        width: `${100 / total}%`,
        height: '100%',
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Large decorative orb — top right */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-8%',
          width: isMobile ? '160px' : '240px',
          height: isMobile ? '160px' : '240px',
          borderRadius: '28px',
          background: `radial-gradient(circle at 40% 40%, ${orbColor}, ${orbColor2} 60%, transparent 80%)`,
          backdropFilter: 'blur(2px)',
          border: '1px solid rgba(255,255,255,0.15)',
          transform: 'rotate(12deg)',
          pointerEvents: 'none',
        }}
      />

      {/* Secondary smaller orb — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '8%',
          width: isMobile ? '80px' : '120px',
          height: isMobile ? '80px' : '120px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${orbColor} 0%, transparent 70%)`,
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      />

      {/* Top-left ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '-10%',
          width: '50%',
          height: '120%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          // Enough horizontal padding — no arrows inside on mobile
          padding: isMobile ? '18px 16px 32px 16px' : '28px 80px 40px 32px',
          maxWidth: isMobile ? '100%' : '70%',
          boxSizing: 'border-box',
        }}
      >
        {/* Icon tile */}
        <div
          style={{
            width: isMobile ? '38px' : '52px',
            height: isMobile ? '38px' : '52px',
            borderRadius: '12px',
            background: iconBg,
            border: `1px solid ${iconBorder}`,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: isMobile ? '8px' : '14px',
            flexShrink: 0,
          }}
        >
          <svg
            width={isMobile ? '19' : '26'}
            height={isMobile ? '19' : '26'}
            viewBox={iconViewBox}
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={iconPath} />
          </svg>
        </div>

        {/* Headline */}
        <h2
          style={{
            margin: 0,
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 800,
            fontSize: isMobile ? '19px' : '30px',
            color: 'white',
            lineHeight: 1.15,
            marginBottom: isMobile ? '5px' : '8px',
            letterSpacing: '-0.02em',
          }}
        >
          {headline}
        </h2>

        {/* Subtext */}
        <p
          style={{
            margin: 0,
            fontSize: isMobile ? '11px' : '14px',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.4,
            marginBottom: visiblePills.length ? (isMobile ? '10px' : '16px') : 0,
            maxWidth: isMobile ? '240px' : '380px',
          }}
        >
          {sub}
        </p>

        {/* Pill badges */}
        {visiblePills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px', overflow: 'hidden' }}>
            {visiblePills.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: isMobile ? '10px' : '12px',
                  fontWeight: 600,
                  color: 'white',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '999px',
                  padding: isMobile ? '3px 10px' : '5px 14px',
                  backdropFilter: 'blur(4px)',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '0.01em',
                  flexShrink: 0,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Nav Arrow Button ───────────────────────────────────────────────────────

function NavArrow({ direction, onClick, isMobile, inside = false, offset, cardHeight }) {
  const isLeft = direction === 'left';
  const size = isMobile ? '28px' : '36px';

  const positionStyle = inside
    ? {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [isLeft ? 'left' : 'right']: '14px',
        marginTop: '-12px',
      }
    : {
        // Outside the card: position relative to wrapper
        position: 'absolute',
        top: `${(cardHeight / 2) - 14 - 12}px`, // vertically center minus dot offset
        [isLeft ? 'left' : 'right']: offset,
      };

  return (
    <button
      type="button"
      aria-label={isLeft ? 'Previous slide' : 'Next slide'}
      onClick={onClick}
      style={{
        ...positionStyle,
        width: size,
        height: size,
        borderRadius: '50%',
        background: isMobile ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.35)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        transition: 'background 200ms ease',
        padding: 0,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isMobile ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.32)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isMobile ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.2)'; }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 14 14"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isLeft
          ? <polyline points="9,2 4,7 9,12" />
          : <polyline points="5,2 10,7 5,12" />
        }
      </svg>
    </button>
  );
}

export default HeroCarousel;
