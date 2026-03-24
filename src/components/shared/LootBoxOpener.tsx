import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SPRINGS, TIER_FX, useScreenShake } from './AnimationSystem'
import RewardReveal, { type RewardEntry } from './RewardReveal'
import GameModal from './GameModal'
import { getItemImagePath, type LootBoxResult } from '../../stores/inventoryStore'
import BadgeOfHonorIcon from './BadgeOfHonorIcon'
import { usePlayerStore } from '../../stores/playerStore'

/* ═══════════════════════════════════════════════════
   LootBoxOpener — GameModal-Based Box Opening
   Phase 1: Box display inside GameModal (click to open)
   Phase 2: Reward reveal (staggered cards)
   ═══════════════════════════════════════════════════ */

type Phase = 'idle' | 'opening' | 'reveal'

interface LootBoxOpenerProps {
  isOpen: boolean
  onClose: () => void
  onOpenBox: () => Promise<LootBoxResult | null>
  boxType?: 'civilian' | 'military' | 'supply'
}

const BOX_THEMES = {
  civilian: {
    image: '/assets/items/lootbox_civilian.png',
    color: '#22d38a',
    title: 'CIVILIAN LOOT BOX',
    gradient: 'linear-gradient(135deg, #22d38a, #16a34a)',
    bgTint: 'rgba(34,211,138,0.08)',
    borderTint: 'rgba(34,211,138,0.2)',
  },
  military: {
    image: '/assets/items/lootbox_military.png',
    color: '#ef4444',
    title: 'MILITARY LOOT BOX',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    bgTint: 'rgba(239,68,68,0.08)',
    borderTint: 'rgba(239,68,68,0.2)',
  },
  supply: {
    image: '/assets/items/lootbox_civilian.png',
    color: '#3b82f6',
    title: 'SUPPLY BOX',
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    bgTint: 'rgba(59,130,246,0.08)',
    borderTint: 'rgba(59,130,246,0.2)',
  },
}

export default function LootBoxOpener({ isOpen, onClose, onOpenBox, boxType = 'civilian' }: LootBoxOpenerProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [rewards, setRewards] = useState<RewardEntry[]>([])
  const [isOpening, setIsOpening] = useState(false)
  const shake = useScreenShake()

  const theme = BOX_THEMES[boxType]

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle')
      setRewards([])
      setIsOpening(false)
    }
  }, [isOpen])

  const handleOpenClick = useCallback(async () => {
    if (phase !== 'idle' || isOpening) return
    setIsOpening(true)
    setPhase('opening')

    // Short delay for wiggle animation
    await new Promise(r => setTimeout(r, 800))

    const result = await onOpenBox()
    if (!result) {
      setPhase('idle')
      setIsOpening(false)
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
        stats: result.item.stats,
        icon: <img src={getItemImagePath(result.item.tier, result.item.slot, result.item.category, result.item.weaponSubtype, result.item.superforged) || ''} alt="item" style={{ width: '72px', height: '72px', objectFit: 'contain' }} />,
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
        icon: <BadgeOfHonorIcon size={36} />,
      })
    }

    // Transition to reward reveal
    setTimeout(() => {
      setRewards(rewardEntries)
      setPhase('reveal')
      setIsOpening(false)
    }, 300)
  }, [phase, isOpening, onOpenBox, shake])

  const handleClose = useCallback(() => {
    setPhase('idle')
    setRewards([])
    setIsOpening(false)
    onClose()
  }, [onClose])

  const handleOpenAnother = useCallback(async () => {
    // Reset to idle and immediately trigger a new open
    setPhase('idle')
    setRewards([])
    setIsOpening(false)
    // Small delay then open again
    await new Promise(r => setTimeout(r, 100))
    handleOpenClick()
  }, [handleOpenClick])

  // How many boxes left
  const player = usePlayerStore()
  const boxCount = boxType === 'civilian' ? player.lootBoxes
    : boxType === 'military' ? player.militaryBoxes
    : (player.supplyBoxes ?? 0)

  // Phase 2: Reward reveal overlay (same as before)
  if (phase === 'reveal' && rewards.length > 0) {
    return (
      <RewardReveal
        key="lootbox-rewards"
        isOpen={true}
        rewards={rewards}
        onClose={handleClose}
        onOpenAnother={handleOpenAnother}
        canOpenAnother={boxCount > 0}
        title={`${theme.title} REWARDS`}
      />
    )
  }

  // Phase 1: Box display inside GameModal
  return (
    <GameModal isOpen={isOpen && phase !== 'reveal'} onClose={handleClose} size="sm" glowColor={theme.color}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 900,
            color: theme.color, letterSpacing: '2px',
            textShadow: `0 0 16px ${theme.color}60`,
          }}>
            {theme.title}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '10px', color: '#94a3b8', marginTop: '4px',
          }}>
            Tap the button to reveal your rewards
          </div>
        </div>

        {/* Box Image */}
        <div style={{
          background: theme.bgTint, border: `1px solid ${theme.borderTint}`,
          borderRadius: '12px', padding: '20px', marginBottom: '16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        }}>
          <motion.div
            animate={
              phase === 'opening'
                ? {
                    rotate: [0, -5, 5, -7, 7, -4, 4, 0],
                    scale: [1, 1.05, 1.1, 1.15, 1.1, 1.05, 1.02, 1],
                  }
                : { rotate: 0, scale: 1 }
            }
            transition={
              phase === 'opening'
                ? { duration: 0.7, ease: 'easeInOut' }
                : SPRINGS.gentle
            }
            style={{
              filter: `drop-shadow(0 8px 24px ${theme.color}50)`,
            }}
          >
            <img
              src={theme.image}
              alt={theme.title}
              style={{ width: '96px', height: '96px', objectFit: 'contain' }}
            />
          </motion.div>

          {phase === 'opening' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                fontFamily: 'var(--font-display)', fontSize: '10px',
                fontWeight: 700, letterSpacing: '0.1em', color: theme.color,
              }}
            >
              OPENING...
            </motion.div>
          )}
        </div>

        {/* Open Button */}
        <button
          onClick={handleOpenClick}
          disabled={isOpening}
          style={{
            background: isOpening ? 'rgba(100,116,139,0.3)' : theme.gradient,
            color: isOpening ? '#64748b' : '#fff',
            border: 'none', borderRadius: '8px',
            padding: '10px 32px', fontSize: '13px', fontWeight: 800,
            fontFamily: 'var(--font-display)', letterSpacing: '2px',
            cursor: isOpening ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isOpening ? 'none' : `0 4px 20px ${theme.color}40`,
            textTransform: 'uppercase' as const,
            width: '100%',
          }}
          onMouseOver={(e) => { if (!isOpening) { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 6px 30px ${theme.color}60` } }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = isOpening ? 'none' : `0 4px 20px ${theme.color}40` }}
        >
          {isOpening ? '⏳ OPENING...' : '📦 OPEN BOX'}
        </button>

        {/* Footer note */}
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '9px',
          color: '#475569', marginTop: '8px',
        }}>
          Rewards include equipment, money, scrap, oil & more
        </div>
      </div>
    </GameModal>
  )
}
