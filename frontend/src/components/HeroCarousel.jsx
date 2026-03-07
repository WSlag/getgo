import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Inline SVG Illustrations ──────────────────────────────────────────────

function TruckIllustration() {
  return (
    <svg width="88" height="56" viewBox="0 0 88 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Trailer */}
      <rect x="2" y="12" width="52" height="28" rx="4" fill="white" fillOpacity="0.25" />
      <rect x="2" y="12" width="52" height="28" rx="4" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Cab */}
      <rect x="54" y="18" width="28" height="22" rx="4" fill="white" fillOpacity="0.3" />
      <rect x="54" y="18" width="28" height="22" rx="4" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Windshield */}
      <rect x="69" y="21" width="10" height="10" rx="2" fill="white" fillOpacity="0.5" />
      {/* Wheels */}
      <circle cx="18" cy="42" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="18" cy="42" r="2.5" fill="white" fillOpacity="0.5" />
      <circle cx="46" cy="42" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="46" cy="42" r="2.5" fill="white" fillOpacity="0.5" />
      <circle cx="70" cy="42" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      <circle cx="70" cy="42" r="2.5" fill="white" fillOpacity="0.5" />
      {/* Speed lines */}
      <line x1="0" y1="22" x2="8" y2="22" stroke="white" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="28" x2="12" y2="28" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="0" y1="34" x2="6" y2="34" stroke="white" strokeOpacity="0.25" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function BrokerIllustration() {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Central coin */}
      <circle cx="36" cy="28" r="16" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="36" cy="28" r="10" fill="white" fillOpacity="0.15" />
      {/* Peso sign */}
      <text x="36" y="33" textAnchor="middle" fill="white" fillOpacity="0.9" fontSize="13" fontWeight="700" fontFamily="Outfit, sans-serif">₱</text>
      {/* Network dots */}
      <circle cx="10" cy="12" r="5" fill="white" fillOpacity="0.3" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="62" cy="12" r="5" fill="white" fillOpacity="0.3" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="10" cy="44" r="5" fill="white" fillOpacity="0.3" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="62" cy="44" r="5" fill="white" fillOpacity="0.3" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      {/* Connection lines */}
      <line x1="15" y1="15" x2="26" y2="21" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="57" y1="15" x2="46" y2="21" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="15" y1="41" x2="26" y2="35" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="57" y1="41" x2="46" y2="35" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 2" />
      {/* Upward arrow */}
      <path d="M58 8 L62 4 L66 8" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="62" y1="4" x2="62" y2="12" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Slide definitions ─────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'welcome',
    bg: 'linear-gradient(135deg, #FF6B35 0%, #FF9A56 60%, #FFB347 100%)',
    patternColor: 'rgba(255,255,255,0.06)',
    Illustration: TruckIllustration,
    headline: 'Welcome to GetGo PH',
    sub: 'The Philippines\' cargo marketplace. Connect shippers and truckers instantly — anytime, anywhere.',
    pills: ['Cargo Listings', 'Truck Bookings', 'Real-time Tracking'],
  },
  {
    id: 'broker',
    bg: 'linear-gradient(135deg, #15803d 0%, #16a34a 55%, #22c55e 100%)',
    patternColor: 'rgba(255,255,255,0.06)',
    Illustration: BrokerIllustration,
    headline: 'Earn While You Share',
    sub: 'Become a GetGo Broker. Refer shippers & truckers and earn 3–6% commission on every closed deal.',
    steps: ['Share Code', 'User Signs Up', 'Deal Closes', 'You Earn'],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function HeroCarousel({ isMobile = false, onEarnAsBrokerClick }) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const autoRef = useRef(null);

  const goTo = useCallback((idx) => {
    setCurrent(idx);
    setIsPaused(true);
    // Resume auto-advance after 8s of inactivity
    clearTimeout(autoRef.current);
    autoRef.current = setTimeout(() => setIsPaused(false), 8000);
  }, []);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, [isPaused]);

  useEffect(() => () => clearTimeout(autoRef.current), []);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    const next = delta < 0
      ? (current + 1) % SLIDES.length
      : (current - 1 + SLIDES.length) % SLIDES.length;
    goTo(next);
  };

  const height = isMobile ? 164 : 200;
  const slide = SLIDES[current];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: isMobile ? '14px' : '16px',
        overflow: 'hidden',
        marginBottom: isMobile ? '12px' : '16px',
        height: `${height}px`,
        userSelect: 'none',
        flexShrink: 0,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides track */}
      <div
        style={{
          display: 'flex',
          width: `${SLIDES.length * 100}%`,
          height: '100%',
          transform: `translateX(-${(current * 100) / SLIDES.length}%)`,
          transition: 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {SLIDES.map((s, i) => (
          <SlidePane
            key={s.id}
            slide={s}
            isMobile={isMobile}
            slideCount={SLIDES.length}
            onCTAClick={s.id === 'broker' ? onEarnAsBrokerClick : undefined}
            isActive={i === current}
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
          gap: '6px',
          zIndex: 10,
        }}
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            style={{
              width: i === current ? '20px' : '7px',
              height: '7px',
              borderRadius: '999px',
              background: i === current ? 'white' : 'rgba(255,255,255,0.45)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'width 300ms ease, background 300ms ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SlidePane ─────────────────────────────────────────────────────────────

function SlidePane({ slide, isMobile, slideCount, onCTAClick }) {
  const { bg, patternColor, Illustration, headline, sub, pills, steps } = slide;

  return (
    <div
      style={{
        width: `${100 / slideCount}%`,
        height: '100%',
        background: bg,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {/* Diagonal pattern overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id={`diag-${slide.id}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="20" stroke={patternColor} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#diag-${slide.id})`} />
      </svg>

      {/* Radial glow top-right */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          padding: isMobile ? '16px 16px 32px' : '20px 24px 36px',
          gap: isMobile ? '12px' : '20px',
          boxSizing: 'border-box',
        }}
      >
        {/* Illustration */}
        <div style={{ flexShrink: 0, opacity: 0.95 }}>
          <Illustration />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 800,
              fontSize: isMobile ? '15px' : '18px',
              color: 'white',
              lineHeight: 1.2,
              marginBottom: '5px',
              letterSpacing: '-0.01em',
            }}
          >
            {headline}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? '11px' : '12px',
              color: 'rgba(255,255,255,0.88)',
              lineHeight: 1.45,
              marginBottom: pills || steps ? '10px' : 0,
            }}
          >
            {sub}
          </p>

          {/* Pills (slide 1) */}
          {pills && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {pills.map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: isMobile ? '9.5px' : '10px',
                    fontWeight: 600,
                    color: 'white',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '999px',
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Steps (slide 2) */}
          {steps && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
              {steps.map((step, idx) => (
                <span key={step} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span
                    style={{
                      fontSize: isMobile ? '9.5px' : '10px',
                      fontWeight: 700,
                      color: 'white',
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    {idx + 1}. {step}
                  </span>
                  {idx < steps.length - 1 && (
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>›</span>
                  )}
                </span>
              ))}
              {onCTAClick && (
                <button
                  type="button"
                  onClick={onCTAClick}
                  style={{
                    marginTop: '6px',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    background: 'white',
                    color: '#15803d',
                    fontSize: isMobile ? '10px' : '11px',
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  Learn More
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HeroCarousel;
