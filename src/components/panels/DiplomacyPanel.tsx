import { useState } from 'react'
import { useDiplomacyStore } from '../../stores/diplomacyStore'
import { useWorldStore } from '../../stores/worldStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { getCountryName } from '../../stores/battleStore'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/diplomacy-chat.css'

type Tab = 'active' | 'proposals' | 'new'

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'EXPIRED'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export default function DiplomacyPanel() {
  const [tab, setTab] = useState<Tab>('active')
  const [targetCountry, setTargetCountry] = useState('')
  const playerIso = usePlayerStore((s) => s.countryCode) || 'US'
  const countries = useWorldStore((s) => s.countries)
  const diplo = useDiplomacyStore()
  const addNotification = useUIStore((s) => s.addNotification)

  const active = diplo.getActiveAgreements(playerIso)
  const pendingProposals = diplo.proposals.filter((p) => p.status === 'pending' && (p.fromCountry === playerIso || p.toCountry === playerIso))

  const handlePropose = (type: 'peace' | 'nap' | 'trade') => {
    if (!targetCountry) return
    const fn = type === 'peace' ? diplo.proposePeace : type === 'nap' ? diplo.proposeNAP : diplo.proposeTrade
    const result = fn(playerIso, targetCountry)
    addNotification({ type: result.success ? 'success' : 'warning', message: result.message })
    // Auto-accept for demo (AI countries)
    if (result.success) {
      const proposal = useDiplomacyStore.getState().proposals[0]
      if (proposal) {
        setTimeout(() => {
          diplo.acceptProposal(proposal.id)
          addNotification({ type: 'success', message: `${getCountryName(targetCountry)} accepted your ${type} proposal!` })
        }, 2000)
      }
    }
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Tabs */}
      <div className="diplo-tabs">
        {(['active', 'proposals', 'new'] as Tab[]).map((t) => (
          <button key={t} className={`diplo-tab ${tab === t ? 'diplo-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t === 'active' ? `📜 Active (${active.treaties.length + active.naps.length + active.tradeDeals.length})` : t === 'proposals' ? `📨 Proposals (${pendingProposals.length})` : '🤝 New'}
          </button>
        ))}
      </div>

      {/* Active Agreements */}
      {tab === 'active' && (
        <div>
          {active.treaties.length + active.naps.length + active.tradeDeals.length === 0 ? (
            <div className="hud-card" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>No active agreements</div>
            </div>
          ) : (
            <>
              {active.treaties.map((t) => {
                const other = t.country1 === playerIso ? t.country2 : t.country1
                return (
                  <div key={t.id} className="diplo-agreement">
                    <CountryFlag iso={other} size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{getCountryName(other)}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Expires: {formatTimeLeft(t.expiresAt)}</div>
                    </div>
                    <span className="diplo-agreement__type diplo-agreement__type--peace">🕊️ PEACE</span>
                  </div>
                )
              })}
              {active.naps.map((n) => {
                const other = n.country1 === playerIso ? n.country2 : n.country1
                return (
                  <div key={n.id} className="diplo-agreement">
                    <CountryFlag iso={other} size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{getCountryName(other)}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Expires: {formatTimeLeft(n.expiresAt)}</div>
                    </div>
                    <span className="diplo-agreement__type diplo-agreement__type--nap">🤝 NAP</span>
                  </div>
                )
              })}
              {active.tradeDeals.map((d) => {
                const other = d.country1 === playerIso ? d.country2 : d.country1
                return (
                  <div key={d.id} className="diplo-agreement">
                    <CountryFlag iso={other} size={18} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{getCountryName(other)}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>+{d.bonus}% trade · Expires: {formatTimeLeft(d.expiresAt)}</div>
                    </div>
                    <span className="diplo-agreement__type diplo-agreement__type--trade">💰 TRADE</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* Proposals */}
      {tab === 'proposals' && (
        <div>
          {pendingProposals.length === 0 ? (
            <div className="hud-card" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>No pending proposals</div>
            </div>
          ) : (
            pendingProposals.map((p) => {
              const isIncoming = p.toCountry === playerIso
              const otherCountry = isIncoming ? p.fromCountry : p.toCountry
              return (
                <div key={p.id} className="diplo-agreement">
                  <CountryFlag iso={otherCountry} size={18} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{getCountryName(otherCountry)}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{isIncoming ? 'Incoming' : 'Sent'} · {p.type.toUpperCase()}</div>
                  </div>
                  {isIncoming && (
                    <div className="diplo-proposal-actions">
                      <button className="diplo-btn diplo-btn--accept" onClick={() => diplo.acceptProposal(p.id)}>✓ ACCEPT</button>
                      <button className="diplo-btn diplo-btn--reject" onClick={() => diplo.rejectProposal(p.id)}>✕ REJECT</button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* New Agreement */}
      {tab === 'new' && (
        <div className="hud-card">
          <div className="hud-card__title">🌍 NEW AGREEMENT</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>TARGET COUNTRY</label>
            <select
              value={targetCountry}
              onChange={(e) => setTargetCountry(e.target.value)}
              style={{
                width: '100%', padding: '8px', borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '12px', fontFamily: 'var(--font-display)',
              }}
            >
              <option value="">Select country...</option>
              {countries.filter((c) => c.code !== playerIso && c.code !== 'OC').map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="diplo-btn diplo-btn--accept" style={{ flex: 1, padding: '8px' }} onClick={() => handlePropose('peace')} disabled={!targetCountry}>🕊️ PEACE</button>
            <button className="diplo-btn diplo-btn--accept" style={{ flex: 1, padding: '8px', borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa', background: 'rgba(59,130,246,0.1)' }} onClick={() => handlePropose('nap')} disabled={!targetCountry}>🤝 NAP</button>
            <button className="diplo-btn diplo-btn--accept" style={{ flex: 1, padding: '8px', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }} onClick={() => handlePropose('trade')} disabled={!targetCountry}>💰 TRADE</button>
          </div>
          <div style={{ marginTop: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
            <div>🕊️ <b>Peace Treaty</b> — Ends active war, 24h no-attack cooldown</div>
            <div>🤝 <b>Non-Aggression Pact</b> — 48h mutual non-attack agreement</div>
            <div>💰 <b>Trade Agreement</b> — +10% trade income for 72h</div>
          </div>
        </div>
      )}
    </div>
  )
}
