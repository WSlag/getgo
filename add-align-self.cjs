const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/components/HeroCarousel.jsx');

let content = fs.readFileSync(filePath, 'utf8');

// Find and replace flexShrink: 0, with flexShrink: 0, alignSelf: 'flex-start',
// in the Icon tile - left section
const oldPattern = `flexShrink: 0,
            }}`;

const newPattern = `flexShrink: 0,
              alignSelf: 'flex-start',
            }}`;

if (!content.includes(oldPattern)) {
  console.error('ERROR: Pattern not found');
  process.exit(1);
}

// Count occurrences - we need to find the right one (in Icon tile - left)
// Look for the one that comes after "Icon tile - left"
const iconLeftIdx = content.indexOf('{/* Icon tile - left */}');
if (iconLeftIdx === -1) {
  console.error('ERROR: Icon tile - left marker not found');
  process.exit(1);
}

// Find the first flexShrink after Icon tile - left
const flexShrinkIdx = content.indexOf(oldPattern, iconLeftIdx);
if (flexShrinkIdx === -1) {
  console.error('ERROR: flexShrink pattern not found after Icon tile - left');
  process.exit(1);
}

// Replace only this occurrence
const newContent = content.substring(0, flexShrinkIdx) + 
                   newPattern + 
                   content.substring(flexShrinkIdx + oldPattern.length);

if (newContent === content) {
  console.error('ERROR: Replacement did not modify content');
  process.exit(1);
}

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✓ Added alignSelf: "flex-start" to icon tile');
