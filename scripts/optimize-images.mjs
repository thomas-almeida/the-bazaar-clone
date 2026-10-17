import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = 'public';
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 82;
const PNG_COMPRESSION = 9;

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

const imageExts = new Set(['.jpg', '.jpeg', '.png']);
const files = walk(PUBLIC_DIR).filter(f => imageExts.has(path.extname(f).toLowerCase()));

console.log('Found ' + files.length + ' images to optimize');

let totalBefore = 0;
let totalAfter = 0;
let processed = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
  const stat = fs.statSync(file);
  totalBefore += stat.size;
  
  try {
    const ext = path.extname(file).toLowerCase();
    const metadata = await sharp(file).metadata();
    
    const needsResize = metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;
    
    let pipeline = sharp(file);
    
    if (needsResize) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });
    }
    
    const tmpFile = file + '.tmp';
    
    if (ext === '.jpg' || ext === '.jpeg') {
      await pipeline
        .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
        .toFile(tmpFile);
    } else if (ext === '.png') {
      if (metadata.hasAlpha) {
        await pipeline
          .png({ compressionLevel: PNG_COMPRESSION, palette: true })
          .toFile(tmpFile);
      } else {
        await pipeline
          .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
          .toFile(tmpFile);
      }
    }
    
    const newStat = fs.statSync(tmpFile);
    if (newStat.size < stat.size) {
      fs.renameSync(tmpFile, file);
      totalAfter += newStat.size;
      processed++;
      const savings = ((1 - newStat.size / stat.size) * 100).toFixed(1);
      console.log('OK ' + path.relative(PUBLIC_DIR, file) + ': ' + (stat.size/1024).toFixed(0) + 'KB -> ' + (newStat.size/1024).toFixed(0) + 'KB (-' + savings + '%)');
    } else {
      fs.unlinkSync(tmpFile);
      totalAfter += stat.size;
      skipped++;
    }
  } catch (err) {
    errors++;
    console.error('ERR ' + file + ': ' + err.message);
    try { fs.unlinkSync(file + '.tmp'); } catch {}
  }
}

console.log('\n=== SUMMARY ===');
console.log('Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
console.log('Before: ' + (totalBefore/1024/1024).toFixed(2) + ' MB');
console.log('After:  ' + (totalAfter/1024/1024).toFixed(2) + ' MB');
console.log('Saved:  ' + ((totalBefore-totalAfter)/1024/1024).toFixed(2) + ' MB (' + ((1-totalAfter/totalBefore)*100).toFixed(1) + '%)');
