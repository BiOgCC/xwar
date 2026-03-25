import { useState } from 'react'
import { useBattleStore, getCountryName } from '../../../stores/battleStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import CountryFlag from '../../shared/CountryFlag'
import type { Battle } from '../../../types/battle.types'
import '../../../styles/battles.css'

type SubTab = 'active' | 'history' | 'contracts'
type Filter = 'all' | 'tournament' | 'your_country' | 'allies' | 'enemies' | 'favorites' | 'with_bounty'

interface Props {
  onSelectBattle: (battleId: string) => void
}

export default function BattleListView({ onSelectBattle }: Props) {
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const iso = player.countryCode || 'US'
  const countries = useWorldStore(s => s.countries)
  const myCountry = countries.find(c => c.code === iso)
  const govStore = useGovernmentStore()

  const [subTab, setSubTab] = useState<SubTab>('active')
  const [filter, setFilter] = useState<Filter>('all')
  const [visibleCount, setVisibleCount] = useState(20)

  const allBattles = Object.values(battleStore.battles)
  const activeBattles = allBattles.filter(b => b.status === 'active')
  const pastBattles = allBattles.filter(b => b.status !== 'active')

  // Filter logic
  const filterBattles = (battles: Battle[]): Battle[] => {
    if (filter === 'all') return battles
    if (filter === 'your_country') return battles.filter(b => b.attackerId === iso || b.defenderId === iso)
    if (filter === 'allies') {
      if (!myCountry?.empire) return []
      return battles.filter(b => {
        const atk = countries.find(c => c.code === b.attackerId)
        const def = countries.find(c => c.code === b.defenderId)
        return (atk?.empire === myCountry.empire && b.attackerId !== iso) ||
               (def?.empire === myCountry.empire && b.defenderId !== iso)
      })
    }
    if (filter === 'enemies') {
      const wars = useWorldStore.getState().wars.filter(w => w.status === 'active')
      const enemyCodes = new Set<string>()
      wars.forEach(w => {
        if (w.attacker === iso) enemyCodes.add(w.defender)
        if (w.defender === iso) enemyCodes.add(w.attacker)
      })
      return battles.filter(b => enemyCodes.has(b.attackerId) || enemyCodes.has(b.defenderId))
    }
    if (filter === 'with_bounty') return battles.filter(b => (b.mercenaryContracts || []).some(c => c.remaining > 0))
    if (filter === 'tournament') return battles.filter(b => b.type === 'quick_battle')
    return battles
  }

  const filteredActive = filterBattles(activeBattles)
  const filteredPast = filterBattles(pastBattles)

  // Orders for display
  const activeOrders = activeBattles.filter(b => {
    const mySide: 'attacker' | 'defender' = iso === b.attackerId ? 'attacker' : 'defender'
    const order = mySide === 'attacker' ? b.attackerOrder : b.defenderOrder
    return order && order !== 'none'
  })

  const subTabs: { id: SubTab; icon: string; label: string }[] = [
    { id: 'active', icon: '⚔️', label: 'Active' },
    { id: 'history', icon: '📋', label: 'History' },
    { id: 'contracts', icon: '📄', label: 'Contracts' },
  ]

  const filters: { id: Filter; icon: string; label: string }[] = [
    { id: 'all', icon: '🔥', label: 'All' },
    { id: 'tournament', icon: '🏆', label: 'Tournament' },
    { id: 'your_country', icon: '🏳️', label: 'Your country' },
    { id: 'allies', icon: '🤝', label: 'Allies' },
    { id: 'enemies', icon: '💀', label: 'Enemies' },
    { id: 'with_bounty', icon: '💰', label: 'With bounty' },
  ]

  const fmtDmg = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000 ? `${(v / 1000).toFixed(1)}K`
    : v.toString()

  const renderBattleCard = (battle: Battle) => {
    const atkDmg = battle.attacker?.damageDealt || 0
    const defDmg = battle.defender?.damageDealt || 0
    const totalDmg = atkDmg + defDmg
    const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50

    const atkCountry = countries.find(c => c.code === battle.attackerId)
    const defCountry = countries.find(c => c.code === battle.defenderId)
    const atkClr = atkCountry?.color || '#3b82f6'
    const defClr = defCountry?.color || '#ef4444'

    const hasMerc = (battle.mercenaryContracts || []).some(c => c.remaining > 0)
    const activeRound = battle.rounds[battle.rounds.length - 1]
    const rdAtkPts = activeRound?.attackerPoints || 0
    const rdDefPts = activeRound?.defenderPoints || 0

    return (
      <div key={battle.id} className="btl-card" onClick={() => onSelectBattle(battle.id)}>
        {/* Type badge */}
        <div className="btl-card__type">
          {battle.type === 'quick_battle' ? '⚡QB' :
           battle.type === 'revolt' ? '✊REV' :
           battle.type === 'invasion' ? '⚔️' : '🎯'}
          {hasMerc && <span style={{ marginLeft: '2px', color: '#f59e0b' }}>💰</span>}
        </div>

        {/* Flags + Score */}
        <div className="btl-card__flags">
          <CountryFlag iso={battle.attackerId} size={18} />
          <span className="btl-card__score" style={{ color: atkClr }}>{battle.attackerRoundsWon}</span>
          <span className="btl-card__vs">vs</span>
          <span className="btl-card__score" style={{ color: defClr }}>{battle.defenderRoundsWon}</span>
          <CountryFlag iso={battle.defenderId} size={18} />
        </div>

        {/* Region */}
        <div className="btl-card__region">{battle.regionName}</div>

        {/* Ground points */}
        {battle.status === 'active' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 700, marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: atkClr }}>⛰ {rdAtkPts}</span>
            <span style={{ color: defClr }}>{rdDefPts} ⛰</span>
          </div>
        )}

        {/* Damage bar */}
        <div className="btl-card__dmg-bar">
          <div className="btl-card__dmg-fill" style={{ width: `${atkPct}%`, background: atkClr }} />
          <div className="btl-card__dmg-fill" style={{ width: `${100 - atkPct}%`, background: defClr }} />
        </div>

        {/* Damage totals */}
        <div className="btl-card__dmg-row">
          <span style={{ color: atkClr }}>⚔️ {fmtDmg(atkDmg)}</span>
          <span style={{ color: defClr }}>{fmtDmg(defDmg)} 🛡️</span>
        </div>

        {/* Activity indicator */}
        {battle.status === 'active' && (
          <div className="btl-card__activity">
            <span className="btl-card__activity-dot" />
            <span>R{battle.rounds.length}</span>
            {battle.rounds.length > 1 && (
              <span style={{ marginLeft: 'auto', color: '#3b82f6', fontWeight: 800 }}>
                {battle.rounds.filter(r => r.status === 'attacker_won').length}W
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="btl-list">
      {/* Sub-tabs */}
      <div className="btl-subtabs">
        {subTabs.map(t => (
          <button
            key={t.id}
            className={`btl-subtab ${subTab === t.id ? 'btl-subtab--active' : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            <span className="btl-subtab__icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Filter chips */}
      <div className="btl-filters">
        {filters.map(f => (
          <button
            key={f.id}
            className={`btl-chip ${filter === f.id ? 'btl-chip--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            <span className="btl-chip__icon">{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Active tab */}
      {subTab === 'active' && (
        <>
          {/* Orders section */}
          {activeOrders.length > 0 && (
            <div className="btl-orders">
              <div className="btl-orders__title">⚙ Orders</div>
              {activeOrders.map(b => {
                const mySide: 'attacker' | 'defender' = iso === b.attackerId ? 'attacker' : 'defender'
                const order = mySide === 'attacker' ? b.attackerOrder : b.defenderOrder
                return (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '3px 6px', fontSize: '8px', color: '#e2e8f0',
                    background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                    marginBottom: '2px',
                  }}>
                    <CountryFlag iso={b.attackerId} size={12} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                      {b.regionName}
                    </span>
                    <span style={{ fontWeight: 800, color: '#60a5fa', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                      {order?.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Battle grid */}
          <div className="btl-grid">
            {filteredActive.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px 10px', color: '#334155' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.3 }}>⚔️</div>
                <div style={{ fontSize: '10px' }}>No active battles matching filter.</div>
              </div>
            ) : (
              filteredActive.slice(0, visibleCount).map(renderBattleCard)
            )}
            {filteredActive.length > visibleCount && (
              <button className="btl-load-more" onClick={() => setVisibleCount(v => v + 20)}>
                Load more ({filteredActive.length - visibleCount} remaining)
              </button>
            )}
          </div>
        </>
      )}

      {/* History tab */}
      {subTab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px 0' }}>
          {filteredPast.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#334155', fontSize: '10px' }}>No battle history.</div>
          ) : (
            filteredPast.slice(-50).reverse().map(b => (
              <div key={b.id} className={`btl-history-row btl-history-row--${b.status}`} onClick={() => onSelectBattle(b.id)} style={{ cursor: 'pointer' }}>
                <CountryFlag iso={b.attackerId} size={14} />
                <span style={{ fontSize: '8px', color: '#64748b' }}>vs</span>
                <CountryFlag iso={b.defenderId} size={14} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.regionName}</span>
                <span className="btl-history-result" style={{ color: b.status === 'attacker_won' ? '#ef4444' : '#3b82f6' }}>
                  {b.status === 'attacker_won' ? '🏆 ATK' : '🛡️ DEF'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Contracts tab */}
      {subTab === 'contracts' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
          {(() => {
            const allContracts = allBattles.flatMap(b =>
              (b.mercenaryContracts || []).filter(c => c.remaining > 0).map(c => ({ ...c, battleId: b.id, regionName: b.regionName, attackerId: b.attackerId, defenderId: b.defenderId }))
            )
            if (allContracts.length === 0) return (
              <div style={{ textAlign: 'center', padding: '30px', color: '#334155', fontSize: '10px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.3 }}>💰</div>
                No active mercenary contracts.
              </div>
            )
            return allContracts.map(c => {
              const pct = Math.round((c.remaining / c.totalPool) * 100)
              return (
                <div key={c.id} onClick={() => onSelectBattle(c.battleId)} style={{
                  padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
                  background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(245,158,11,0.06)', transition: 'width 0.5s' }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <CountryFlag iso={c.attackerId} size={12} />
                      <span style={{ fontSize: '8px', color: '#94a3b8', flex: 1 }}>{c.regionName}</span>
                      <span style={{ fontSize: '7px', fontWeight: 800, color: c.side === 'attacker' ? '#ef4444' : '#3b82f6' }}>
                        {c.side === 'attacker' ? '⚔️ ATK' : '🛡️ DEF'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '10px', fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                        {c.ratePerDamage.toLocaleString()}/1K
                      </span>
                      <span style={{ fontSize: '8px', color: pct > 30 ? '#94a3b8' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                        {c.remaining.toLocaleString()} left ({pct}%)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
