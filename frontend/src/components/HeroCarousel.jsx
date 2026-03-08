import { useState, useEffect, useRef, useCallback } from 'react';

// ΓöÇΓöÇΓöÇ Slide data ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const SLIDES = [
  {
    id: 'truckers',
    isImage: true,
    image: '/assets/trucker-phone-cab.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(251, 146, 60, 0.3) 0%, rgba(249, 115, 22, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.62) 38%, rgba(10,14,23,0.18) 68%, rgba(10,14,23,0.06) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M1 3h11v9H1zM12 6h4l3 3v3h-7V6zM5.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    iconViewBox: '0 0 20 18',
    headline: 'Welcome to GetGo PH',
    sub: "The Philippines' cargo marketplace. Connect shippers and truckers instantly.",
    pills: ['Cargo Listings', 'Truck Bookings', 'Bidding'],
  },
  {
    id: 'cargo',
    isImage: true,
    image: '/assets/warehouse-worker-phone.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.62) 38%, rgba(10,14,23,0.18) 68%, rgba(10,14,23,0.06) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M1 3h11v9H1zM12 6h4l3 3v3h-7V6zM5.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 15.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    iconViewBox: '0 0 20 18',
    headline: 'Book Trucks in Seconds',
    sub: 'Post cargo and receive bids from available truckers fast with a smoother dispatch workflow.',
    pills: ['Fast Dispatch', 'Verified Truckers', 'Better Pricing'],
  },
  {
    id: 'network',
    isImage: true,
    image: '/assets/highway-sunset-truck.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(36, 99, 235, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.62) 38%, rgba(10,14,23,0.18) 68%, rgba(10,14,23,0.06) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M10 1C6.686 1 4 3.686 4 7c0 5 6 12 6 12s6-7 6-12c0-3.314-2.686-6-6-6zm0 8a2 2 0 110-4 2 2 0 010 4z',
    iconViewBox: '0 0 20 21',
    headline: 'Nationwide Coverage',
    sub: 'From Luzon to Mindanao, trusted carriers across the Philippines.',
    pills: ['Verified', 'Secure Payments', 'Rated Drivers'],
  },
  {
    id: 'manage',
    isImage: true,
    image: '/assets/problem-logistics-manager.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(249, 115, 22, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.62) 38%, rgba(10,14,23,0.18) 68%, rgba(10,14,23,0.06) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M12 2a8 8 0 00-8 8v1.5l-1 2V15h18v-1.5l-1-2V10a8 8 0 00-8-8zm0 20a3 3 0 003-3H9a3 3 0 003 3z',
    iconViewBox: '0 0 24 24',
    headline: 'Struggling to Manage Your Logistics?',
    sub: 'Multiple shipments, delays, and manual coordination between shippers and truckers.',
    pills: ['Manual Follow-up', 'Delayed Booking', 'Missed Opportunities'],
  },
  {
    id: 'solution',
    isImage: true,
    image: '/assets/warehouse-worker-phone.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(14,23,42,0.84) 0%, rgba(14,23,42,0.64) 40%, rgba(14,23,42,0.16) 70%, rgba(14,23,42,0.05) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M3 3h18v14H3zM8 21h8M12 17v4',
    iconViewBox: '0 0 24 24',
    headline: 'One Platform to Control Your Logistics',
    sub: 'Post cargo, track shipments, and connect with truckers instantly in one marketplace.',
    pills: ['Cargo Marketplace', 'Live Tracking', 'Smart Bidding'],
  },
  {
    id: 'broker',
    isImage: true,
    image: '/assets/broker-booking.png',
    placeholderGradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(8, 145, 178, 0.3) 100%)',
    overlayGradient: 'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.62) 38%, rgba(10,14,23,0.18) 68%, rgba(10,14,23,0.06) 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    iconBorder: 'rgba(255,255,255,0.3)',
    iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    iconViewBox: '0 0 24 22',
    headline: 'Be a Broker',
    sub: 'Refer deals, earn commission. Zero capital, unlimited income.',
    pills: ['Commission', 'Zero Capital', 'Unlimited Earn'],
    isBrokerCta: true,
  },
];

// ΓöÇΓöÇΓöÇ Component ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

  const height = isMobile ? 210 : 320;

  return (
    <div
      style={{
        position: 'relative',
        margin: isMobile ? '0 0 12px' : '0 0 16px',
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
              onCtaClick={slide.isBrokerCta ? onEarnAsBrokerClick : undefined}
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

        {/* Nav arrows ΓÇö always inside card */}
        <NavArrow direction="left" onClick={prev} isMobile={isMobile} />
        <NavArrow direction="right" onClick={next} isMobile={isMobile} />
      </div>
    </div>
  );
}

// ΓöÇΓöÇΓöÇ Individual Slide ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function Slide({ slide, total, isMobile, onCtaClick }) {
  const { bg, orbColor, orbColor2, isImage, image, placeholderGradient, overlayGradient, iconBg, iconBorder, iconPath, iconViewBox, headline, sub, pills } = slide;
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Lazy-load images with Intersection Observer
  useEffect(() => {
    if (!isImage || !image) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !imageLoaded) {
            // Preload the image
            const img = new Image();
            img.onload = () => {
              setImageLoaded(true);
              if (imageRef.current) {
                imageRef.current.style.backgroundImage = `url(${image})`;
              }
            };
            img.src = image;
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, [isImage, image, imageLoaded]);

  const visiblePills = pills || [];

  // Determine background style
  const backgroundStyle = isImage
    ? {
        background: placeholderGradient,
        backgroundSize: 'cover',
        backgroundPosition: isMobile ? '68% center' : 'center',
      }
    : {
        background: bg,
      };

  return (
    <div
      ref={imageRef}
      style={{
        width: `${100 / total}%`,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        ...backgroundStyle,
      }}
    >
      {/* Image overlay gradient for text readability */}
      {isImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: overlayGradient,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Decorative orbs ΓÇö gradient slides only */}
      {!isImage && orbColor && (
        <>
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
        </>
      )}

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isMobile ? '18px 52px 42px 60px' : '34px 72px 52px 100px',
          maxWidth: isMobile ? '100%' : '64%',
          margin: '0',
          width: '100%',
          boxSizing: 'border-box',
          alignItems: 'flex-start',
          textAlign: 'left',
        }}
      >
        {/* Icon + Text column wrapper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: isMobile ? '12px' : '18px',
            marginBottom: isMobile ? '8px' : '16px',
            width: '100%',
          }}
        >
          {/* Icon tile - left */}
          <div
            style={{
              width: isMobile ? '38px' : '56px',
              height: isMobile ? '38px' : '56px',
              borderRadius: '12px',
              background: iconBg,
              border: `1px solid ${iconBorder}`,
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width={isMobile ? '19' : '28'}
              height={isMobile ? '19' : '28'}
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

          {/* Text column - headline and subtext stacked */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '4px' : '8px',
            }}
          >
            {/* Headline */}
            <h2
              style={{
                margin: 0,
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 800,
                fontSize: isMobile ? '19px' : '38px',
                color: 'white',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              {headline}
            </h2>

            {/* Subtext */}
            <p
              style={{
                margin: 0,
                fontSize: isMobile ? '11px' : '17px',
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.4,
                maxWidth: isMobile ? '100%' : '520px',
              }}
            >
              {sub}
            </p>
          </div>
        </div>

        {/* Pill badges */}{/* Pill badges */}
        {visiblePills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '5px' : '8px', justifyContent: 'flex-start' }}>
            {visiblePills.map((p) => (
              <span
                key={p}
                style={{
                  fontSize: isMobile ? '10px' : '14px',
                  fontWeight: 600,
                  color: 'white',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '999px',
                  padding: isMobile ? '3px 9px' : '7px 18px',
                  backdropFilter: 'blur(4px)',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '0.01em',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* CTA button ΓÇö broker slide only */}
        {onCtaClick && (
          <button
            type="button"
            onClick={onCtaClick}
            style={{
              marginTop: isMobile ? '10px' : '16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '8px 18px' : '10px 24px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.22)',
              border: '1.5px solid rgba(255,255,255,0.55)',
              backdropFilter: 'blur(6px)',
              color: 'white',
              fontFamily: 'Outfit, sans-serif',
              fontSize: isMobile ? '12px' : '15px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              alignSelf: 'flex-start',
            }}
          >
            Activate Broker
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="2" y1="7" x2="12" y2="7" />
              <polyline points="8,3 12,7 8,11" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ΓöÇΓöÇΓöÇ Nav Arrow Button ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function NavArrow({ direction, onClick, isMobile }) {
  const isLeft = direction === 'left';
  const size = isMobile ? '28px' : '36px';

  return (
    <button
      type="button"
      aria-label={isLeft ? 'Previous slide' : 'Next slide'}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        marginTop: '-12px',
        [isLeft ? 'left' : 'right']: isMobile ? '10px' : '14px',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
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
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
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
