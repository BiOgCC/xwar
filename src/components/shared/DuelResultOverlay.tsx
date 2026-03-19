import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRINGS, useScreenShake } from './AnimationSystem'
import { getCountryFlagUrl } from '../../stores/battleStore'
import RewardReveal, { type RewardEntry } from './RewardReveal'

/* ═══════════════════════════════════════════════════
   DuelResultOverlay — Sequenced Battle Result Flow
   Timeline:
     0–1.5s   VS Screen (fighters slide in, VS slams)
     1.5–3s   Tension (screen darkens, heartbeat)
     3–3.5s   Clash (explosion, shake)
     3.5–5s   Result (VICTORY / DEFEAT)
     5s+      Rewards (optional)
   ═══════════════════════════════════════════════════ */

type DuelPhase = 'vs' | 'tension' | 'clash' | 'result' | 'rewards'

interface DuelResultOverlayProps {
  isOpen: boolean
  onClose: () => void
  attacker: { name: string; flag: string }
  defender: { name: string; flag: string }
  winner: 'attacker' | 'defender'
  isPlayerAttacker: boolean
  rewards?: RewardEntry[]
}

export default function DuelResultOverlay({
  isOpen,
  onClose,
  attacker,
  defender,
  winner,
  isPlayerAttacker,
  rewards,
}: DuelResultOverlayProps) {
  const [phase, setPhase] = useState<DuelPhase>('vs')
  const shake = useScreenShake()

  useEffect(() => {
    if (!isOpen) {
      setPhase('vs')
      return
    }

    // VS phase
    const t1 = setTimeout(() => setPhase('tension'), 1500)
    // Tension phase
    const t2 = setTimeout(() => {
      setPhase('clash')
      shake(8, 400)
    }, 3000)
    // Result phase
    const t3 = setTimeout(() => setPhase('result'), 3500)
    // Rewards phase (if any)
    const t4 = setTimeout(() => {
      if (rewards && rewards.length > 0) {
        setPhase('rewards')
      }
    }, 5500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [isOpen, rewards, shake])

  const playerWon = (winner === 'attacker' && isPlayerAttacker)
    || (winner === 'defender' && !isPlayerAttacker)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="duel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {/* ── VS Phase: Fighters slide in ── */}
          {(phase === 'vs' || phase === 'tension') && (
            <div className="duel-fighters-row">
              {/* Attacker */}
              <motion.div
                className="duel-fighter duel-fighter--left"
                initial={{ x: -200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ ...SPRINGS.heavy, delay: 0.2 }}
              >
                <div className="duel-fighter__flag"><img src={getCountryFlagUrl(attacker.flag, 80)} alt={attacker.flag} draggable={false} style={{ width: '48px', borderRadius: '4px' }} /></div>
                <div className="duel-fighter__name">{attacker.name}</div>
              </motion.div>

              {/* VS */}
              <motion.div
                className="duel-vs"
                initial={{ scale: 4, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ ...SPRINGS.snappy, delay: 0.5 }}
              >
                ⚔️
              </motion.div>

              {/* Defender */}
              <motion.div
                className="duel-fighter duel-fighter--right"
                initial={{ x: 200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ ...SPRINGS.heavy, delay: 0.2 }}
              >
                <div className="duel-fighter__flag"><img src={getCountryFlagUrl(defender.flag, 80)} alt={defender.flag} draggable={false} style={{ width: '48px', borderRadius: '4px' }} /></div>
                <div className="duel-fighter__name">{defender.name}</div>
              </motion.div>
            </div>
          )}

          {/* ── Tension Phase: Heartbeat overlay ── */}
          {phase === 'tension' && (
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
                pointerEvents: 'none',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0.5, 0.9, 0.6] }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />
          )}

          {/* ── Clash Phase: Explosion ── */}
          {phase === 'clash' && (
            <motion.div
              style={{
                fontSize: '120px',
                position: 'absolute',
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: [0, 2, 3], opacity: [1, 1, 0] }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              💥
            </motion.div>
          )}

          {/* ── Result Phase ── */}
          {(phase === 'result' || phase === 'rewards') && (
            <motion.div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRINGS.bouncy}
            >
              <div
                className={`duel-result-text ${
                  playerWon ? 'duel-result-text--victory' : 'duel-result-text--defeat'
                }`}
              >
                {playerWon ? 'VICTORY' : 'DEFEAT'}
              </div>

              <motion.div
                style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.06em',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {winner === 'attacker' ? attacker.name : defender.name} WINS
              </motion.div>

              {phase === 'result' && (!rewards || rewards.length === 0) && (
                <motion.button
                  className="reward-dismiss"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={onClose}
                >
                  CONTINUE
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ── Rewards Phase ── */}
          {phase === 'rewards' && rewards && rewards.length > 0 && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <RewardReveal
                isOpen={true}
                rewards={rewards}
                onClose={onClose}
                title={playerWon ? 'BATTLE REWARDS' : 'CONSOLATION'}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
