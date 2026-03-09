const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/HeroCarousel.jsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find the markers
const startMarker = '{/* Icon + Headline row */}';
const endMarker = '{/* Pill badges */}';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('ERROR: Could not find markers');
  console.error('startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

// Extract the old section
const oldSection = content.substring(startIdx, endIdx);

// Define the new section
const newSection = `{/* Icon + Text column wrapper */}
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
              border: \`1px solid \${iconBorder}\`,
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

        {/* Pill badges */}`;

// Perform replacement
const newContent = content.replace(oldSection, newSection);

if (newContent === content) {
  console.error('ERROR: Replacement did not modify content');
  process.exit(1);
}

// Write the file
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✓ File updated successfully');
console.log('Old section length:', oldSection.length);
console.log('New section length:', newSection.length);
console.log('File size delta:', newContent.length - content.length);
