const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const electronDir = __dirname;
const srcDist = path.join(rootDir, 'dist');
const destDist = path.join(electronDir, 'dist');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Step 1: Building frontend...');
execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

console.log('Step 2: Copying dist/ into electron-browser/dist/...');
if (fs.existsSync(destDist)) {
  fs.rmSync(destDist, { recursive: true });
}
copyRecursive(srcDist, destDist);
console.log(`Copied ${srcDist} -> ${destDist}`);

console.log('Step 3: Done! Now run: npm run build');
