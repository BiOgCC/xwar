import { useState, type ReactNode } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useSpecializationStore } from '../../stores/specializationStore'
import { Swords, Briefcase, Landmark, Crosshair, Sparkles, Gift, Zap, Clock, FlaskConical, Info } from 'lucide-react'
import SpecDetailPanel from './profile/SpecDetailPanel'
import type { SpecKey } from './profile/SpecDetailPanel'

const ICON_PROPS = { size: 14, strokeWidth: 2 }
const RADAR_SIZE = 160
const CX = RADAR_SIZE / 2
const CY = RADAR_SIZE / 2
const MAX_R = 55
const MAX_TIER = 5

function getPoint(tierObj: { tier: number; percent: number }, angleDeg: number) {
  const effTier = Math.min(MAX_TIER, tierObj.tier + (tierObj.tier === 5 ? 0 : tierObj.percent / 100))
  const r = (effTier / MAX_TIER) * MAX_R
  const angleRad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(angleRad), y: CY + r * Math.sin(angleRad) }
}

function getBgPoint(tier: number, angleDeg: number) {
  const r = (tier / MAX_TIER) * MAX_R
  const angleRad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(angleRad), y: CY + r * Math.sin(angleRad) }
}

const AXISES: { key: SpecKey; icon: ReactNode; angle: number; color: string; title: string }[] = [
  { key: 'mil', icon: <Swords {...ICON_PROPS} />, angle: 0, color: '#f87171', title: 'Military' },
  { key: 'eco', icon: <Briefcase {...ICON_PROPS} />, angle: 72, color: '#38bdf8', title: 'Economy' },
  { key: 'mer', icon: <Crosshair {...ICON_PROPS} />, angle: 144, color: '#22d38a', title: 'Mercenary' },
  { key: 'inf', icon: <Sparkles {...ICON_PROPS} />, angle: 216, color: '#eab308', title: 'Influencer' },
  { key: 'pol', icon: <Landmark {...ICON_PROPS} />, angle: 288, color: '#a855f7', title: 'Politician' },
]

/* ── How-to-earn data ─────────────────────────────── */
interface ActionRow { action: string; xp: string; cap: string; color: string }

const CATEGORY_ACTIONS: { key: SpecKey; name: string; icon: ReactNode; color: string; actions: ActionRow[] }[] = [
  {
    key: 'mil', name: 'Military', icon: <Swords size={12} color="#f87171" />, color: '#f87171',
    actions: [
      { action: 'Deal 10k damage', xp: '+1 XP', cap: '25/day', color: '#f87171' },
      { action: 'Win a round', xp: '+10 XP', cap: '3/day', color: '#f87171' },
      { action: 'Train division', xp: '+3 XP', cap: '2/day', color: '#f87171' },
    ],
  },
  {
    key: 'eco', name: 'Economic', icon: <Briefcase size={12} color="#38bdf8" />, color: '#38bdf8',
    actions: [
      { action: 'Work', xp: '+2 XP', cap: '12/day', color: '#38bdf8' },
      { action: 'Produce (company)', xp: '+3 XP', cap: '2/day', color: '#38bdf8' },
      { action: 'Donate $100k', xp: '+10 XP', cap: '1/day', color: '#38bdf8' },
    ],
  },
  {
    key: 'pol', name: 'Politician', icon: <Landmark size={12} color="#a855f7" />, color: '#a855f7',
    actions: [
      { action: 'Country war 10k dmg', xp: '+1 XP', cap: '20/day', color: '#a855f7' },
      { action: 'Donate $100k (pol)', xp: '+10 XP', cap: '1/day', color: '#a855f7' },
      { action: 'Win election (66%+)', xp: '+66 XP', cap: '1/day', color: '#a855f7' },
      { action: 'Hold office', xp: '+3 XP', cap: '1/day', color: '#a855f7' },
    ],
  },
  {
    key: 'mer', name: 'Mercenary', icon: <Crosshair size={12} color="#22d38a" />, color: '#22d38a',
    actions: [
      { action: 'Abroad 10k dmg', xp: '+1 XP', cap: '20/day', color: '#22d38a' },
      { action: 'Abroad round win', xp: '+8 XP', cap: '5/day', color: '#22d38a' },
      { action: 'Claim bounty', xp: '+15 XP', cap: '1/day', color: '#22d38a' },
      { action: 'Abroad kill', xp: '+5 XP', cap: '5/day', color: '#22d38a' },
    ],
  },
  {
    key: 'inf', name: 'Influencer', icon: <Sparkles size={12} color="#eab308" />, color: '#eab308',
    actions: [
      { action: 'Wall post', xp: '+3 XP', cap: '5/day', color: '#eab308' },
      { action: 'Mentee progress', xp: '+8 XP', cap: '3/day', color: '#eab308' },
      { action: 'Publish article', xp: '+5 XP', cap: '2/day', color: '#eab308' },
      { action: 'Referral', xp: '+15 XP', cap: '1/day', color: '#eab308' },
      { action: 'Blood pact level', xp: '+12 XP', cap: '2/day', color: '#eab308' },
    ],
  },
]

const DAILY_XP_CAP = 200

export default function SpecializationTab() {
  const player = usePlayerStore()
  const ss = useSpecializationStore()
  const [activeSpec, setActiveSpec] = useState<SpecKey | null>(null)

  const mil = ss.getMilitaryTier()
  const eco = ss.getEconomicTier()
  const pol = ss.getPoliticianTier()
  const mer = ss.getMercenaryTier()
  const inf = ss.getInfluencerTier()
  const milB = ss.getMilitaryBonuses()
  const ecoB = ss.getEconomicBonuses()
  const polB = ss.getPoliticianBonuses()
  const merB = ss.getMercenaryBonuses()
  const infB = ss.getInfluencerBonuses()

  // Daily XP per category
  const dailyMil = ss.dailyMilitaryPoints
  const dailyEco = ss.dailyEconomicPoints
  const dailyPol = ss.dailyPoliticianPoints
  const dailyMer = ss.dailyMercenaryPoints
  const dailyInf = ss.dailyInfluencerPoints
  const dailyTotal = dailyMil + dailyEco + dailyPol + dailyMer + dailyInf
  const dailyPct = Math.min(100, (dailyTotal / DAILY_XP_CAP) * 100)

  // If a spec detail is selected, show it
  if (activeSpec) {
    return <SpecDetailPanel specKey={activeSpec} onBack={() => setActiveSpec(null)} />
  }

  const bars = [
    { key: 'mil' as SpecKey, icon: <Swords {...ICON_PROPS} color="#f87171" />, name: 'Military', tier: mil, color: '#f87171', trackClass: 'ptab-spec-card__mil', border: 'rgba(239,68,68,0.2)',
      bonus: milB.damagePercent > 0 ? `+${milB.damagePercent}% DMG${milB.critRatePercent > 0 ? `, +${milB.critRatePercent}% CRIT` : ''}${milB.bohDropPercent > 0 ? `, +${milB.bohDropPercent}% 🎖️ Drop` : ''}${milB.bohWinBonus > 0 ? ` (+${milB.bohWinBonus}/win)` : ''}` : '' },
    { key: 'eco' as SpecKey, icon: <Briefcase {...ICON_PROPS} color="#38bdf8" />, name: 'Economic', tier: eco, color: '#38bdf8', trackClass: 'ptab-spec-card__eco', border: 'rgba(56,189,248,0.2)',
      bonus: ecoB.extraCompanySlots > 0 ? `+${ecoB.extraCompanySlots} Companies${ecoB.productionPercent > 0 ? `, +${ecoB.productionPercent}% Prod` : ''}` : '' },
    { key: 'pol' as SpecKey, icon: <Landmark {...ICON_PROPS} color="#a855f7" />, name: 'Politician', tier: pol, color: '#a855f7', trackClass: 'ptab-spec-card__mil', border: 'rgba(168,85,247,0.2)',
      bonus: polB.countryDamage > 0 ? `Country: +${polB.countryDamage}% DMG/Prod/Prosp/Ind${polB.countryDodge > 0 ? '/Agility' : ''} (as Pres.)` : '' },
    { key: 'mer' as SpecKey, icon: <Crosshair {...ICON_PROPS} color="#22d38a" />, name: 'Mercenary', tier: mer, color: '#22d38a', trackClass: 'ptab-spec-card__eco', border: 'rgba(34,211,138,0.2)',
      bonus: merB.abroadDamagePercent > 0 ? `+${merB.abroadDamagePercent}% Abroad DMG${merB.lootChancePercent > 0 ? `, +${merB.lootChancePercent}% Loot` : ''}` : '' },
    { key: 'inf' as SpecKey, icon: <Sparkles {...ICON_PROPS} color="#eab308" />, name: 'Influencer', tier: inf, color: '#eab308', trackClass: 'ptab-spec-card__eco', border: 'rgba(234,179,8,0.2)',
      bonus: infB.extraFriendSlots > 0 ? `+${infB.extraFriendSlots} Friends${infB.giftingTaxReduction > 0 ? `, -${infB.giftingTaxReduction}% Gift Tax` : ''}${infB.bloodPactXPBonus > 0 ? `, +${infB.bloodPactXPBonus}% Pact XP` : ''}` : '' },
  ]

  const playerPoints = [
    getPoint(mil, 0),
    getPoint(eco, 72),
    getPoint(mer, 144),
    getPoint(inf, 216),
    getPoint(pol, 288),
  ].map(p => `${p.x},${p.y}`).join(' ')

  const dailyCategories = [
    { label: 'MIL', value: dailyMil, color: '#f87171' },
    { label: 'ECO', value: dailyEco, color: '#38bdf8' },
    { label: 'POL', value: dailyPol, color: '#a855f7' },
    { label: 'MER', value: dailyMer, color: '#22d38a' },
    { label: 'INF', value: dailyInf, color: '#eab308' },
  ]

  return (
    <div className="spec-tab">
      {/* ══════════ DAILY XP SUMMARY ══════════ */}
      <div className="spec-tab__daily">
        <div className="spec-tab__daily-header">
          <span className="spec-tab__daily-icon"><Zap size={14} color="#22d38a" /></span>
          <span className="spec-tab__daily-title">DAILY XP</span>
          <span className="spec-tab__daily-clock"><Clock size={10} color="#64748b" /> Resets at 00:00 UTC</span>
        </div>
        <div className="spec-tab__daily-bar-wrap">
          <div className="spec-tab__daily-track">
            {/* Stacked segments */}
            {(() => {
              let offset = 0
              return dailyCategories.map(c => {
                const w = (c.value / DAILY_XP_CAP) * 100
                const left = offset
                offset += w
                return w > 0 ? (
                  <div
                    key={c.label}
                    className="spec-tab__daily-segment"
                    style={{ left: `${left}%`, width: `${Math.min(w, 100 - left)}%`, background: c.color }}
                  />
                ) : null
              })
            })()}
          </div>
          <div className="spec-tab__daily-nums">
            <span style={{ color: dailyPct >= 100 ? '#22d38a' : '#e2e8f0', fontWeight: 700 }}>{Math.round(dailyTotal)}</span>
            <span style={{ color: '#475569' }}>/</span>
            <span style={{ color: '#64748b' }}>{DAILY_XP_CAP} XP</span>
          </div>
        </div>
        {/* Per-category mini chips */}
        <div className="spec-tab__daily-chips">
          {dailyCategories.map(c => (
            <div key={c.label} className="spec-tab__daily-chip" style={{ borderColor: `${c.color}33` }}>
              <span className="spec-tab__daily-chip-dot" style={{ background: c.color }} />
              <span className="spec-tab__daily-chip-label">{c.label}</span>
              <span className="spec-tab__daily-chip-val" style={{ color: c.color }}>{Math.round(c.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════ RADAR CHART ══════════ */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        <svg width={RADAR_SIZE} height={RADAR_SIZE} style={{ overflow: 'visible' }}>
          {AXISES.map(a => {
            const p = getBgPoint(MAX_TIER, a.angle)
            return <line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          })}
          {[1,2,3,4,5].map(t => {
            const pts = AXISES.map(a => getBgPoint(t, a.angle)).map(p => `${p.x},${p.y}`).join(' ')
            return <polygon key={t} points={pts} fill={t % 2 === 0 ? "rgba(255,255,255,0.02)" : "none"} stroke="rgba(255,255,255,0.08)" strokeWidth={t === MAX_TIER ? 1 : 0.5} />
          })}
          <polygon points={playerPoints} fill="rgba(99, 102, 241, 0.2)" stroke="#818cf8" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.5))' }} />
          {[
            { p: getPoint(mil, 0), c: '#f87171' },
            { p: getPoint(eco, 72), c: '#38bdf8' },
            { p: getPoint(mer, 144), c: '#22d38a' },
            { p: getPoint(inf, 216), c: '#eab308' },
            { p: getPoint(pol, 288), c: '#a855f7' },
          ].map((pt, i) => (
            <circle key={`dot-${i}`} cx={pt.p.x} cy={pt.p.y} r="3" fill={pt.c} />
          ))}
          {AXISES.map(a => {
            const p = getBgPoint(MAX_TIER + 1.25, a.angle)
            return (
              <g key={a.key} onClick={() => setActiveSpec(a.key)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                <foreignObject x={p.x - 9} y={p.y - 9} width="18" height="18" style={{ pointerEvents: 'none', overflow: 'visible' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', color: a.color, filter: `drop-shadow(0 0 6px ${a.color}80)` }}>
                    {a.icon}
                  </div>
                </foreignObject>
                <title>{a.title}</title>
              </g>
            )
          })}
        </svg>
      </div>

      {/* ══════════ SPEC CARDS ══════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px' }}>
        {bars.map(b => (
          <div
            key={b.key}
            className="ptab-spec-card ptab-spec-card--clickable"
            style={{ borderColor: b.border, padding: '8px 10px' }}
            onClick={() => setActiveSpec(b.key)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: b.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{b.icon} {b.name} — T{b.tier.tier} {b.tier.label}</span>
              <span style={{ fontSize: '7px', color: '#94a3b8' }}>{b.tier.xp} / {b.tier.nextXP} XP</span>
            </div>
            <div className="ptab-spec-card__track" style={{ height: '5px' }}>
              <div className={b.trackClass} style={{ width: `${b.tier.percent}%` }} />
            </div>
            {b.bonus && (
              <div style={{ fontSize: '7px', color: b.color, marginTop: '2px', opacity: 0.85 }}>{b.bonus}</div>
            )}
          </div>
        ))}
      </div>

      {/* ══════════ RP PRODUCTION INFO ══════════ */}
      <div className="spec-tab__rp-card">
        <div className="spec-tab__rp-header">
          <FlaskConical size={14} color="#a78bfa" />
          <span className="spec-tab__rp-title">RESEARCH POINTS (RP)</span>
        </div>
        <div className="spec-tab__rp-desc">
          Your daily specialization XP generates <strong style={{ color: '#a78bfa' }}>Research Points</strong> for your country.
          The more active you are, the faster your nation can unlock new technologies.
        </div>
        <div className="spec-tab__rp-formula">
          <Info size={10} color="#64748b" />
          <span>Every 1 Specialization XP earned = 1 RP contributed to your country's research pool</span>
        </div>
        <div className="spec-tab__rp-today">
          <span>Today's RP contribution:</span>
          <span className="spec-tab__rp-today-val">+{Math.round(dailyTotal)} RP</span>
        </div>
      </div>

      {/* ══════════ HOW TO EARN XP ══════════ */}
      <div className="spec-tab__actions">
        <div className="spec-tab__actions-title">
          <Zap size={12} color="#22d38a" /> HOW TO EARN XP
        </div>
        <div className="spec-tab__actions-note">
          Max 200 XP/day across all specializations. After hitting the daily action cap, XP is halved.
        </div>
        {CATEGORY_ACTIONS.map(cat => (
          <div key={cat.key} className="spec-tab__action-group">
            <div className="spec-tab__action-group-header" style={{ color: cat.color }}>
              {cat.icon} <span>{cat.name}</span>
            </div>
            <div className="spec-tab__action-table">
              {cat.actions.map((a, i) => (
                <div key={i} className="spec-tab__action-row">
                  <span className="spec-tab__action-name">{a.action}</span>
                  <span className="spec-tab__action-xp" style={{ color: a.color }}>{a.xp}</span>
                  <span className="spec-tab__action-cap">{a.cap}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ══════════ DONATE ══════════ */}
      <div className="ptab-section">
        <div className="ptab-section__title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Gift size={12} color="#22d38a" /> DONATE FOR SPECIALIZATION</div>
        <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>
          10 XP per $100,000 donated. 1 donate/day per type.
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { label: 'Economy', icon: <Briefcase size={12} strokeWidth={2} />, color: '#38bdf8', border: 'rgba(56,189,248,0.3)', bg: 'rgba(56,189,248,0.08)', fn: 'recordDonate' as const },
            { label: 'Military', icon: <Swords size={12} strokeWidth={2} />, color: '#f87171', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.08)', fn: 'recordMilitaryDonate' as const },
          ].map(d => (
            <button
              key={d.fn}
              style={{
                flex: 1, minWidth: '90px', padding: '8px 6px', fontSize: '9px', fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
                color: d.color, background: d.bg, border: `1px solid ${d.border}`,
                borderRadius: '6px', cursor: player.money >= 100000 ? 'pointer' : 'not-allowed',
                opacity: player.money >= 100000 ? 1 : 0.4,
                transition: 'all 150ms ease',
              }}
              disabled={player.money < 100000}
              onClick={() => {
                const amt = 100000
                if (player.money < amt) return
                player.spendMoney(amt)
                useSpecializationStore.getState()[d.fn](amt)
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{d.icon} {d.label}</span>
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 500, marginTop: '1px' }}>$100k</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
