const { execSync } = require('child_process');
const files = execSync('git ls-files --deleted', { encoding: 'utf8' }).trim().split(/\r?\n/);
console.log('Restoring ' + files.length + ' deleted files...');
let restored = 0;
for (const f of files) {
  try {
    execSync('git checkout HEAD -- ' + JSON.stringify(f), { stdio: 'pipe' });
    restored++;
  } catch (e) {
    console.error('Failed to restore: ' + f + ' - ' + e.message.slice(0, 100));
  }
}
console.log('Restored ' + restored + ' of ' + files.length + ' files');