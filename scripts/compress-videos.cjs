const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

const videos = walk('public').filter(f => path.extname(f).toLowerCase() === '.mp4');

console.log('Compressing ' + videos.length + ' videos...');

let totalBefore = 0;
let totalAfter = 0;

for (const video of videos) {
  const stat = fs.statSync(video);
  totalBefore += stat.size;
  
  // Skip if already small (less than 500KB)
  if (stat.size < 500 * 1024) {
    console.log('SKIP (small) ' + path.relative('public', video) + ': ' + (stat.size/1024).toFixed(0) + 'KB');
    totalAfter += stat.size;
    continue;
  }
  
  const tmpFile = video + '.tmp.mp4';
  
  const isBackground = video.includes('bg-video') || video.includes('homescreen');
  
  try {
    const audioFlag = isBackground ? '-an' : '-c:a aac -b:a 96k';
    const cmd = 'ffmpeg -y -i "' + video + '" -c:v libx264 -crf 28 -preset medium -vf "scale=\'min(1920,iw)\':\'min(1080,ih)\':force_original_aspect_ratio=decrease" ' + audioFlag + ' -movflags +faststart "' + tmpFile + '"';
    
    execSync(cmd, { stdio: 'pipe', timeout: 300000 });
    
    if (fs.existsSync(tmpFile)) {
      const newStat = fs.statSync(tmpFile);
      if (newStat.size < stat.size) {
        fs.renameSync(tmpFile, video);
        totalAfter += newStat.size;
        const savings = ((1 - newStat.size / stat.size) * 100).toFixed(1);
        console.log('OK ' + path.relative('public', video) + ': ' + (stat.size/1024/1024).toFixed(2) + 'MB -> ' + (newStat.size/1024/1024).toFixed(2) + 'MB (-' + savings + '%)');
      } else {
        fs.unlinkSync(tmpFile);
        totalAfter += stat.size;
        console.log('SKIP (no gain) ' + path.relative('public', video));
      }
    } else {
      totalAfter += stat.size;
      console.log('ERR (no output) ' + path.relative('public', video));
    }
  } catch (err) {
    console.error('ERR ' + path.relative('public', video) + ': ' + err.message.slice(0, 150));
    try { fs.unlinkSync(tmpFile); } catch {}
    totalAfter += stat.size;
  }
}

console.log('\n=== VIDEO SUMMARY ===');
console.log('Before: ' + (totalBefore/1024/1024).toFixed(2) + ' MB');
console.log('After:  ' + (totalAfter/1024/1024).toFixed(2) + ' MB');
console.log('Saved:  ' + ((totalBefore-totalAfter)/1024/1024).toFixed(2) + ' MB (' + ((1-totalAfter/totalBefore)*100).toFixed(1) + '%)');