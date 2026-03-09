const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/HeroCarousel.jsx');
let content = fs.readFileSync(filePath, 'utf8');

let count = 0;
const log = [];

// 1. Update container height (210 → 240 mobile, 320 → 340 desktop)
if (content.includes('const height = isMobile ? 210 : 320;')) {
  content = content.replace(
    'const height = isMobile ? 210 : 320;',
    'const height = isMobile ? 240 : 340;'
  );
  count++;
  log.push('✓ Container height: 210→240px (mobile), 320→340px (desktop)');
}

// 2. Update content wrapper padding (reduce right/left: 52px→40px right, 60px→48px left)
if (content.includes(`padding: isMobile ? '18px 52px 42px 60px' : '34px 72px 52px 100px',`)) {
  content = content.replace(
    `padding: isMobile ? '18px 52px 42px 60px' : '34px 72px 52px 100px',`,
    `padding: isMobile ? '18px 40px 42px 48px' : '34px 72px 52px 100px',`
  );
  count++;
  log.push('✓ Content padding: Mobile 52px→40px right, 60px→48px left');
}

// 3. Update icon-text gap (10px → 14px mobile)
// Match the exact gap in the Icon + Text wrapper
const gapPattern1 = /gap: isMobile \? '10px' : '18px',\n\s+marginBottom: isMobile \? '5px' : '10px',\n\s+width: '100%',/;
const gapReplacement1 = `gap: isMobile ? '14px' : '18px',
            marginBottom: isMobile ? '8px' : '14px',
            width: '100%',`;

if (gapPattern1.test(content)) {
  content = content.replace(gapPattern1, gapReplacement1);
  count++;
  log.push('✓ Icon-text gap: 10px→14px (mobile), 5px→8px marginBottom');
}

// 4. Update headline font size (19px → 22px mobile)
if (content.includes(`fontSize: isMobile ? '19px' : '38px',`)) {
  content = content.replace(
    `fontSize: isMobile ? '19px' : '38px',`,
    `fontSize: isMobile ? '22px' : '38px',`
  );
  count++;
  log.push('✓ Headline font: 19px→22px (mobile)');
}

// 5. Update subtext font size (11px → 13px mobile)
if (content.includes(`fontSize: isMobile ? '11px' : '17px',`)) {
  content = content.replace(
    `fontSize: isMobile ? '11px' : '17px',`,
    `fontSize: isMobile ? '13px' : '17px',`
  );
  count++;
  log.push('✓ Subtext font: 11px→13px (mobile)');
}

// 6. Update text column gap (2px → 8px mobile, 4px → 10px desktop)
// This is in the text column div after icon tile
const textGapPattern = /gap: isMobile \? '2px' : '4px',\n\s+\}\)\n\s+>\n\s+\{\/\* Headline \*\/\}/;
const textGapReplacement = `gap: isMobile ? '8px' : '10px',
            }}
          >
            {/* Headline */}`;

if (textGapPattern.test(content)) {
  content = content.replace(textGapPattern, textGapReplacement);
  count++;
  log.push('✓ Text column gap: 2px→8px (mobile), 4px→10px (desktop)');
}

// 7. Add marginTop to icon for baseline alignment (if not already present)
const iconWithMarginTop = `flexShrink: 0,
              marginTop: '2px',`;
const iconWithoutMarginTop = `flexShrink: 0,`;

if (!content.includes(iconWithMarginTop)) {
  // Find the icon flex div and add marginTop
  const iconPattern = /(\s+flexShrink: 0,)(\n\s+})/;
  if (iconPattern.test(content)) {
    content = content.replace(
      iconPattern,
      `$1
              marginTop: '2px',$2`
    );
    count++;
    log.push('✓ Icon margin-top: Added 2px for baseline alignment');
  }
}

// Write the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  MOBILE CAROUSEL OPTIMIZATION COMPLETE  ║');
console.log('╚══════════════════════════════════════════════════╝\n');
log.forEach(l => console.log(l));
console.log(`\nTotal replacements: ${count}\n`);
