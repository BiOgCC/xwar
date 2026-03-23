import { useState, type ReactNode } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useSpecializationStore } from '../../../stores/specializationStore'
import { Swords, Briefcase, Landmark, Crosshair, Sparkles, Gift } from 'lucide-react'
import SpecDetailPanel from './SpecDetailPanel'
import type { SpecKey } from './SpecDetailPanel'

const ICON_PROPS = { size: 14, strokeWidth: 2 }

const RADAR_SIZE = 160
const CX = RADAR_SIZE / 2
const CY = RADAR_SIZE / 2
const MAX_R = 55
const MAX_TIER = 5

function getPoint(tierObj: { tier: number, percent: number }, angleDeg: number) {
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

const AXISES: { key: SpecKey; icon: ReactNode; angle: number; color: string; title: string; desc: string }[] = [
  { key: 'mil', icon: <Swords {...ICON_PROPS} />, angle: 0, color: '#f87171', title: 'Military', desc: 'Earn points fighting!' },
  { key: 'eco', icon: <Briefcase {...ICON_PROPS} />, angle: 72, color: '#38bdf8', title: 'Economy', desc: 'Earn points producing!' },
  { key: 'mer', icon: <Crosshair {...ICON_PROPS} />, angle: 144, color: '#22d38a', title: 'Mercenary', desc: 'Earn points grinding damage!' },
  { key: 'inf', icon: <Sparkles {...ICON_PROPS} />, angle: 216, color: '#eab308', title: 'Influencer', desc: 'Earn points being you!' },
  { key: 'pol', icon: <Landmark {...ICON_PROPS} />, angle: 288, color: '#a855f7', title: 'Politician', desc: 'Earn points helping your country!' },
]

/** Specialization bars + Radar chart + Donate section */
export default function ProfileSpecBars() {
  const player = usePlayerStore()
  const ss = useSpecializationStore.getState()
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

  // ── If a spec is selected, show the detail panel ──
  if (activeSpec) {
    return <SpecDetailPanel specKey={activeSpec} onBack={() => setActiveSpec(null)} />
  }

  const playerPoints = [
    getPoint(mil, 0),
    getPoint(eco, 72),
    getPoint(mer, 144),
    getPoint(inf, 216),
    getPoint(pol, 288),
  ].map(p => `${p.x},${p.y}`).join(' ')

  return (
    <>
      {/* Radar Chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', marginTop: '16px' }}>
        <svg width={RADAR_SIZE} height={RADAR_SIZE} style={{ overflow: 'visible' }}>
          {/* Background Rays */}
          {AXISES.map(a => {
            const p = getBgPoint(MAX_TIER, a.angle)
            return <line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          })}
          
          {/* Background Pentagons */}
          {[1,2,3,4,5].map(t => {
            const pts = AXISES.map(a => getBgPoint(t, a.angle)).map(p => `${p.x},${p.y}`).join(' ')
            return <polygon key={t} points={pts} fill={t % 2 === 0 ? "rgba(255,255,255,0.02)" : "none"} stroke="rgba(255,255,255,0.08)" strokeWidth={t === MAX_TIER ? 1 : 0.5} />
          })}

          {/* Player Progress Polygon */}
          <polygon points={playerPoints} fill="rgba(99, 102, 241, 0.2)" stroke="#818cf8" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.5))' }} />
          
          {/* Player Progress Dots */}
          {[
            { p: getPoint(mil, 0), c: '#f87171' },
            { p: getPoint(eco, 72), c: '#38bdf8' },
            { p: getPoint(mer, 144), c: '#22d38a' },
            { p: getPoint(inf, 216), c: '#eab308' },
            { p: getPoint(pol, 288), c: '#a855f7' },
          ].map((pt, i) => (
            <circle key={`dot-${i}`} cx={pt.p.x} cy={pt.p.y} r="3" fill={pt.c} />
          ))}

          {/* Clickable Labels with Tooltips */}
          {AXISES.map(a => {
            const p = getBgPoint(MAX_TIER + 1.25, a.angle)
            return (
              <g
                key={a.key}
                onClick={() => setActiveSpec(a.key)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible larger hit area */}
                <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
                <foreignObject x={p.x - 9} y={p.y - 9} width="18" height="18" style={{ pointerEvents: 'none', overflow: 'visible' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', color: a.color, filter: `drop-shadow(0 0 6px ${a.color}80)` }}>
                    {a.icon}
                  </div>
                </foreignObject>
                <title>{a.title} — {a.desc}</title>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Spec Bars */}
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

      {/* Donate */}
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
    </>
  )
}
