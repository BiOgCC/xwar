const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/panels/InventoryTab.tsx');
let c = fs.readFileSync(file, 'utf8');

const replacements = [
  // 1. Replace ARMOR & PRESTIGE title with title + BEST/REMOVE buttons
  {
    find: `<div className="inv-section__title" style={{ color: '#ffffff' }}>ARMOR & PRESTIGE</div>`,
    replace: `<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div className="inv-section__title" style={{ color: '#ffffff', margin: 0 }}>ARMOR & PRESTIGE</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={{
                padding: '3px 10px', fontSize: '8px', fontWeight: 800, letterSpacing: '0.08em',
                fontFamily: 'var(--font-display)',
                color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '4px', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onClick={() => {
                const inv = useInventoryStore.getState()
                const allItems = inv.items
                const armorSlots = ['helmet', 'chest', 'legs', 'gloves', 'boots']
                armorSlots.forEach(slot => {
                  const candidates = allItems.filter(i => i.slot === slot && i.durability > 0)
                  if (candidates.length === 0) return
                  const best = candidates.reduce((a, b) => {
                    const aT = (a.stats.damage || 0) + (a.stats.armor || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0) + (a.stats.dodge || 0) + (a.stats.precision || 0)
                    const bT = (b.stats.damage || 0) + (b.stats.armor || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0) + (b.stats.dodge || 0) + (b.stats.precision || 0)
                    return bT > aT ? b : a
                  })
                  inv.equipItem(best.id)
                })
                const weapons = allItems.filter(i => i.slot === 'weapon' && i.durability > 0)
                if (weapons.length > 0) {
                  const bestWep = weapons.reduce((a, b) => {
                    const aT = (a.stats.damage || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0)
                    const bT = (b.stats.damage || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0)
                    return bT > aT ? b : a
                  })
                  inv.equipItem(bestWep.id)
                }
                const p = usePlayerStore.getState()
                if (p.redBullets > 0) p.equipAmmo('red')
                else if (p.purpleBullets > 0) p.equipAmmo('purple')
                else if (p.blueBullets > 0) p.equipAmmo('blue')
                else if (p.greenBullets > 0) p.equipAmmo('green')
              }}
            >BEST</button>
            <button
              style={{
                padding: '3px 10px', fontSize: '8px', fontWeight: 800, letterSpacing: '0.08em',
                fontFamily: 'var(--font-display)',
                color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '4px', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onClick={() => {
                const inv = useInventoryStore.getState()
                inv.items.filter(i => i.equipped).forEach(i => inv.unequipItem(i.id))
                usePlayerStore.getState().equipAmmo('none')
              }}
            >REMOVE</button>
          </div>
        </div>`
  },
  // 2. Fix empty armor slots (unicode -> T1 images) - the repeated pattern in equipped gear section
  {
    find: `{slotStr === 'helmet' ? '\\u2302' : slotStr === 'chest' ? '\\u2666' : slotStr === 'legs' ? '\\u2225' : slotStr === 'gloves' ? '\\u270B' : '\\u25B2'}`,
    replace: `<img src={getItemImagePath('t1', slotStr, 'armor') || ''} alt={slotStr} style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} />`
  },
  // 3. Fix weapon empty slot unicode -> T1 image
  {
    find: `<div style={{ fontSize: '28px', opacity: 0.2 }}>\\u2694</div>`,
    replace: `<img src={getItemImagePath('t1', 'weapon', 'weapon') || ''} alt="Weapon" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} />`
  },
  // 4. Fix weapon fallback icon unicode
  {
    find: `>\\u2694</div>}`,
    replace: `>\u2694\uFE0F</div>}`
  },
  // 5. Fix ammo empty slot unicode -> image
  {
    find: `<div style={{ fontSize: '28px', opacity: 0.3 }}>\\u25cf</div>`,
    replace: `<img src="/assets/items/ammo_green.png" alt="Ammo" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} />`
  },
  // 6. Fix ammo multiplier unicode
  {
    find: `>\\u00d7{ammoBonus.dmg}<`,
    replace: `>\u00D7{ammoBonus.dmg}<`
  },
];

let count = 0;
for (const r of replacements) {
  if (c.includes(r.find)) {
    c = c.replace(r.find, r.replace);
    count++;
    console.log(`  [OK] Replaced: ${r.find.substring(0, 50)}...`);
  } else {
    console.log(`  [SKIP] Not found: ${r.find.substring(0, 50)}...`);
  }
}

// Also fix the renderEquipmentCategoryRow fallback icons (line ~184)
const renderFallback = `{item.slot === 'helmet' ? '\\u2302' : item.slot === 'chest' ? '\\u2666' : item.slot === 'legs' ? '\\u2225' : item.slot === 'gloves' ? '\\u270B' : item.slot === 'boots' ? '\\u25B2' : '\\u2694'}`;
if (c.includes(renderFallback)) {
  c = c.replace(renderFallback, `<img src={getItemImagePath('t1', item.slot, item.category) || ''} alt={item.slot} style={{ width: '28px', height: '28px', objectFit: 'contain', opacity: 0.5, filter: 'grayscale(100%)' }} />`);
  count++;
  console.log('  [OK] Fixed renderEquipmentCategoryRow fallback');
}

fs.writeFileSync(file, c, 'utf8');
console.log(`Done! Applied ${count} replacements.`);
