import React, { useState, useEffect } from 'react'
import {
  useWarCardsStore,
  CARD_CATEGORY_META,
  CARD_RARITY_META,
  type CardCategory,
  type CardRarity,
  type WarCardDefinition,
  type EarnedWarCard,
} from '../../stores/warCardsStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'

type SubTab = 'collection' | 'available' | 'hall' | 'leaderboard'

// ── Card Art Mapping (10 cards with art) ──
const CARD_ART: Record<string, string> = {
  milestone_1m_money:    '/assets/cards/card_millionaire.png',
  timed_1m_dmg_week:     '/assets/cards/card_blitzkrieg.png',
  combat_one_shot:       '/assets/cards/card_oneshot.png',
  combat_comeback:       '/assets/cards/card_comeback.png',
  econ_casino_royale:    '/assets/cards/card_casino.png',
  timed_top1_dmg_10w:    '/assets/cards/card_warmachine.png',
  combat_biggest_battle: '/assets/cards/card_titanofwar.png',
  econ_scrap_lord:       '/assets/cards/card_scraplord.png',
  combat_iron_wall:      '/assets/cards/card_ironwall.png',
  econ_market_maker:     '/assets/cards/card_marketmaker.png',
}

// Rarity → frame accent color
const RARITY_FRAME: Record<CardRarity, { border: string; glow: string; bg: string }> = {
  legendary: { border: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: 'linear-gradient(180deg, #1a1206 0%, #0d0a04 100%)' },
  epic:      { border: '#a855f7', glow: 'rgba(168,85,247,0.25)', bg: 'linear-gradient(180deg, #140d1e 0%, #0a060f 100%)' },
  rare:      { border: '#3b82f6', glow: 'rgba(59,130,246,0.2)',  bg: 'linear-gradient(180deg, #0c1220 0%, #060a14 100%)' },
  uncommon:  { border: '#22d38a', glow: 'rgba(34,211,138,0.15)', bg: 'linear-gradient(180deg, #0a1510 0%, #050d09 100%)' },
  common:    { border: '#64748b', glow: 'rgba(100,116,139,0.1)', bg: 'linear-gradient(180deg, #111318 0%, #0a0c10 100%)' },
}

const RARITY_ORDER: CardRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// ── TCG-Style Card Component ──

function WarCard({ def, earned }: { def: WarCardDefinition; earned?: EarnedWarCard }) {
  const [hovered, setHovered] = useState(false)
  const catMeta = CARD_CATEGORY_META[def.category]
  const rarMeta = CARD_RARITY_META[def.rarity]
  const frame = RARITY_FRAME[def.rarity]
  const isOwned = !!earned
  const artUrl = CARD_ART[def.id]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '10px',
        border: `2px solid ${isOwned ? frame.border : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isOwned ? `0 0 16px ${frame.glow}, 0 4px 20px rgba(0,0,0,0.6)` : '0 2px 8px rgba(0,0,0,0.4)',
        background: isOwned ? frame.bg : 'linear-gradient(180deg, #0e1015 0%, #080a0e 100%)',
        padding: '6px',
        opacity: isOwned ? 1 : 0.45,
        transition: 'all 0.3s ease, transform 0.25s ease',
        transform: hovered ? 'translateY(-2px) scale(1.02)' : 'scale(1)',
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* ─── Top: Rarity gems ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 2px 3px',
      }}>
        <span style={{ fontSize: '7px', fontWeight: 800, color: catMeta.color, letterSpacing: '0.5px' }}>
          {catMeta.icon} {catMeta.label.toUpperCase()}
        </span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 }[def.rarity] }).map((_, i) => (
            <div key={i} style={{
              width: '6px', height: '6px', borderRadius: '1px',
              background: isOwned ? frame.border : '#1e293b',
              border: `1px solid ${isOwned ? frame.border : '#334155'}`,
              boxShadow: isOwned ? `0 0 4px ${frame.glow}` : 'none',
            }} />
          ))}
        </div>
      </div>

      {/* ─── Card Art Frame ─── */}
      <div style={{
        position: 'relative',
        width: '100%', height: '100px',
        borderRadius: '4px',
        border: `1px solid ${isOwned ? `${frame.border}55` : 'rgba(255,255,255,0.06)'}`,
        overflow: 'hidden',
        background: '#050709',
      }}>
        {artUrl ? (
          <img
            src={artUrl}
            alt={def.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: isOwned ? 'saturate(1.1)' : 'grayscale(0.9) brightness(0.3)',
              transition: 'filter 0.3s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `radial-gradient(ellipse at center, ${catMeta.color}15 0%, transparent 70%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '32px', opacity: isOwned ? 0.5 : 0.15 }}>{catMeta.icon}</span>
          </div>
        )}

        {/* Owned corner badge */}
        {isOwned && (
          <div style={{
            position: 'absolute', top: '3px', right: '3px',
            fontSize: '6px', fontWeight: 900, padding: '1px 4px',
            background: 'rgba(0,0,0,0.7)', border: `1px solid ${frame.border}66`,
            borderRadius: '2px', color: frame.border, backdropFilter: 'blur(4px)',
          }}>
            ✦ OWNED
          </div>
        )}
      </div>

      {/* ─── TYPE Bar ─── */}
      <div style={{
        margin: '4px 0 3px',
        padding: '3px 6px',
        background: isOwned
          ? `linear-gradient(90deg, ${frame.border}15, transparent)`
          : 'rgba(255,255,255,0.02)',
        borderRadius: '3px',
        borderLeft: `2px solid ${isOwned ? frame.border : '#334155'}`,
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 900,
          color: isOwned ? '#e2e8f0' : '#475569',
          lineHeight: 1.2,
        }}>
          {def.name}
        </div>
      </div>

      {/* ─── Description Area ─── */}
      <div style={{
        padding: '4px 6px 2px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.015)',
        border: `1px solid ${isOwned ? `${frame.border}15` : 'rgba(255,255,255,0.03)'}`,
        minHeight: '42px',
      }}>
        {!hovered ? (
          <>
            <div style={{
              fontSize: '7.5px', color: '#94a3b8', lineHeight: 1.5,
            }}>
              {def.description}
            </div>
            <div style={{
              height: '1px', margin: '3px 0',
              background: `linear-gradient(90deg, transparent, ${isOwned ? frame.border : '#334155'}33, transparent)`,
            }} />
            {earned ? (
              <div style={{ fontSize: '7px', color: '#fbbf24' }}>
                ✦ {earned.playerName} · {formatTimestamp(earned.earnedAt)}
              </div>
            ) : def.firstOnly ? (
              <div style={{ fontSize: '7px', color: '#f59e0b', fontWeight: 700 }}>🔓 FIRST TO CLAIM</div>
            ) : def.weekly ? (
              <div style={{ fontSize: '7px', color: '#06b6d4', fontWeight: 700 }}>↻ WEEKLY</div>
            ) : (
              <div style={{ fontSize: '7px', color: '#334155' }}>—</div>
            )}
          </>
        ) : (
          <div style={{
            fontSize: '8px', color: '#cbd5e1', fontStyle: 'italic',
            textAlign: 'center', lineHeight: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '36px',
          }}>
            {def.flavorText}
          </div>
        )}
      </div>

      {/* ─── Bottom: Rarity badge + NFT status ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '3px 2px 0',
      }}>
        <span style={{
          fontSize: '6px', fontWeight: 900, letterSpacing: '0.5px',
          color: rarMeta.color, opacity: 0.7,
        }}>
          {rarMeta.label.toUpperCase()}
        </span>

        {/* Stats badge (like the 0/0 in the template) */}
        <div style={{
          fontSize: '7px', fontWeight: 900, padding: '1px 6px',
          background: isOwned ? `${frame.border}15` : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isOwned ? `${frame.border}44` : 'rgba(255,255,255,0.06)'}`,
          borderRadius: '3px',
          color: isOwned ? frame.border : '#334155',
        }}>
          {earned?.nft?.mintState === 'minted' ? '⛓ NFT' :
           earned?.nft?.mintState === 'pending' ? '⏳' :
           earned ? '◇ MINT' : '—'}
        </div>
      </div>

      {/* Shimmer overlay for legendary/epic */}
      {isOwned && (def.rarity === 'legendary' || def.rarity === 'epic') && (
        <div style={{
          position: 'absolute', top: 0, left: '-100%', right: 0, bottom: 0,
          width: '200%',
          background: `linear-gradient(105deg, transparent 45%, ${frame.border}0A 49%, ${frame.border}15 50%, ${frame.border}0A 51%, transparent 55%)`,
          animation: 'wc-shimmer 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

// ── Main Tab ──

export default function WarCardsTab() {
  const player = usePlayerStore()
  const cards = useWarCardsStore()
  const ui = useUIStore()
  const [subTab, setSubTab] = useState<SubTab>('collection')
  const [filterCat, setFilterCat] = useState<CardCategory | 'all'>('all')

  useEffect(() => {
    cards.fetchMyCards()
    cards.fetchAllCards()
  }, [])

  const myCards = cards.getPlayerCards(player.name)
  const hallOfFame = cards.getHallOfFame()
  const leaderboard = cards.getLeaderboard()
  const allDefs = cards.cardDefinitions

  const filteredDefs = filterCat === 'all' ? allDefs : allDefs.filter(d => d.category === filterCat)
  const sortedDefs = [...filteredDefs].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))

  const handleMint = async (earnedCardId: string) => {
    const result = await cards.requestMint(earnedCardId, 'polygon')
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'collection', label: '🃏 MY CARDS' },
    { id: 'available', label: '📖 ALL' },
    { id: 'hall', label: '🏛️ FAME' },
    { id: 'leaderboard', label: '📊 RANK' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

      {/* Header */}
      <div style={{
        textAlign: 'center', fontSize: '10px', fontWeight: 700, padding: '5px',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(168,85,247,0.06))',
        border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px',
        color: '#f59e0b', letterSpacing: '1px',
      }}>
        🃏 WAR CARDS — {myCards.length} / {allDefs.length}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '1px' }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: '4px 2px', fontSize: '7px', fontWeight: 700,
            border: `1px solid ${subTab === t.id ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.04)'}`,
            borderRadius: '3px',
            background: subTab === t.id ? 'rgba(245,158,11,0.06)' : 'transparent',
            color: subTab === t.id ? '#f59e0b' : '#475569', cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ====== COLLECTION ====== */}
      {subTab === 'collection' && (
        myCards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#334155' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.3 }}>🃏</div>
            <div style={{ fontSize: '10px' }}>No cards earned yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {myCards
              .sort((a, b) => {
                const da = cards.getCardDef(a.cardDefId), db = cards.getCardDef(b.cardDefId)
                if (!da || !db) return 0
                return RARITY_ORDER.indexOf(da.rarity) - RARITY_ORDER.indexOf(db.rarity)
              })
              .map(earned => {
                const def = cards.getCardDef(earned.cardDefId)
                if (!def) return null
                return (
                  <div key={earned.id}>
                    <WarCard def={def} earned={earned} />
                    {earned.nft.mintState === 'unminted' && (
                      <button
                        onClick={() => handleMint(earned.id)}
                        style={{
                          width: '100%', marginTop: '3px', padding: '4px', fontSize: '7px', fontWeight: 700,
                          background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                          borderRadius: '3px', color: '#a855f7', cursor: 'pointer', letterSpacing: '0.5px',
                        }}
                      >
                        ⛓ MINT AS NFT
                      </button>
                    )}
                  </div>
                )
              })}
          </div>
        )
      )}

      {/* ====== ALL CARDS ====== */}
      {subTab === 'available' && (
        <>
          <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterCat('all')}
              style={{
                fontSize: '7px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px', cursor: 'pointer',
                background: filterCat === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: `1px solid ${filterCat === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                color: filterCat === 'all' ? '#e2e8f0' : '#475569',
              }}
            >ALL</button>
            {(Object.keys(CARD_CATEGORY_META) as CardCategory[]).map(cat => {
              const meta = CARD_CATEGORY_META[cat]
              return (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{
                  fontSize: '7px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px', cursor: 'pointer',
                  background: filterCat === cat ? `${meta.color}11` : 'transparent',
                  border: `1px solid ${filterCat === cat ? `${meta.color}44` : 'rgba(255,255,255,0.05)'}`,
                  color: filterCat === cat ? meta.color : '#475569',
                }}>{meta.icon} {meta.label.toUpperCase()}</button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {sortedDefs.map(def => {
              const earned = myCards.find(e => e.cardDefId === def.id)
              const claimedBy = cards.earnedCards.find(e => e.cardDefId === def.id)
              return (
                <div key={def.id}>
                  <WarCard def={def} earned={earned} />
                  {!earned && claimedBy && def.firstOnly && (
                    <div style={{ fontSize: '6px', color: '#ef4444', marginTop: '1px', textAlign: 'center' }}>
                      ✗ {claimedBy.playerName}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ====== HALL OF FAME ====== */}
      {subTab === 'hall' && (
        <div className="hud-card">
          <div className="hud-card__title" style={{ fontSize: '10px' }}>🏛️ HALL OF FAME</div>
          {hallOfFame.length === 0 ? (
            <p style={{ fontSize: '9px', color: '#475569', marginTop: '6px' }}>No cards earned yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
              {hallOfFame.slice(0, 50).map(earned => {
                const def = cards.getCardDef(earned.cardDefId)
                if (!def) return null
                const catMeta = CARD_CATEGORY_META[def.category]
                const rarMeta = CARD_RARITY_META[def.rarity]
                return (
                  <div key={earned.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px',
                    borderLeft: `2px solid ${catMeta.color}`,
                  }}>
                    <div>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: rarMeta.color }}>{def.name}</span>
                      <span style={{ fontSize: '7px', color: '#64748b', marginLeft: '4px' }}>{earned.playerName}</span>
                    </div>
                    <span style={{ fontSize: '7px', color: '#475569' }}>{formatTimestamp(earned.earnedAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ====== LEADERBOARD ====== */}
      {subTab === 'leaderboard' && (
        <div className="hud-card">
          <div className="hud-card__title" style={{ fontSize: '10px' }}>📊 COLLECTORS</div>
          {leaderboard.length === 0 ? (
            <p style={{ fontSize: '9px', color: '#475569', marginTop: '6px' }}>No cards earned yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
              {leaderboard.map((entry, i) => {
                const rc = ['#fbbf24', '#c0c0c0', '#cd7f32']
                return (
                  <div key={entry.playerId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 6px',
                    background: entry.playerId === player.name ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.02)',
                    borderRadius: '2px', borderLeft: `2px solid ${rc[i] || '#334155'}`,
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: rc[i] || '#94a3b8', marginRight: '4px' }}>#{i + 1}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600 }}>{entry.playerName}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700 }}>{entry.count} 🃏</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes wc-shimmer {
          0%, 100% { transform: translateX(-25%); }
          50% { transform: translateX(25%); }
        }
      `}</style>
    </div>
  )
}
