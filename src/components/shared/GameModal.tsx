import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalVariants, overlayVariants } from './AnimationSystem'

/* ═══════════════════════════════════════════════════
   GameModal — Unified Animated Modal
   ═══════════════════════════════════════════════════ */

interface GameModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  glowColor?: string
}

export default function GameModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  glowColor,
}: GameModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gm-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`gm-panel gm-panel--${size}`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={
              glowColor
                ? {
                    boxShadow: `0 0 30px ${glowColor}40, 0 0 60px ${glowColor}20`,
                    borderColor: `${glowColor}40`,
                  }
                : undefined
            }
          >
            {title && <div className="gm-panel__title">{title}</div>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
