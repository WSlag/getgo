$filePath = "c:\Users\Administrator\Karga\frontend\src\components\HeroCarousel.jsx"
$content = Get-Content $filePath -Raw

# Extract the old section using regex
$pattern = @"
\{/\* Icon \+ Headline row \*/\}[\s\S]*?\{sub\}\s*</p>
"@

Write-Host "Extracting section to replace..."
$matches = $content -match $pattern

if (-not $matches) {
  Write-Host "ERROR: Pattern not found"
  exit 1
}

# Get the actual matched text
$oldSection = $null
if ($content -match $pattern) {
  $oldSection = $matches[0]
}

if ($null -eq $oldSection) {
  Write-Host "ERROR: Could not extract matched section"
  exit 1
}

Write-Host "Found section of length: $($oldSection.Length)"
Write-Host "First 300 chars of old section:"
Write-Host $oldSection.Substring(0, [Math]::Min(300, $oldSection.Length))

# Define the new section - simpler, based on actual structure
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
"@

# Perform replacement
$newContent = $content.Replace($oldSection, $newSection)

if ($newContent -eq $content) {
  Write-Host "ERROR: Replace() did not make changes"
  exit 1
}

Write-Host "Replacement successful!"

# Write file
Set-Content $filePath $newContent -Encoding UTF8
Write-Host "File updated successfully"
