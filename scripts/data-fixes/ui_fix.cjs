const fs = require('fs');
let c = fs.readFileSync('src/components/panels/InventoryTab.tsx', 'utf8');

// The user wants: "make sure to make the icons the main part of the card you are uploading to, and center all the other data below, as name, stats, etc"

// Let's modify: `renderEquipmentCategoryRow`
// We need to change the item card layout from row to column, centered.

const oldGridStyle = `        <div className="inv-items-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '4px' }}>`;
const newGridStyle = `        <div className="inv-items-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>`;
c = c.replace(oldGridStyle, newGridStyle);

const oldItemStyle = `              style={{
                borderColor: \`\${TIER_COLORS[item.tier]}44\`,
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '4px 6px',
                background: item.equipped ? 'rgba(34, 211, 138, 0.05)' : 'rgba(8,12,18,0.4)',
                minHeight: '34px',
              }}`;

const newItemStyle = `              style={{
                borderColor: \`\${TIER_COLORS[item.tier]}44\`,
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '12px 6px 8px 6px',
                background: item.equipped ? 'rgba(34, 211, 138, 0.05)' : 'rgba(8,12,18,0.4)',
                minHeight: '110px',
                position: 'relative'
              }}`;
c = c.replace(oldItemStyle, newItemStyle);

// Let's rewrite the inner content of the item card for renderEquipmentCategoryRow
const oldItemCardInner = `              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
                {(() => {
                  const imgUrl = getItemImagePath(item.tier, item.slot, item.category);
                  return imgUrl ? (
                    <img src={imgUrl} alt={item.name} style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '4px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : null;
                })()}
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: TIER_COLORS[item.tier], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                {item.equipped && <span style={{ fontSize: '7px', color: '#22d38a', border: '1px solid #22d38a', padding: '1px 2px', borderRadius: '2px', marginLeft: '2px' }}>EQ</span>}
              </div>
              {renderStats(item.stats, true)}`;

const newItemCardInner = `              {/* EQ Badge */}
              {item.equipped && <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '8px', fontWeight: 900, color: '#22d38a', border: '1px solid #22d38a', padding: '2px 4px', borderRadius: '3px', background: 'rgba(34,211,138,0.1)' }}>EQUIPPED</div>}
              
              {/* Main Image Centered */}
              <div style={{ height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', width: '100%' }}>
                {(() => {
                  const imgUrl = getItemImagePath(item.tier, item.slot, item.category);
                  return imgUrl ? (
                    <img src={imgUrl} alt={item.name} style={{ width: '54px', height: '54px', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : <span style={{fontSize: '32px'}}>{(SLOT_ICONS as any)[item.slot]}</span>;
                })()}
              </div>

              {/* Name & Stats Below */}
              <div style={{ fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-display)', color: TIER_COLORS[item.tier], marginBottom: '4px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                {renderStats(item.stats, true)}
              </div>`;
c = c.replace(oldItemCardInner, newItemCardInner);

// Now apply the same logic to the Crafting View preview cards
const oldCraftPreviewInner = `                    {/* Item Name */}
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '10px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                      {(() => {
                        const imgUrl = getItemImagePath(tier as EquipTier, craftSlot, category);
                        return imgUrl ? (
                          <img src={imgUrl} alt={itemName} style={{ width: '16px', height: '16px', objectFit: 'contain', marginRight: '4px' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.removeAttribute('style'); }} />
                        ) : null;
                      })()}
                      <span style={getItemImagePath(tier as EquipTier, craftSlot, category) ? { display: 'none' } : { marginRight: '4px' }}>{(SLOT_ICONS as any)[craftSlot]}</span>
                      <span>{itemName}</span>
                    </div>

                    {/* Stat Range Preview */}`;

const newCraftPreviewInner = `                    {/* Main Centered Image */}
                    <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                      {(() => {
                        const imgUrl = getItemImagePath(tier as EquipTier, craftSlot, category);
                        return imgUrl ? (
                          <img src={imgUrl} alt={itemName} style={{ width: '54px', height: '54px', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.removeAttribute('style'); }} />
                        ) : <span style={{fontSize: '32px'}}>{(SLOT_ICONS as any)[craftSlot]}</span>;
                      })()}
                    </div>

                    {/* Item Name Centered */}
                    <div style={{ fontSize: '11px', textAlign: 'center', fontWeight: 800, color: TIER_COLORS[tier], marginBottom: '6px' }}>
                      {itemName}
                    </div>

                    {/* Stat Range Preview */}`;
c = c.replace(oldCraftPreviewInner, newCraftPreviewInner);

// Fix the renderStats centering to make sure it wraps nice when flex centered
c = c.replace(
  `{stats.damage && <span>⚔️ {stats.damage}</span>}`,
  `{Object.keys(stats).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>\n` +
  `        {stats.damage && <span>⚔️ {stats.damage}</span>}`
).replace(
  `{stats.precision && <span>👁️ +{stats.precision}%</span>}\n      </div>`,
  `{stats.precision && <span>👁️ +{stats.precision}%</span>}\n        </div>}\n      </div>`
);

fs.writeFileSync('src/components/panels/InventoryTab.tsx', c);
console.log('UI UI Overhaul applied');
