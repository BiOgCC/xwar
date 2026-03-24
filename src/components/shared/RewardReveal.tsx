import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { rewardItemVariants, SPRINGS, TIER_FX, useScreenShake } from './AnimationSystem'
import { TIER_COLORS, TIER_LABELS, type EquipItem, type EquipTier, type EquipStats } from '../../stores/inventoryStore'
import GameModal from './GameModal'

/* ═══════════════════════════════════════════════════
   RewardReveal — Staggered Tier-Aware Reward Display
   Now uses GameModal for consistent popup behavior
   ═══════════════════════════════════════════════════ */

interface RewardEntry {
  type: 'item' | 'money' | 'scrap' | 'xp' | 'lootbox'
  label: string
  value: string
  tier?: EquipTier
  icon: React.ReactNode
  stats?: EquipStats  // Item stats for hype display
}

interface RewardRevealProps {
  rewards: RewardEntry[]
  isOpen: boolean
  onClose: () => void
  onOpenAnother?: () => void  // "Open Another" callback
  canOpenAnother?: boolean    // Whether the player has more boxes
  title?: string
}

export default function RewardReveal({ rewards, isOpen, onClose, onOpenAnother, canOpenAnother, title = 'REWARDS' }: RewardRevealProps) {
  const [showRewards, setShowRewards] = useState(false)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const shake = useScreenShake()

  // Find highest tier for screen effects
  const highestTier = useMemo(() => {
    const tiers = rewards.filter(r => r.tier).map(r => r.tier!)
    const order: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6', 't7']
    let best: EquipTier = 't1'
    for (const t of tiers) {
      if (order.indexOf(t) > order.indexOf(best)) best = t
    }
    return best
  }, [rewards])

  const glowColor = useMemo(() => {
    const tiers = rewards.filter(r => r.tier).map(r => r.tier!)
    if (tiers.length === 0) return '#a855f7'
    return TIER_COLORS[highestTier] || '#a855f7'
  }, [rewards, highestTier])

  useEffect(() => {
    if (!isOpen) {
      setShowRewards(false)
      return
    }

    // Delay reward reveal for dramatic effect
    const timer = setTimeout(() => {
      setShowRewards(true)
      const fx = TIER_FX[highestTier]

      // Screen shake for T3+
      if (fx.shake > 0) {
        shake(fx.shake, 300)
      }

      // Flash for T4+
      if (highestTier === 't4') setFlashColor('purple')
      else if (highestTier === 't5') setFlashColor('gold')
      else if (highestTier === 't6' || highestTier === 't7') setFlashColor('red')
    }, 300)

    return () => clearTimeout(timer)
  }, [isOpen, highestTier, shake])

  // Clear flash
  useEffect(() => {
    if (!flashColor) return
    const t = setTimeout(() => setFlashColor(null), 500)
    return () => clearTimeout(t)
  }, [flashColor])

  // Stat display helpers
  const STAT_DEFS: { key: keyof EquipStats; label: string; suffix: string; color: string }[] = [
    { key: 'damage', label: 'DMG', suffix: '', color: '#f87171' },
    { key: 'critRate', label: 'CRIT', suffix: '%', color: '#fb923c' },
    { key: 'critDamage', label: 'C.DMG', suffix: '%', color: '#fbbf24' },
    { key: 'armor', label: 'ARM', suffix: '%', color: '#94a3b8' },
    { key: 'dodge', label: 'EVA', suffix: '%', color: '#34d399' },
    { key: 'precision', label: 'ACC', suffix: '%', color: '#38bdf8' },
  ]

  return (
    <GameModal isOpen={isOpen} onClose={onClose} size="md" glowColor={glowColor}>
      <div style={{ textAlign: 'center', padding: '8px 0', position: 'relative' }}>
        {/* Screen flash */}
        {flashColor && (
          <div className={`reward-flash reward-flash--${flashColor}`} />
        )}

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...SPRINGS.bouncy, delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            fontWeight: 900,
            color: glowColor,
            letterSpacing: '2px',
            textShadow: `0 0 16px ${glowColor}60`,
            marginBottom: '16px',
          }}
        >
          {title}
        </motion.div>

        {/* Reward Cards */}
        {showRewards && (
          <motion.div
            className="reward-cards"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}
          >
            {rewards.map((reward, i) => {
              const fx = reward.tier ? TIER_FX[reward.tier] : null
              const tierColor = reward.tier ? TIER_COLORS[reward.tier] : undefined
              const tierLabel = reward.tier ? TIER_LABELS[reward.tier] : undefined
              const hasStats = reward.stats && Object.values(reward.stats).some(v => v && v > 0)

              return (
                <motion.div
                  key={i}
                  className={`reward-card ${fx?.glowClass || ''}`}
                  variants={rewardItemVariants}
                  style={{
                    '--card-glow': tierColor ? `${tierColor}20` : 'transparent',
                    borderColor: tierColor ? `${tierColor}40` : undefined,
                    width: '100%',
                    maxWidth: '320px',
                    padding: hasStats ? '16px' : undefined,
                  } as React.CSSProperties}
                >
                  {/* Large icon for equipment */}
                  <div className="reward-card__icon" style={{ 
                    transform: reward.type === 'item' && reward.stats ? 'scale(1.4)' : undefined,
                    marginBottom: reward.type === 'item' && reward.stats ? '8px' : undefined,
                  }}>
                    {reward.icon}
                  </div>

                  <div className="reward-card__label">{reward.label}</div>
                  <div
                    className="reward-card__value"
                    style={tierColor ? { color: tierColor, fontSize: '16px', fontWeight: 900 } : undefined}
                  >
                    {reward.value}
                  </div>

                  {tierLabel && (
                    <div
                      className="reward-card__tier"
                      style={{
                        color: tierColor,
                        borderColor: `${tierColor}50`,
                        background: `${tierColor}15`,
                      }}
                    >
                      {tierLabel}
                    </div>
                  )}

                  {/* Item Stats — the hype section */}
                  {hasStats && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.12 }}
                      style={{
                        marginTop: '10px', padding: '8px 12px', width: '100%',
                        background: 'rgba(0,0,0,0.4)', borderRadius: '6px',
                        border: `1px solid ${tierColor || '#ffffff'}20`,
                      }}
                    >
                      {STAT_DEFS.filter(s => reward.stats![s.key] && reward.stats![s.key]! > 0).map(s => (
                        <div key={s.key} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '3px 0', fontSize: '11px', fontFamily: 'var(--font-mono)',
                        }}>
                          <span style={{ color: '#64748b', fontWeight: 600, letterSpacing: '0.06em', fontSize: '10px' }}>{s.label}</span>
                          <span style={{ color: s.color, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: '13px' }}>
                            {s.key === 'damage' ? '' : '+'}{reward.stats![s.key]}{s.suffix}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {/* Open Another */}
          {onOpenAnother && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + rewards.length * 0.12 }}
              onClick={onOpenAnother}
              disabled={!canOpenAnother}
              style={{
                flex: 1,
                background: canOpenAnother ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: canOpenAnother ? '#e2e8f0' : '#334155',
                border: `1px solid ${canOpenAnother ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: 'var(--font-display)',
                letterSpacing: '1px',
                cursor: canOpenAnother ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase' as const,
              }}
              onMouseOver={(e) => { if (canOpenAnother) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = canOpenAnother ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}
            >
              🔄 OPEN ANOTHER
            </motion.button>
          )}

          {/* Collect */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + rewards.length * 0.12 }}
            onClick={onClose}
            style={{
              flex: 1,
              background: `linear-gradient(135deg, ${glowColor}, ${glowColor}cc)`,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '2px',
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${glowColor}40`,
              textTransform: 'uppercase' as const,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = `0 6px 30px ${glowColor}60`
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = `0 4px 20px ${glowColor}40`
            }}
          >
            🎁 COLLECT
          </motion.button>
        </div>
      </div>
    </GameModal>
  )
}

export type { RewardEntry }
