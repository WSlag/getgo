$filePath = "c:\Users\Administrator\Karga\frontend\src\components\HeroCarousel.jsx"
[string]$content = Get-Content $filePath -Raw -Encoding UTF8

# Pattern to find the old section
$startMarker = '{/* Icon + Headline row */}'
$endMarker = '{/* Pill badges */}'

$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker, $startIdx)

if ($startIdx -lt 0 -or $endIdx -lt 0) {
  Write-Host "ERROR: Markers not found"
  exit 1
}

Write-Host "Found section from index $startIdx to $endIdx (length: $($endIdx - $startIdx))"

# Extract the old section to be replaced
$oldSection = $content.Substring($startIdx, $endIdx - $startIdx)

# Define new section with proper template literals and escaped backticks
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

        "
@

# Replace in content
$newContent = $content.Substring(0, $startIdx) + $newSection + $content.Substring($endIdx)

# Verify change
if ($newContent.Length -le $content.Length + 100) {
  Write-Host "WARNING: New content not significantly larger. Verify replacement worked."
}

# Write back
[System.IO.File]::WriteAllText($filePath, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "File updated successfully"
Write-Host "New file size: $($newContent.Length) bytes (was $($content.Length))"
