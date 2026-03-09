$filePath = "c:\Users\Administrator\Karga\frontend\src\components\HeroCarousel.jsx"
$content = Get-Content $filePath -Raw

$newSlides = @"
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
"@

# Find and replace the SLIDES array using regex
$pattern = "const SLIDES = \[.*?\];"
$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $newSlides, [System.Text.RegularExpressions.RegexOptions]::Singleline)

# Write back
[System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Updated HeroCarousel.jsx successfully"
