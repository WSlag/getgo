const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/HeroCarousel.jsx');
let content = fs.readFileSync(filePath, 'utf8');

let count = 0;
const log = [];

// 1. Update icon-text gap (12px → 14px mobile)
if (content.includes(`gap: isMobile ? '12px' : '18px',`)) {
  content = content.replace(
    `gap: isMobile ? '12px' : '18px',`,
    `gap: isMobile ? '14px' : '18px',`
  );
  count++;
  log.push('✓ Icon-text gap: 12px→14px (mobile)');
}

// 2. Update text column gap (4px → 10px mobile, 8px → 12px desktop) - second occurrence
// We need to be careful to only update the text column gap, not pill badges gap
// The text column is: gap: isMobile ? '4px' : '8px', which should be '10px' : '12px'
const lines = content.split('\n');
let foundTextGap = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(`gap: isMobile ? '4px' : '8px',`) && !foundTextGap) {
    // Check if this is in the text column context (should be in a flex column)
    if (i > 0 && lines[i-1].includes(`flexDirection: 'column'`)) {
      lines[i] = lines[i].replace(
        `gap: isMobile ? '4px' : '8px',`,
        `gap: isMobile ? '10px' : '12px',`
      );
      foundTextGap = true;
      count++;
      log.push('✓ Text column gap: 4px→10px (mobile), 8px→12px (desktop)');
      break;
    }
  }
}
content = lines.join('\n');

// Write the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  FINAL GAP OPTIMIZATIONS  ║');
console.log('╚══════════════════════════════════════════════════╝\n');
log.forEach(l => console.log(l));
console.log(`\nTotal replacements: ${count}\n`);
