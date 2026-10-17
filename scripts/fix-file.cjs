const fs = require('fs');
let content = fs.readFileSync('scripts/optimize-images.mjs', 'utf8');
const marker = "console.log('Saved:  '";
const idx = content.indexOf(marker);
if (idx >= 0) {
  const lineEnd = content.indexOf('\n', idx);
  content = content.substring(0, lineEnd + 1);
  fs.writeFileSync('scripts/optimize-images.mjs', content, 'utf8');
  console.log('Fixed. New length:', content.length);
} else {
  console.log('Marker not found');
}