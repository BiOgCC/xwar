import { useState } from 'react'
import BlackjackGame from './BlackjackGame'
import SlotsGame from './SlotsGame'
import CrashGame from './CrashGame'
import RouletteGame from './casino/RouletteGame'
import RaffleGame from './casino/RaffleGame'
import '../../styles/casino.css'

export default function CasinoPanel() {
  const [activeGame, setActiveGame] = useState<'roulette' | 'blackjack' | 'slots' | 'crash' | 'raffle'>('roulette')

  return (
    <div className="casino-panel">

      {/* ═══ HEADER ═══ */}
      <div className="casino-header">
        <div className="casino-header__title">WARZONE CASINO</div>
      </div>

      {/* ═══ GAME TABS ═══ */}
      <div className="casino-tabs">
        <button
          className={`casino-tab ${activeGame === 'roulette' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('roulette')}
        >
          🎰 ROULETTE
        </button>
        <button
          className={`casino-tab ${activeGame === 'blackjack' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('blackjack')}
        >
          🃏 BLACKJACK
        </button>
        <button
          className={`casino-tab ${activeGame === 'slots' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('slots')}
        >
          🎰 SLOTS
        </button>
        <button
          className={`casino-tab ${activeGame === 'crash' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('crash')}
        >
          🚀 CRASH
        </button>
        <button
          className={`casino-tab ${activeGame === 'raffle' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('raffle')}
        >
          🎟️ RAFFLE
        </button>
      </div>

      {/* ═══ GAME CONTENT ═══ */}
      {activeGame === 'roulette' && <RouletteGame />}
      {activeGame === 'blackjack' && <BlackjackGame />}
      {activeGame === 'slots' && <SlotsGame />}
      {activeGame === 'crash' && <CrashGame />}
      {activeGame === 'raffle' && <RaffleGame />}
    </div>
  )
}
