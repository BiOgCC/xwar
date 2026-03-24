import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore, generateStats, WEAPON_SUBTYPES, TIER_COLORS, TIER_LABELS } from '../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/army'
import { ENABLE_DIVISIONS } from '../../config/features'
import type { EquipTier, EquipSlot, EquipCategory, EquipItem } from '../../types/inventory.types'
import type { DivisionType } from '../../stores/army/types'

const STORAGE_KEY = 'xwar_welcome_kit_claimed'

// ── Kit Contents ──
const RESOURCES = [
  { key: 'money', label: 'Money', amount: 100_000, icon: '💰' },
  { key: 'oil', label: 'Oil', amount: 100_000, icon: '🛢️' },
  { key: 'materialX', label: 'Material X', amount: 100_000, icon: '⚗️' },
  { key: 'scrap', label: 'Scrap', amount: 100_000, icon: '🔩' },
  { key: 'bitcoin', label: 'Bitcoin', amount: 100_000, icon: '₿' },
  { key: 'bread', label: 'Bread', amount: 100_000, icon: '🍞' },
  { key: 'sushi', label: 'Sushi', amount: 100_000, icon: '🍣' },
  { key: 'wagyu', label: 'Wagyu', amount: 100_000, icon: '🥩' },
  { key: 'lootBoxes', label: 'Loot Boxes', amount: 50, icon: '📦' },
  { key: 'militaryBoxes', label: 'Military Boxes', amount: 50, icon: '🧰' },
  { key: 'badgesOfHonor', label: 'Badges', amount: 100, icon: '🎖️' },
]

const DIV_TYPES: DivisionType[] = ['recon', 'assault', 'sniper', 'rpg', 'jeep', 'tank', 'jet', 'warship', 'submarine']

const XP_GRANT = 4000

function buildFullGearKit(): EquipItem[] {
  const kit: EquipItem[] = []
  const tiers: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6', 't7']
  const armorSlots: EquipSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots']

  tiers.forEach(tier => {
    // All armor slots
    armorSlots.forEach(slot => {
      const { name, stats } = generateStats('armor', slot, tier)
      kit.push({
        id: `wk-${tier}-${slot}-${Math.random().toString(36).substring(2, 9)}`,
        name, slot, category: 'armor' as EquipCategory, tier,
        equipped: false, durability: 100, stats, location: 'inventory',
      })
    })
    // All weapon subtypes for this tier
    const subtypes = WEAPON_SUBTYPES[tier]
    subtypes.forEach(subtype => {
      const { name, stats, weaponSubtype } = generateStats('weapon', 'weapon', tier, subtype)
      kit.push({
        id: `wk-${tier}-wpn-${subtype}-${Math.random().toString(36).substring(2, 9)}`,
        name, slot: 'weapon', category: 'weapon', tier,
        equipped: false, durability: 100, stats, weaponSubtype, location: 'inventory',
      })
    })
  })
  return kit
}

export default function WelcomeKitModal() {
  const [show, setShow] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    // DEV: Always show on refresh for testing
    const t = setTimeout(() => setShow(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!show) return null

  const handleClaim = () => {
    setAnimating(true)

    // 1. Grant XP
    usePlayerStore.getState().gainXP(XP_GRANT)

    // 2. Grant resources
    RESOURCES.forEach(r => {
      usePlayerStore.getState().addResource(r.key, r.amount, 'welcome_kit')
    })

    // 3. Grant full gear set (all tiers, all slots, all weapon subtypes)
    const gear = buildFullGearKit()
    gear.forEach(item => useInventoryStore.getState().addItem(item))

    // 4. Grant one of each division type (free, skip cost/pop checks) — divisions only
    if (ENABLE_DIVISIONS) {
      const player = usePlayerStore.getState()
      const armyStore = useArmyStore.getState()
      const playerCountry = player.countryCode || 'US'
      const armies = armyStore.getArmiesForCountry(playerCountry)
      const armyId = armies.length > 0 ? armies[0].id : undefined

      DIV_TYPES.forEach(type => {
        // Bypass cost — directly create the division
        const template = DIVISION_TEMPLATES[type]
        const id = `wk-div-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        const division = {
          id, type, name: `${template.name} (Kit)`,
          category: template.category,
          ownerId: player.name,
          countryCode: playerCountry,
          manpower: template.manpowerCost,
          maxManpower: template.manpowerCost,
          health: Math.floor(template.healthMult * 100),
          maxHealth: Math.floor(template.healthMult * 100),
          equipment: [] as string[],
          experience: 0,
          stance: 'unassigned' as const,
          autoTrainingEnabled: false,
          status: 'ready' as const,
          trainingProgress: 0,
          recoveryTicksNeeded: 0,
          readyAt: 0,
          reinforcing: false,
          reinforceProgress: 0,
          killCount: 0,
          battlesSurvived: 0,
          starQuality: 3 as 1 | 2 | 3 | 4 | 5,
          statModifiers: { atkDmgMult: 0, hitRate: 0, critRateMult: 0, critDmgMult: 0, healthMult: 0, dodgeMult: 0, armorMult: 0 },
          deployedToPMC: false,
        }
        useArmyStore.setState((s: any) => ({
          divisions: { ...s.divisions, [id]: division },
        }))
        // Assign to first army if exists
        if (armyId) {
          useArmyStore.getState().assignDivisionToArmy(id, armyId)
        }
      })
    }

    // DEV: localStorage.setItem(STORAGE_KEY, Date.now().toString())  // Re-enable for production

    setTimeout(() => {
      setClaimed(true)
      setAnimating(false)
    }, 800)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{
        width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        background: 'linear-gradient(165deg, rgba(15,23,42,0.98), rgba(2,6,23,0.99))',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 12, padding: '28px 24px',
        boxShadow: '0 0 60px rgba(245,158,11,0.15), 0 0 120px rgba(245,158,11,0.05)',
        fontFamily: 'var(--font-primary)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            fontSize: 40, lineHeight: 1, marginBottom: 8,
            animation: 'pulse 2s infinite',
          }}>🎁</div>
          <div style={{
            fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-display)',
            letterSpacing: 3, color: '#f59e0b',
            textShadow: '0 0 20px rgba(245,158,11,0.4)',
          }}>WELCOME KIT</div>
          <div style={{
            fontSize: 11, color: '#94a3b8', marginTop: 4,
            letterSpacing: 1,
          }}>ONE-TIME STARTER PACKAGE — CLAIM YOUR ARSENAL</div>
        </div>

        {/* Claimed State */}
        {claimed ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{
              fontSize: 16, fontWeight: 900, color: '#22d38a',
              fontFamily: 'var(--font-display)', letterSpacing: 2,
            }}>KIT CLAIMED!</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              All items{ENABLE_DIVISIONS ? ', divisions,' : ''} and resources have been added to your account.
            </div>
            <button
              onClick={() => setShow(false)}
              style={{
                marginTop: 16, padding: '10px 32px',
                background: 'linear-gradient(135deg, #22d38a, #059669)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                fontSize: 13, fontWeight: 900, color: '#0a0a0a',
                fontFamily: 'var(--font-display)', letterSpacing: 2,
              }}
            >ENTER XWAR</button>
          </div>
        ) : (<>
          {/* XP Section */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', marginBottom: 12,
            background: 'rgba(245,158,11,0.08)', borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
                +{XP_GRANT.toLocaleString()} XP
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>Instant level boost</div>
            </div>
          </div>

          {/* Resources Grid */}
          <div style={{
            fontSize: 9, fontWeight: 900, color: '#64748b',
            letterSpacing: 1.5, marginBottom: 6,
            fontFamily: 'var(--font-display)',
          }}>RESOURCES</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
            marginBottom: 14,
          }}>
            {RESOURCES.map(r => (
              <div key={r.key} style={{
                padding: '6px 4px', textAlign: 'center',
                background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 14 }}>{r.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#22d38a', fontFamily: 'var(--font-mono)' }}>
                  {r.amount >= 1000 ? `${(r.amount/1000).toFixed(0)}k` : r.amount}
                </div>
                <div style={{ fontSize: 7, color: '#64748b', fontWeight: 600 }}>{r.label}</div>
              </div>
            ))}
          </div>

          {/* Gear Section */}
          <div style={{
            fontSize: 9, fontWeight: 900, color: '#64748b',
            letterSpacing: 1.5, marginBottom: 6,
            fontFamily: 'var(--font-display)',
          }}>FULL GEAR SET — ALL TIERS</div>
          <div style={{
            display: 'flex', gap: 3, marginBottom: 14, flexWrap: 'wrap',
          }}>
            {(['t1', 't2', 't3', 't4', 't5', 't6', 't7'] as EquipTier[]).map(tier => (
              <div key={tier} style={{
                flex: 1, minWidth: 58, padding: '5px 4px', textAlign: 'center',
                background: `${TIER_COLORS[tier]}0a`, borderRadius: 4,
                border: `1px solid ${TIER_COLORS[tier]}33`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: TIER_COLORS[tier], fontFamily: 'var(--font-display)' }}>
                  {tier.toUpperCase()}
                </div>
                <div style={{ fontSize: 7, color: '#94a3b8' }}>
                  {TIER_LABELS[tier].split(' ')[0]}
                </div>
                <div style={{ fontSize: 7, color: '#64748b', marginTop: 2 }}>
                  All slots
                </div>
              </div>
            ))}
          </div>

          {/* Divisions Section — only when divisions are enabled */}
          {ENABLE_DIVISIONS && (<>
          <div style={{
            fontSize: 9, fontWeight: 900, color: '#64748b',
            letterSpacing: 1.5, marginBottom: 6,
            fontFamily: 'var(--font-display)',
          }}>MILITARY DIVISIONS — ONE OF EACH</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
            marginBottom: 20,
          }}>
            {DIV_TYPES.map(type => {
              const t = DIVISION_TEMPLATES[type]
              return (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <img src={t.icon} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#e2e8f0' }}>{t.name}</div>
                    <div style={{ fontSize: 7, color: '#64748b' }}>{t.category}</div>
                  </div>
                </div>
              )
            })}
          </div>
          </>)}

          {/* Claim Button */}
          <button
            onClick={handleClaim}
            disabled={animating}
            style={{
              width: '100%', padding: '14px 0',
              background: animating
                ? 'rgba(245,158,11,0.3)'
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: '2px solid rgba(245,158,11,0.5)',
              borderRadius: 8, cursor: animating ? 'wait' : 'pointer',
              fontSize: 16, fontWeight: 900, color: '#0a0a0a',
              fontFamily: 'var(--font-display)', letterSpacing: 3,
              textTransform: 'uppercase' as const,
              boxShadow: '0 0 30px rgba(245,158,11,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {animating ? '⏳ CLAIMING...' : '🎁 CLAIM WELCOME KIT'}
          </button>
          <div style={{
            textAlign: 'center', fontSize: 8, color: '#475569',
            marginTop: 8, letterSpacing: 0.5,
          }}>
            This can only be claimed once per account
          </div>
        </>)}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
