const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\5fe60c8d-bffa-43af-95a2-ae4813500ce7';
const dst = path.join(__dirname, 'public', 'assets');

// Copy blue soldier
const blueFiles = fs.readdirSync(src).filter(f => f.startsWith('soldier_blue'));
if (blueFiles.length > 0) {
  fs.copyFileSync(path.join(src, blueFiles[0]), path.join(dst, 'soldier_blue.png'));
  console.log('Copied', blueFiles[0], '-> soldier_blue.png');
}

// Copy red soldier
const redFiles = fs.readdirSync(src).filter(f => f.startsWith('soldier_red'));
if (redFiles.length > 0) {
  fs.copyFileSync(path.join(src, redFiles[0]), path.join(dst, 'soldier_red.png'));
  console.log('Copied', redFiles[0], '-> soldier_red.png');
}

console.log('Done!');
