import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/armyStore'
import { useBattleStore, getCountryName } from '../../stores/battleStore'
import { useUIStore } from '../../stores/uiStore'
import CountryFlag from '../shared/CountryFlag'
import { fmtElapsed } from './warHelpers'

export default function WarOverviewTab({ iso }: { iso: string }) {
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
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 60 ? '#f59e0b' : '#3b82f6'

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
            { label: 'READY', value: readyDivs, color: '#3b82f6' },
            { label: 'TRAINING', value: trainingDivs, color: '#f59e0b' },
            { label: 'COMBAT', value: inCombatDivs, color: '#60a5fa' },
            { label: 'BATTLES', value: activeBattles.length, color: '#60a5fa' },
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
              <span style={{ color: '#3b82f6' }}>🛡️ {totalHp.toLocaleString()} HP</span>
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
              <div style={{ width: `${comp.total ? (comp.land / comp.total)*100 : 0}%`, background: '#60a5fa' }} />
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
              <span style={{ color: fullyGeared > 0 ? '#3b82f6' : '#64748b' }}>Full: {fullyGeared}</span>
              <span style={{ color: someGear > 0 ? '#f59e0b' : '#64748b' }}>Partial: {someGear}</span>
              <span style={{ color: noGear > 0 ? '#ef4444' : '#64748b' }}>Empty: {noGear}</span>
            </div>
          </div>

          {/* 6. Experience */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>ARMY VETERANCY</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0' }}>Level {avgLevel}</div>
            <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', marginTop: '2px' }}>
              <div style={{ width: `${avgExp % 10}0%`, height: '100%', background: '#3b82f6' }} />
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
                  <span><CountryFlag iso={battle.attackerId} size={14} style={{ marginRight: '3px' }} /> {getCountryName(battle.attackerId)}</span>
                  <span style={{ color: '#64748b', fontSize: '8px' }}>{fmtElapsed(battle.startedAt)} • R{battle.rounds.length}/3</span>
                  <span>{getCountryName(battle.defenderId)} <CountryFlag iso={battle.defenderId} size={14} style={{ marginLeft: '3px' }} /></span>
                </div>
                {/* Compact damage bar */}
                <div style={{ position: 'relative', height: '14px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: '#3b82f6', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: '#ef4444', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#fff', transform: 'translateX(-1px)', zIndex: 2, opacity: 0.5 }} />
                  <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
                </div>
                {activeRound && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ color: '#3b82f6' }}>{activeRound.attackerPoints} pts</span>
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
