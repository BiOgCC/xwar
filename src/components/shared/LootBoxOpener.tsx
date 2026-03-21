import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRINGS, TIER_FX, useScreenShake } from './AnimationSystem'
import RewardReveal, { type RewardEntry } from './RewardReveal'
import { getItemImagePath, type LootBoxResult } from '../../stores/inventoryStore'

/* ═══════════════════════════════════════════════════
   LootBoxOpener — Three-Phase Animation Sequence
   Phase 1: Anticipation (wiggle, glow builds)
   Phase 2: Impact (flash, shake)
   Phase 3: Release (rewards stagger in)
   ═══════════════════════════════════════════════════ */

type Phase = 'idle' | 'anticipation' | 'impact' | 'reveal' | 'done'

interface LootBoxOpenerProps {
  isOpen: boolean
  onClose: () => void
  onOpenBox: () => Promise<LootBoxResult | null>
  boxType?: 'civilian' | 'military'
}

const BOX_THEMES = {
  civilian: {
    image: '/assets/items/lootbox_civilian.png',
    color: '#22d38a',
    title: 'CIVILIAN LOOT BOX',
    hintColor: '#f59e0b',
  },
  military: {
    image: '/assets/items/lootbox_military.png',
    color: '#ef4444',
    title: 'MILITARY LOOT BOX',
    hintColor: '#ef4444',
  },
}

export default function LootBoxOpener({ isOpen, onClose, onOpenBox, boxType = 'civilian' }: LootBoxOpenerProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [rewards, setRewards] = useState<RewardEntry[]>([])
  const shake = useScreenShake()

  const theme = BOX_THEMES[boxType]

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle')
      setRewards([])
    }
  }, [isOpen])

  const handleOpenClick = useCallback(() => {
    if (phase !== 'idle') return

    // Phase 1: Anticipation
    setPhase('anticipation')

    setTimeout(async () => {
      // Phase 2: Impact — actually open the box
      setPhase('impact')

      const result = await onOpenBox()
      if (!result) {
        setPhase('idle')
        return
      }

      // Screen shake based on reward type
      let shakeIntensity = 3
      if (result.item) {
        const fx = TIER_FX[result.item.tier]
        shakeIntensity = Math.max(3, fx.shake)
      }
      shake(shakeIntensity, 300)

      // Build reward entries based on result type
      const rewardEntries: RewardEntry[] = []

      if (result.item) {
        rewardEntries.push({
          type: 'item',
          label: result.item.slot.toUpperCase(),
          value: result.item.name,
          tier: result.item.tier,
          icon: <img src={getItemImagePath(result.item.tier, result.item.slot, result.item.category, result.item.weaponSubtype) || ''} alt="item" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />,
        })
      }
      if (result.money > 0) {
        rewardEntries.push({
          type: 'money',
          label: 'MONEY',
          value: `$${result.money.toLocaleString()}`,
          icon: <img src="/assets/items/icon_bitcoin.png" alt="money" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />,
        })
      }
      if (result.scrap > 0) {
        rewardEntries.push({
          type: 'scrap',
          label: 'SCRAP',
          value: `+${result.scrap}`,
          icon: <img src="/assets/items/icon_scrap.png" alt="scrap" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />,
        })
      }
      if (result.oil > 0) {
        rewardEntries.push({
          type: 'scrap',
          label: 'OIL',
          value: `+${result.oil}`,
          icon: <img src="/assets/items/icon_oil.png" alt="oil" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />,
        })
      }
      if (result.badgesOfHonor && result.badgesOfHonor > 0) {
        rewardEntries.push({
          type: 'item',
          label: 'BADGE OF HONOR',
          value: `+${result.badgesOfHonor}`,
          icon: <span style={{ fontSize: '36px' }}>🎖️</span>,
        })
      }

      // Phase 3: Reveal (after a brief pause)
      setTimeout(() => {
        setRewards(rewardEntries)
        setPhase('reveal')
      }, 400)
    }, 700) // anticipation duration
  }, [phase, onOpenBox, shake])

  const handleClose = useCallback(() => {
    setPhase('done')
    setTimeout(() => onClose(), 200)
  }, [onClose])

  return (
    <AnimatePresence>
      {isOpen && phase !== 'done' && (
        <>
          {/* Chest opening phase */}
          {(phase === 'idle' || phase === 'anticipation' || phase === 'impact') && (
            <motion.div
              className="lootbox-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="lootbox-chest"
            >
              {/* Box image */}
              <motion.div
                className="lootbox-chest"
                animate={
                  phase === 'anticipation'
                    ? {
                        rotate: [0, -5, 5, -7, 7, -4, 4, 0],
                        scale: [1, 1.02, 1.04, 1.08, 1.1, 1.08, 1.04, 1],
                      }
                    : phase === 'impact'
                    ? { scale: [1, 1.5, 0], opacity: [1, 1, 0] }
                    : { scale: 1 }
                }
                transition={
                  phase === 'anticipation'
                    ? { duration: 0.6, ease: 'easeInOut' }
                    : phase === 'impact'
                    ? { duration: 0.35, ease: 'easeOut' }
                    : SPRINGS.gentle
                }
                onClick={handleOpenClick}
                style={{
                  cursor: phase === 'idle' ? 'pointer' : 'default',
                  filter: `drop-shadow(0 8px 24px ${theme.color}60)`,
                }}
              >
                {phase === 'impact'
                  ? '💥'
                  : <img src={theme.image} alt={theme.title} style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                }
              </motion.div>

              {/* Box type label */}
              <motion.div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 900,
                  color: theme.color,
                  letterSpacing: '0.12em',
                  textShadow: `0 0 12px ${theme.color}60`,
                  marginBottom: '-8px',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {theme.title}
              </motion.div>

              {phase === 'idle' && (
                <motion.div
                  className="lootbox-hint"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  CLICK TO OPEN
                </motion.div>
              )}

              {phase === 'anticipation' && (
                <motion.div
                  className="lootbox-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  style={{ color: theme.hintColor }}
                >
                  OPENING...
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Reward reveal phase */}
          {phase === 'reveal' && rewards.length > 0 && (
            <RewardReveal
              key="lootbox-rewards"
              isOpen={true}
              rewards={rewards}
              onClose={handleClose}
              title={`${theme.title} REWARDS`}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}
