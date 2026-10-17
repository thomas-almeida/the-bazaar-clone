const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const audioFiles = [
  'public/boargame/img/maggi-soundtrack-2.mp3',
  'public/boargame/img/maggi-soundtrack-3.mp3',
  'public/boargame/img/menu-song.mp3',
  'public/sounds/soundtracks/mago-2-sondtrack.mp3',
  'public/sounds/soundtracks/mago-5-soundtrack.mp3',
];

console.log('Compressing ' + audioFiles.length + ' audio files...');

let totalBefore = 0;
let totalAfter = 0;

for (const audio of audioFiles) {
  const stat = fs.statSync(audio);
  totalBefore += stat.size;
  const tmpFile = 'temp_audio.mp3';
  
  try {
    const cmd = 'ffmpeg -y -i "' + audio + '" -b:a 128k -map a "' + tmpFile + '"';
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });
    
    if (fs.existsSync(tmpFile)) {
      const newStat = fs.statSync(tmpFile);
      if (newStat.size < stat.size) {
        fs.renameSync(tmpFile, audio);
        totalAfter += newStat.size;
        const savings = ((1 - newStat.size / stat.size) * 100).toFixed(1);
        console.log('OK ' + audio + ': ' + (stat.size/1024/1024).toFixed(2) + 'MB -> ' + (newStat.size/1024/1024).toFixed(2) + 'MB (-' + savings + '%)');
      } else {
        fs.unlinkSync(tmpFile);
        totalAfter += stat.size;
        console.log('SKIP (no gain) ' + audio);
      }
    } else {
      totalAfter += stat.size;
      console.log('ERR (no output) ' + audio);
    }
  } catch (err) {
    console.error('ERR ' + audio + ': ' + err.message.slice(0, 150));
    try { fs.unlinkSync(tmpFile); } catch {}
    totalAfter += stat.size;
  }
}

console.log('\n=== AUDIO SUMMARY ===');
console.log('Before: ' + (totalBefore/1024/1024).toFixed(2) + ' MB');
console.log('After:  ' + (totalAfter/1024/1024).toFixed(2) + ' MB');
console.log('Saved:  ' + ((totalBefore-totalAfter)/1024/1024).toFixed(2) + ' MB (' + ((1-totalAfter/totalBefore)*100).toFixed(1) + '%)');