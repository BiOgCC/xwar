import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/armyStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { usePlayerStore } from '../../stores/playerStore'

export default function WarRecruitTab() {
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
          background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.15))',
          border: '1px solid rgba(59,130,246,0.4)', borderRadius: '6px',
          color: '#3b82f6', fontWeight: 700, fontSize: '13px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.2s', letterSpacing: '0.5px', fontFamily: 'var(--font-display)',
        }}
      >
        💸 MAKE A CONTRACT
      </button>

      {/* ====== CONTRACT MODAL ====== */}
      {showContractModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '380px', background: '#1a1f2e', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', padding: '20px', position: 'relative' }}>
            <button onClick={() => setShowContractModal(false)} style={{ position: 'absolute', top: '10px', right: '12px', background: 'none', border: 'none', color: '#64748b', fontSize: '16px', cursor: 'pointer' }}>✕</button>

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#3b82f6', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
              💸 MILITARY CONTRACT
            </div>

            <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.6' }}>
              Invest money into the national defense fund. Your investment will be <b style={{ color: '#f59e0b' }}>locked for 24 hours</b>, after which you receive a <b style={{ color: '#3b82f6' }}>fixed 11% profit</b>. Each contract <b style={{ color: '#a855f7' }}>instantly spawns 1 new division</b> in the shop.
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
                style={{ width: '100%', accentColor: '#3b82f6' }}
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
                <span style={{ color: '#3b82f6', fontWeight: 600 }}>+${projectedProfit.toLocaleString()}</span>
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
                  background: player.money >= contractAmount ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.1)',
                  border: `1px solid ${player.money >= contractAmount ? 'rgba(59,130,246,0.4)' : 'rgba(100,116,139,0.2)'}`,
                  borderRadius: '5px', color: player.money >= contractAmount ? '#3b82f6' : '#64748b',
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
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: c.status === 'claimable' ? 'rgba(59,130,246,0.08)' : 'rgba(245,158,11,0.06)', border: `1px solid ${c.status === 'claimable' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.15)'}`, borderRadius: '5px', marginBottom: '4px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>
                    {c.status === 'locked' ? '🔒' : '✅'} ${c.investedAmount.toLocaleString()} → ${payout.toLocaleString()}
                    <span style={{ color: '#3b82f6', marginLeft: '4px', fontSize: '9px' }}>+${profit.toLocaleString()}</span>
                  </div>
                  {c.status === 'locked' && (
                    <div style={{ fontSize: '8px', color: '#f59e0b' }}>Unlocks in {hoursLeft}h {minsLeft}m</div>
                  )}
                </div>
                {c.status === 'claimable' && (
                  <button
                    onClick={() => handleClaimContract(c.id)}
                    style={{ padding: '4px 12px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '4px', color: '#3b82f6', fontWeight: 700, fontSize: '10px', cursor: 'pointer', animation: 'pulse 1.5s infinite' }}
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
            border: `1px solid ${sortPrice ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 3, background: sortPrice ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
            color: sortPrice ? '#3b82f6' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
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
            const priceColor = listing.price <= avgPrice ? '#3b82f6' : '#f59e0b'
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
                  <div className="war-recruit-stat"><span>ATK</span><span className="war-recruit-stat__val" style={{ color: sm.atkDmgMult > 0 ? '#3b82f6' : sm.atkDmgMult < 0 ? '#ef4444' : undefined }}>{fAtk}x</span></div>
                  <div className="war-recruit-stat"><span>Hit Rate</span><span className="war-recruit-stat__val" style={{ color: sm.hitRate > 0 ? '#3b82f6' : sm.hitRate < 0 ? '#ef4444' : undefined }}>{fHit}%</span></div>
                  <div className="war-recruit-stat"><span>CRTH</span><span className="war-recruit-stat__val" style={{ color: sm.critRateMult > 0 ? '#3b82f6' : sm.critRateMult < 0 ? '#ef4444' : undefined }}>{fCrit}x</span></div>
                  <div className="war-recruit-stat"><span>CRTD</span><span className="war-recruit-stat__val" style={{ color: sm.critDmgMult > 0 ? '#3b82f6' : sm.critDmgMult < 0 ? '#ef4444' : undefined }}>{fCritDmg}x</span></div>
                  <div className="war-recruit-stat"><span>Speed</span><span className="war-recruit-stat__val" style={{ color: sm.attackSpeed > 0 ? '#3b82f6' : sm.attackSpeed < 0 ? '#ef4444' : undefined }}>{fSpeed}s</span></div>
                  {/* Defensive */}
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val" style={{ color: sm.healthMult > 0 ? '#3b82f6' : sm.healthMult < 0 ? '#ef4444' : undefined }}>{fHp}x</span></div>
                  <div className="war-recruit-stat"><span>Armor</span><span className="war-recruit-stat__val" style={{ color: sm.armorMult > 0 ? '#3b82f6' : sm.armorMult < 0 ? '#ef4444' : undefined }}>{fArmor}x</span></div>
                  <div className="war-recruit-stat"><span>Dodge</span><span className="war-recruit-stat__val" style={{ color: sm.dodgeMult > 0 ? '#3b82f6' : sm.dodgeMult < 0 ? '#ef4444' : undefined }}>{fDodge}x</span></div>
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
