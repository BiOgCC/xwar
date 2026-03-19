// Copy card art from brain to public/assets/cards
const fs = require('fs')
const path = require('path')

const src = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\82df854b-d98e-4151-986b-26c2c5059ec7'
const dst = path.join(__dirname, 'public', 'assets', 'cards')

const files = {
  // Original 5
  'card_millionaire_1773906521243.png': 'card_millionaire.png',
  'card_blitzkrieg_1773906537838.png': 'card_blitzkrieg.png',
  'card_oneshot_1773906552461.png': 'card_oneshot.png',
  'card_comeback_1773906565632.png': 'card_comeback.png',
  'card_casino_1773906583686.png': 'card_casino.png',
  // New 5
  'card_warmachine_1773908339373.png': 'card_warmachine.png',
  'card_titanofwar_1773908354260.png': 'card_titanofwar.png',
  'card_scraplord_1773908367893.png': 'card_scraplord.png',
  'card_ironwall_1773908386837.png': 'card_ironwall.png',
  'card_marketmaker_1773908402027.png': 'card_marketmaker.png',
}

fs.mkdirSync(dst, { recursive: true })
for (const [from, to] of Object.entries(files)) {
  const srcPath = path.join(src, from)
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(dst, to))
    console.log(`Copied ${to}`)
  } else {
    console.warn(`SKIP: ${from} not found`)
  }
}
console.log('Done! 10 card images copied.')
