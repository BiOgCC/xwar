const fs = require('fs')
const path = require('path')

const src = 'C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\3b280b97-ce32-48a0-a147-9ee1dc8f459d'
const dest = path.join(__dirname, 'public', 'assets', 'stages')

fs.mkdirSync(dest, { recursive: true })

fs.copyFileSync(path.join(src, 'urban_stage_1773897249484.png'), path.join(dest, 'urban.png'))
fs.copyFileSync(path.join(src, 'jungle_stage_1773897264120.png'), path.join(dest, 'jungle.png'))
fs.copyFileSync(path.join(src, 'desert_stage_1773897279502.png'), path.join(dest, 'desert.png'))

console.log('Copied 3 stage backgrounds to', dest)
console.log(fs.readdirSync(dest))
