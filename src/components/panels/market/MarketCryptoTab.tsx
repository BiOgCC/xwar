import React, { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, TIER_COLORS, TIER_LABELS, type EquipTier } from '../../../stores/inventoryStore'
import { badgePurchase } from '../../../api/client'
import BadgeOfHonorIcon from '../../shared/BadgeOfHonorIcon'

interface MarketCryptoTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

const BOX_OFFERS = [
  { key: 'civilian', label: 'Civilian Loot Box', icon: '/assets/items/lootbox_civilian.png', price: 2, resource: 'lootBoxes' as const, color: '#22d38a' },
  { key: 'supply', label: 'Supply Box', icon: '/assets/items/lootbox_civilian.png', price: 4, resource: 'supplyBoxes' as const, color: '#3b82f6' },
]

const GEAR_OFFERS: { tier: EquipTier; price: number; label: string }[] = [
  { tier: 't2', price: 3, label: 'T2 Uncommon Gear' },
  { tier: 't3', price: 6, label: 'T3 Rare Gear' },
  { tier: 't4', price: 12, label: 'T4 Epic Gear' },
]

export default function MarketCryptoTab({ showFb }: MarketCryptoTabProps) {
  const player = usePlayerStore()
  const [isBuying, setIsBuying] = useState(false)

  const handleBuyBox = (price: number, resource: 'lootBoxes' | 'militaryBoxes' | 'supplyBoxes', label: string) => {
    if (player.badgesOfHonor < price) {
      showFb('Not enough Badges of Honor.', false); return
    }
    usePlayerStore.getState().spendBadgesOfHonor(price)
    usePlayerStore.getState().addResource(resource, 1, 'badge_market')
    showFb(`Purchased ${label}!`, true)
  }

  const handleBuyGear = async (tier: EquipTier, price: number) => {
    if (player.badgesOfHonor < price || isBuying) {
      showFb('Not enough Badges of Honor.', false); return
    }
    setIsBuying(true)
    try {
      const res = await badgePurchase(tier)
      if (!res.success) {
        showFb('Purchase failed.', false); return
      }
      // Refresh server state
      await useInventoryStore.getState().fetchInventory()
      await usePlayerStore.getState().fetchPlayer()
      showFb(`Purchased ${res.item.name}!`, true)
    } catch (e) {
      showFb('Purchase failed.', false)
      console.error('[BadgeMarket] Failed:', e)
    } finally {
      setIsBuying(false)
    }
  }

  return (
    <>
      {/* Balance display */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        padding: '10px 16px', marginBottom: '16px',
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px',
      }}>
        <BadgeOfHonorIcon size={18} />
        <span style={{ fontSize: '14px', fontWeight: 900, color: '#10b981', fontFamily: 'var(--font-display)' }}>
          {player.badgesOfHonor ?? 0}
        </span>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>BADGES OF HONOR</span>
      </div>

      {/* Loot Boxes Section */}
      <div className="market-section-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BadgeOfHonorIcon size={14} /> SUPPLY CRATES
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {BOX_OFFERS.map(box => (
          <div key={box.key} style={{
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${box.color}30`, borderRadius: '8px',
            padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          }}>
            <img src={box.icon} alt={box.label} style={{ width: '48px', height: '48px', objectFit: 'contain', filter: `drop-shadow(0 2px 8px ${box.color}40)` }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: box.color, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>{box.label}</div>
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Random equipment & resources</div>
            </div>
            <button
              onClick={() => handleBuyBox(box.price, box.resource, box.label)}
              disabled={player.badgesOfHonor < box.price}
              style={{
                width: '100%', padding: '8px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)',
                background: player.badgesOfHonor >= box.price ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${player.badgesOfHonor >= box.price ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '4px', color: player.badgesOfHonor >= box.price ? '#10b981' : '#334155',
                cursor: player.badgesOfHonor >= box.price ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              }}
            >
              BUY <BadgeOfHonorIcon size={12} /> {box.price}
            </button>
          </div>
        ))}
      </div>

      {/* Gear Section */}
      <div className="market-section-title" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BadgeOfHonorIcon size={14} /> EQUIPMENT — RANDOM SLOT
      </div>
      <div className="ptab-gear-grid" style={{ marginBottom: 16 }}>
        {GEAR_OFFERS.map(box => {
          const tierColor = TIER_COLORS[box.tier] || '#94a3b8'
          const tierLabel = TIER_LABELS[box.tier] || box.tier
          const canAfford = player.badgesOfHonor >= box.price
          return (
            <div key={box.tier} className="ptab-gear-card" style={{ '--card-tier-color': tierColor, borderColor: tierColor, boxShadow: `0 0 10px ${tierColor}40` } as any}>
               <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">RANDOM</span>
                  <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
               </div>
               <div className="ptab-gear-card__img-wrap">
                  <div style={{ fontSize: '32px', filter: `drop-shadow(0 0 8px ${tierColor})` }}>🎁</div>
               </div>
               <div className="ptab-gear-card__stats">
                  <div style={{ textAlign: 'center', width: '100%', fontSize: '11px', fontWeight: 'bold', color: tierColor, marginTop: '8px' }}>{box.label}</div>
               </div>
               <div style={{ padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
                  <button
                    onClick={() => handleBuyGear(box.tier, box.price)}
                    disabled={!canAfford}
                    style={{
                      width: '100%', padding: '6px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)',
                      background: canAfford ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${canAfford ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '4px', color: canAfford ? '#10b981' : '#334155',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    }}
                  >
                    BUY <BadgeOfHonorIcon size={12} /> {box.price}
                  </button>
               </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
