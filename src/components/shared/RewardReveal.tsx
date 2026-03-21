import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { rewardItemVariants, SPRINGS, TIER_FX, useScreenShake } from './AnimationSystem'
import { TIER_COLORS, TIER_LABELS, type EquipItem, type EquipTier } from '../../stores/inventoryStore'

/* ═══════════════════════════════════════════════════
   RewardReveal — Staggered Tier-Aware Reward Display
   ═══════════════════════════════════════════════════ */

interface RewardEntry {
  type: 'item' | 'money' | 'scrap' | 'xp' | 'lootbox'
  label: string
  value: string
  tier?: EquipTier
  icon: React.ReactNode
}

interface RewardRevealProps {
  rewards: RewardEntry[]
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function RewardReveal({ rewards, isOpen, onClose, title = 'REWARDS' }: RewardRevealProps) {
  const [showRewards, setShowRewards] = useState(false)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const shake = useScreenShake()

  // Find highest tier for screen effects
  const highestTier = useMemo(() => {
    const tiers = rewards.filter(r => r.tier).map(r => r.tier!)
    const order: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6']
    let best: EquipTier = 't1'
    for (const t of tiers) {
      if (order.indexOf(t) > order.indexOf(best)) best = t
    }
    return best
  }, [rewards])

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
      else if (highestTier === 't6') setFlashColor('red')
    }, 300)

    return () => clearTimeout(timer)
  }, [isOpen, highestTier, shake])

  // Clear flash
  useEffect(() => {
    if (!flashColor) return
    const t = setTimeout(() => setFlashColor(null), 500)
    return () => clearTimeout(t)
  }, [flashColor])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="reward-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          onClick={onClose}
        >
          {/* Screen flash */}
          {flashColor && (
            <div className={`reward-flash reward-flash--${flashColor}`} />
          )}

          {/* Title */}
          <motion.div
            className="reward-title"
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRINGS.bouncy, delay: 0.1 }}
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
              onClick={(e) => e.stopPropagation()}
            >
              {rewards.map((reward, i) => {
                const fx = reward.tier ? TIER_FX[reward.tier] : null
                const tierColor = reward.tier ? TIER_COLORS[reward.tier] : undefined
                const tierLabel = reward.tier ? TIER_LABELS[reward.tier] : undefined

                return (
                  <motion.div
                    key={i}
                    className={`reward-card ${fx?.glowClass || ''}`}
                    variants={rewardItemVariants}
                    style={{
                      '--card-glow': tierColor ? `${tierColor}20` : 'transparent',
                      borderColor: tierColor ? `${tierColor}40` : undefined,
                    } as React.CSSProperties}
                  >
                    <div className="reward-card__icon">{reward.icon}</div>
                    <div className="reward-card__label">{reward.label}</div>
                    <div
                      className="reward-card__value"
                      style={tierColor ? { color: tierColor } : undefined}
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
                  </motion.div>
                )
              })}
            </motion.div>
          )}

          {/* Dismiss */}
          <motion.button
            className="reward-dismiss"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + rewards.length * 0.12 }}
            onClick={onClose}
          >
            COLLECT
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export type { RewardEntry }
