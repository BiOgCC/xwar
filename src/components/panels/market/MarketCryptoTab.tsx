import React from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, generateStats, TIER_COLORS, getItemImagePath, SLOT_ICONS, type EquipTier } from '../../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth } from '../../../stores/army'
import ResourceIcon from '../../shared/ResourceIcon'

interface MarketCryptoTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

const GEAR_BOXES = [
  { tier: 't4' as const, price: 2, label: 'T4 Premium Gear' },
  { tier: 't5' as const, price: 5, label: 'T5 Elite Gear' },
  { tier: 't6' as const, price: 15, label: 'T6 Legendary Gear' },
]

const ELITE_DIVISIONS = [
  { type: 'tank' as const, price: 5, label: 'Elite Tank Battalion' },
  { type: 'jet' as const, price: 10, label: 'Elite Strike Wing' },
  { type: 'warship' as const, price: 20, label: 'Elite Naval Fleet' },
  { type: 'submarine' as const, price: 25, label: 'Elite Submarine' },
]

export default function MarketCryptoTab({ showFb }: MarketCryptoTabProps) {
  const player = usePlayerStore()

  const handleBuyGear = async (tier: 't4' | 't5' | 't6', price: number) => {
    if (player.badgesOfHonor < price) {
      showFb('Not enough Badges of Honor.', false); return
    }
    usePlayerStore.getState().spendBadgesOfHonor(price)
    
    const slots = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots'] as const
    const slot = slots[Math.floor(Math.random() * slots.length)]
    const category = slot === 'weapon' ? 'weapon' as const : 'armor' as const
    
    // Quick random subtype hack for weapon
    const weaponSubtypes = ['knife', 'gun', 'rifle', 'sniper', 'rpg', 'tank', 'jet', 'warship', 'submarine']
    const subtype = slot === 'weapon' ? weaponSubtypes[Math.floor(Math.random() * weaponSubtypes.length)] as any : undefined
    
    const result = generateStats(category, slot, tier as any, subtype)
    
    useInventoryStore.setState(s => ({
      items: [{
        id: `eq_${Date.now()}_${Math.random()}`,
        name: result.name, category, slot, tier,
        weaponSubtype: subtype,
        stats: result.stats,
        location: 'inventory', equipped: false, durability: 100,
      }, ...s.items]
    }))
    showFb(`Purchased ${result.name}!`, true)
  }

  const handleBuyDivision = async (type: any, price: number, label: string) => {
    if (player.badgesOfHonor < price) {
      showFb('Not enough Badges of Honor.', false); return
    }
    usePlayerStore.getState().spendBadgesOfHonor(price)
    
    const t = DIVISION_TEMPLATES[type as keyof typeof DIVISION_TEMPLATES]
    const { star, modifiers } = rollStarQuality(1000000) // Guaranteed high rolls
    const newDiv = {
      id: `div_badge_${Date.now()}_${Math.random()}`, type, name: label,
      category: t.category, ownerId: player.name, countryCode: player.countryCode || 'US',
      manpower: getEffectiveManpower(t), maxManpower: getEffectiveManpower(t),
      health: getEffectiveHealth(t), maxHealth: getEffectiveHealth(t),
      equipment: [], experience: 50, // Level 5
      status: 'ready' as const, trainingProgress: t.trainingTime,
      reinforcing: false, reinforceProgress: 0, recoveryTicksNeeded: 0,
      readyAt: 0, stance: 'unassigned' as const, autoTrainingEnabled: false,
      killCount: 0, battlesSurvived: 0,
      starQuality: star, statModifiers: modifiers,
    }
    
    useArmyStore.setState((s: any) => ({ divisions: { ...s.divisions, [newDiv.id]: newDiv } }))
    showFb(`Recruited ${label}!`, true)
  }

  return (
    <>
      <div className="market-section-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🎖️ BADGE MARKET — PREMIUM EQUIPMENT
      </div>
      <div className="ptab-gear-grid" style={{ marginBottom: 24 }}>
        {GEAR_BOXES.map(box => {
          const tierColor = TIER_COLORS[box.tier as EquipTier] || '#94a3b8'
          return (
            <div key={box.tier} className="ptab-gear-card" style={{ '--card-tier-color': tierColor, borderColor: tierColor, boxShadow: `0 0 10px ${tierColor}40` } as any}>
               <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">RANDOM SLOT</span>
                  <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{box.tier.toUpperCase()}</span>
               </div>
               <div className="ptab-gear-card__img-wrap">
                  <div style={{ fontSize: '32px', filter: `drop-shadow(0 0 8px ${tierColor})` }}>🎁</div>
               </div>
               <div className="ptab-gear-card__stats">
                  <div style={{ textAlign: 'center', width: '100%', fontSize: '11px', fontWeight: 'bold', color: tierColor, marginTop: '8px' }}>{box.label}</div>
               </div>
               <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
                  <button onClick={() => handleBuyGear(box.tier, box.price)} style={{
                    width: '100%', padding: '6px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '4px',
                    color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}>
                    BUY 🎖️ {box.price}
                  </button>
               </div>
            </div>
          )
        })}
      </div>

      <div className="market-section-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🎖️ BADGE MARKET — ELITE DIVISIONS
      </div>
      <div className="war-recruit-grid">
        {ELITE_DIVISIONS.map(div => {
          const t = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
          return (
            <div key={div.type} className="war-recruit-card" style={{ borderColor: 'rgba(16,185,129,0.4)', boxShadow: '0 0 15px rgba(16,185,129,0.15)' }}>
               <div className="war-recruit-card__header">
                  {t?.icon && <img src={t.icon} alt={div.label} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#10b981' }}>{div.label}</div>
                     <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#94a3b8' }}>Instant Deployment • High Rolls</div>
                  </div>
               </div>
               <div className="war-recruit-card__stats">
                  <div className="war-recruit-stat"><span>Troops</span><span className="war-recruit-stat__val">{t.manpowerCost}</span></div>
                  <div className="war-recruit-stat"><span>Base HP</span><span className="war-recruit-stat__val">{t.healthMult * 100}</span></div>
                  <div className="war-recruit-stat"><span>Level</span><span className="war-recruit-stat__val" style={{ color: '#10b981' }}>5</span></div>
                  <div className="war-recruit-stat"><span>Stars</span><span className="war-recruit-stat__val" style={{ color: '#10b981' }}>Guaranteed High</span></div>
               </div>
               <div style={{ padding: '8px', marginTop: 'auto' }}>
                  <button className="war-recruit-btn" onClick={() => handleBuyDivision(div.type, div.price, div.label)} style={{
                    width: '100%', height: '36px', fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.5)', color: '#10b981', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    BUY 🎖️ {div.price}
                  </button>
               </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
