import { useState } from 'react'
import { useOccupationStore, type OccupationActionType } from '../../stores/occupationStore'
import { useUIStore } from '../../stores/uiStore'

const ACTIONS: { type: OccupationActionType; icon: string; name: string; desc: string; variant: string }[] = [
  { type: 'scouting',         icon: '🔭', name: 'SCOUT',      desc: 'Reveal production & scrap values',     variant: 'scout' },
  { type: 'destroy',          icon: '💥', name: 'DESTROY',     desc: 'Destroy up to 20% of companies',       variant: 'destroy' },
  { type: 'power_down',       icon: '⚡', name: 'POWER DOWN', desc: 'Disable all companies indefinitely',   variant: 'power' },
  { type: 'hijack_production',icon: '🏭', name: 'HIJACK PROD', desc: 'Redirect production for 72h',         variant: 'hijack-prod' },
  { type: 'hijack_taxes',     icon: '💰', name: 'HIJACK TAX',  desc: 'Redirect tax income for 72h',         variant: 'hijack-tax' },
  { type: 'passive',          icon: '🏳️', name: 'PASSIVE',     desc: 'Hold territory, no exploitation',     variant: 'passive' },
]

export default function OccupationPanel() {
  const occ = useOccupationStore()
  const ui = useUIStore()
  const occupations = Object.values(occ.occupations)
  const [selectedOccId, setSelectedOccId] = useState<string | null>(null)

  if (occupations.length === 0) {
    return (
      <div className="war-card" style={{ textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏴</div>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>NO OCCUPIED REGIONS</div>
        <div style={{ fontSize: '9px', color: '#475569', marginTop: '4px' }}>
          Win a full-scale attack to occupy enemy territory.
        </div>
      </div>
    )
  }

  const selected = selectedOccId ? occ.occupations[selectedOccId] : null

  return (
    <div className="occupation-panel">
      {/* Occupation list */}
      {occupations.map(o => (
        <div
          key={o.id}
          className="occupation-header"
          onClick={() => setSelectedOccId(selectedOccId === o.id ? null : o.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className="occupation-header__flag">🏴</span>
          <div className="occupation-header__info">
            <div className="occupation-header__region">
              {o.occupiedCountry} — OCCUPIED
            </div>
            <div className="occupation-header__status">
              {o.activeAction ? `Active: ${o.activeAction.type.replace(/_/g, ' ').toUpperCase()}` : 'No action selected'}
              {' · '}Since {new Date(o.establishedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}

      {/* Action Grid for selected occupation */}
      {selected && (
        <>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '1px' }}>
            SELECT OCCUPATION ACTION
          </div>

          <div className="occ-actions-grid">
            {ACTIONS.map(a => (
              <div
                key={a.type}
                className={`occ-action-card occ-action-card--${a.variant} ${selected.activeAction?.type === a.type ? 'occ-action-card--active' : ''}`}
                onClick={() => {
                  if (a.type === 'scouting') {
                    const report = occ.scoutRegion(selected.id)
                    if (report) {
                      ui.addFloatingText(`Scouted! ${report.companies.length} companies found.`, window.innerWidth / 2, window.innerHeight / 2, '#22d3ee')
                    }
                  } else if (a.type === 'power_down') {
                    const r = occ.powerDown(selected.id)
                    ui.addFloatingText(`⚡ ${r.companiesDisabled} companies disabled!`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
                  } else if (a.type === 'hijack_production') {
                    const r = occ.hijackProduction(selected.id)
                    ui.addFloatingText(`🏭 ${r.companiesHijacked} companies hijacked for 72h!`, window.innerWidth / 2, window.innerHeight / 2, '#a855f7')
                  } else if (a.type === 'hijack_taxes') {
                    const r = occ.hijackTaxes(selected.id)
                    ui.addFloatingText(`💰 $${r.taxIncome.toLocaleString()} tax income redirected!`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
                  } else if (a.type === 'passive') {
                    occ.setPassive(selected.id)
                    ui.addFloatingText('🏳️ Passive occupation set.', window.innerWidth / 2, window.innerHeight / 2, '#94a3b8')
                  } else if (a.type === 'destroy') {
                    // For simplicity, destroy first available companies
                    const r = occ.destroyInfrastructure(selected.id, [])
                    ui.addFloatingText(`💥 ${r.destroyed} companies destroyed! +${r.scrapsGained} scraps`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                  }
                }}
                style={{ borderWidth: selected.activeAction?.type === a.type ? '2px' : '1px' }}
              >
                <span className="occ-action-card__icon">{a.icon}</span>
                <span className="occ-action-card__name">{a.name}</span>
                <span className="occ-action-card__desc">{a.desc}</span>
              </div>
            ))}
          </div>

          {/* Active action details */}
          {selected.activeAction?.type === 'power_down' && (
            <button
              className="war-btn war-btn--primary"
              style={{ width: '100%', marginTop: '4px' }}
              onClick={() => {
                occ.liftPowerDown(selected.id)
                ui.addFloatingText('Power restored.', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
              }}
            >
              🔌 RESTORE POWER
            </button>
          )}

          {/* End occupation */}
          <button
            className="war-btn war-btn--danger"
            style={{ width: '100%', marginTop: '4px', fontSize: '9px' }}
            onClick={() => {
              occ.endOccupation(selected.id)
              setSelectedOccId(null)
              ui.addFloatingText('Occupation ended.', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
            }}
          >
            🏴 END OCCUPATION
          </button>

          {/* Scouting Report */}
          {selected.scoutingReport && (
            <div className="occ-scout-report">
              <div className="occ-scout-report__title">📊 SCOUTING REPORT</div>
              <div className="occ-scout-row">
                <span className="occ-scout-row__label">Total Companies</span>
                <span className="occ-scout-row__value">{selected.scoutingReport.companies.length}</span>
              </div>
              <div className="occ-scout-row">
                <span className="occ-scout-row__label">Production/Day</span>
                <span className="occ-scout-row__value">{selected.scoutingReport.totalProductionPerDay.toLocaleString()}</span>
              </div>
              <div className="occ-scout-row">
                <span className="occ-scout-row__label">Total Scrap Value</span>
                <span className="occ-scout-row__value" style={{ color: '#f59e0b' }}>{selected.scoutingReport.totalScrapValue.toLocaleString()}</span>
              </div>
              <div className="occ-scout-row">
                <span className="occ-scout-row__label">Tax Income/Day</span>
                <span className="occ-scout-row__value" style={{ color: '#22d38a' }}>${selected.scoutingReport.totalTaxIncomePerDay.toLocaleString()}</span>
              </div>

              {/* Infrastructure */}
              {selected.scoutingReport.infrastructure.map((inf, i) => (
                <div key={i} className="occ-scout-row">
                  <span className="occ-scout-row__label">{inf.type}</span>
                  <span className="occ-scout-row__value">Lv.{inf.level}</span>
                </div>
              ))}

              {/* Company Details */}
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>COMPANIES</div>
              {selected.scoutingReport.companies.slice(0, 8).map((c, i) => (
                <div key={i} className="occ-scout-row">
                  <span className="occ-scout-row__label">{c.type} (Lv.{c.level})</span>
                  <span className="occ-scout-row__value" style={{ fontSize: '8px' }}>
                    {c.productionPerDay}/day · Scrap: {c.scrapValue}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
