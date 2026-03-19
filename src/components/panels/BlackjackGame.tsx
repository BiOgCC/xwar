import { useState, useCallback, useEffect } from 'react'
import { useBlackjackStore, calculateHand, BJ_BETS, type Card } from '../../stores/blackjackStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore, TIER_COLORS, TIER_LABELS, TIER_ORDER, getItemImagePath, type EquipItem } from '../../stores/inventoryStore'

/* ── Single playing card ── */
function PlayingCard({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const suitColor = card.faceUp
    ? isRed ? '#ef4444' : '#e2e8f0'
    : '#3b82f6'

  return (
    <div
      className={`bj-card ${card.faceUp ? '' : 'bj-card--facedown'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {card.faceUp ? (
        <>
          <span className="bj-card__rank" style={{ color: suitColor }}>{card.rank}</span>
          <span className="bj-card__suit" style={{ color: suitColor }}>{card.suit}</span>
        </>
      ) : (
        <span className="bj-card__back">?</span>
      )}
    </div>
  )
}

/* ── Hand display ── */
function Hand({ cards, label, total, showTotal = true }: {
  cards: Card[]
  label: string
  total: number
  showTotal?: boolean
}) {
  return (
    <div className="bj-hand-area">
      <div className="bj-hand-label">
        {label}
        {showTotal && cards.length > 0 && (
          <span className="bj-hand-total">{total}</span>
        )}
      </div>
      <div className="bj-hand">
        {cards.map((card, i) => (
          <PlayingCard key={`${card.rank}${card.suit}${i}`} card={card} delay={i * 150} />
        ))}
      </div>
    </div>
  )
}

/* ── Item card mini display ── */
function ItemCard({ item, size = 'normal' }: { item: EquipItem; size?: 'normal' | 'large' }) {
  const tierColor = TIER_COLORS[item.tier]
  const imgPath = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
  const isLarge = size === 'large'

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(0,0,0,0.6), ${tierColor}15)`,
      border: `2px solid ${tierColor}88`,
      borderRadius: isLarge ? '12px' : '8px',
      padding: isLarge ? '16px' : '8px 10px',
      display: 'flex', flexDirection: isLarge ? 'column' : 'row',
      alignItems: 'center', gap: isLarge ? '12px' : '8px',
      boxShadow: `0 0 ${isLarge ? '25px' : '12px'} ${tierColor}33`,
      minWidth: isLarge ? '180px' : undefined,
    }}>
      {imgPath && (
        <img src={imgPath} alt={item.name} draggable={false}
          style={{ width: isLarge ? '64px' : '32px', height: isLarge ? '64px' : '32px', objectFit: 'contain', filter: `drop-shadow(0 0 6px ${tierColor}66)` }}
        />
      )}
      <div style={{ textAlign: isLarge ? 'center' : 'left' }}>
        <div style={{ fontSize: isLarge ? '13px' : '10px', fontWeight: 900, color: tierColor, letterSpacing: '0.5px' }}>
          {item.name}
        </div>
        <div style={{ fontSize: isLarge ? '10px' : '8px', color: '#94a3b8', marginTop: '2px' }}>
          {TIER_LABELS[item.tier]}
        </div>
        {isLarge && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
            {item.stats.damage != null && <span style={{ fontSize: '10px', color: '#ef4444' }}>⚔️ {item.stats.damage}</span>}
            {item.stats.critRate != null && <span style={{ fontSize: '10px', color: '#f59e0b' }}>💥 {item.stats.critRate}%</span>}
            {item.stats.critDamage != null && <span style={{ fontSize: '10px', color: '#f59e0b' }}>💣 {item.stats.critDamage}%</span>}
            {item.stats.armor != null && <span style={{ fontSize: '10px', color: '#3b82f6' }}>🛡️ {item.stats.armor}%</span>}
            {item.stats.dodge != null && <span style={{ fontSize: '10px', color: '#22d38a' }}>🏃 {item.stats.dodge}%</span>}
            {item.stats.precision != null && <span style={{ fontSize: '10px', color: '#a855f7' }}>🎯 {item.stats.precision}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BlackjackGame() {
  const bj = useBlackjackStore()
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const [selectedBet, setSelectedBet] = useState(BJ_BETS[0])
  const [showHelp, setShowHelp] = useState(false)
  const [showItemBet, setShowItemBet] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [showWinPopup, setShowWinPopup] = useState(false)

  const playerTotal = calculateHand(bj.playerHand)
  const dealerTotal = calculateHand(bj.dealerHand)

  // Eligible items for betting: unequipped T2-T5
  const eligibleItems = inventory.items.filter(
    i => !i.equipped && TIER_ORDER.indexOf(i.tier) >= 1 && TIER_ORDER.indexOf(i.tier) <= 4
  )

  // Trigger shake animation on item loss
  useEffect(() => {
    if (bj.itemLost && bj.phase === 'result') {
      setShaking(true)
      const t = setTimeout(() => setShaking(false), 600)
      return () => clearTimeout(t)
    }
  }, [bj.itemLost, bj.phase])

  // Trigger win popup on item win
  useEffect(() => {
    if (bj.wonItem && bj.phase === 'result') {
      const t = setTimeout(() => setShowWinPopup(true), 400)
      return () => clearTimeout(t)
    }
  }, [bj.wonItem, bj.phase])

  const handleBet = useCallback(() => {
    if (player.money < selectedBet) return
    useBlackjackStore.getState().placeBet(selectedBet)
  }, [selectedBet, player.money])

  const handleItemBet = useCallback((itemId: string) => {
    useBlackjackStore.getState().placeBetWithItem(itemId)
    setShowItemBet(false)
  }, [])

  const handleNewRound = useCallback(() => {
    setShowWinPopup(false)
    useBlackjackStore.getState().newRound()
  }, [])

  return (
    <div className={`bj-table ${shaking ? 'bj-table--shake' : ''}`}>

      {/* ═══ STATS BAR ═══ */}
      {bj.handsPlayed > 0 && (
        <div className="bj-stats">
          <span>HANDS: <b>{bj.handsPlayed}</b></span>
          <span className="bj-stats--win">W: <b>{bj.wins}</b></span>
          <span className="bj-stats--lose">L: <b>{bj.losses}</b></span>
          <span className="bj-stats--push">P: <b>{bj.pushes}</b></span>
          {bj.blackjacks > 0 && <span className="bj-stats--bj">BJ: <b>{bj.blackjacks}</b></span>}
        </div>
      )}

      {/* ═══ ITEM BET INDICATOR ═══ */}
      {bj.betItem && bj.phase !== 'betting' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '6px 12px', marginBottom: '8px',
          background: `${TIER_COLORS[bj.betItem.tier]}12`,
          border: `1px solid ${TIER_COLORS[bj.betItem.tier]}44`,
          borderRadius: '8px', fontSize: '9px', fontWeight: 700, color: '#94a3b8',
        }}>
          🎲 ITEM AT STAKE: <ItemCard item={bj.betItem} />
        </div>
      )}

      {/* ═══ DEALER HAND ═══ */}
      <Hand
        cards={bj.dealerHand}
        label="DEALER"
        total={dealerTotal}
        showTotal={bj.phase === 'result'}
      />

      {/* ═══ RESULT OVERLAY ═══ */}
      {bj.phase === 'result' && (
        <div className={`bj-result bj-result--${bj.result}`}>
          <div className="bj-result__text">{bj.resultText}</div>
          {bj.payout > 0 && (
            <div className="bj-result__payout">+${bj.payout.toLocaleString()}</div>
          )}
        </div>
      )}

      {/* ═══ PLAYER HAND ═══ */}
      <Hand
        cards={bj.playerHand}
        label="YOU"
        total={playerTotal}
      />

      {/* ═══ BETTING PHASE ═══ */}
      {bj.phase === 'betting' && (
        <div className="bj-betting">
          {/* Money Bet */}
          <div className="bj-bet-chips">
            {BJ_BETS.map(amt => (
              <button
                key={amt}
                className={`bj-chip ${selectedBet === amt ? 'bj-chip--active' : ''}`}
                disabled={player.money < amt}
                onClick={() => setSelectedBet(amt)}
              >
                ${amt >= 1000 ? `${amt / 1000}K` : amt}
              </button>
            ))}
          </div>
          <button
            className="bj-deal-btn"
            disabled={player.money < selectedBet}
            onClick={handleBet}
          >
            DEAL — ${selectedBet >= 1000 ? `${selectedBet / 1000}K` : selectedBet}
          </button>
          <div className="bj-balance">
            BALANCE: <span>${player.money.toLocaleString()}</span>
          </div>

          {/* ── Item Bet Section ── */}
          <div style={{
            marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: '12px',
          }}>
            <button
              onClick={() => setShowItemBet(v => !v)}
              style={{
                width: '100%', padding: '10px 14px',
                background: showItemBet ? 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(245,158,11,0.1))' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${showItemBet ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '8px', cursor: 'pointer', color: showItemBet ? '#a855f7' : '#64748b',
                fontSize: '10px', fontWeight: 900, letterSpacing: '1px', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              🎲 {showItemBet ? '▲ HIDE ITEM BET' : '▼ BET AN ITEM'}
              <span style={{ fontSize: '8px', fontWeight: 400, color: '#64748b' }}>
                Win = upgrade tier • Lose = item destroyed
              </span>
            </button>

            {showItemBet && (
              <div style={{ marginTop: '8px' }}>
                {eligibleItems.length === 0 ? (
                  <div style={{
                    padding: '16px', textAlign: 'center', fontSize: '10px', color: '#475569',
                    border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px',
                  }}>
                    No eligible items (need unequipped T2–T5 gear)
                  </div>
                ) : (
                  <div style={{
                    maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px',
                    padding: '4px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)',
                  }}>
                    {eligibleItems.map(item => {
                      const nextTier = TIER_ORDER[TIER_ORDER.indexOf(item.tier) + 1]
                      const tierColor = TIER_COLORS[item.tier]
                      const nextColor = nextTier ? TIER_COLORS[nextTier] : '#fff'
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemBet(item.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 10px', background: `${tierColor}08`,
                            border: `1px solid ${tierColor}33`, borderRadius: '6px',
                            cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                            color: '#e2e8f0', fontSize: '10px', width: '100%',
                          }}
                          title={`Bet ${item.name} — Win: upgrade to ${nextTier?.toUpperCase()} • Lose: item destroyed`}
                        >
                          {(() => {
                            const imgPath = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
                            return imgPath ? (
                              <img src={imgPath} alt={item.name} draggable={false}
                                style={{ width: '28px', height: '28px', objectFit: 'contain', filter: `drop-shadow(0 0 4px ${tierColor}66)` }}
                              />
                            ) : null
                          })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: tierColor, fontSize: '10px' }}>{item.name}</div>
                            <div style={{ fontSize: '8px', color: '#64748b' }}>{item.tier.toUpperCase()} {item.slot}</div>
                          </div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '9px', fontWeight: 700,
                          }}>
                            <span style={{ color: tierColor }}>{item.tier.toUpperCase()}</span>
                            <span style={{ color: '#475569' }}>→</span>
                            <span style={{ color: nextColor }}>{nextTier?.toUpperCase()}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* How to Play */}
          <button
            className="bj-how-toggle"
            onClick={() => setShowHelp(h => !h)}
            style={{
              marginTop: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', color: '#64748b', fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', width: '100%',
              transition: 'all 0.2s',
            }}
          >
            {showHelp ? '▲ HIDE RULES' : '▼ HOW TO PLAY'}
          </button>
          {showHelp && (
            <div style={{
              marginTop: '8px', padding: '12px 14px', background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
              fontSize: '10px', lineHeight: 1.7, color: '#94a3b8',
            }}>
              <div style={{ fontWeight: 900, color: '#e2e8f0', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>🃏 BLACKJACK RULES</div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Goal:</b> Get your cards as close to <b style={{ color: '#f59e0b' }}>21</b> as possible without going over. Beat the dealer's hand to win.
              </div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Card Values:</b><br/>
                • Number cards (2–10) = face value<br/>
                • Face cards (J, Q, K) = <b>10</b><br/>
                • Ace = <b>11</b> or <b>1</b> (automatically adjusted)
              </div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Actions:</b><br/>
                • <b style={{ color: '#22d38a' }}>HIT</b> — Draw another card<br/>
                • <b style={{ color: '#f59e0b' }}>STAND</b> — Keep your hand, dealer plays<br/>
                • <b style={{ color: '#a855f7' }}>DOUBLE</b> — Double your bet, get one more card, then stand
              </div>
              <div style={{ color: '#64748b', fontSize: '9px' }}>
                Blackjack (Ace + 10-value card) pays <b style={{ color: '#22d38a' }}>2.5x</b> your bet. Regular win pays <b style={{ color: '#22d38a' }}>2x</b>. Tie = push (bet returned).
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PLAYING PHASE ═══ */}
      {bj.phase === 'playing' && (
        <div className="bj-actions">
          <button className="bj-action bj-action--hit" onClick={() => useBlackjackStore.getState().hit()}>
            HIT
          </button>
          <button className="bj-action bj-action--stand" onClick={() => useBlackjackStore.getState().stand()}>
            STAND
          </button>
          {bj.playerHand.length === 2 && player.money >= bj.bet && bj.bet > 0 && (
            <button className="bj-action bj-action--double" onClick={() => useBlackjackStore.getState().doubleDown()}>
              DOUBLE
            </button>
          )}
        </div>
      )}

      {/* ═══ RESULT PHASE ═══ */}
      {bj.phase === 'result' && (
        <div className="bj-actions">
          <button className="bj-action bj-action--deal" onClick={handleNewRound}>
            NEW HAND
          </button>
        </div>
      )}

      {/* ═══ ITEM WIN POPUP ═══ */}
      {showWinPopup && bj.wonItem && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: 'bj-popup-in 0.4s ease-out',
          }}
          onClick={() => setShowWinPopup(false)}
        >
          <div style={{
            fontSize: '14px', fontWeight: 900, color: '#22d38a', letterSpacing: '2px',
            marginBottom: '16px', textShadow: '0 0 20px rgba(34,211,138,0.5)',
            animation: 'bj-popup-glow 1.5s ease-in-out infinite alternate',
          }}>
            ✨ ITEM UPGRADED! ✨
          </div>
          {bj.betItem && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px',
              fontSize: '11px', color: '#94a3b8',
            }}>
              <ItemCard item={bj.betItem} />
              <span style={{ fontSize: '20px', color: '#22d38a', fontWeight: 900 }}>→</span>
              <ItemCard item={bj.wonItem} size="large" />
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#475569', marginTop: '12px' }}>
            Click anywhere to close
          </div>
        </div>
      )}
    </div>
  )
}
