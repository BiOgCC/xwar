import { usePlayerStore } from '../../../stores/playerStore'
import { useSpecializationStore } from '../../../stores/specializationStore'

/** Specialization bars (4 tracks) + Donate section */
export default function ProfileSpecBars() {
  const player = usePlayerStore()
  const ss = useSpecializationStore.getState()
  const mil = ss.getMilitaryTier()
  const eco = ss.getEconomicTier()
  const pol = ss.getPoliticianTier()
  const mer = ss.getMercenaryTier()
  const milB = ss.getMilitaryBonuses()
  const ecoB = ss.getEconomicBonuses()
  const polB = ss.getPoliticianBonuses()
  const merB = ss.getMercenaryBonuses()

  const bars = [
    { key: 'mil', icon: '⚔️', name: 'Military', tier: mil, color: '#f87171', trackClass: 'ptab-spec-card__mil', border: 'rgba(239,68,68,0.2)',
      bonus: milB.damagePercent > 0 ? `+${milB.damagePercent}% DMG${milB.critRatePercent > 0 ? `, +${milB.critRatePercent}% CRIT` : ''}` : '' },
    { key: 'eco', icon: '💼', name: 'Economic', tier: eco, color: '#38bdf8', trackClass: 'ptab-spec-card__eco', border: 'rgba(56,189,248,0.2)',
      bonus: ecoB.extraCompanySlots > 0 ? `+${ecoB.extraCompanySlots} Companies${ecoB.productionPercent > 0 ? `, +${ecoB.productionPercent}% Prod` : ''}` : '' },
    { key: 'pol', icon: '🏛️', name: 'Politician', tier: pol, color: '#a855f7', trackClass: 'ptab-spec-card__mil', border: 'rgba(168,85,247,0.2)',
      bonus: polB.countryDamage > 0 ? `Country: +${polB.countryDamage}% DMG/Prod/Prosp/Ind${polB.countryDodge > 0 ? '/Dodge' : ''} (as Pres.)` : '' },
    { key: 'mer', icon: '🪖', name: 'Mercenary', tier: mer, color: '#22d38a', trackClass: 'ptab-spec-card__eco', border: 'rgba(34,211,138,0.2)',
      bonus: merB.abroadDamagePercent > 0 ? `+${merB.abroadDamagePercent}% Abroad DMG${merB.lootChancePercent > 0 ? `, +${merB.lootChancePercent}% Loot` : ''}` : '' },
  ]

  return (
    <>
      {/* Spec Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {bars.map(b => (
          <div key={b.key} className="ptab-spec-card" style={{ borderColor: b.border, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: b.color }}>{b.icon} {b.name} — T{b.tier.tier} {b.tier.label}</span>
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
        <div className="ptab-section__title">🎁 DONATE FOR SPECIALIZATION</div>
        <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>
          10 XP per $100,000 donated. 1 donate/day per type.
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { label: '💼 Economy', color: '#38bdf8', border: 'rgba(56,189,248,0.3)', bg: 'rgba(56,189,248,0.08)', fn: 'recordDonate' as const },
            { label: '⚔️ Military', color: '#f87171', border: 'rgba(239,68,68,0.3)', bg: 'rgba(239,68,68,0.08)', fn: 'recordMilitaryDonate' as const },
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
              {d.label}
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 500, marginTop: '1px' }}>$100k</div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
