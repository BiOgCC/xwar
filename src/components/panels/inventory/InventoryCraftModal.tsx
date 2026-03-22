import { useState, useCallback } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useSkillsStore } from '../../../stores/skillsStore'
import {
  useInventoryStore,
  generateStats,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
  SLOT_ICONS,
  getItemImagePath,
  WEAPON_SUBTYPES,
  type EquipItem,
  type EquipSlot,
  type EquipTier,
  type WeaponSubtype,
} from '../../../stores/inventoryStore'
import GameModal from '../../shared/GameModal'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRINGS } from '../../shared/AnimationSystem'
import ResourceIcon from '../../shared/ResourceIcon'

interface CraftModalProps {
  onClose: () => void
}

const costTable: Record<string, { scrap: number; bitcoin: number }> = {
  t1: { scrap: 50, bitcoin: 1 },
  t2: { scrap: 150, bitcoin: 1 },
  t3: { scrap: 450, bitcoin: 1 },
  t4: { scrap: 1350, bitcoin: 1 },
  t5: { scrap: 4050, bitcoin: 1 },
  t6: { scrap: 12150, bitcoin: 1 },
  t7: { scrap: 36450, bitcoin: 1 },
}

const statPreview: Record<string, Record<string, string>> = {
  weapon: {
    t1: 'DMG 20-49 / CRIT 5%', t2: 'DMG 50-80 / CRIT 6-10%', t3: 'DMG 81-120 / CRIT 11-15%',
    t4: 'DMG 121-150 / CRIT 16-20%', t5: 'DMG 151-199 / CRIT 21-30%', t6: 'DMG 200-300 / CRIT 31-49%',
    t7: 'DMG 350-500 / CRIT 40-60%',
  },
  helmet: { t1: 'CDMG 12-20%', t2: 'CDMG 32-40%', t3: 'CDMG 52-60%', t4: 'CDMG 72-80%', t5: 'CDMG 92-100%', t6: 'CDMG 112-120%', t7: 'CDMG 132-140%' },
  chest: { t1: 'ARM 2-5%', t2: 'ARM 7-10%', t3: 'ARM 12-15%', t4: 'ARM 17-20%', t5: 'ARM 22-25%', t6: 'ARM 27-30%', t7: 'ARM 32-35%' },
  legs: { t1: 'ARM 2-5%', t2: 'ARM 7-10%', t3: 'ARM 12-15%', t4: 'ARM 17-20%', t5: 'ARM 22-25%', t6: 'ARM 27-30%', t7: 'ARM 32-35%' },
  gloves: { t1: 'ACC 1-5%', t2: 'ACC 6-10%', t3: 'ACC 11-15%', t4: 'ACC 16-20%', t5: 'ACC 21-25%', t6: 'ACC 26-30%', t7: 'ACC 31-35%' },
  boots: { t1: 'EVA 2-5%', t2: 'EVA 7-10%', t3: 'EVA 12-15%', t4: 'EVA 17-20%', t5: 'EVA 22-25%', t6: 'EVA 27-30%', t7: 'EVA 32-35%' },
}

const slotTabs: { slot: EquipSlot; label: string }[] = [
  { slot: 'weapon', label: 'WEAPON' },
  { slot: 'helmet', label: 'HELMET' },
  { slot: 'chest', label: 'CHEST' },
  { slot: 'legs', label: 'LEGS' },
  { slot: 'gloves', label: 'GLOVES' },
  { slot: 'boots', label: 'BOOTS' },
]

/** Craft equipment modal + crafted item result overlay */
export default function InventoryCraftModal({ onClose }: CraftModalProps) {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const [craftSlot, setCraftSlot] = useState<EquipSlot>('weapon')
  const [craftedItem, setCraftedItem] = useState<{ item: EquipItem; superforged: boolean } | null>(null)
  const [craftHistory, setCraftHistory] = useState<{ item: EquipItem; superforged: boolean }[]>([])

  const doCraft = (tier: EquipTier, slot: EquipSlot) => {
    const cost = costTable[tier]
    if (player.scrap < cost.scrap || player.bitcoin < cost.bitcoin) return
    player.spendBitcoin(cost.bitcoin)
    player.spendScrap(cost.scrap)
    const category = slot === 'weapon' ? 'weapon' as const : 'armor' as const
    const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[tier][Math.floor(Math.random() * WEAPON_SUBTYPES[tier].length)] : undefined
    const result = generateStats(category, slot, tier, subtype)

    const indLevel = useSkillsStore.getState().economic.industrialist || 0
    const superforgeChance = Math.min(0.20, indLevel * 0.02)
    const isSuperforged = superforgeChance > 0 && Math.random() < superforgeChance
    const sfBonus = 1.09 + Math.random() * 0.07 // +9% to +16%
    if (isSuperforged) {
      for (const key of Object.keys(result.stats) as Array<keyof typeof result.stats>) {
        if (typeof result.stats[key] === 'number') {
          (result.stats as any)[key] = Math.ceil(result.stats[key]! * sfBonus)
        }
      }
    }

    const newItem: EquipItem = {
      id: `crafted_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: isSuperforged ? `\u26a1 ${result.name}` : result.name,
      slot, category, tier, equipped: false, durability: 100,
      location: 'inventory', stats: result.stats, weaponSubtype: result.weaponSubtype,
      superforged: isSuperforged || undefined,
    }
    inventory.addItem(newItem)
    const entry = { item: newItem, superforged: isSuperforged }
    setCraftedItem(entry)
    setCraftHistory(prev => [entry, ...prev])
  }

  const doRandomCraft = (tier: EquipTier) => {
    const allSlots: EquipSlot[] = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots']
    doCraft(tier, allSlots[Math.floor(Math.random() * allSlots.length)])
  }

  return (
    <>
      <GameModal isOpen={true} onClose={onClose} title="CRAFT EQUIPMENT" size="lg" glowColor="#fbbf24">
        <div>
          {/* Resources bar */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '9px', color: '#94a3b8',
            marginBottom: '12px', padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ResourceIcon resourceKey="scrap" size={14} />{player.scrap.toLocaleString()} SCRAP</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ResourceIcon resourceKey="bitcoin" size={14} />{player.bitcoin.toLocaleString()} BTC</span>
          </div>

          {/* Slot Tabs */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '12px' }}>
            {slotTabs.map(st => (
              <button key={st.slot} onClick={() => setCraftSlot(st.slot)} style={{
                flex: 1, padding: '6px 2px', fontSize: '8px', fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
                border: `1px solid ${craftSlot === st.slot ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '3px', background: craftSlot === st.slot ? 'rgba(251,191,36,0.12)' : 'transparent',
                color: craftSlot === st.slot ? '#fbbf24' : '#64748b', cursor: 'pointer',
              }}>
                {st.label}
              </button>
            ))}
          </div>

          {/* Tier Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            {(() => {
              type CraftEntry = { tier: EquipTier; subtype?: WeaponSubtype; label: string }
              const entries: CraftEntry[] = []
              TIER_ORDER.forEach(tier => {
                if (craftSlot === 'weapon' && WEAPON_SUBTYPES[tier].length > 1) {
                  WEAPON_SUBTYPES[tier].forEach(sub => {
                    entries.push({ tier, subtype: sub, label: sub.charAt(0).toUpperCase() + sub.slice(1) })
                  })
                } else {
                  entries.push({ tier, label: TIER_LABELS[tier].split(' ')[0] })
                }
              })
              return entries.map((entry, idx) => {
                const tc = costTable[entry.tier]
                const canAfford = player.scrap >= tc.scrap && player.bitcoin >= tc.bitcoin
                const preview = statPreview[craftSlot]?.[entry.tier] || ''
                const imgUrl = getItemImagePath(entry.tier, craftSlot, craftSlot === 'weapon' ? 'weapon' : 'armor', entry.subtype, false)

                return (
                  <div key={`${entry.tier}-${entry.subtype || idx}`} style={{
                    padding: '8px 6px', borderRadius: '6px', textAlign: 'center',
                    background: canAfford ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                    border: `1px solid ${canAfford ? TIER_COLORS[entry.tier] + '44' : 'rgba(255,255,255,0.04)'}`,
                    opacity: canAfford ? 1 : 0.4,
                  }}>
                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={entry.label} style={{ width: '56px', height: '56px', objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${TIER_COLORS[entry.tier]}30)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <span style={{ fontSize: '20px', opacity: 0.4 }}>{(SLOT_ICONS as any)[craftSlot]}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: TIER_COLORS[entry.tier], fontFamily: 'var(--font-display)', marginBottom: '2px' }}>
                      {entry.subtype ? entry.label : TIER_LABELS[entry.tier].split(' ')[0]}
                    </div>
                    <div style={{ fontSize: '7px', color: TIER_COLORS[entry.tier], opacity: 0.7, marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                      {preview}
                    </div>
                    <div style={{ fontSize: '7px', color: '#475569', marginBottom: '6px', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
                      {tc.scrap} ⚙️ / {tc.bitcoin} ₿
                    </div>
                    <button
                      disabled={!canAfford}
                      onClick={() => {
                        if (entry.subtype) {
                          const cost = costTable[entry.tier]
                          if (player.scrap < cost.scrap || player.bitcoin < cost.bitcoin) return
                          player.spendBitcoin(cost.bitcoin)
                          player.spendScrap(cost.scrap)
                          const result = generateStats('weapon', 'weapon', entry.tier, entry.subtype)
                          const indLevel = useSkillsStore.getState().economic.industrialist || 0
                          const superforgeChance = Math.min(0.20, indLevel * 0.02)
                          const isSuperforged = superforgeChance > 0 && Math.random() < superforgeChance
                          const sfBonus = 1.09 + Math.random() * 0.07 // +9% to +16%
                          if (isSuperforged) {
                            for (const key of Object.keys(result.stats) as Array<keyof typeof result.stats>) {
                              if (typeof result.stats[key] === 'number') {
                                (result.stats as any)[key] = Math.ceil(result.stats[key]! * sfBonus)
                              }
                            }
                          }
                          const newItem: EquipItem = {
                            id: `crafted_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                            name: isSuperforged ? `\u26a1 ${result.name}` : result.name,
                            slot: 'weapon', category: 'weapon', tier: entry.tier, equipped: false, durability: 100,
                            location: 'inventory', stats: result.stats, weaponSubtype: result.weaponSubtype,
                            superforged: isSuperforged || undefined,
                          }
                          inventory.addItem(newItem)
                          const histEntry = { item: newItem, superforged: isSuperforged }
                          setCraftedItem(histEntry)
                          setCraftHistory(prev => [histEntry, ...prev])
                        } else {
                          doCraft(entry.tier, craftSlot)
                        }
                      }}
                      style={{
                        width: '100%', padding: '5px', fontSize: '8px', fontWeight: 800,
                        fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                        border: `1px solid ${canAfford ? TIER_COLORS[entry.tier] : '#222'}`,
                        borderRadius: '3px', cursor: canAfford ? 'pointer' : 'not-allowed',
                        background: canAfford ? `${TIER_COLORS[entry.tier]}22` : 'transparent',
                        color: canAfford ? TIER_COLORS[entry.tier] : '#333',
                      }}
                    >ROLL</button>
                  </div>
                )
              })
            })()}
          </div>

          {/* Random Craft Section */}
          <div style={{
            padding: '10px', borderRadius: '6px', marginBottom: '12px',
            background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: '6px', textAlign: 'center' }}>
              RANDOM CRAFT // ANY SLOT, ANY SUBTYPE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
              {TIER_ORDER.map(tier => {
                const tc = costTable[tier]
                const canAfford = player.scrap >= tc.scrap && player.bitcoin >= tc.bitcoin
                return (
                  <button
                    key={`rand-${tier}`}
                    disabled={!canAfford}
                    onClick={() => doRandomCraft(tier)}
                    style={{
                      padding: '5px 4px', fontSize: '8px', fontWeight: 800,
                      fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
                      border: `1px solid ${canAfford ? TIER_COLORS[tier] + '55' : '#222'}`,
                      borderRadius: '3px', cursor: canAfford ? 'pointer' : 'not-allowed',
                      background: canAfford ? 'rgba(251,191,36,0.08)' : 'transparent',
                      color: canAfford ? TIER_COLORS[tier] : '#333',
                      opacity: canAfford ? 1 : 0.4,
                    }}
                  >{TIER_LABELS[tier].split(' ')[0]}</button>
                )
              })}
            </div>
          </div>

          {/* Session Craft History */}
          {craftHistory.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: '#94a3b8',
                fontFamily: 'var(--font-display)', letterSpacing: '0.1em',
                marginBottom: '6px', textAlign: 'center',
              }}>CRAFTED THIS SESSION ({craftHistory.length})</div>
              <div style={{
                display: 'flex', gap: '6px', overflowX: 'auto',
                padding: '4px 2px 8px', scrollbarWidth: 'thin',
              }}>
                {craftHistory.map((entry, idx) => {
                  const ci = entry.item
                  const tc = TIER_COLORS[ci.tier]
                  const img = getItemImagePath(ci.tier, ci.slot, ci.category, ci.weaponSubtype, ci.superforged)
                  const mainStat = ci.stats.damage
                    ? `DMG ${ci.stats.damage}`
                    : ci.stats.armor
                    ? `ARM ${ci.stats.armor}%`
                    : ci.stats.critDamage
                    ? `CDMG ${ci.stats.critDamage}%`
                    : ci.stats.dodge
                    ? `EVA ${ci.stats.dodge}%`
                    : ci.stats.precision
                    ? `ACC ${ci.stats.precision}%`
                    : ''
                  return (
                    <motion.div
                      key={ci.id}
                      initial={{ opacity: 0, scale: 0.7, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: idx < 3 ? idx * 0.06 : 0, ...SPRINGS.snappy }}
                      style={{
                        minWidth: '80px', maxWidth: '80px', flexShrink: 0,
                        background: 'rgba(0,0,0,0.4)', borderRadius: '6px',
                        border: `1px solid ${entry.superforged ? '#fbbf2480' : tc + '40'}`,
                        padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                        boxShadow: entry.superforged ? '0 0 8px rgba(251,191,36,0.2)' : undefined,
                      }}
                      title={ci.name}
                      onClick={() => setCraftedItem(entry)}
                    >
                      <div style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
                        {img ? (
                          <img src={img} alt={ci.name} style={{ width: '24px', height: '24px', objectFit: 'contain', filter: `drop-shadow(0 1px 3px ${tc}40)` }} />
                        ) : (
                          <span style={{ fontSize: '18px', opacity: 0.4 }}>{SLOT_ICONS[ci.slot]}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '7px', fontWeight: 800, color: tc, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.superforged ? '⚡' : ''}{TIER_LABELS[ci.tier].split(' ')[0]}
                      </div>
                      <div style={{ fontSize: '6px', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                        {ci.slot.toUpperCase()}
                      </div>
                      {mainStat && (
                        <div style={{ fontSize: '6px', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          {mainStat}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '8px', fontSize: '9px', fontWeight: 600,
              fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
              background: 'transparent', color: '#475569',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
              cursor: 'pointer',
            }}
          >CLOSE</button>
        </div>
      </GameModal>

      {/* Crafted Item Result Overlay */}
      <AnimatePresence>
        {craftedItem && (
          <motion.div
            key="craft-result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setCraftedItem(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10001,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, ...SPRINGS.snappy }}
              style={{
                fontSize: '12px', fontWeight: 900,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.2em',
                color: craftedItem.superforged ? '#fbbf24' : TIER_COLORS[craftedItem.item.tier],
                textShadow: `0 0 20px ${craftedItem.superforged ? '#fbbf24' : TIER_COLORS[craftedItem.item.tier]}60`,
                marginBottom: '12px',
              }}
            >
              {craftedItem.superforged ? '⚡ SUPERFORGED!' : 'ITEM CRAFTED!'}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.3, rotateX: 45 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={SPRINGS.snappy}
              onClick={e => e.stopPropagation()}
              style={{
                width: '260px',
                background: 'rgba(12,16,24,0.95)',
                border: `2px solid ${TIER_COLORS[craftedItem.item.tier]}60`,
                borderRadius: '10px',
                padding: '20px 16px',
                boxShadow: `0 0 40px ${TIER_COLORS[craftedItem.item.tier]}30, 0 20px 60px rgba(0,0,0,0.5)`,
              }}
            >
              {(() => {
                const item = craftedItem.item
                const tierColor = TIER_COLORS[item.tier]
                const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
                return (
                  <>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '12px 0', marginBottom: '12px',
                      background: `radial-gradient(ellipse at center, ${tierColor}15 0%, transparent 70%)`,
                      borderRadius: '8px',
                    }}>
                      <motion.div
                        animate={craftedItem.superforged ? {
                          filter: ['drop-shadow(0 0 8px #fbbf2440)', 'drop-shadow(0 0 16px #fbbf2480)', 'drop-shadow(0 0 8px #fbbf2440)'],
                        } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        {imgUrl ? (
                          <img src={imgUrl} alt={item.name} style={{
                            width: '64px', height: '64px', objectFit: 'contain',
                            filter: `drop-shadow(0 4px 16px ${tierColor}50)`,
                          }} />
                        ) : (
                          <div style={{ fontSize: '48px', opacity: 0.5 }}>{SLOT_ICONS[item.slot]}</div>
                        )}
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        style={{
                          fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)',
                          color: tierColor, letterSpacing: '0.08em', marginTop: '8px',
                          textShadow: `0 0 12px ${tierColor}50`,
                        }}
                      >{item.name}</motion.div>
                      <div style={{
                        fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)',
                        color: '#64748b', letterSpacing: '0.1em', marginTop: '2px',
                      }}>{TIER_LABELS[item.tier]} • {item.slot.toUpperCase()}</div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      style={{
                        background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
                        padding: '10px 12px', marginBottom: '12px',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      {[
                        item.stats.damage && { label: 'DAMAGE', val: `${item.stats.damage}`, color: '#f87171' },
                        item.stats.critRate && { label: 'CRIT RATE', val: `${item.stats.critRate}%`, color: '#fb923c' },
                        item.stats.critDamage && { label: 'CRIT DMG', val: `+${item.stats.critDamage}%`, color: '#fb923c' },
                        item.stats.armor && { label: 'ARMOR', val: `+${item.stats.armor}%`, color: '#94a3b8' },
                        item.stats.dodge && { label: 'EVASION', val: `+${item.stats.dodge}%`, color: '#34d399' },
                        item.stats.precision && { label: 'ACCURACY', val: `+${item.stats.precision}%`, color: '#38bdf8' },
                      ].filter(Boolean).map((s: any, i) => (
                        <motion.div
                          key={s.label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.08 }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>{s.label}</span>
                          <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{s.val}</span>
                        </motion.div>
                      ))}
                    </motion.div>

                    {craftedItem.superforged && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: 'spring', stiffness: 400, damping: 15 }}
                        style={{
                          textAlign: 'center', padding: '6px 12px', marginBottom: '8px',
                          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                          borderRadius: '4px', fontSize: '9px', fontWeight: 900,
                          fontFamily: 'var(--font-display)', color: '#fbbf24',
                          letterSpacing: '0.12em',
                        }}
                      >⚡ SUPERFORGED +9–16% ALL STATS</motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      transition={{ delay: 0.8 }}
                      style={{
                        textAlign: 'center', fontSize: '8px', fontWeight: 600,
                        fontFamily: 'var(--font-display)', color: '#475569',
                        letterSpacing: '0.1em',
                      }}
                    >CLICK ANYWHERE TO CLOSE</motion.div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
