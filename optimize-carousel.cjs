const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/HeroCarousel.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Track replacements
let replacements = [];

// 1. Update HeroCarousel height (210px → 240px mobile)
const heightOld = `height: isMobile ? 210 : 320,`;
const heightNew = `height: isMobile ? 240 : 340,`;
if (content.includes(heightOld)) {
  content = content.replace(heightOld, heightNew);
  replacements.push('✓ Updated container height: 210→240px (mobile), 320→340px (desktop)');
}

// 2. Update content wrapper padding (mobile: 18px 52px 42px 60px → 18px 40px 42px 48px)
const paddingOld = `padding: isMobile ? '18px 52px 42px 60px' : '34px 72px 52px 100px',`;
const paddingNew = `padding: isMobile ? '18px 40px 42px 48px' : '34px 72px 52px 100px',`;
if (content.includes(paddingOld)) {
  content = content.replace(paddingOld, paddingNew);
  replacements.push('✓ Optimized padding: Mobile 52px→40px right, 60px→48px left');
}

// 3. Update icon-text gap (10px → 14px mobile)
const gapOld = `gap: isMobile ? '10px' : '18px',`;
const gapNew = `gap: isMobile ? '14px' : '18px',`;
if (content.includes(gapOld)) {
  content = content.replace(gapOld, gapNew);
  replacements.push('✓ Increased icon-text gap: 10px→14px (mobile)');
}

// 4. Update icon-subtext gap (2px → 8px mobile, 4px → 10px desktop)
const textGapOld = `gap: isMobile ? '2px' : '4px',`;
const textGapNew = `gap: isMobile ? '8px' : '10px',`;
if (content.includes(textGapOld)) {
  content = content.replace(textGapOld, textGapNew);
  replacements.push('✓ Increased headline-subtext gap: 2px→8px (mobile), 4px→10px (desktop)');
}

// 5. Update headline font size (19px → 22px mobile)
const headlineFontOld = `fontSize: isMobile ? '19px' : '38px',`;
const headlineFontNew = `fontSize: isMobile ? '22px' : '38px',`;
if (content.includes(headlineFontOld)) {
  content = content.replace(headlineFontOld, headlineFontNew);
  replacements.push('✓ Increased headline font: 19px→22px (mobile)');
}

// 6. Update subtext font size (11px → 13px mobile)
const subtextFontOld = `fontSize: isMobile ? '11px' : '17px',`;
const subtextFontNew = `fontSize: isMobile ? '13px' : '17px',`;
if (content.includes(subtextFontOld)) {
  content = content.replace(subtextFontOld, subtextFontNew);
  replacements.push('✓ Increased subtext font: 11px→13px (mobile)');
}

// 7. Add icon margin-top (2px baseline alignment)
const iconStylePattern = /flexShrink: 0,\s+alignSelf: 'flex-start',/;
if (iconStylePattern.test(content)) {
  content = content.replace(
    /flexShrink: 0,\s+alignSelf: 'flex-start',/,
    `flexShrink: 0,
              alignSelf: 'flex-start',
              marginTop: '2px',`
  );
  replacements.push('✓ Added icon margin-top: 2px (baseline alignment)');
}

// Write the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n========== MOBILE CAROUSEL OPTIMIZATION ==========\n');
replacements.forEach(r => console.log(r));
console.log('\n✓ All optimizations applied successfully!\n');
