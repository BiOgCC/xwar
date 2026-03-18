import React, { useState, Suspense, useMemo } from 'react'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { useArmyStore, DIVISION_TEMPLATES, getDivisionEquipBonus, WEAPON_DIVISION_MAP, type DivisionType, type MilitaryRankType } from '../../stores/armyStore'
import { useGovernmentStore, type DivisionListing, type MilitaryContract } from '../../stores/governmentStore'
import { useBattleStore, getCountryFlag, getCountryName, getBaseSkillStats, TACTICAL_ORDERS } from '../../stores/battleStore'
import type { TacticalOrder } from '../../stores/battleStore'
import { usePlayerStore, getMilitaryRank } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import { useInventoryStore, type WeaponSubtype } from '../../stores/inventoryStore'
import OccupationPanel from './OccupationPanel'
import '../../styles/war.css'
import { playHitSound, playCritSound } from '../../hooks/useCombatSounds'

// Animated number display component (usable in loops unlike hooks)
function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const display = useAnimatedNumber(value, duration)
  return <>{display.toLocaleString()}</>
}

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

// Shared time helpers
const fmtElapsed = (startedAt: number) => {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}
const fmtTicks = (ticks: number) => {
  const s = Math.max(0, ticks * 15)
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

type WarTab = 'overview' | 'recruit' | 'armies' | 'battles'
export default function WarPanel({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const [tab, setTab] = useState<WarTab>('overview')
  const [editingMotd, setEditingMotd] = useState(false)
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const iso = player.countryCode || 'US'

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const govStore = useGovernmentStore()
  const gov = govStore.governments[iso]
  const shopCount = gov?.divisionShop?.length || 0
  const claimableContracts = govStore.militaryContracts.filter(c => c.playerId === player.name && c.status === 'claimable').length
  const recruitBadge = shopCount + claimableContracts || undefined

  const tabs: { id: WarTab; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'HQ', icon: '📊' },
    { id: 'recruit', label: 'RECRUIT', icon: '🏭', count: recruitBadge },
    { id: 'armies', label: 'FORCES', icon: '⚔️', count: myDivisions.length },
    { id: 'battles', label: 'COMBAT', icon: '💥', count: activeBattles.length },
  ]

  return (
    <div className="war-panel">
      {/* Message of the Day — global, above tabs */}
      <div className="war-motd" style={{ padding: '6px 10px', marginBottom: '6px', background: 'rgba(132, 204, 22, 0.08)', borderRadius: '4px', border: '1px solid rgba(132, 204, 22, 0.2)', boxShadow: 'inset 0 0 10px rgba(132, 204, 22, 0.05)' }}>
        {editingMotd ? (
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <input
              type="text" placeholder="COMMANDER MESSAGE OF THE DAY..." maxLength={200}
              value={battleStore.warMotd || ''} autoFocus
              onChange={(e) => battleStore.setWarMotd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingMotd(false) }}
              style={{
                flex: 1, padding: '3px 6px', fontSize: '8px',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '3px', color: '#e2e8f0', outline: 'none',
              }}
            />
            <button
              onClick={() => setEditingMotd(false)}
              style={{
                padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px', fontWeight: 700,
              }}
            >✅</button>
          </div>
        ) : battleStore.warMotd ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setEditingMotd(true)}>
            <div style={{
              flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#84cc16',
              padding: '4px 8px', background: 'rgba(132, 204, 22, 0.05)', borderRadius: '2px',
              borderLeft: '2px solid #84cc16',
            }}>
              {battleStore.warMotd}
            </div>
            <span style={{ fontSize: '8px', color: '#475569' }}>✏️</span>
          </div>
        ) : (
          <button
            onClick={() => setEditingMotd(true)}
            style={{
              width: '100%', padding: '4px 6px', border: '1px dashed rgba(132, 204, 22, 0.3)',
              borderRadius: '2px', cursor: 'pointer', background: 'transparent',
              fontSize: '8px', color: '#84cc16', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: 600
            }}
          >SET MESSAGE OF THE DAY</button>
        )}
      </div>
      <div className="war-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`war-tab ${tab === t.id ? 'war-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="war-tab__icon">{t.icon}</span>
            <span className="war-tab__label">{t.label}</span>
            {t.count !== undefined && <span className="war-tab__badge">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="war-content">
        {tab === 'overview' && <OverviewTab iso={iso} />}
        {tab === 'recruit' && <RecruitTab />}
        {tab === 'armies' && <ForcesTab iso={iso} />}
        {tab === 'battles' && <CombatTab panelFullscreen={panelFullscreen} setPanelFullscreen={setPanelFullscreen} />}
      </div>
    </div>
  )
}

// ====== HQ TAB — Dashboard ======

function OverviewTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const ui = useUIStore()

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const totalManpower = myDivisions.reduce((s, d) => s + d.manpower, 0)
  const readyDivs = myDivisions.filter(d => d.status === 'ready').length
  const trainingDivs = myDivisions.filter(d => d.status === 'training').length
  const inCombatDivs = myDivisions.filter(d => d.status === 'in_combat').length

  const popCap = armyStore.getPlayerPopCap()
  const popPct = popCap.max > 0 ? (popCap.used / popCap.max) * 100 : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 60 ? '#f59e0b' : '#22d38a'

  // --- ARMY INTELLIGENCE METRICS ---
  // 1. Elite Forces (Star breakdown)
  const starsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  myDivisions.forEach(d => { starsCount[d.starQuality as keyof typeof starsCount]++ })

  // 2. Combat Power (DPT & HP of ready/training divs)
  let totalDpt = 0
  let totalHp = 0
  myDivisions.forEach(d => {
    if (d.status === 'ready' || d.status === 'training' || d.status === 'in_combat') {
      const t = armyStore.divisions[d.id] ? DIVISION_TEMPLATES?.[d.type] : null
      if (t) {
        const effAtk = t.atkDmgMult * (1 + parseFloat(String(d.statModifiers?.atkDmgMult || 0)))
        const effSpeed = (t.attackSpeed || 1.0) * (1 + parseFloat(String(d.statModifiers?.attackSpeed || 0)))
        const baseAtk = 100 // estimate
        const dpt = Math.floor((baseAtk + t.manpowerCost * 3) * effAtk * (1 / Math.max(0.2, effSpeed)))
        totalDpt += dpt
        totalHp += d.maxHealth
      }
    }
  })

  // 3. Hall of Fame (Top division by kills)
  let topDiv = myDivisions[0]
  myDivisions.forEach(d => { if (d.killCount > (topDiv?.killCount || 0)) topDiv = d })

  // 4. Composition (Land/Air/Naval)
  const comp = { land: 0, air: 0, naval: 0, total: myDivisions.length }
  myDivisions.forEach(d => { if (d.category in comp) comp[d.category as keyof typeof comp]++ })

  // 5. Equipment Status (Geared vs Ungeared)
  const fullyGeared = myDivisions.filter(d => d.equipment?.length === 3).length
  const someGear = myDivisions.filter(d => (d.equipment?.length || 0) > 0 && (d.equipment?.length || 0) < 3).length
  const noGear = myDivisions.filter(d => !d.equipment || d.equipment.length === 0).length

  // 6. Experience (Average level)
  const avgExp = myDivisions.length > 0 ? Math.floor(myDivisions.reduce((s, d) => s + (d.experience || 0), 0) / myDivisions.length) : 0
  const avgLevel = Math.floor(avgExp / 10) + 1

  return (
    <div className="war-overview">
      {/* Compact Stats Row */}
      <div className="war-card war-card--highlight">
        <div className="war-card__title">🎖️ MILITARY OVERVIEW — {getCountryName(iso)}</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
          {[
            { label: 'DIVS', value: myDivisions.length, color: '#e2e8f0' },
            { label: 'TROOPS', value: totalManpower.toLocaleString(), color: '#e2e8f0' },
            { label: 'READY', value: readyDivs, color: '#22d38a' },
            { label: 'TRAINING', value: trainingDivs, color: '#f59e0b' },
            { label: 'COMBAT', value: inCombatDivs, color: '#84cc16' },
            { label: 'BATTLES', value: activeBattles.length, color: '#84cc16' },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 60px', textAlign: 'center', padding: '4px 2px',
              background: 'rgba(255,255,255,0.03)', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Pop Cap Bar */}
        <div style={{ marginTop: '6px', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 800, marginBottom: '2px' }}>
            <span style={{ color: '#94a3b8' }}>🏠 POP CAP</span>
            <span style={{ color: popColor }}>{popCap.used} / {popCap.max}</span>
          </div>
          <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, popPct)}%`, background: popColor, borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* --- ARMY INTELLIGENCE --- */}
      <div className="war-card">
        <div className="war-card__title">🧠 ARMY INTELLIGENCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '6px' }}>
          
          {/* 1. Elite Forces */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>ELITE FORCES</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: '#f59e0b' }}>5★: {starsCount[5]}</span>
              <span style={{ color: '#a855f7' }}>4★: {starsCount[4]}</span>
              <span style={{ color: '#3b82f6' }}>3★: {starsCount[3]}</span>
            </div>
          </div>

          {/* 2. Combat Power */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>ESTIMATED POWER</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: '#ef4444' }}>⚔️ {totalDpt.toLocaleString()} DPT</span>
              <span style={{ color: '#22d38a' }}>🛡️ {totalHp.toLocaleString()} HP</span>
            </div>
          </div>

          {/* 3. Hall of Fame */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>TOP DIVISION</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topDiv ? `${topDiv.name}` : 'No divisions yet'}
            </div>
            <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 700 }}>
              {topDiv ? `💀 ${topDiv.killCount} Kills` : '-'}
            </div>
          </div>

          {/* 4. Composition */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>COMPOSITION</div>
            <div style={{ display: 'flex', width: '100%', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '2px' }}>
              <div style={{ width: `${comp.total ? (comp.land / comp.total)*100 : 0}%`, background: '#84cc16' }} />
              <div style={{ width: `${comp.total ? (comp.air / comp.total)*100 : 0}%`, background: '#0ea5e9' }} />
              <div style={{ width: `${comp.total ? (comp.naval / comp.total)*100 : 0}%`, background: '#3b82f6' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#cbd5e1' }}>
              <span>🌲 {comp.land}</span><span>✈️ {comp.air}</span><span>🚢 {comp.naval}</span>
            </div>
          </div>

          {/* 5. Equipment */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>EQUIPMENT STATUS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: fullyGeared > 0 ? '#22d38a' : '#64748b' }}>Full: {fullyGeared}</span>
              <span style={{ color: someGear > 0 ? '#f59e0b' : '#64748b' }}>Partial: {someGear}</span>
              <span style={{ color: noGear > 0 ? '#ef4444' : '#64748b' }}>Empty: {noGear}</span>
            </div>
          </div>

          {/* 6. Experience */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>ARMY VETERANCY</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0' }}>Level {avgLevel}</div>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '2px' }}>
              <div style={{ width: `${avgExp % 10}0%`, height: '100%', background: '#22d38a' }} />
            </div>
          </div>

        </div>
      </div>

      {/* Active Battles — Compact cards */}
      {activeBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">💥 ACTIVE BATTLES ({activeBattles.length})</div>
          {activeBattles.map(battle => {
            const atkDmg = battle.attacker?.damageDealt || 0
            const defDmg = battle.defender?.damageDealt || 0
            const totalDmg = atkDmg + defDmg
            const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
            const activeRound = battle.rounds[battle.rounds.length - 1]

            return (
              <div key={battle.id} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(239,68,68,0.05)', borderRadius: '5px',
                border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: '#e2e8f0', marginBottom: '3px' }}>
                  <span>{getCountryFlag(battle.attackerId)} {getCountryName(battle.attackerId)}</span>
                  <span style={{ color: '#64748b', fontSize: '8px' }}>{fmtElapsed(battle.startedAt)} • R{battle.rounds.length}/3</span>
                  <span>{getCountryName(battle.defenderId)} {getCountryFlag(battle.defenderId)}</span>
                </div>
                {/* Compact damage bar */}
                <div style={{ position: 'relative', height: '14px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: '#22d38a', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: '#ef4444', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#fff', transform: 'translateX(-1px)', zIndex: 2, opacity: 0.5 }} />
                  <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
                </div>
                {activeRound && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ color: '#22d38a' }}>{activeRound.attackerPoints} pts</span>
                    <span>600 to win</span>
                    <span style={{ color: '#ef4444' }}>{activeRound.defenderPoints} pts</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeBattles.length === 0 && (
        <div className="war-card">
          <div className="war-empty">No active battles. Peace reigns... for now.</div>
        </div>
      )}
    </div>
  )
}

// ====== RECRUIT TAB ======

function RecruitTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const [feedback, setFeedback] = useState('')
  const [showContractModal, setShowContractModal] = useState(false)
  const [contractAmount, setContractAmount] = useState(100000)
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set())
  const [filterStars, setFilterStars] = useState<Set<number>>(new Set())
  const [sortPrice, setSortPrice] = useState<0 | 1 | 2>(0) // 0=none, 1=high→low, 2=low→high
  const [searchName, setSearchName] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [contractsCollapsed, setContractsCollapsed] = useState(false)

  const countryCode = player.countryCode || 'US'
  const gov = govStore.governments[countryCode]
  const shopListings = gov?.divisionShop || []
  const shopQuotas = govStore.getShopQuota(countryCode)
  const dismissalsLeft = govStore.getDismissalsLeft(player.name)
  const myContracts = govStore.militaryContracts.filter(c => c.playerId === player.name && c.status !== 'claimed')

  const handleBuy = (listingId: string) => {
    const result = govStore.buyFromShop(countryCode, listingId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleDismiss = (listingId: string) => {
    const result = govStore.dismissListing(countryCode, listingId, player.name)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleReroll = (listingId: string) => {
    const result = govStore.rerollListing(countryCode, listingId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCreateContract = () => {
    const result = govStore.createContract(countryCode, contractAmount)
    setFeedback(result.message)
    if (result.success) setShowContractModal(false)
    setTimeout(() => setFeedback(''), 4000)
  }

  const handleClaimContract = (contractId: string) => {
    const result = govStore.claimContract(contractId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const starColor = (star: number) => {
    if (star >= 5) return '#f59e0b'
    if (star >= 4) return '#a855f7'
    if (star >= 3) return '#3b82f6'
    if (star >= 2) return '#94a3b8'
    return '#64748b'
  }

  const projectedPayout = Math.floor(contractAmount * 1.11)
  const projectedProfit = projectedPayout - contractAmount

  return (
    <div className="war-recruit">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Not enough') || feedback.includes('Minimum') || feedback.includes('Maximum') || feedback.includes('expired') || feedback.includes('not found') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* ====== MAKE A CONTRACT BUTTON ====== */}
      <button
        onClick={() => setShowContractModal(true)}
        style={{
          width: '20%', margin: '0 auto 8px', padding: '10px 16px',
          background: 'linear-gradient(135deg, rgba(34,211,138,0.2), rgba(16,185,129,0.15))',
          border: '1px solid rgba(34,211,138,0.4)', borderRadius: '6px',
          color: '#22d38a', fontWeight: 700, fontSize: '13px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.2s', letterSpacing: '0.5px', fontFamily: 'var(--font-display)',
        }}
      >
        💸 MAKE A CONTRACT
      </button>

      {/* ====== CONTRACT MODAL ====== */}
      {showContractModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '380px', background: '#1a1f2e', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '10px', padding: '20px', position: 'relative' }}>
            <button onClick={() => setShowContractModal(false)} style={{ position: 'absolute', top: '10px', right: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '16px', cursor: 'pointer' }}>✕</button>

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#22d38a', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
              💸 MILITARY CONTRACT
            </div>

            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.6' }}>
              Invest money into the national defense fund. Your investment will be <b style={{ color: '#f59e0b' }}>locked for 24 hours</b>, after which you receive a <b style={{ color: '#22d38a' }}>fixed 11% profit</b>. Each contract <b style={{ color: '#a855f7' }}>instantly spawns 1 new division</b> in the shop.
            </div>

            {/* Amount Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>
                <span>$100,000</span>
                <span>$1,000,000</span>
              </div>
              <input
                type="range"
                min={100000}
                max={1000000}
                step={10000}
                value={contractAmount}
                onChange={(e) => setContractAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#22d38a' }}
              />
              <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--font-display)', marginTop: '4px' }}>
                ${contractAmount.toLocaleString()}
              </div>
            </div>

            {/* Projected Returns */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Investment</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>${contractAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>Profit (11%)</span>
                <span style={{ color: '#22d38a', fontWeight: 600 }}>+${projectedProfit.toLocaleString()}</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>Payout (24h)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>${projectedPayout.toLocaleString()}</span>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowContractModal(false)}
                style={{ flex: 1, padding: '8px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', borderRadius: '5px', color: '#64748b', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
              >CANCEL</button>
              <button
                onClick={handleCreateContract}
                disabled={player.money < contractAmount}
                style={{
                  flex: 2, padding: '8px',
                  background: player.money >= contractAmount ? 'rgba(34,211,138,0.2)' : 'rgba(100,116,139,0.1)',
                  border: `1px solid ${player.money >= contractAmount ? 'rgba(34,211,138,0.4)' : 'rgba(100,116,139,0.2)'}`,
                  borderRadius: '5px', color: player.money >= contractAmount ? '#22d38a' : '#64748b',
                  fontWeight: 700, fontSize: '12px', cursor: player.money >= contractAmount ? 'pointer' : 'not-allowed',
                }}
              >CONFIRM CONTRACT</button>
            </div>
          </div>
        </div>
      )}

      {/* ====== ACTIVE CONTRACTS ====== */}
      {myContracts.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {myContracts.length > 1 && (
            <button onClick={() => setContractsCollapsed(!contractsCollapsed)} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 10px', marginBottom: '4px', background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)', borderRadius: 4, cursor: 'pointer',
              fontSize: 9, fontWeight: 700, color: '#f59e0b',
            }}>
              <span>📋 {myContracts.length} ACTIVE CONTRACTS</span>
              <span>{contractsCollapsed ? '▼ EXPAND' : '▲ COLLAPSE'}</span>
            </button>
          )}
          {!contractsCollapsed && myContracts.map(c => {
            const payout = Math.floor(c.investedAmount * (1 + c.profitRate))
            const profit = payout - c.investedAmount
            const timeLeftMs = Math.max(0, c.unlocksAt - Date.now())
            const hoursLeft = Math.floor(timeLeftMs / 3600000)
            const minsLeft = Math.floor((timeLeftMs % 3600000) / 60000)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: c.status === 'claimable' ? 'rgba(34,211,138,0.08)' : 'rgba(245,158,11,0.06)', border: `1px solid ${c.status === 'claimable' ? 'rgba(34,211,138,0.2)' : 'rgba(245,158,11,0.15)'}`, borderRadius: '5px', marginBottom: '4px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>
                    {c.status === 'locked' ? '🔒' : '✅'} ${c.investedAmount.toLocaleString()} → ${payout.toLocaleString()}
                    <span style={{ color: '#22d38a', marginLeft: '4px', fontSize: '9px' }}>+${profit.toLocaleString()}</span>
                  </div>
                  {c.status === 'locked' && (
                    <div style={{ fontSize: '8px', color: '#f59e0b' }}>Unlocks in {hoursLeft}h {minsLeft}m</div>
                  )}
                </div>
                {c.status === 'claimable' && (
                  <button
                    onClick={() => handleClaimContract(c.id)}
                    style={{ padding: '4px 12px', background: 'rgba(34,211,138,0.2)', border: '1px solid rgba(34,211,138,0.4)', borderRadius: '4px', color: '#22d38a', fontWeight: 700, fontSize: '10px', cursor: 'pointer', animation: 'pulse 1.5s infinite' }}
                  >CLAIM ${payout.toLocaleString()}</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ====== DIVISION SHOP — FILTERS ====== */}
      <div className="war-card" style={{ marginBottom: '8px' }}>
        <div className="war-card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span>DIVISION SHOP</span>
          <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 400 }}>
            {shopListings.length} listed
          </span>
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {['all', ...Array.from(new Set(shopQuotas.map(q => q.category)))].map(grp => {
            const active = grp === 'all' ? filterGroups.size === 0 : filterGroups.has(grp)
            const count = grp === 'all' ? shopListings.length : shopListings.filter(l => DIVISION_TEMPLATES[l.divisionType]?.group === grp).length
            return (
              <button key={grp} onClick={() => {
                if (grp === 'all') { setFilterGroups(new Set()) }
                else { setFilterGroups(prev => { const next = new Set(prev); if (next.has(grp)) next.delete(grp); else next.add(grp); return next }) }
              }} style={{
                padding: '3px 8px', fontSize: 9, fontWeight: 700, border: `1px solid ${active ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 3, background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: active ? '#60a5fa' : '#94a3b8', cursor: 'pointer', textTransform: 'uppercase', transition: 'all .15s',
              }}>{grp === 'all' ? 'ALL' : grp} <span style={{ color: '#64748b', fontWeight: 400 }}>({count})</span></button>
            )
          })}
        </div>
        {/* Star filter */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: '#64748b', marginRight: 2 }}>STARS:</span>
          <button onClick={() => setFilterStars(new Set())} style={{
            padding: '2px 6px', fontSize: 9, fontWeight: 700, border: `1px solid ${filterStars.size === 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 3, background: filterStars.size === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
            color: filterStars.size === 0 ? '#f59e0b' : '#64748b', cursor: 'pointer',
          }}>ALL</button>
          {[1,2,3,4,5].map(s => {
            const active = filterStars.has(s)
            return (
              <button key={s} onClick={() => setFilterStars(prev => { const next = new Set(prev); if (next.has(s)) next.delete(s); else next.add(s); return next })} style={{
                padding: '2px 5px', fontSize: 10, fontWeight: 700, border: `1px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3, background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                color: active ? '#f59e0b' : '#64748b', cursor: 'pointer', letterSpacing: '-1px',
              }}>{'★'.repeat(s)}</button>
            )
          })}
        </div>
        {/* Search + Sort row */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <input type="text" placeholder="Search by name..." value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearchName(searchInput) }}
              style={{ flex: 1, padding: '4px 8px', fontSize: 10, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontFamily: 'inherit' }}
            />
            <button onClick={() => setSearchName(searchInput)} style={{
              padding: '4px 8px', background: 'rgba(59,130,246,0.2)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)',
              color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 700, lineHeight: 1,
            }}>↵</button>
          </div>
          {searchName && <button onClick={() => { setSearchName(''); setSearchInput('') }} style={{
            padding: '3px 6px', fontSize: 9, fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
          }}>✕</button>}
          <button onClick={() => setSortPrice(p => ((p + 1) % 3) as 0 | 1 | 2)} style={{
            padding: '3px 8px', fontSize: 9, fontWeight: 700,
            border: `1px solid ${sortPrice ? '#22d38a' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 3, background: sortPrice ? 'rgba(34,211,138,0.15)' : 'rgba(255,255,255,0.04)',
            color: sortPrice ? '#22d38a' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
          }}>
            {sortPrice === 0 ? '⇅' : sortPrice === 1 ? '↓' : '↑'} PRICE
          </button>
        </div>
      </div>

      {shopListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
          No divisions available — new ones spawn every 15s (2% chance per slot)
        </div>
      ) : (
        <div className="war-recruit-grid">
          {(() => {
            const filtered = shopListings.filter(l => {
              const tmpl = DIVISION_TEMPLATES[l.divisionType]
              if (filterGroups.size > 0 && !filterGroups.has(tmpl?.group || '')) return false
              if (filterStars.size > 0 && !filterStars.has(l.starQuality)) return false
              if (searchName && !tmpl?.name.toLowerCase().includes(searchName.toLowerCase())) return false
              return true
            })
            if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)', gridColumn: '1 / -1' }}>No divisions match your filters.</div>
            if (sortPrice === 1) filtered.sort((a, b) => b.price - a.price)
            else if (sortPrice === 2) filtered.sort((a, b) => a.price - b.price)
            const avgPrice = filtered.length > 0 ? filtered.reduce((s, l) => s + l.price, 0) / filtered.length : 0
            return filtered.map(listing => {
            const t = DIVISION_TEMPLATES[listing.divisionType]
            const canBuy = player.money >= listing.price
            const timeLeft = Math.max(0, Math.floor((listing.expiresAt - Date.now()) / 60000))
            const sm = listing.statModifiers
            const rerollCost = govStore.getRerollCost(listing)
            // Calculate final stats: template × (1 + modifier)
            const fAtk = (t.atkDmgMult * (1 + sm.atkDmgMult)).toFixed(2)
            const fHit = ((t.hitRate * (1 + sm.hitRate)) * 100).toFixed(0)
            const fCrit = (t.critRateMult * (1 + sm.critRateMult)).toFixed(2)
            const fSpeed = (t.attackSpeed * (1 + sm.attackSpeed)).toFixed(1)
            const fHp = (t.healthMult * (1 + sm.healthMult)).toFixed(2)
            const fDodge = (t.dodgeMult * (1 + sm.dodgeMult)).toFixed(2)
            const fArmor = (t.armorMult * (1 + sm.armorMult)).toFixed(2)
            const fCritDmg = (t.critDmgMult * (1 + sm.critDmgMult)).toFixed(2)
            // DPT: matches combat formula (baseAtk + manpower*0.5) * atkDmgMult * shots/tick
            const effAtk = t.atkDmgMult * (1 + sm.atkDmgMult)
            const effSpeed = (t.attackSpeed || 1.0) * (1 + sm.attackSpeed)
            const baseAtk = 100 // player base attack estimate
            const dpt = Math.floor((baseAtk + t.manpowerCost * 3) * effAtk * (1 / Math.max(0.2, effSpeed)))
            const priceColor = listing.price <= avgPrice ? '#22d38a' : '#f59e0b'
            // Squadron callsign from listing ID hash
            const SQUADRONS = ['Iron Wolves','Phantom Hawks','Steel Vipers','Thunder Eagles','Shadow Foxes','War Hounds','Night Stalkers','Crimson Lancers','Ghost Riders','Storm Breakers','Death Dealers','Black Scorpions','Blood Ravens','Hellfire Squad','Dire Wolves','Ice Fangs','Void Reapers','Apex Hunters','Bone Crushers','Wrath Brigade']
            const sqIdx = listing.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % SQUADRONS.length
            const squadron = SQUADRONS[sqIdx]

            let glowStyle = {}
            if (listing.starQuality === 5) glowStyle = { boxShadow: '0 0 15px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(245, 158, 11, 0.1)' }
            if (listing.starQuality === 4) glowStyle = { boxShadow: '0 0 12px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.1)' }

            return (
              <div key={listing.id} className={`war-recruit-card ${!canBuy ? 'war-recruit-card--disabled' : ''}`} style={glowStyle}>
                <div className="war-recruit-card__header">
                  <img src={t.icon} alt={t.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0', letterSpacing: '0.5px', lineHeight: 1.1 }}>{t.name}</div>
                    <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#f59e0b', fontWeight: 600, opacity: 0.85 }}>"{squadron}"</div>
                  </div>
                  <span style={{ color: starColor(listing.starQuality), fontWeight: 700, fontSize: '11px', letterSpacing: '-1px', marginRight: '4px' }}>
                    {'★'.repeat(listing.starQuality)}{'☆'.repeat(5 - listing.starQuality)}
                  </span>
                  <span className={`war-recruit-card__category war-recruit-card__category--${t.category}`}>
                    {t.category.toUpperCase()}
                  </span>
                </div>

                <div className="war-recruit-card__desc">{t.description}</div>

                <div className="war-recruit-card__stats">
                  {/* Offensive */}
                  <div className="war-recruit-stat"><span>ATK</span><span className="war-recruit-stat__val" style={{ color: sm.atkDmgMult > 0 ? '#22d38a' : sm.atkDmgMult < 0 ? '#ef4444' : undefined }}>{fAtk}x</span></div>
                  <div className="war-recruit-stat"><span>Hit Rate</span><span className="war-recruit-stat__val" style={{ color: sm.hitRate > 0 ? '#22d38a' : sm.hitRate < 0 ? '#ef4444' : undefined }}>{fHit}%</span></div>
                  <div className="war-recruit-stat"><span>CRTH</span><span className="war-recruit-stat__val" style={{ color: sm.critRateMult > 0 ? '#22d38a' : sm.critRateMult < 0 ? '#ef4444' : undefined }}>{fCrit}x</span></div>
                  <div className="war-recruit-stat"><span>CRTD</span><span className="war-recruit-stat__val" style={{ color: sm.critDmgMult > 0 ? '#22d38a' : sm.critDmgMult < 0 ? '#ef4444' : undefined }}>{fCritDmg}x</span></div>
                  <div className="war-recruit-stat"><span>Speed</span><span className="war-recruit-stat__val" style={{ color: sm.attackSpeed > 0 ? '#22d38a' : sm.attackSpeed < 0 ? '#ef4444' : undefined }}>{fSpeed}s</span></div>
                  {/* Defensive */}
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val" style={{ color: sm.healthMult > 0 ? '#22d38a' : sm.healthMult < 0 ? '#ef4444' : undefined }}>{fHp}x</span></div>
                  <div className="war-recruit-stat"><span>Armor</span><span className="war-recruit-stat__val" style={{ color: sm.armorMult > 0 ? '#22d38a' : sm.armorMult < 0 ? '#ef4444' : undefined }}>{fArmor}x</span></div>
                  <div className="war-recruit-stat"><span>Dodge</span><span className="war-recruit-stat__val" style={{ color: sm.dodgeMult > 0 ? '#22d38a' : sm.dodgeMult < 0 ? '#ef4444' : undefined }}>{fDodge}x</span></div>
                </div>

                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: priceColor }}>${listing.price.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {t.manpowerCost} troops
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)' }}>
                      DPT {dpt}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {t.popCost} pop
                    </span>
                  </div>
                  <span style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '1px 6px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: timeLeft < 60 ? '#ef4444' : '#f59e0b', letterSpacing: '0.5px' }}>
                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Action buttons: Recruit + Reroll */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'stretch' }}>
                  <button
                    className="war-recruit-btn"
                    style={{ flex: 1, height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    disabled={!canBuy}
                    onClick={() => handleBuy(listing.id)}
                  >
                    {canBuy ? 'RECRUIT' : 'INSUFFICIENT FUNDS'}
                  </button>
                </div>
              </div>
            )
          })})()}
        </div>
      )}
    </div>
  )
}

// ====== FORCES TAB — Enlist + Division Management ======

const RANK_ICONS: Record<string, string> = {
  private: '🪖', corporal: '🎖️', sergeant: '⭐', lieutenant: '⭐⭐',
  captain: '⭐⭐⭐', colonel: '🏅', general: '👑',
}

function ForcesTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const world = useWorldStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [newArmyName, setNewArmyName] = useState('')
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [weaponPickerDivId, setWeaponPickerDivId] = useState<string | null>(null)
  const inventory = useInventoryStore()

  const myRank = getMilitaryRank(player.level)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = Object.values(armyStore.armies).find(a => a.members.some(m => m.playerId === player.name))
  const unassignedDivs = Object.values(armyStore.divisions).filter(
    d => d.countryCode === iso && !Object.values(armyStore.armies).some(a => a.divisionIds.includes(d.id))
  )
  const adjacentCountries = ADJACENCY_MAP[iso] || []

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    armyStore.createArmy(newArmyName.trim(), iso)
    setNewArmyName('')
  }

  const handleEnlist = (armyId: string) => {
    const result = armyStore.enlistInArmy(armyId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLeave = () => {
    const result = armyStore.leaveArmy()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLaunchAttack = (armyId: string, targetCode: string) => {
    const result = battleStore.launchHOIBattle(armyId, targetCode, 'invasion')
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="war-armies">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Already') || feedback.includes('cannot') || feedback.includes('Not') || feedback.includes('No') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* Compact Rank + Enlistment */}
      <div className="war-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{RANK_ICONS[myRank.rank] || '🪖'}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{myRank.label.toUpperCase()}</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>Level {player.level}</div>
            </div>
          </div>
          {currentArmy ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#22d38a', fontWeight: 700 }}>✅ {currentArmy.name}</div>
              <div style={{ fontSize: '7px', color: '#64748b' }}>{currentArmy.members.length} members</div>
              {currentArmy.commanderId !== player.name && (
                <button className="war-btn war-btn--danger" style={{ fontSize: '7px', padding: '2px 6px', marginTop: '2px' }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '8px', color: '#f59e0b' }}>Not enlisted</div>
          )}
        </div>
      </div>

      {/* Create Force */}
      <div className="war-card">
        <div className="war-card__title">➕ CREATE MILITARY FORCE</div>
        <div className="war-create-army">
          <input className="war-input" placeholder="Force name..." value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
      </div>

      {/* Available Forces to Enlist */}
      {!currentArmy && myArmies.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📋 AVAILABLE FORCES</div>
          {myArmies.map(army => (
            <div key={army.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 8px', marginBottom: '3px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>⚔️ {army.name}</div>
                <div style={{ fontSize: '7px', color: '#64748b' }}>👑 {army.commanderId} • {army.members.length} members • {army.divisionIds.length} divs</div>
              </div>
              <button className="war-btn war-btn--primary" style={{ fontSize: '7px', padding: '3px 8px' }} onClick={() => handleEnlist(army.id)}>ENLIST</button>
            </div>
          ))}
        </div>
      )}

      {/* Force List with Divisions */}
      {myArmies.map(army => {
        const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
        const isExpanded = expandedArmy === army.id
        const readyDivs = divs.filter(d => d.status === 'ready')
        const canAttack = readyDivs.length > 0

        return (
          <div className="war-card war-card--army" key={army.id}>
            <div className="war-army-header" onClick={() => setExpandedArmy(isExpanded ? null : army.id)}>
              <div className="war-army-header__left">
                <span className="war-army-header__icon">⚔️</span>
                <div>
                  <div className="war-army-header__name">{army.name}</div>
                  <div className="war-army-header__info">{divs.length} divisions • {army.totalManpower.toLocaleString()} troops</div>
                </div>
              </div>
              <div className="war-army-header__right">
                <span className={`war-army-status war-army-status--${army.status}`}>{army.status.toUpperCase()}</span>
                <span className="war-army-expand">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="war-army-body">
                {/* Force Vault */}
                <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>🏦 FORCE VAULT</div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {[
                      { icon: '💰', val: army.vault.money },
                      { icon: '🛢️', val: army.vault.oil },
                      { icon: '🔫', val: army.vault.ammo },
                      { icon: '✈️', val: army.vault.jets },
                      { icon: '🪖', val: army.vault.tanks },
                    ].map(r => (
                      <div key={r.icon} style={{
                        flex: '1 1 40px', textAlign: 'center', padding: '3px',
                        background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ fontSize: '10px' }}>{r.icon}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginLeft: '2px' }}>{r.val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {army.members.some(m => m.playerId === player.name) && (
                    <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                      {[
                        { resource: 'money' as const, amount: 10000, label: '💰 $10K' },
                        { resource: 'money' as const, amount: 50000, label: '💰 $50K' },
                        { resource: 'oil' as const, amount: 100, label: '🛢️ 100' },
                      ].map(d => (
                        <button key={d.label} className="war-btn war-btn--small"
                          style={{ fontSize: '7px', padding: '2px 5px' }}
                          onClick={() => armyStore.donateToVault(army.id, d.resource, d.amount)}
                        >{d.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Division List — Enhanced with stance, XP, rebuild/disband */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.health / div.maxHealth) * 100)
                    const divLevel = Math.floor((div.experience || 0) / 10)
                    const ps = getBaseSkillStats()
                    const eq = getDivisionEquipBonus(div)
                    // Compute final stats (including equipment bonuses)
                    const finalAtk = Math.floor((ps.attackDamage + div.manpower * 3 + eq.bonusAtk) * (template.atkDmgMult + divLevel * 0.01) * (1 + divLevel * 0.10))
                    const finalHit = Math.min(95, Math.floor((template.hitRate + divLevel * 0.01 + eq.bonusHitRate) * 100))
                    const finalCrit = Math.floor((ps.critRate + eq.bonusCritRate) * (template.critRateMult + divLevel * 0.01))
                    const finalDodge = Math.floor((ps.dodgeChance || 5) * template.dodgeMult + eq.bonusDodge)
                    const finalArmor = Math.floor((ps.armorBlock || 0) * template.armorMult + eq.bonusArmor)
                    const finalSpeed = Math.max(0.2, (template.attackSpeed || 1.0) - eq.bonusSpeed)
                    const finalCritDmg = (ps.critMultiplier * (template.critDmgMult + divLevel * 0.01) * 100).toFixed(0)
                    const statusColors: Record<string, string> = {
                      training: '#f59e0b', ready: '#22d38a', in_combat: '#ef4444', recovering: '#3b82f6', destroyed: '#64748b'
                    }
                    const statusLabels: Record<string, string> = {
                      training: '🔨 TRAINING', ready: '✅ READY', in_combat: '⚔️ COMBAT', recovering: '💤 RECOVERING', destroyed: '💀 DESTROYED'
                    }

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 8px' }}>
                        {/* Header: icon, name, level, status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={template?.icon} alt="div" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                          <span className="war-div-row__name" style={{ flex: 1 }}>{div.name}</span>
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                            LV{divLevel}
                          </span>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: statusColors[div.status] || '#64748b', background: `${statusColors[div.status] || '#64748b'}15`, padding: '1px 5px', borderRadius: '3px' }}>
                            {div.status === 'training' ? (() => { const left = Math.max(0, Math.ceil((div.readyAt - Date.now()) / 1000)); return `🔨 ${left}s` })() : (statusLabels[div.status] || div.status.toUpperCase())}
                          </span>
                          <button
                            style={{ marginLeft: '2px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', fontSize: '10px', fontWeight: 900, padding: '1px 5px', cursor: 'pointer', lineHeight: 1 }}
                            title="Recall from battle"
                            onClick={() => {
                              const r = armyStore.recallArmy(army.id)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                            }}
                          >✕</button>
                        </div>
                        {/* HP bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="war-div-bar" title={`HP: ${strengthPct}%`} style={{ flex: 1, height: '16px' }}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%`, transition: 'width 0.8s ease' }} />
                            <span className="war-div-bar__label" style={{ fontSize: '10px', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.8)', letterSpacing: '0.5px' }}>{div.health}/{div.maxHealth} ({strengthPct}%)</span>
                          </div>
                        </div>
                        {/* Stat grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 8px', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)' }}>
                          <span style={{ color: '#94a3b8' }}>⚔️ ATK <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalAtk}</span></span>
                          <span style={{ color: '#94a3b8' }}>🎯 HIT <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalHit}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💥 CRTH <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCrit}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💀 CRTD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCritDmg}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💨 DGE <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalDodge}%</span></span>
                          <span style={{ color: '#94a3b8' }}>🛡️ ARM <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalArmor}</span></span>
                          <span style={{ color: '#94a3b8' }}>⚡ SPD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalSpeed}x</span></span>
                          <span style={{ color: '#94a3b8' }}>👥 Troops <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{div.manpower}</span></span>
                        </div>
                        {/* === Big Action Buttons === */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          {/* REINFORCE = equip weapon */}
                          <button
                            style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                            onClick={() => setWeaponPickerDivId(div.id)}
                          >
                            ⚔️ REINFORCE
                          </button>
                          {/* REBUILD or REVIVE based on status */}
                          {div.status === 'destroyed' ? (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                              title={`Revive: 50% cost, halve XP, reroll stars, 2-16% HP`}
                              onClick={() => {
                                const r = armyStore.reviveDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                              }}
                            >
                              💀 REVIVE (${Math.floor(DIVISION_TEMPLATES[div.type].recruitCost.money * 0.6).toLocaleString()})
                            </button>
                          ) : (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(34,211,138,0.5)', background: 'rgba(34,211,138,0.15)', color: '#22d38a', cursor: 'pointer', transition: 'all 0.15s' }}
                              onClick={() => {
                                const r = armyStore.rebuildDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                              }}
                            >
                              🍞 FEED
                            </button>
                          )}
                        </div>
                        {/* Equipped weapon indicator */}
                        {(() => {
                          const inv = useInventoryStore.getState()
                          const matchingSub = Object.entries(WEAPON_DIVISION_MAP).find(([, dt]) => dt === div.type)?.[0] as WeaponSubtype | undefined
                          const equipped = div.equipment.map(eid => inv.items.find(i => i.id === eid)).find(i => i && i.category === 'weapon' && i.weaponSubtype === matchingSub)
                          if (equipped) {
                            return <div style={{ fontSize: '8px', color: '#22d38a', fontWeight: 700, marginTop: '2px' }}>⚔️ {equipped.name} — {Math.floor(equipped.durability)}% durability</div>
                          }
                          return <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>No weapon equipped</div>
                        })()}
                      </div>
                    )
                  })}
                </div>

                {/* AV Composition & Aura */}
                {divs.length > 0 && (() => {
                  const av = armyStore.getArmyAV(army.id)
                  const aura = armyStore.getCompositionAura(army.id)
                  return (
                    <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>📊 ARMY VALUE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                        {[
                          { label: '✈️', val: av.air, buff: `+${aura.critDmgPct}% CDmg`, color: '#60a5fa' },
                          { label: '🚶', val: av.ground, buff: `+${aura.dodgePct}% Dodge`, color: '#22d38a' },
                          { label: '🪖', val: av.tanks, buff: `+${aura.attackPct}% Atk`, color: '#f59e0b' },
                          { label: '🚢', val: av.navy, buff: `+${aura.precisionPct}% Prec`, color: '#a78bfa' },
                        ].map(cat => (
                          <div key={cat.label} style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                            <div style={{ fontSize: '8px', color: cat.color, fontWeight: 700 }}>{cat.label} {cat.val}</div>
                            <div style={{ fontSize: '7px', color: cat.color, opacity: 0.7 }}>{cat.buff}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Attack Controls */}
                {canAttack && (
                  <div className="war-attack-controls">
                    <div className="war-attack-header">🎯 LAUNCH ATTACK</div>
                    <div className="war-attack-targets">
                      {adjacentCountries.map(code => {
                        const country = world.countries.find(c => c.code === code)
                        if (!country) return null
                        const atWar = world.wars.some(w =>
                          w.status === 'active' &&
                          ((w.attacker === iso && w.defender === code) || (w.defender === iso && w.attacker === code))
                        )
                        return (
                          <button
                            key={code}
                            className={`war-target-btn ${!atWar ? 'war-target-btn--disabled' : ''}`}
                            disabled={!atWar}
                            onClick={() => handleLaunchAttack(army.id, code)}
                            title={atWar ? `Attack ${country.name}` : `Not at war with ${country.name}`}
                          >
                            <span className="war-target-flag">{getCountryFlag(code)}</span>
                            <span className="war-target-name">{country.name}</span>
                            {!atWar && <span className="war-target-peace">☮️</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned Divisions */}
      {unassignedDivs.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📦 UNASSIGNED ({unassignedDivs.length})</div>
          {unassignedDivs.map(div => {
            const template = DIVISION_TEMPLATES[div.type]
            return (
              <div className="war-unassigned-row" key={div.id}>
                <span><img src={template?.icon} alt="div" style={{ width: '12px', height: '12px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '4px' }} />{div.name}</span>
                <span className={`war-div-status--${div.status}`}>{div.status}</span>
                <div className="war-unassigned-actions">
                  {myArmies.map(army => (
                    <button key={army.id} className="war-btn war-btn--small"
                      onClick={() => armyStore.assignDivisionToArmy(div.id, army.id)}
                    >→ {army.name.substring(0, 15)}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* === Weapon Picker Modal === */}
      {weaponPickerDivId && (() => {
        const div = armyStore.divisions[weaponPickerDivId]
        if (!div) { setWeaponPickerDivId(null); return null }
        const matchingSub = Object.entries(WEAPON_DIVISION_MAP).find(([, dt]) => dt === div.type)?.[0] as WeaponSubtype | undefined
        const matchingWeapons = matchingSub ? inventory.items.filter(i => i.category === 'weapon' && i.weaponSubtype === matchingSub && i.durability > 0) : []
        const equippedIds = new Set(div.equipment)
        const currentlyEquipped = matchingWeapons.filter(w => equippedIds.has(w.id))
        const available = matchingWeapons.filter(w => !w.equipped).sort((a, b) => (b.stats.damage || 0) - (a.stats.damage || 0))
        const template = DIVISION_TEMPLATES[div.type]

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setWeaponPickerDivId(null)}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', minWidth: '320px', maxWidth: '400px', maxHeight: '70vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>⚔️ REINFORCE</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{div.name} — needs: {matchingSub?.toUpperCase()}</div>
                </div>
                <button onClick={() => setWeaponPickerDivId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>

              {/* Currently equipped */}
              {currentlyEquipped.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#22d38a', fontWeight: 700, marginBottom: '4px' }}>EQUIPPED</div>
                  {currentlyEquipped.map(w => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.2)', borderRadius: '4px', marginBottom: '4px' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#22d38a' }}>{w.name}</div>
                        <div style={{ fontSize: '8px', color: '#94a3b8' }}>⚔️ {w.stats.damage || 0} dmg • 💥 {w.stats.critRate || 0}% crit • {Math.floor(w.durability)}% dur</div>
                      </div>
                      <button style={{ fontSize: '8px', padding: '2px 6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', cursor: 'pointer' }}
                        onClick={() => { armyStore.unequipItemFromDivision(div.id, w.id); ui.addFloatingText('Unequipped!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b') }}>
                        UNEQUIP
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available weapons */}
              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>AVAILABLE ({available.length})</div>
              {available.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '16px' }}>No matching {matchingSub} weapons in inventory</div>
              ) : (
                available.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '3px', cursor: 'pointer', transition: 'all 0.1s' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>{w.name} <span style={{ fontSize: '8px', color: '#64748b' }}>({w.tier.toUpperCase()})</span></div>
                      <div style={{ fontSize: '8px', color: '#94a3b8' }}>⚔️ {w.stats.damage || 0} dmg • 💥 {w.stats.critRate || 0}% crit • {Math.floor(w.durability)}% dur</div>
                    </div>
                    <button style={{ fontSize: '9px', padding: '3px 8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => {
                        const r = armyStore.equipItemToDivision(div.id, w.id)
                        ui.addFloatingText(r ? `Equipped ${w.name}!` : 'Failed to equip', window.innerWidth / 2, window.innerHeight / 2, r ? '#22d38a' : '#ef4444')
                        setWeaponPickerDivId(null)
                      }}>
                      EQUIP
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ====== COMBAT TAB — Battle Engagement + Deploy + Fight ======

function CombatTab({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const battleStore = useBattleStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [expandedBattles, setExpandedBattles] = useState<Set<string>>(new Set())
  const [deployCount, setDeployCount] = useState<Record<string, number>>({})
  const [editingOrderMsg, setEditingOrderMsg] = useState<Record<string, boolean>>({})
  const [scene3DBattle, setScene3DBattle] = useState<{
    id: string
    atkDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
    defDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  } | null>(null)

  // Combat tick timer
  const [combatTickLeft, setCombatTickLocal] = useState(() => useBattleStore.getState().combatTickLeft)
  const [viewingRound, setViewingRound] = useState<{ battleId: string; roundIdx: number } | null>(null)
  React.useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => { setCombatTickLocal(state.combatTickLeft) })
    return unsub
  }, [])


  const iso = player.countryCode || 'US'
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const pastBattles = Object.values(battleStore.battles).filter(b => b.status !== 'active').slice(-5)

  const get3DDivisions = (divIds: string[]) => {
    return divIds.map(id => {
      const d = armyStore.divisions[id]
      if (!d) return null
      return { type: d.type, name: d.name, health: d.health, maxHealth: d.maxHealth }
    }).filter(Boolean) as { type: DivisionType; name: string; health: number; maxHealth: number }[]
  }

  return (
    <div className="war-battles" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* === Fixed Header: Tick Timer + Food (sidebar mode only) === */}
      <div style={{ flexShrink: 0 }}>
      {/* 3D Battle Scene Overlay */}
      {scene3DBattle && (
        <Suspense fallback={
          <div className="battle-scene-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚔️</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px' }}>LOADING 3D BATTLE...</div>
            </div>
          </div>
        }>
          <BattleScene3D
            battle={{ id: scene3DBattle.id }}
            attackerDivisions={scene3DBattle.atkDivs}
            defenderDivisions={scene3DBattle.defDivs}
            onClose={() => setScene3DBattle(null)}
          />
        </Suspense>
      )}

      {/* Tick Timer — only in sidebar mode */}
      {!panelFullscreen && activeBattles.length > 0 && (
        <div className="war-combat-header" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 10px', marginBottom: '6px',
          background: 'rgba(132, 204, 22, 0.08)', borderRadius: '6px',
          border: '1px solid rgba(132, 204, 22, 0.15)',
        }}>
          <span style={{ fontSize: '12px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: combatTickLeft <= 3 ? '#84cc16' : '#94a3b8' }}>
              <span>NEXT TICK</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: combatTickLeft <= 3 ? '#84cc16' : '#22d38a' }}>{combatTickLeft}s</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
              <div style={{
                width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                background: combatTickLeft <= 3 ? '#84cc16' : '#22d38a',
                transition: 'width 0.9s linear', borderRadius: '2px',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Food — sidebar mode only */}
      {!panelFullscreen && (
        <div className="war-combat-food" style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
          {[
            { key: 'bread', icon: '🍞', label: 'Bread', count: player.bread, sta: 10, heal: 1 },
            { key: 'sushi', icon: '🍣', label: 'Sushi', count: player.sushi, sta: 20, heal: 2 },
            { key: 'wagyu', icon: '🥩', label: 'Wagyu', count: player.wagyu, sta: 30, heal: 3 },
          ].map(f => (
            <button key={f.key} disabled={f.count <= 0}
              onClick={() => {
                player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                if (result.success) console.log(result.message)
              }}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                background: f.count > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${f.count > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '14px' }}>{f.icon}</div>
              <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0' }}>{f.count}</div>
              <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
              <div style={{ fontSize: '7px', color: '#22c55e' }}>+{f.heal}% HP</div>
            </button>
          ))}
        </div>
      )}
      </div>


      {/* === Scrollable Battles List === */}
      <div className="war-battles-grid" style={panelFullscreen ? {
        flex: 1, overflowX: 'auto', overflowY: 'auto',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '8px', padding: '4px', alignContent: 'start', alignItems: 'start',
      } : { flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {activeBattles.length === 0 && pastBattles.length === 0 && (
        <div className="war-card" style={{ gridColumn: '1 / -1' }}><div className="war-empty">No active battles. Launch an attack from the Forces tab.</div></div>
      )}

      {/* In fullscreen: insert center panel (tick+food) at slot 3 */}
      {activeBattles.map((battle, idx) => {
        // Render center panel BEFORE the 3rd battle card (index 2) in fullscreen
        const centerPanel = (panelFullscreen && idx === 2) ? (
          <div key="center-panel" className="war-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
            {/* Tick Timer */}
            {activeBattles.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px',
                background: 'rgba(132, 204, 22, 0.08)', borderRadius: '6px',
                border: '1px solid rgba(132, 204, 22, 0.15)',
              }}>
                <span style={{ fontSize: '14px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: combatTickLeft <= 3 ? '#84cc16' : '#94a3b8' }}>
                    <span>NEXT TICK</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: combatTickLeft <= 3 ? '#84cc16' : '#22d38a' }}>{combatTickLeft}s</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                    <div style={{
                      width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                      background: combatTickLeft <= 3 ? '#84cc16' : '#22d38a',
                      transition: 'width 0.9s linear', borderRadius: '2px',
                    }} />
                  </div>
                </div>
              </div>
            )}
            {/* Food Grid */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'bread', count: player.bread, sta: 10, heal: 1 },
                { key: 'sushi', count: player.sushi, sta: 20, heal: 2 },
                { key: 'wagyu', count: player.wagyu, sta: 30, heal: 3 },
              ].map(f => (
                <button key={f.key} disabled={f.count <= 0}
                  onClick={() => {
                    player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                    const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                    if (result.success) console.log(result.message)
                  }}
                  style={{
                    flex: 1, padding: '6px 3px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                    background: f.count > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${f.count > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
                  }}
                >
                  <img src={`/assets/food/${f.key}.png`} alt={f.key} style={{ width: '24px', height: '24px', objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>{f.count}</div>
                  <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
                  <div style={{ fontSize: '7px', color: '#22c55e' }}>+{f.heal}% HP</div>
                </button>
              ))}
            </div>
            {/* Mini Leaderboard */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '3px' }}>🏆 TOP DAMAGE TODAY</div>
              {(() => {
                const dealers: Record<string, number> = {}
                activeBattles.forEach(b => {
                  Object.entries(b.attackerDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                  Object.entries(b.defenderDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                })
                const sorted = Object.entries(dealers).sort((a, b) => b[1] - a[1]).slice(0, 5)
                const maxDmg = sorted[0]?.[1] || 1
                if (sorted.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '6px' }}>No damage dealt yet</div>
                return sorted.map(([name, dmg], i) => {
                  const isMe = name === player.name
                  const pct = (dmg / maxDmg) * 100
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 900, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b', width: '12px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '1px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : i === 0 ? '#22d38a' : '#3b82f6', borderRadius: '1px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        ) : null
        const isExpanded = expandedBattles.has(battle.id)
        const activeRound = battle.rounds[battle.rounds.length - 1]
        const atkDmg = battle.attacker?.damageDealt || 0
        const defDmg = battle.defender?.damageDealt || 0
        const totalDmg = atkDmg + defDmg
        const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
        const mySide: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'

        const countries = useWorldStore.getState().countries
        const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#22d38a'
        const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'

        const activeRd = battle.rounds[battle.rounds.length - 1]
        const tickAtkDmg = battle.currentTick?.attackerDamage || 0
        const tickDefDmg = battle.currentTick?.defenderDamage || 0
        const tickWinnerClr = tickAtkDmg >= tickDefDmg ? atkClr : defClr
        const rdAtkPts = activeRd?.attackerPoints || 0
        const rdDefPts = activeRd?.defenderPoints || 0
        const rdLeaderClr = rdAtkPts >= rdDefPts ? atkClr : defClr

        let glowClass = ''
        let glowColor = 'transparent'
        const maxPts = Math.max(rdAtkPts, rdDefPts)
        const tickDmg = tickAtkDmg + tickDefDmg

        if (maxPts >= 450) {
          glowClass = ' war-card--critical'
          glowColor = rdLeaderClr
        } else if (tickDmg > 500) {
          glowClass = ' war-card--hot'
          glowColor = tickWinnerClr
        }

        return (
          <React.Fragment key={battle.id}>
            {centerPanel}
            <div className={`war-card war-card--battle${glowClass}`} style={{ '--glow-color': glowColor } as React.CSSProperties}>
            {/* Battle Header */}
            <div className="war-battle-header" onClick={() => setExpandedBattles(prev => { const next = new Set(prev); if (next.has(battle.id)) next.delete(battle.id); else next.add(battle.id); return next })}>
              <div className="war-battle-sides">
                <div className="war-battle-side war-battle-side--atk">
                  <span className="war-battle-flag">{getCountryFlag(battle.attackerId)}</span>
                  <div>
                    {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && iso === battle.attackerId && (
                      <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', fontFamily: 'var(--font-display)', animation: 'pulse 2s infinite' }}>HERO</div>
                    )}
                    <div className="war-battle-country">{getCountryName(battle.attackerId)}</div>
                    <div className="war-battle-meta">{battle.attacker.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-rounds">{battle.attackerRoundsWon}</span>
                </div>
                <div className="war-battle-center">
                  <div className="war-battle-vs">VS</div>
                  <div className="war-battle-terrain">⚔️ {battle.regionName}</div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>{fmtElapsed(battle.rounds[battle.rounds.length - 1]?.startedAt || battle.startedAt)}</div>
                  {/* Clickable round labels */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {battle.rounds.map((rd, ri) => {
                      if (rd.status === 'active') return null
                      const won = rd.status === 'attacker_won'
                      return (
                        <button key={ri} onClick={(e) => { e.stopPropagation(); setViewingRound(viewingRound?.battleId === battle.id && viewingRound?.roundIdx === ri ? null : { battleId: battle.id, roundIdx: ri }) }}
                          style={{ padding: '1px 5px', fontSize: 7, fontWeight: 800, border: `1px solid ${won ? 'rgba(34,211,138,0.4)' : 'rgba(59,130,246,0.4)'}`, borderRadius: 2, background: viewingRound?.battleId === battle.id && viewingRound?.roundIdx === ri ? (won ? 'rgba(34,211,138,0.25)' : 'rgba(59,130,246,0.25)') : 'rgba(0,0,0,0.3)', color: won ? '#22d38a' : '#60a5fa', cursor: 'pointer', letterSpacing: '0.5px' }}>
                          R{ri + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="war-battle-side war-battle-side--def">
                  <span className="war-battle-rounds">{battle.defenderRoundsWon}</span>
                  <div style={{ textAlign: 'right' }}>
                    {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && iso === battle.defenderId && (
                      <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', fontFamily: 'var(--font-display)', animation: 'pulse 2s infinite' }}>HERO</div>
                    )}
                    <div className="war-battle-country">{getCountryName(battle.defenderId)}</div>
                    <div className="war-battle-meta">{battle.defender.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-flag">{getCountryFlag(battle.defenderId)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedBattles(prev => { const next = new Set(prev); if (next.has(battle.id)) next.delete(battle.id); else next.add(battle.id); return next }) }}
                  style={{
                    padding: '1px 16px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                    fontSize: '8px', fontWeight: 600, background: 'rgba(255,255,255,0.04)',
                    color: '#64748b', transition: 'all 0.15s', lineHeight: 1,
                  }}
                >{isExpanded ? '▲' : '▼'}</button>
              </div>
            </div>

            {/* Round Snapshot Popover */}
            {viewingRound && viewingRound.battleId === battle.id && (() => {
              const rd = battle.rounds[viewingRound.roundIdx]
              if (!rd || rd.status === 'active') return null
              const won = rd.status === 'attacker_won'
              return (
                <div style={{ margin: '4px 0', padding: '8px 10px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${won ? 'rgba(34,211,138,0.3)' : 'rgba(59,130,246,0.3)'}`, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: won ? '#22d38a' : '#60a5fa', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                      ROUND {viewingRound.roundIdx + 1} — {won ? getCountryName(battle.attackerId) + ' WON' : getCountryName(battle.defenderId) + ' WON'}
                    </span>
                    <button onClick={() => setViewingRound(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
                    <div style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: 3, border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ color: '#94a3b8', fontSize: 7, fontWeight: 700, marginBottom: 2 }}>ATTACKER</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>⚔️ {(rd.attackerDmgTotal || 0).toLocaleString()} dmg</div>
                      <div style={{ color: '#f87171', fontWeight: 600 }}>{rd.attackerPoints} pts</div>
                    </div>
                    <div style={{ padding: '4px 6px', background: 'rgba(59,130,246,0.08)', borderRadius: 3, border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div style={{ color: '#94a3b8', fontSize: 7, fontWeight: 700, marginBottom: 2 }}>DEFENDER</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>🛡️ {(rd.defenderDmgTotal || 0).toLocaleString()} dmg</div>
                      <div style={{ color: '#60a5fa', fontWeight: 600 }}>{rd.defenderPoints} pts</div>
                    </div>
                  </div>
                  {rd.ticksElapsed && <div style={{ marginTop: 4, fontSize: 8, color: '#64748b', textAlign: 'center' }}>
                    {fmtTicks(rd.ticksElapsed)} • ended {rd.endedAt ? new Date(rd.endedAt).toLocaleTimeString() : '—'}
                  </div>}
                </div>
              )
            })()}

            {/* Ground Points Bar — THE MOST IMPORTANT BAR */}
            {activeRound && (() => {
              const atkPts = activeRound.attackerPoints
              const defPts = activeRound.defenderPoints
              const maxPts = 600
              const atkFill = Math.min(100, (atkPts / maxPts) * 100)
              const defFill = Math.min(100, (defPts / maxPts) * 100)
              return (
                <div style={{ margin: '4px 0', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 800, marginBottom: '4px' }}>
                    <span style={{ color: atkClr, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{atkPts}</span>
                    <span style={{ color: '#64748b', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>R{battle.rounds.length}/3 • {maxPts} to win</span>
                    <span style={{ color: defClr, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{defPts}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', height: '14px' }}>
                    {/* Attacker bar — fills left to right */}
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${atkFill}%`, background: `linear-gradient(90deg, ${atkClr}66, ${atkClr})`,
                        borderRadius: '7px', transition: 'width 0.5s ease',
                        boxShadow: atkFill > 0 ? `0 0 10px ${atkClr}55, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      }} />
                      {atkFill > 8 && <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 800, color: '#fff', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{Math.round(atkFill)}%</span>}
                    </div>
                    {/* Defender bar — fills right to left */}
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: `${defFill}%`, background: `linear-gradient(270deg, ${defClr}66, ${defClr})`,
                        borderRadius: '7px', transition: 'width 0.5s ease',
                        boxShadow: defFill > 0 ? `0 0 10px ${defClr}55, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      }} />
                      {defFill > 8 && <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 800, color: '#fff', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{Math.round(defFill)}%</span>}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Improved Damage Bar */}
            <div className="war-damage-bar">
              <div className="war-damage-bar__fill war-damage-bar__fill--atk" style={{ width: `${atkPct}%`, background: `linear-gradient(90deg, ${atkClr}44, ${atkClr})`, boxShadow: `2px 0 8px ${atkClr}55` }} />
              <div className="war-damage-bar__fill war-damage-bar__fill--def" style={{ width: `${100 - atkPct}%`, background: `linear-gradient(270deg, ${defClr}44, ${defClr})`, boxShadow: `-2px 0 8px ${defClr}55` }} />
              <div className="war-damage-bar__center" />
              <span className="war-damage-bar__label war-damage-bar__label--atk"><AnimatedNumber value={atkDmg} /></span>
              <span className="war-damage-bar__label war-damage-bar__label--def"><AnimatedNumber value={defDmg} /></span>
            </div>

            {/* Fight Buttons — always visible */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
              <button disabled={player.stamina < 5}
                style={{ padding: '8px 0', background: `${atkClr}15`, border: `2px solid ${atkClr}66`, borderRadius: '2px', color: atkClr, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s' }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'attacker'); r.isCrit ? playCritSound() : playHitSound(); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : atkClr) }}
              >
                ATTACK
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>5 STAMINA</div>
              </button>
              <button disabled={player.stamina < 5}
                style={{ padding: '8px 0', background: `${defClr}15`, border: `2px solid ${defClr}66`, borderRadius: '2px', color: defClr, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s' }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'defender'); r.isCrit ? playCritSound() : playHitSound(); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : defClr) }}
              >
                DEFEND
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>5 STAMINA</div>
              </button>
            </div>

            {/* === Collapsible Section === */}
            {isExpanded && (<>

            {/* Tactical Battle Orders */}
            <div style={{ marginTop: '4px', marginBottom: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '6px 8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>TACTICAL ORDERS</div>
              {/* Per-side order rows */}
              {(['attacker', 'defender'] as const).map(side => {
                const currentOrder = side === 'attacker' ? (battle.attackerOrder || 'none') : (battle.defenderOrder || 'none')
                const otherSideOrder = side === 'attacker' ? (battle.defenderOrder || 'none') : (battle.attackerOrder || 'none')
                const sideColor = side === 'attacker' ? atkClr : defClr
                // Disable this side if the OTHER side has an active order
                const sideDisabled = otherSideOrder !== 'none'
                return (
                  <div key={side} style={{ marginBottom: '4px', opacity: sideDisabled ? 0.35 : 1 }}>
                    <div style={{ fontSize: '7px', fontWeight: 900, color: sideColor, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '3px', borderLeft: `2px solid ${sideColor}`, paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{side.toUpperCase()}: {TACTICAL_ORDERS[currentOrder].label}</span>
                      {currentOrder !== 'none' && <span style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 600 }}>{TACTICAL_ORDERS[currentOrder].desc}</span>}
                      {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && ((side === 'attacker' && iso === battle.attackerId) || (side === 'defender' && iso === battle.defenderId)) && (
                        <span style={{ fontSize: '7px', fontWeight: 900, color: '#0a0a0a', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.5px', animation: 'pulse 2s infinite', marginLeft: 'auto' }}>HERO +10%</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                      {(['charge', 'fortify', 'precision', 'blitz'] as TacticalOrder[]).map(ord => {
                        const o = TACTICAL_ORDERS[ord]
                        const isActive = currentOrder === ord
                        return (
                          <button key={ord}
                            disabled={sideDisabled}
                            onClick={(e) => { e.stopPropagation(); if (!sideDisabled) battleStore.setBattleOrder(battle.id, side, isActive ? 'none' : ord) }}
                            style={{
                              padding: '3px 2px', border: `1px solid ${isActive ? o.color : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: '2px', cursor: sideDisabled ? 'not-allowed' : 'pointer', fontSize: '7px', fontWeight: 800,
                              fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                              background: isActive ? `${o.color}20` : 'rgba(255,255,255,0.03)',
                              color: isActive ? o.color : '#64748b',
                              boxShadow: isActive ? `0 0 6px ${o.color}33` : 'none',
                              transition: 'all 0.15s',
                            }}
                          >{o.label}</button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* Order Message */}
              <div style={{ marginTop: '4px' }}>
                {editingOrderMsg[battle.id] ? (
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <input
                      type="text" placeholder="COMMANDER ORDER..." maxLength={100}
                      value={battle.orderMessage || ''}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => battleStore.setBattleOrderMessage(battle.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingOrderMsg(prev => ({ ...prev, [battle.id]: false })) }}
                      style={{
                        flex: 1, padding: '3px 6px', fontSize: '8px',
                        fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '3px', color: '#e2e8f0', outline: 'none',
                      }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: false })) }}
                      style={{ padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px', fontWeight: 700 }}
                    >OK</button>
                  </div>
                ) : battle.orderMessage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                  >
                    <div style={{ flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa', padding: '2px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', borderLeft: '2px solid #a78bfa' }}>
                      {battle.orderMessage}
                    </div>
                    <span style={{ fontSize: '8px', color: '#475569' }}>EDIT</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                    style={{ width: '100%', padding: '2px 6px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', background: 'transparent', fontSize: '7px', color: '#475569', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >+ ADD ORDER MESSAGE</button>
                )}
              </div>
            </div>

            {/* Division Deploy List — grouped by type */}
            {(() => {
              const readyDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status === 'ready')
              const engagedIds = (mySide === 'attacker' ? battle.attacker : battle.defender).engagedDivisionIds
              const engagedDivs = engagedIds.map(id => armyStore.divisions[id]).filter(Boolean)

              // Group all my country's divs by type
              const allMyDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status !== 'destroyed')
              const typeMap = new Map<string, { ready: typeof readyDivs; engaged: typeof engagedDivs; total: typeof allMyDivs }>()
              
              for (const d of allMyDivs) {
                if (!typeMap.has(d.type)) typeMap.set(d.type, { ready: [], engaged: [], total: [] })
                const g = typeMap.get(d.type)!
                g.total.push(d)
                if (d.status === 'ready') g.ready.push(d)
                if (engagedIds.includes(d.id)) g.engaged.push(d)
              }

              const types = Array.from(typeMap.entries())
              if (types.length === 0) return <div style={{ fontSize: '8px', color: '#475569', padding: '4px', textAlign: 'center' }}>No divisions available</div>

              return (
                <div style={{ marginBottom: '4px' }}>
                  {types.map(([type, group]) => {
                    const template = DIVISION_TEMPLATES[type as keyof typeof DIVISION_TEMPLATES]
                    const deployedCount = group.engaged.length
                    const totalCount = group.total.length
                    const canDeploy = group.ready.length > 0
                    const canRecall = group.engaged.length > 0

                    return (
                      <div key={type} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '3px 6px', marginBottom: '2px',
                        background: deployedCount > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        borderRadius: '3px', border: `1px solid ${deployedCount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                        {/* Count badge */}
                        <div style={{
                          minWidth: '28px', textAlign: 'center', fontSize: '9px', fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: deployedCount > 0 ? '#f59e0b' : '#64748b',
                        }}>
                          {deployedCount}/{totalCount}
                        </div>

                        {/* - button (recall) */}
                        <button
                          disabled={!canRecall}
                          onClick={(e) => {
                            e.stopPropagation()
                            const divToRecall = group.engaged[group.engaged.length - 1]
                            if (divToRecall) {
                              const r = battleStore.recallDivisionFromBattle(battle.id, divToRecall.id, mySide)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                            }
                          }}
                          style={{
                            width: '18px', height: '18px', border: 'none', borderRadius: '3px', cursor: canRecall ? 'pointer' : 'not-allowed',
                            background: canRecall ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                            color: canRecall ? '#ef4444' : '#334155', fontSize: '11px', fontWeight: 900,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >−</button>

                        {/* + button (deploy) */}
                        <button
                          disabled={!canDeploy}
                          onClick={(e) => {
                            e.stopPropagation()
                            const divToDeploy = group.ready[0]
                            if (divToDeploy) {
                              const r = battleStore.deployDivisionsToBattle(battle.id, [divToDeploy.id], mySide)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                            }
                          }}
                          style={{
                            width: '18px', height: '18px', border: 'none', borderRadius: '3px', cursor: canDeploy ? 'pointer' : 'not-allowed',
                            background: canDeploy ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                            color: canDeploy ? '#22c55e' : '#334155', fontSize: '11px', fontWeight: 900,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >+</button>

                        {/* Division type info */}
                        <img src={template?.icon} alt="" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {template?.name || type}
                          </div>
                        </div>
                        {deployedCount > 0 && (
                          <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 4px', borderRadius: '2px' }}>
                            IN BATTLE
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Expanded Details */}
            
              <div className="war-battle-details" style={{ marginTop: '6px' }}>

                {/* Deployed Divisions — Military Style */}
                <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: atkClr, padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${atkClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>ATTACKER DIVISIONS</div>
                  <div style={{ padding: '2px 8px' }}>
                  {battle.attacker.engagedDivisionIds.map((id, idx) => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.health / d.maxHealth) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)', borderBottom: idx < battle.attacker.engagedDivisionIds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <img src={template?.icon} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{d.health}/{d.maxHealth}</span>
                        <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#22c55e' : strPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s ease, background 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.attacker.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569', padding: '4px 0' }}>No divisions deployed</div>}
                  </div>
                </div>

                <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: defClr, padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${defClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>DEFENDER DIVISIONS</div>
                  <div style={{ padding: '2px 8px' }}>
                  {battle.defender.engagedDivisionIds.map((id, idx) => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.health / d.maxHealth) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)', borderBottom: idx < battle.defender.engagedDivisionIds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <img src={template?.icon} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{d.health}/{d.maxHealth}</span>
                        <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#22c55e' : strPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s ease, background 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.defender.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569', padding: '4px 0' }}>No divisions deployed</div>}
                  </div>
                </div>

                {/* Stats Comparison — Military */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 8px', borderLeft: `2px solid ${atkClr}` }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px' }}>ATTACKER</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>DMG <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.attacker.damageDealt || 0).toLocaleString()}</span></div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>KIA <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.attacker.manpowerLost || 0).toLocaleString()}</span></div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>DST <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{battle.attacker.divisionsDestroyed}</span></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '0 10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', fontFamily: 'var(--font-display)' }}>{fmtElapsed(battle.startedAt)}</span>
                  </div>
                  <div style={{ padding: '6px 8px', borderRight: `2px solid ${defClr}`, textAlign: 'right' }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px' }}>DEFENDER</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.defender.damageDealt || 0).toLocaleString()}</span> DMG</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.defender.manpowerLost || 0).toLocaleString()}</span> KIA</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{battle.defender.divisionsDestroyed}</span> DST</div>
                  </div>
                </div>

                {/* Combat Log — Military Terminal */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>▌ COMBAT LOG</span>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>{battle.combatLog.length} entries</span>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '2px 0', fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", monospace)', fontSize: '9px', lineHeight: '1.5' }}>
                    {battle.combatLog.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '10px' }}>⏳ Waiting for first combat tick...</div>
                    )}
                    {battle.combatLog.slice(-20).reverse().map((entry, i) => {
                      // Color & prefix by type+side
                      const isAtk = entry.side === 'attacker'
                      let color = '#94a3b8'
                      let prefix = '[---]'
                      let bgTint = 'transparent'
                      if (entry.type === 'damage' && isAtk) { color = '#f87171'; prefix = '[ATK]'; bgTint = 'rgba(239,68,68,0.04)' }
                      else if (entry.type === 'damage' && !isAtk) { color = '#60a5fa'; prefix = '[DEF]'; bgTint = 'rgba(59,130,246,0.04)' }
                      else if ((entry.type as string) === 'dodge') { color = '#fbbf24'; prefix = '[DGE]'; bgTint = 'rgba(251,191,36,0.04)' }
                      else if ((entry.type as string) === 'crit') { color = '#fb923c'; prefix = '[CRT]'; bgTint = 'rgba(251,146,60,0.06)' }
                      else if (entry.type === 'destroyed') { color = '#64748b'; prefix = '[KIA]'; bgTint = 'rgba(100,116,139,0.06)' }
                      else if ((entry.type as string) === 'reinforcement') { color = '#22d38a'; prefix = '[RNF]'; bgTint = 'rgba(34,211,138,0.04)' }
                      else if (entry.type === 'phase_change') { color = '#a78bfa'; prefix = '[SYS]'; bgTint = 'rgba(167,139,250,0.04)' }
                      // Alternating row
                      const rowBg = i % 2 === 0 ? bgTint : `rgba(255,255,255,0.015)`
                      // Highlight numbers in message
                      const msgParts = entry.message.replace(/^[⚔️🛡️💨💀🚀⏸️\s]+/, '').replace(/T\d+:\s*/, '').split(/(\d+)/g)
                      return (
                        <div key={`${entry.timestamp}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: rowBg, borderLeft: `2px solid ${color}` }}>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8', background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: '3px', flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>{fmtTicks(entry.tick)}</span>
                          <span style={{ fontWeight: 800, color, flexShrink: 0, letterSpacing: '0.5px' }}>{prefix}</span>
                          <span style={{ color: '#94a3b8' }}>
                            {msgParts.map((p, j) => /^\d+$/.test(p) ? <span key={j} style={{ color: '#e2e8f0', fontWeight: 700 }}>{p}</span> : <span key={j}>{p}</span>)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>)}
          </div>
          </React.Fragment>
        )
      })}      {/* Fallback: if fewer than 3 battles, render center panel after all battle cards */}
      {panelFullscreen && activeBattles.length > 0 && activeBattles.length < 3 && (
        <div className="war-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
          {/* Tick Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.08)', borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.15)',
          }}>
            <span style={{ fontSize: '14px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: combatTickLeft <= 3 ? '#ef4444' : '#94a3b8' }}>
                <span>NEXT TICK</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: combatTickLeft <= 3 ? '#ef4444' : '#22d38a' }}>{combatTickLeft}s</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                <div style={{
                  width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                  background: combatTickLeft <= 3 ? '#ef4444' : '#22d38a',
                  transition: 'width 0.9s linear', borderRadius: '2px',
                }} />
              </div>
            </div>
          </div>
          {/* Food Grid */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'bread', count: player.bread, sta: 10, heal: 1 },
              { key: 'sushi', count: player.sushi, sta: 20, heal: 2 },
              { key: 'wagyu', count: player.wagyu, sta: 30, heal: 3 },
            ].map(f => (
              <button key={f.key} disabled={f.count <= 0}
                onClick={() => {
                  player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                  const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                  if (result.success) console.log(result.message)
                }}
                style={{
                  flex: 1, padding: '6px 3px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                  background: f.count > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${f.count > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
                }}
              >
                <img src={`/assets/food/${f.key}.png`} alt={f.key} style={{ width: '24px', height: '24px', objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>{f.count}</div>
                <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
                <div style={{ fontSize: '7px', color: '#22c55e' }}>+{f.heal}% HP</div>
              </button>
            ))}
          </div>
          {/* Mini Leaderboard */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '3px' }}>🏆 TOP DAMAGE TODAY</div>
            {(() => {
              const dealers: Record<string, number> = {}
              activeBattles.forEach(b => {
                Object.entries(b.attackerDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                Object.entries(b.defenderDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
              })
              const sorted = Object.entries(dealers).sort((a, b) => b[1] - a[1]).slice(0, 5)
              const maxDmg = sorted[0]?.[1] || 1
              if (sorted.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '6px' }}>No damage dealt yet</div>
              return sorted.map(([name, dmg], i) => {
                const isMe = name === player.name
                const pct = (dmg / maxDmg) * 100
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '8px', fontWeight: 900, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b', width: '12px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '1px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : i === 0 ? '#22d38a' : '#3b82f6', borderRadius: '1px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Past Battles */}
      {pastBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📜 BATTLE HISTORY</div>
          {pastBattles.map(battle => (
            <div className={`war-history-row war-history-row--${battle.status}`} key={battle.id}>
              <span>{getCountryFlag(battle.attackerId)} vs {getCountryFlag(battle.defenderId)}</span>
              <span>{battle.regionName}</span>
              <span className={`war-history-result war-history-result--${battle.status}`}>
                {battle.status === 'attacker_won' ? '🏆 ATK WON' : '🛡️ DEF WON'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
