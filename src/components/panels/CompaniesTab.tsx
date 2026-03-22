import React, { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import InventorySummary from '../shared/InventorySummary'
import { useSkillsStore } from '../../stores/skillsStore'
import { useUIStore } from '../../stores/uiStore'
import { useWorldStore } from '../../stores/worldStore'
import {
  useCompanyStore,
  COMPANY_TEMPLATES,
  getUpgradeCost,
  getLocationBonus,
  type CompanyType,
} from '../../stores/companyStore'
import CompanyIcon from '../companies/CompanyIcon'
import {
  Building2, Hammer, Handshake, Briefcase, Package, Pickaxe,
  Scroll, Edit2, Trash2, Truck, Check, X, MapPin, Zap
} from 'lucide-react'

export default function CompaniesTab() {
  const player = usePlayerStore()
  const skills = useSkillsStore()
  const companyStore = useCompanyStore()
  const uiStore = useUIStore()
  const worldStore = useWorldStore()
  const [showBuild, setShowBuild] = useState(false)
  const [showJobs, setShowJobs] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [postJobCompanyId, setPostJobCompanyId] = useState<string | null>(null)
  const [postJobPayPerPP, setPostJobPayPerPP] = useState('2.0')
  const [moveCompanyId, setMoveCompanyId] = useState<string | null>(null)

  useEffect(() => {
    companyStore.fetchAll()
  }, [])

  const flash = (msg: string, duration = 3000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const spawnFloating = (e: React.MouseEvent, text: string, color?: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    uiStore.addFloatingText(text, rect.left + rect.width / 2, rect.top, color)
  }

  const handleEnterprise = async (e: React.MouseEvent, companyId: string) => {
    const result = await companyStore.doEnterprise(companyId)
    if (result) {
      if (result.type === 'error') flash(result.message)
      else spawnFloating(e, result.message, '#a855f7')
    }
  }

  const handleProduce = async (e: React.MouseEvent, companyId: string) => {
    const result = await companyStore.produceCompany(companyId)
    if (result) {
      if (result.type === 'error') flash(result.message)
      else spawnFloating(e, result.message, '#22d38a')
    }
  }

  const handleProspect = async (companyId: string) => {
    const deposit = await companyStore.prospect(companyId)
    if (deposit) {
      flash(`🎉 DEPOSIT FOUND! ${deposit.resource} in ${deposit.country}! +${deposit.bitcoinReward} ₿ jackpot!`, 5000)
    } else if (player.bitcoin < 1) {
      flash('❌ Need 1₿')
    } else {
      flash('🔍 No deposit found...')
    }
  }

  const handleBuild = async (type: CompanyType) => {
    if (await companyStore.buildCompany(type)) {
      flash(`✅ Built ${COMPANY_TEMPLATES[type].label}!`)
      setShowBuild(false)
    } else {
      flash('❌ Not enough resources')
    }
  }

  const handleUpgrade = async (companyId: string) => {
    if (await companyStore.upgradeCompany(companyId)) {
      flash('⬆️ Upgraded!')
    } else {
      flash('❌ Not enough resources')
    }
  }

  const handleJoinJob = (jobId: string) => {
    companyStore.setActiveJob(jobId)
    flash(`🤝 Joined ${companyStore.jobs.find(j => j.id === jobId)?.employerName}'s company`)
    setShowJobs(false)
  }

  const handleWork = async (e: React.MouseEvent) => {
    const result = await companyStore.doWork()
    if (result) {
      if (result.type === 'error') flash(result.message)
      else spawnFloating(e, result.message, '#3b82f6')
    }
  }

  const activeJob = companyStore.activeJobId
    ? companyStore.jobs.find(j => j.id === companyStore.activeJobId)
    : null

  const itemsInBusinessStr = companyStore.companies.length + (activeJob ? 1 : 0)

  return (
    <div className="ctab">
      {/* Toast */}
      {toast && (
        <div className={`ctab-toast ${toast.startsWith('🎉') ? 'ctab-toast--gold' : ''}`}>
          {toast}
        </div>
      )}

      {/* ── Mode Switch ─────────────────────────────── */}
      <div className="ctab-switch">
        <button
          className={`ctab-switch__btn ${!showJobs ? 'ctab-switch__btn--active' : ''}`}
          onClick={() => setShowJobs(false)}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}><Building2 size={16} /></span>
          <span>My Business</span>
          <span className="ctab-switch__count">{itemsInBusinessStr}</span>
        </button>
        <button
          className={`ctab-switch__btn ${showJobs ? 'ctab-switch__btn--active' : ''}`}
          onClick={() => setShowJobs(true)}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}><Hammer size={16} /></span>
          <span>Jobs Board</span>
          <span className="ctab-switch__count">{companyStore.jobs.length}</span>
        </button>
      </div>

      {/* ── MY BUSINESS ──────────────────────────────── */}
      {!showJobs && (
        <>
          {/* Inventory Summary */}
          <InventorySummary />

          {/* MY JOB */}
          <div className="ctab-section-hdr">
            <div className="ctab-section-hdr__left">
              <span className="ctab-section-hdr__dot" style={{ background: '#3b82f6' }} />
              <span className="ctab-section-hdr__title">MY JOB</span>
            </div>
            <span className="ctab-section-hdr__badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Hammer size={10} color="#60a5fa" /> Work: {Math.round(player.work)}/{player.maxWork}
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            {activeJob ? (() => {
              const template = COMPANY_TEMPLATES[activeJob.companyType]
              const prodSkill = skills.economic.production
              const baseProd = 10 + (prodSkill * 5)
              const contribution = Math.floor(baseProd * (1 + activeJob.productionBonus / 100))
              const estimatedPay = Math.floor(contribution * activeJob.payPerPP)
              const netPay = estimatedPay - Math.floor(estimatedPay * 0.05)
              const country = worldStore.getCountry(activeJob.location)
              return (
                <div className="ctab-job-card" style={{ borderColor: `${template.color}40` }}>
                  <div className="ctab-job-card__header" style={{ background: `linear-gradient(135deg, ${template.color}15, transparent)` }}>
                    <div className="ctab-job-card__icon" style={{ color: template.color, background: `${template.color}20`, border: `1px solid ${template.color}40` }}>
                      <CompanyIcon type={activeJob.companyType} />
                    </div>
                    <div className="ctab-job-card__info">
                      <span className="ctab-job-card__employer">{activeJob.employerName}</span>
                      <div className="ctab-job-card__meta">
                        <span style={{ color: template.color, fontSize: '9px', fontWeight: 700 }}>{template.label} LVL {activeJob.companyLevel}</span>
                        {activeJob.productionBonus > 0 && <span className="ctab-badge ctab-badge--green">+{activeJob.productionBonus}%</span>}
                        <span className="ctab-badge" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}><MapPin size={8} /> {country?.code || activeJob.location}</span>
                      </div>
                    </div>
                    <div className="ctab-job-card__pay">
                      <span className="ctab-job-card__pay-num">${activeJob.payPerPP.toFixed(1)}</span>
                      <span className="ctab-job-card__pay-lbl">per PP</span>
                    </div>
                  </div>
                  <div className="ctab-job-card__stats">
                    <span>~{contribution} PP</span>
                    <span>→</span>
                    <span style={{ color: '#22d38a', fontWeight: 700 }}>~${netPay} net</span>
                    <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: '8px' }}>Tax: ${Math.floor(estimatedPay * 0.1)}</span>
                  </div>
                  <button
                    className="ctab-job-card__work-btn"
                    onClick={handleWork}
                    disabled={Math.floor(player.work) < 10}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Hammer size={14} /> Work Now
                  </button>
                </div>
              )
            })() : (
              <div className="ctab-empty-job">
                <span className="ctab-empty-job__icon" style={{ display: 'flex', alignItems: 'center' }}><Briefcase size={24} color="#64748b" /></span>
                <span className="ctab-empty-job__text">No active job</span>
                <button className="ctab-empty-job__btn" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowJobs(true)}>
                  <Handshake size={14} /> Browse Jobs
                </button>
              </div>
            )}
          </div>

          {/* MY COMPANIES */}
          <div className="ctab-section-hdr">
            <div className="ctab-section-hdr__left">
              <span className="ctab-section-hdr__dot" style={{ background: '#22d38a' }} />
              <span className="ctab-section-hdr__title">MY COMPANIES</span>
              <span className="ctab-section-hdr__badge" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Briefcase size={10} color="#c084fc" /> Ent: {Math.round(player.entrepreneurship)}/{player.maxEntrepreneurship}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="ctab-build-btn"
                style={{ background: 'rgba(34,211,138,0.12)', color: '#22d38a', border: '1px solid rgba(34,211,138,0.3)' }}
                onClick={async () => {
                  const result = await companyStore.collectAll()
                  if (result.collected > 0) {
                    flash(`✅ Collected from ${result.collected} companies!`)
                  } else {
                    flash('Nothing to collect')
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={14} /> Collect All</div>
              </button>
              <button className="ctab-build-btn" onClick={() => setShowBuild(true)}>
                + Build
              </button>
            </div>
          </div>

          <div className="ctab-company-list">
            {companyStore.companies.map((company) => {
              const template = COMPANY_TEMPLATES[company.type]
              const bonus = getLocationBonus(company)
              const isProspector = company.type === 'prospection_center'
              const isFull = company.productionProgress >= company.productionMax
              const hasActiveJob = companyStore.jobs.some(j => j.companyId === company.id)
              const countryObj = worldStore.getCountry(company.location)
              const pct = Math.min(100, Math.floor(company.productionProgress / company.productionMax * 100))
              const isDisabled = company.disabledUntil && Date.now() < company.disabledUntil

              return (
                <div
                  key={company.id}
                  className={`ctab-company-card ${isDisabled ? 'ctab-company-card--disabled' : ''}`}
                  style={{ borderColor: `${template.color}35` }}
                >
                  {/* Card Header */}
                  <div className="ctab-company-card__header" style={{ background: `linear-gradient(135deg, ${template.color}12, transparent 80%)` }}>
                    <div className="ctab-company-card__icon" style={{ color: template.color, background: `${template.color}18`, border: `1px solid ${template.color}35` }}>
                      <CompanyIcon type={company.type} />
                    </div>

                    <div className="ctab-company-card__title-block">
                      <div className="ctab-company-card__name">{template.label}</div>
                      <div className="ctab-company-card__tags">
                        <span className="ctab-lvl-badge" style={{ color: template.color, borderColor: `${template.color}40` }}>LVL {company.level}</span>
                        {bonus > 0 && <span className="ctab-badge ctab-badge--green">+{bonus}%</span>}
                        {isProspector
                          ? <span className="ctab-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>+{(company.level * 5) + ((skills.economic.prospection || 0) * 5)}% CHANCE</span>
                          : <span className="ctab-badge ctab-badge--green">+{company.level} PP</span>
                        }
                        {company.autoProduction && <span className="ctab-badge ctab-badge--amber">⚡AUTO</span>}
                        {hasActiveJob && <span className="ctab-badge" style={{ background: 'rgba(34,211,138,0.1)', color: '#22d38a' }}>📋 HIRING</span>}
                      </div>
                    </div>

                    <div className="ctab-company-card__meta-right">
                      <span className="ctab-company-card__produces">{template.produces}</span>
                      <span className="ctab-company-card__location">📍 {countryObj?.code || company.location}</span>
                    </div>
                  </div>

                  {/* Production Bar (not prospector) */}
                  {!isProspector && (
                    <div className="ctab-prod-section">
                      <div className="ctab-prod-bar">
                        <div
                          className={`ctab-prod-bar__fill ${isFull ? 'ctab-prod-bar__fill--full' : ''}`}
                          style={{
                            width: `${pct}%`,
                            background: isFull
                              ? `linear-gradient(90deg, ${template.color}, #22d38a)`
                              : `linear-gradient(90deg, ${template.color}88, ${template.color})`,
                            boxShadow: isFull ? `0 0 10px ${template.color}88` : `0 0 5px ${template.color}44`,
                          }}
                        />
                      </div>
                      <div className="ctab-prod-labels">
                        <span className="ctab-prod-labels__pts">
                          {Math.floor(company.productionProgress)}<span style={{ color: '#475569' }}>/{company.productionMax}</span>
                        </span>
                        <span className="ctab-prod-labels__tick">
                          +{Number((Math.min(6, company.level) * (1 + bonus / 100)).toFixed(1))}/tick
                        </span>
                        <span className="ctab-prod-labels__pct" style={{ color: isFull ? '#22d38a' : '#64748b' }}>{pct}%</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="ctab-company-card__actions">
                    {isProspector ? (
                      <button
                        className="ctab-action-btn ctab-action-btn--prospect"
                        onClick={() => handleProspect(company.id)}
                        disabled={player.bitcoin < 1 || player.stamina < 10}
                      >
                        ⛏️ Prospect <span style={{ opacity: 0.7 }}>1₿ + 10 STA</span>
                      </button>
                    ) : (
                      <>
                        <button
                          className="ctab-action-btn ctab-action-btn--enterprise"
                          onClick={e => handleEnterprise(e, company.id)}
                          disabled={Math.floor(player.entrepreneurship) < 10 || isFull}
                          title="Spend Entrepreneurship to fill production bar"
                        >
                          💼 Enterprise
                        </button>
                        <button
                          className="ctab-action-btn ctab-action-btn--produce"
                          onClick={e => handleProduce(e, company.id)}
                          disabled={company.productionProgress <= 0}
                          title="Convert production points to output"
                        >
                          ⚙️ Produce
                        </button>
                      </>
                    )}
                    <button
                      className="ctab-action-btn ctab-action-btn--upgrade"
                      onClick={() => handleUpgrade(company.id)}
                      title="Upgrade (1₿)"
                    >
                      ⬆️ <span style={{ opacity: 0.7 }}>1₿</span>
                    </button>
                  </div>

                  {/* Post Job / Move row */}
                  {!isProspector && (
                    <div className="ctab-company-card__footer">
                      {postJobCompanyId === company.id ? (
                        <div className="ctab-post-job-form">
                          <span style={{ fontSize: '9px', color: '#94a3b8' }}>$/PP:</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={postJobPayPerPP}
                            onChange={e => setPostJobPayPerPP(e.target.value)}
                            className="ctab-post-job-input"
                          />
                          <button
                            className="ctab-footer-btn ctab-footer-btn--confirm"
                            onClick={async () => {
                              const val = parseFloat(postJobPayPerPP)
                              if (val > 0 && await companyStore.postJob(company.id, val)) {
                                flash(`📋 Job posted at $${val}/PP`)
                              }
                              setPostJobCompanyId(null)
                            }}
                          >✓</button>
                          <button
                            className="ctab-footer-btn"
                            style={{ color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}
                            onClick={() => setPostJobCompanyId(null)}
                          >✕</button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="ctab-footer-btn ctab-footer-btn--post"
                            onClick={() => setPostJobCompanyId(company.id)}
                          >
                            {hasActiveJob ? '✏️ Edit Job' : '📋 Post Job'}
                          </button>
                          {hasActiveJob && (
                            <button
                              className="ctab-footer-btn ctab-footer-btn--remove"
                              onClick={async () => { await companyStore.removeJob(company.id); flash('Job removed') }}
                            >🗑️</button>
                          )}
                          {moveCompanyId === company.id ? (
                            <select
                              className="ctab-move-select"
                              value={company.location}
                              onChange={async e => {
                                if (await companyStore.moveCompany(company.id, e.target.value)) {
                                  flash(`🚚 Moved to ${e.target.value}`)
                                } else {
                                  flash('❌ Need $500 to move')
                                }
                                setMoveCompanyId(null)
                              }}
                            >
                              {worldStore.countries.map(c => (
                                <option key={c.code} value={c.code}>{c.code} – {c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              className="ctab-footer-btn ctab-footer-btn--move"
                              onClick={() => setMoveCompanyId(company.id)}
                            >🚚 Move</button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Deposit History */}
          {companyStore.deposits.length > 0 && (
            <div className="ctab-log ctab-log--gold">
              <div className="ctab-log__title">⛏️ DEPOSIT HISTORY</div>
              {companyStore.deposits.slice(-5).reverse().map(dep => (
                <div key={dep.id} className="ctab-log__row">
                  <span className="ctab-log__name">{dep.resource}</span>
                  <span className="ctab-log__sub">{dep.country}</span>
                  <span className="ctab-log__val" style={{ color: '#f59e0b' }}>+{dep.bitcoinReward} ₿</span>
                </div>
              ))}
            </div>
          )}

          {/* Transaction Log */}
          {companyStore.transactions.length > 0 && (
            <div className="ctab-log ctab-log--green">
              <div className="ctab-log__title">📜 TRANSACTION LOG</div>
              {companyStore.transactions.slice(0, 8).map(tx => (
                <div key={tx.id} className="ctab-log__row">
                  <span className="ctab-log__sub">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="ctab-log__name" style={{ marginLeft: 6 }}>{tx.message}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── JOBS BOARD ───────────────────────────────── */}
      {showJobs && (
        <>
          <div className="ctab-section-hdr">
            <div className="ctab-section-hdr__left">
              <span className="ctab-section-hdr__dot" style={{ background: '#3b82f6' }} />
              <span className="ctab-section-hdr__title">AVAILABLE JOBS</span>
            </div>
            <span className="ctab-section-hdr__badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
              🔨 Work: {Math.round(player.work)}/{player.maxWork}
            </span>
          </div>

          <div className="ctab-company-list">
            {companyStore.jobs.map(job => {
              const template = COMPANY_TEMPLATES[job.companyType]
              const prodSkill = skills.economic.production
              const baseProd = 10 + (prodSkill * 5)
              const contribution = Math.floor(baseProd * (1 + job.productionBonus / 100))
              const estimatedPay = Math.floor(contribution * job.payPerPP)
              const netPay = estimatedPay - Math.floor(estimatedPay * 0.05)
              const isActiveJob = companyStore.activeJobId === job.id
              const country = worldStore.getCountry(job.location)

              return (
                <div key={job.id} className="ctab-job-card" style={{ borderColor: isActiveJob ? `${template.color}60` : `${template.color}25` }}>
                  <div className="ctab-job-card__header" style={{ background: `linear-gradient(135deg, ${template.color}${isActiveJob ? '20' : '10'}, transparent)` }}>
                    <div className="ctab-job-card__icon" style={{ color: template.color, background: `${template.color}15`, border: `1px solid ${template.color}30` }}>
                      <CompanyIcon type={job.companyType} />
                    </div>
                    <div className="ctab-job-card__info">
                      <span className="ctab-job-card__employer">{job.employerName}</span>
                      <div className="ctab-job-card__meta">
                        <span style={{ color: template.color, fontSize: '9px', fontWeight: 700 }}>{template.label} LVL {job.companyLevel}</span>
                        {job.productionBonus > 0 && <span className="ctab-badge ctab-badge--green">+{job.productionBonus}%</span>}
                        <span className="ctab-badge" style={{ color: '#94a3b8', background: 'rgba(148,163,184,0.08)' }}>📍{country?.code || job.location}</span>
                      </div>
                    </div>
                    <div className="ctab-job-card__pay">
                      <span className="ctab-job-card__pay-num">${job.payPerPP.toFixed(1)}</span>
                      <span className="ctab-job-card__pay-lbl">per PP</span>
                    </div>
                  </div>
                  <div className="ctab-job-card__stats">
                    <span>~{contribution} PP → <strong style={{ color: '#f0fdf4' }}>~${netPay}</strong> net</span>
                    <span style={{ color: '#64748b', fontSize: '8px' }}>Tax: 10% split</span>
                  </div>
                  {isActiveJob ? (
                    <button className="ctab-job-card__work-btn ctab-job-card__work-btn--active" onClick={handleWork} disabled={Math.floor(player.work) < 10}>
                      🔨 Work Now
                    </button>
                  ) : (
                    <button
                      className="ctab-job-card__join-btn"
                      style={{ borderColor: `${template.color}50`, color: template.color }}
                      onClick={() => handleJoinJob(job.id)}
                    >
                      🤝 Join Job
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── BUILD MODAL ──────────────────────────────── */}
      {showBuild && (
        <div className="ctab-modal-overlay" onClick={() => setShowBuild(false)}>
          <div className="ctab-modal" onClick={e => e.stopPropagation()}>
            <div className="ctab-modal__title">🏗️ BUILD COMPANY</div>
            <div className="ctab-build-list">
              {companyStore.getBuildableTypes().map(type => {
                const t = COMPANY_TEMPLATES[type]
                const canAfford = player.money >= t.buildCost.money && player.bitcoin >= t.buildCost.bitcoin
                return (
                  <div key={type} className="ctab-build-item" style={{ borderColor: `${t.color}30` }}>
                    <div className="ctab-build-item__icon" style={{ color: t.color, background: `${t.color}18`, border: `1px solid ${t.color}30` }}>
                      <CompanyIcon type={type} />
                    </div>
                    <div className="ctab-build-item__info">
                      <span className="ctab-build-item__name">{t.label}</span>
                      <span className="ctab-build-item__desc">{t.desc}</span>
                      <div className="ctab-build-item__cost">
                        <span style={{ color: player.money >= t.buildCost.money ? '#22d38a' : '#ef4444' }}>💰 ${t.buildCost.money.toLocaleString()}</span>
                        <span style={{ color: player.bitcoin >= t.buildCost.bitcoin ? '#22d38a' : '#ef4444' }}>₿ {t.buildCost.bitcoin}</span>
                      </div>
                    </div>
                    <button
                      className={`ctab-build-item__btn ${canAfford ? 'ctab-build-item__btn--ready' : ''}`}
                      disabled={!canAfford}
                      onClick={() => handleBuild(type)}
                      style={canAfford ? { borderColor: t.color, color: t.color } : {}}
                    >
                      Build
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="ctab-modal__cancel" onClick={() => setShowBuild(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
