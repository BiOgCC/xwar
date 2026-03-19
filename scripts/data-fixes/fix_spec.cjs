const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src/components/panels/ProfileTab.tsx');
const replFile = path.join(__dirname, 'spec_replacement.tsx');

let c = fs.readFileSync(target, 'utf8');
const repl = fs.readFileSync(replFile, 'utf8');

const startStr = 'SPECIALIZATION BARS (independent)';
const endStr = 'STATS GRID';

const si = c.indexOf(startStr);
const ei = c.indexOf(endStr);

if (si === -1 || ei === -1) {
  console.error('Markers not found. SpecBars:', si, 'StatsGrid:', ei);
  process.exit(1);
}

let lineStart = c.lastIndexOf('\n', si) + 1;
let endLineStart = c.lastIndexOf('\n', ei) + 1;

c = c.substring(0, lineStart) + repl + c.substring(endLineStart);
fs.writeFileSync(target, c, 'utf8');
console.log('Done! Replaced spec bars + donate section.');
