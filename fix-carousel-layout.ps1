$filePath = "c:\Users\Administrator\Karga\frontend\src\components\HeroCarousel.jsx"
$content = Get-Content $filePath -Raw

# Find and replace the Icon + Headline section with new nested flex structure
$oldSection = @"
        {/* Icon + Headline row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '10px' : '18px',
            marginBottom: isMobile ? '5px' : '10px',
          }}
        >
          {/* Icon tile */}
          <div
            style={{
              width: isMobile ? '38px' : '56px',
              height: isMobile ? '38px' : '56px',
              borderRadius: '12px',
              background: iconBg,
              border: `1px solid ${'$'}{iconBorder}`,
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
        </div>

        {/* Subtext */}
        <p
          style={{
            margin: 0,
            fontSize: isMobile ? '11px' : '17px',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.4,
            marginBottom: visiblePills.length ? (isMobile ? '10px' : '20px') : 0,
            maxWidth: isMobile ? '100%' : '520px',
          }}
        >
          {sub}
        </p>
"@

$newSection = @"
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
              border: `1px solid ${'$'}{iconBorder}`,
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
"@

# Replace the section
$newContent = $content.Replace($oldSection, $newSection)

# Verify replacement happened
if ($newContent -eq $content) {
  Write-Host "ERROR: Pattern not found - no changes made"
  exit 1
}

Write-Host "Replacement successful"

# Write the updated content
Set-Content $filePath $newContent -Encoding UTF8
Write-Host "File updated successfully"
