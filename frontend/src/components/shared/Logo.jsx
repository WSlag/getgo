import { cn } from '@/lib/utils';

export function Logo({ className = "", showText = true, size = "default" }) {
  const sizes = {
    sm: { img: 32, text: "text-xl" },
    default: { img: 40, text: "text-2xl" },
    lg: { img: 48, text: "text-3xl" },
  };

  const currentSize = sizes[size] || sizes.default;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src="/icons/icon-192x192.png"
        alt="GetGo"
        width={currentSize.img}
        height={currentSize.img}
        className="drop-shadow-lg rounded-xl"
      />
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
              }}
            >
              Get
            </span>
            <span
              className={cn("font-black tracking-tight text-gray-900 dark:text-white", currentSize.text)}
              style={{ fontFamily: 'Outfit, sans-serif' }}
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
