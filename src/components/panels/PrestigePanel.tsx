import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import {
  usePrestigeStore,
  MILITARY_TITLES,
  ECONOMIC_TITLES,
  type PrestigeCategory,
} from '../../stores/prestigeStore'

type PrestigeTab = 'rankings' | 'prestige' | 'market' | 'archive'

export default function PrestigePanel() {
  const player = usePlayerStore()
  const prestige = usePrestigeStore()
  const ui = useUIStore()
  const [tab, setTab] = useState<PrestigeTab>('rankings')
  const [listPrice, setListPrice] = useState(1000)
  const [archiveWeek, setArchiveWeek] = useState(prestige.currentWeek - 1)

  const myPrestige = prestige.getPlayerPrestige(player.name)
  const myTitle = prestige.getPlayerTitle(player.name)
  const myItems = prestige.items.filter(i => i.craftedBy === player.name)

  const tabs: { id: PrestigeTab; label: string; icon: string }[] = [
    { id: 'rankings', label: 'RANKINGS', icon: '🏆' },
    { id: 'prestige', label: 'STATUS', icon: '⭐' },
    { id: 'market', label: 'MARKET', icon: '🛒' },
    { id: 'archive', label: 'ARCHIVE', icon: '📜' },
  ]

  const milRankings = prestige.rankings.filter(r => r.category === 'military').sort((a, b) => a.rankPosition - b.rankPosition)
  const ecoRankings = prestige.rankings.filter(r => r.category === 'economic').sort((a, b) => a.rankPosition - b.rankPosition)

  const handleCreateBlueprint = () => {
    const result = prestige.createBlueprint(player.name, player.name)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const handleCraft = (bpId: string) => {
    const result = prestige.craftItem(bpId, player.name, player.name)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const handleList = (bpId: string) => {
    prestige.listBlueprintOnMarket(bpId, listPrice)
    ui.addFloatingText('LISTED ON MARKET', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  const handleBuy = (bpId: string) => {
    const result = prestige.buyBlueprint(bpId, player.name)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const rankColors = ['#fbbf24', '#c0c0c0', '#cd7f32', '#38bdf8', '#a78bfa']

  const ss: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Week Header */}
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#f59e0b', fontWeight: 700, padding: '6px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
        ⭐ SERVER WEEK {prestige.currentWeek} — PRESTIGE SEASON
      </div>

      {/* Player Title Badge */}
      {myTitle && (
        <div style={{ textAlign: 'center', padding: '8px', background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(167,139,250,0.15))', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px' }}>
          <div style={{ fontSize: '9px', color: '#fbbf24', fontWeight: 700, letterSpacing: '1px' }}>YOUR TITLE</div>
          <div style={{ fontSize: '14px', fontWeight: 900, color: '#fff' }}>{myTitle}</div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '6px 2px', fontSize: '9px', fontWeight: 700,
            border: `1px solid ${tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '3px', background: tab === t.id ? 'rgba(251,191,36,0.1)' : 'transparent',
            color: tab === t.id ? '#fbbf24' : '#94a3b8', cursor: 'pointer',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ====== RANKINGS TAB ====== */}
      {tab === 'rankings' && (
        <>
          {/* Military Rankings */}
          <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <div className="hud-card__title" style={{ color: '#ef4444' }}>⚔️ MILITARY PRESTIGE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
              {milRankings.map((r, i) => (
                <div key={r.rankingId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', background: r.playerName === player.name ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '3px', borderLeft: `3px solid ${rankColors[i] || '#555'}`,
                }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: rankColors[i] || '#fff', marginRight: '6px' }}>#{r.rankPosition}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.playerName}</span>
                    <span style={{ fontSize: '9px', color: '#f59e0b', marginLeft: '6px' }}>{r.title}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>{r.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Economic Rankings */}
          <div className="hud-card" style={{ borderColor: 'rgba(34,211,138,0.2)' }}>
            <div className="hud-card__title" style={{ color: '#22d38a' }}>💰 ECONOMIC PRESTIGE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
              {ecoRankings.map((r, i) => (
                <div key={r.rankingId} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', background: r.playerName === player.name ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '3px', borderLeft: `3px solid ${rankColors[i] || '#555'}`,
                }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: rankColors[i] || '#fff', marginRight: '6px' }}>#{r.rankPosition}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.playerName}</span>
                    <span style={{ fontSize: '9px', color: '#f59e0b', marginLeft: '6px' }}>{r.title}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#22d38a', fontWeight: 700 }}>{r.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score Formula */}
          <div className="hud-card">
            <div className="hud-card__title">📐 SCORE FORMULA</div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.6 }}>
              <div><b style={{ color: '#ef4444' }}>Military:</b> damage×1.0 + captures×1.5 + bunker×1.2 + enemy×1.3</div>
              <div><b style={{ color: '#22d38a' }}>Economic:</b> resources×1.0 + prospect×1.4 + industry×1.4 + PP×1.2</div>
            </div>
          </div>
        </>
      )}

      {/* ====== PRESTIGE STATUS TAB ====== */}
      {tab === 'prestige' && (
        <>
          {/* Current Status */}
          <div className="hud-card" style={{ borderColor: myPrestige ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)' }}>
            <div className="hud-card__title">{myPrestige ? '⭐ PRESTIGE ACTIVE' : '🔒 NO PRESTIGE'}</div>
            {myPrestige ? (
              <div style={{ marginTop: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24' }}>{myPrestige.title}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  Category: {myPrestige.category.toUpperCase()} · Week {myPrestige.weekNumber}
                </div>
                <div style={{ fontSize: '10px', color: myPrestige.blueprintCreated ? '#22d38a' : '#f59e0b', marginTop: '4px' }}>
                  {myPrestige.blueprintCreated ? '✓ Blueprint created this week' : '⚡ Blueprint available — create one!'}
                </div>
                {!myPrestige.blueprintCreated && (
                  <button className="hud-btn-primary" onClick={handleCreateBlueprint} style={{ marginTop: '8px', width: '100%', padding: '10px', fontSize: '12px', fontWeight: 900, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    ⭐ CREATE PRESTIGE BLUEPRINT
                  </button>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                Reach Top 5 in Military or Economic rankings to earn Prestige status.
              </p>
            )}
          </div>

          {/* My Prestige Items */}
          <div className="hud-card">
            <div className="hud-card__title">🏛️ MY PRESTIGE ITEMS ({myItems.length})</div>
            {myItems.length === 0 ? (
              <p style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>Craft a prestige blueprint to get an eternal item.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {myItems.map(item => (
                  <div key={item.itemId} style={{
                    padding: '8px', borderRadius: '4px',
                    background: item.equipped ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.equipped ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>{item.itemName}</span>
                      <span style={{ fontSize: '8px', color: '#22d38a' }}>∞ DURABILITY</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                      {item.itemType} · {item.category} · Week {item.serverWeek}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                      Invented by: {item.inventedByName}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {Object.entries(item.bonusStats).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '2px', color: '#22d38a' }}>
                          +{v}{typeof v === 'number' && v < 50 && k.includes('damage') ? '%' : ''} {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <button
                      className="hud-btn-outline"
                      onClick={() => item.equipped ? prestige.unequipPrestigeItem(item.itemId) : prestige.equipPrestigeItem(item.itemId)}
                      style={{ marginTop: '6px', fontSize: '9px', padding: '3px 8px', borderColor: item.equipped ? '#ef4444' : '#fbbf24', color: item.equipped ? '#ef4444' : '#fbbf24' }}
                    >
                      {item.equipped ? 'UNEQUIP' : 'EQUIP'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Craft From Blueprint */}
          {prestige.blueprints.filter(b => b.creatorPlayerId === player.name).length > 0 && (
            <div className="hud-card" style={{ borderColor: 'rgba(251,191,36,0.3)' }}>
              <div className="hud-card__title" style={{ color: '#fbbf24' }}>🔨 CRAFT FROM BLUEPRINT</div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>Single-use prestige blueprints. Crafting destroys the blueprint and creates an eternal item.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {prestige.blueprints.filter(b => b.creatorPlayerId === player.name).map(bp => (
                  <div key={bp.blueprintId} style={{
                    padding: '8px', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>{bp.itemName}</span>
                      <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 700 }}>SINGLE USE</span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{bp.itemType} · {bp.category} · Week {bp.weekNumber}</div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', margin: '4px 0' }}>
                      {Object.entries(bp.bonusStats).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '2px', color: '#22d38a' }}>
                          +{v} {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                    <button
                      className="hud-btn-primary"
                      onClick={() => handleCraft(bp.blueprintId)}
                      style={{ width: '100%', padding: '6px', fontWeight: 900, fontSize: '11px', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                      ⭐ CRAFT PRESTIGE ITEM
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Prestige Players */}
          <div className="hud-card">
            <div className="hud-card__title">👑 WEEK {prestige.currentWeek} PRESTIGE PLAYERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
              {prestige.prestigePlayers
                .filter(p => p.weekNumber === prestige.currentWeek)
                .sort((a, b) => a.category.localeCompare(b.category))
                .map(pp => (
                <div key={pp.prestigeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>{pp.playerName}</span>
                    <span style={{ fontSize: '8px', color: '#f59e0b', marginLeft: '6px' }}>{pp.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '8px', color: pp.category === 'military' ? '#ef4444' : '#22d38a', textTransform: 'uppercase', fontWeight: 700 }}>{pp.category}</span>
                    {pp.blueprintCreated && <span style={{ fontSize: '8px', color: '#22d38a' }}>📋✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ====== MARKET TAB ====== */}
      {tab === 'market' && (
        <>
          {/* My Blueprints */}
          {prestige.blueprints.filter(b => b.creatorPlayerId === player.name).length > 0 && (
            <div className="hud-card">
              <div className="hud-card__title">📋 MY BLUEPRINTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {prestige.blueprints.filter(b => b.creatorPlayerId === player.name).map(bp => (
                  <div key={bp.blueprintId} style={{ padding: '8px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>{bp.itemName}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{bp.itemType} · {bp.category} · Single Use</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '4px 0' }}>
                      {Object.entries(bp.bonusStats).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(34,211,138,0.1)', borderRadius: '2px', color: '#22d38a' }}>+{v} {k.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="hud-btn-primary" onClick={() => handleCraft(bp.blueprintId)} style={{ fontSize: '9px', padding: '4px 8px' }}>CRAFT ITEM</button>
                      {!bp.listedOnMarket && (
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                          <input type="number" value={listPrice} onChange={(e) => setListPrice(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...ss, width: '60px', padding: '4px' }} />
                          <button className="hud-btn-outline" onClick={() => handleList(bp.blueprintId)} style={{ fontSize: '9px', padding: '4px 8px', borderColor: '#f59e0b', color: '#f59e0b' }}>LIST</button>
                        </div>
                      )}
                      {bp.listedOnMarket && <span style={{ fontSize: '9px', color: '#22d38a', alignSelf: 'center' }}>ON MARKET ${bp.marketPrice}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Listings */}
          <div className="hud-card">
            <div className="hud-card__title">🛒 PRESTIGE BLUEPRINT MARKET</div>
            {(() => {
              const listings = prestige.blueprints.filter(b => b.listedOnMarket && b.creatorPlayerId !== player.name)
              return listings.length === 0 ? (
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>No blueprints listed. Prestige players can create and sell them.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {listings.map(bp => (
                    <div key={bp.blueprintId} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>{bp.itemName}</span>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: '#22d38a' }}>${bp.marketPrice.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                        {bp.itemType} · {bp.category} · By: {bp.creatorPlayerName} · Week {bp.weekNumber} · SINGLE USE
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '6px 0' }}>
                        {Object.entries(bp.bonusStats).map(([k, v]) => (
                          <span key={k} style={{ fontSize: '8px', padding: '2px 5px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.2)', borderRadius: '2px', color: '#22d38a' }}>+{v} {k.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                      <button className="hud-btn-primary" onClick={() => handleBuy(bp.blueprintId)} style={{ fontSize: '10px', padding: '6px 12px', fontWeight: 700 }}>
                        BUY BLUEPRINT
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* ====== ARCHIVE TAB ====== */}
      {tab === 'archive' && (
        <>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button className="hud-btn-outline" onClick={() => setArchiveWeek(Math.max(1, archiveWeek - 1))} style={{ fontSize: '10px', padding: '4px 8px' }}>◀</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>
              WEEK {archiveWeek}
            </div>
            <button className="hud-btn-outline" onClick={() => setArchiveWeek(Math.min(prestige.currentWeek, archiveWeek + 1))} style={{ fontSize: '10px', padding: '4px 8px' }}>▶</button>
          </div>

          {(() => {
            const weekEntries = prestige.archive.filter(a => a.weekNumber === archiveWeek)
            const milEntries = weekEntries.filter(a => a.category === 'military').sort((a, b) => a.rankPosition - b.rankPosition)
            const ecoEntries = weekEntries.filter(a => a.category === 'economic').sort((a, b) => a.rankPosition - b.rankPosition)

            if (weekEntries.length === 0) {
              return <p style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '12px' }}>No archive data for this week.</p>
            }

            return (
              <>
                <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                  <div className="hud-card__title" style={{ color: '#ef4444' }}>⚔️ MILITARY PRESTIGE — WEEK {archiveWeek}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                    {milEntries.map((e, i) => (
                      <div key={e.archiveId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: `3px solid ${rankColors[i] || '#555'}` }}>
                        <div>
                          <span style={{ fontWeight: 900, color: rankColors[i], marginRight: '6px', fontSize: '11px' }}>#{e.rankPosition}</span>
                          <span style={{ fontSize: '10px' }}>{e.playerName}</span>
                          <span style={{ fontSize: '8px', color: '#f59e0b', marginLeft: '4px' }}>{e.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {e.itemCreated && <span style={{ fontSize: '8px', color: '#22d38a' }}>📋</span>}
                          <span style={{ fontSize: '9px', color: '#ef4444' }}>{e.score.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hud-card" style={{ borderColor: 'rgba(34,211,138,0.2)' }}>
                  <div className="hud-card__title" style={{ color: '#22d38a' }}>💰 ECONOMIC PRESTIGE — WEEK {archiveWeek}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                    {ecoEntries.map((e, i) => (
                      <div key={e.archiveId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: `3px solid ${rankColors[i] || '#555'}` }}>
                        <div>
                          <span style={{ fontWeight: 900, color: rankColors[i], marginRight: '6px', fontSize: '11px' }}>#{e.rankPosition}</span>
                          <span style={{ fontSize: '10px' }}>{e.playerName}</span>
                          <span style={{ fontSize: '8px', color: '#f59e0b', marginLeft: '4px' }}>{e.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {e.itemCreated && <span style={{ fontSize: '8px', color: '#22d38a' }}>📋</span>}
                          <span style={{ fontSize: '9px', color: '#22d38a' }}>{e.score.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
