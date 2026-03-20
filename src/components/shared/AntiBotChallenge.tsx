import { useState, useEffect, useCallback } from 'react'
import { useAntiBotStore } from '../../stores/antiBotStore'
import type { ChallengeData } from '../../stores/antiBotStore'
import GameModal from './GameModal'

/* ═══════════════════════════════════════════════════
   AntiBotChallenge — Security Verification Popup
   Military-themed CAPTCHA mini-games
   ═══════════════════════════════════════════════════ */

const CHALLENGE_TIMEOUT_MS = 15_000

function EmojiChallenge({ data, onSubmit }: { data: ChallengeData; onSubmit: (answer: string) => void }) {
  return (
    <div className="ab-challenge-body">
      <div className="ab-target-label">IDENTIFY THIS SIGNAL</div>
      <div className="ab-target-emoji">{data.question}</div>
      <div className="ab-options">
        {data.options.map((opt, i) => (
          <button
            key={i}
            className="ab-option-btn ab-option-btn--emoji"
            onClick={() => onSubmit(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function MathChallenge({ data, onSubmit }: { data: ChallengeData; onSubmit: (answer: string) => void }) {
  return (
    <div className="ab-challenge-body">
      <div className="ab-target-label">SOLVE THE CIPHER</div>
      <div className="ab-target-math">{data.question} = ?</div>
      <div className="ab-options">
        {data.options.map((opt, i) => (
          <button
            key={i}
            className="ab-option-btn ab-option-btn--math"
            onClick={() => onSubmit(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function UnscrambleChallenge({ data, onSubmit }: { data: ChallengeData; onSubmit: (answer: string) => void }) {
  const [input, setInput] = useState('')

  const handleSubmit = useCallback(() => {
    if (input.trim()) onSubmit(input.trim())
  }, [input, onSubmit])

  return (
    <div className="ab-challenge-body">
      <div className="ab-target-label">DECODE THE TRANSMISSION</div>
      <div className="ab-scrambled-word">
        {data.question.split('').map((ch, i) => (
          <span key={i} className="ab-scrambled-letter">{ch}</span>
        ))}
      </div>
      <div className="ab-input-row">
        <input
          type="text"
          className="ab-text-input"
          placeholder="Type the word..."
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          maxLength={10}
          autoFocus
        />
        <button className="ab-submit-btn" onClick={handleSubmit} disabled={!input.trim()}>
          SUBMIT
        </button>
      </div>
    </div>
  )
}

export default function AntiBotChallenge() {
  const { challengeActive, challengeData, challengeStartedAt, submitAnswer, dismissChallenge } = useAntiBotStore()
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_TIMEOUT_MS)
  const [result, setResult] = useState<'success' | 'fail' | null>(null)

  // Countdown timer
  useEffect(() => {
    if (!challengeActive) { setTimeLeft(CHALLENGE_TIMEOUT_MS); setResult(null); return }
    const interval = setInterval(() => {
      const elapsed = Date.now() - challengeStartedAt
      const remaining = Math.max(0, CHALLENGE_TIMEOUT_MS - elapsed)
      setTimeLeft(remaining)
    }, 50)
    return () => clearInterval(interval)
  }, [challengeActive, challengeStartedAt])

  const handleSubmit = useCallback((answer: string) => {
    const correct = submitAnswer(answer)
    setResult(correct ? 'success' : 'fail')
    // Brief flash before modal closes
    if (correct) {
      setTimeout(() => setResult(null), 1200)
    } else {
      setTimeout(() => setResult(null), 1500)
    }
  }, [submitAnswer])

  const progress = timeLeft / CHALLENGE_TIMEOUT_MS
  const urgency = progress < 0.33 ? 'critical' : progress < 0.66 ? 'warning' : 'safe'

  return (
    <GameModal
      isOpen={challengeActive}
      onClose={dismissChallenge}
      title=""
      size="md"
      glowColor="#ef4444"
    >
      <div className="ab-container">
        {/* Scanline overlay */}
        <div className="ab-scanlines" />

        {/* Header */}
        <div className="ab-header">
          <div className="ab-header__icon">🔐</div>
          <div className="ab-header__title">SECURITY CHECK</div>
          <div className="ab-header__sub">
            Verify your identity to continue operations
          </div>
        </div>

        {/* Timer bar */}
        <div className={`ab-timer-track ab-timer-track--${urgency}`}>
          <div
            className={`ab-timer-fill ab-timer-fill--${urgency}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="ab-timer-label">
          {Math.ceil(timeLeft / 1000)}s REMAINING
        </div>

        {/* Challenge content */}
        {result === 'success' ? (
          <div className="ab-result ab-result--success">
            <span className="ab-result__icon">✅</span>
            <span className="ab-result__text">IDENTITY VERIFIED</span>
          </div>
        ) : result === 'fail' ? (
          <div className="ab-result ab-result--fail">
            <span className="ab-result__icon">❌</span>
            <span className="ab-result__text">VERIFICATION FAILED</span>
          </div>
        ) : challengeData ? (
          <>
            {challengeData.type === 'emoji' && (
              <EmojiChallenge data={challengeData} onSubmit={handleSubmit} />
            )}
            {challengeData.type === 'math' && (
              <MathChallenge data={challengeData} onSubmit={handleSubmit} />
            )}
            {challengeData.type === 'unscramble' && (
              <UnscrambleChallenge data={challengeData} onSubmit={handleSubmit} />
            )}
          </>
        ) : null}

        {/* Penalty info */}
        <div className="ab-footer">
          ⚠️ Closing or failing locks actions temporarily
        </div>
      </div>
    </GameModal>
  )
}
