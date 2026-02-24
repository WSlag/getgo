export function AppLogo({ size = 48, className = '' }) {
  return (
    <img
      src="/icons/icon-192x192.png"
      alt="GetGo"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: Math.round(size * 0.22) }}
    />
  );
}

export default AppLogo;
