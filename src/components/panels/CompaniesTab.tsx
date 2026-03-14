import { useState, useCallback, useRef, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import InventorySummary from '../shared/InventorySummary'
import { useSkillsStore } from '../../stores/skillsStore'
import { useUIStore } from '../../stores/uiStore'
import {
  useCompanyStore,
  COMPANY_TEMPLATES,
  getUpgradeCost,
  getProductionBonus,
  CompanyType,
} from '../../stores/companyStore'

export default function CompaniesTab() {
  const player = usePlayerStore()
  const skills = useSkillsStore()
  const companyStore = useCompanyStore()
  const uiStore = useUIStore()
  const [showBuild, setShowBuild] = useState(false)
  const [showJobs, setShowJobs] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string, duration = 3000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  const spawnFloating = (e: MouseEvent, text: string, color?: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Spawn just above the button
    uiStore.addFloatingText(text, rect.left + rect.width / 2, rect.top, color)
  }

  const handleEnterprise = (e: MouseEvent, companyId: string) => {
    const result = companyStore.doEnterprise(companyId)
    if (result) {
      if (result.type === 'error') flash(result.message)
      else spawnFloating(e, result.message, '#a855f7')
    }
  }

  const handleProduce = (e: MouseEvent, companyId: string) => {
    const result = companyStore.produceCompany(companyId)
    if (result) {
      if (result.type === 'error') flash(result.message)
      else spawnFloating(e, result.message, '#22d38a')
    }
  }

  const handleProspect = (companyId: string) => {
    const deposit = companyStore.prospect(companyId)
    if (deposit) {
      flash(`🎉 DEPOSIT FOUND! ${deposit.resource} in ${deposit.country}! +${deposit.bitcoinReward} ₿ jackpot!`, 5000)
    } else if (player.bitcoin < 1) {
      flash('❌ Need 1₿')
    } else {
      flash('🔍 No deposit found...')
    }
  }

  const handleBuild = (type: CompanyType) => {
    if (companyStore.buildCompany(type)) {
      flash(`✅ Built ${COMPANY_TEMPLATES[type].label}!`)
      setShowBuild(false)
    } else {
      flash('❌ Not enough resources')
    }
  }

  const handleUpgrade = (companyId: string) => {
    if (companyStore.upgradeCompany(companyId)) {
      flash('⬆️ Upgraded!')
    } else {
      flash('❌ Not enough resources')
    }
  }

  const handleJoinJob = (jobId: string) => {
    companyStore.setActiveJob(jobId)
    flash(`🤝 Joined ${companyStore.jobs.find(j => j.id === jobId)?.employerName}'s company`)
    setShowJobs(false) // Send them back to My Business
  }

  const handleWork = (e: MouseEvent) => {
    const result = companyStore.doWork()
    if (result) {
      if (result.type === 'error') {
        flash(result.message)
      } else {
        spawnFloating(e, result.message, '#3b82f6')
      }
    }
  }

  const renderJobCard = (job: typeof companyStore.jobs[0], isMyBusinessView: boolean) => {
    const template = COMPANY_TEMPLATES[job.companyType]
    const workSkill = skills.economic.work
    const prodSkill = skills.economic.production
    const contribution = Math.floor((15 + workSkill * 2 + prodSkill) * (1 + job.productionBonus / 100))
    const isActiveJob = companyStore.activeJobId === job.id

    return (
      <div key={job.id} className="comp-card comp-card--job" style={{ borderColor: `${template.color}33` }}>
        <div className="comp-card__top">
          <span className="comp-card__icon" style={{ color: template.color }}>
            {template.icon}
          </span>
          <div className="comp-card__info">
            <span className="comp-card__name">{job.employerName}</span>
            <div className="comp-card__meta">
              <span className="comp-card__level" style={{ color: template.color }}>
                {template.label} LVL {job.companyLevel}
              </span>
              <span className="comp-card__bonus">+{job.productionBonus}%</span>
            </div>
          </div>
          <div className="comp-job-pay">
            <span className="comp-job-pay__amount">${job.payPerWork}</span>
            <span className="comp-job-pay__label">per work</span>
          </div>
        </div>

        <div className="comp-job-stats">
          <span>Your contribution: <strong>{contribution}</strong> pts</span>
          <span>Prospection chance: <strong>{(skills.economic.prospection * 2)}%</strong></span>
        </div>

        {isMyBusinessView && isActiveJob ? (
          <button
            className="comp-action comp-action--work"
            onClick={(e) => handleWork(e)}
            disabled={player.work <= 0}
          >
            🔨 Work (-10 Work, +${job.payPerWork})
          </button>
        ) : isActiveJob ? (
          <button className="comp-action comp-action--work" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            🟢 Current Job
          </button>
        ) : (
          <button
            className="comp-action comp-action--build"
            style={{ background: 'transparent', color: template.color, borderColor: `${template.color}66` }}
            onClick={() => handleJoinJob(job.id)}
          >
            🤝 Join Job
          </button>
        )}
      </div>
    )
  }

  const activeJob = companyStore.activeJobId 
    ? companyStore.jobs.find(j => j.id === companyStore.activeJobId) 
    : null

  const itemsInBusinessStr = companyStore.companies.length + (activeJob ? 1 : 0)

  return (
    <div className="comp-tab">
      {toast && (
        <div className={`comp-toast ${toast.startsWith('🎉') ? 'comp-toast--deposit' : ''}`}>
          {toast}
        </div>
      )}

      {/* Tab Switcher: My Business / Jobs */}
      <div className="comp-mode-switch">
        <button
          className={`comp-mode-btn ${!showJobs ? 'comp-mode-btn--active' : ''}`}
          onClick={() => setShowJobs(false)}
        >
          🏢 My Business ({itemsInBusinessStr})
        </button>
        <button
          className={`comp-mode-btn ${showJobs ? 'comp-mode-btn--active' : ''}`}
          onClick={() => setShowJobs(true)}
        >
          🔨 Jobs Board ({companyStore.jobs.length})
        </button>
      </div>

      {/* === MY BUSINESS === */}
      {!showJobs && (
        <>
          {/* INVENTORY SUMMARY */}
          <InventorySummary />

          {/* MY JOB SECTION */}
          <div className="comp-header">
            <span className="comp-header__title">MY JOB</span>
            <span className="comp-header__subtitle">
              🔨 Work: {Math.round(player.work)}/{player.maxWork}
            </span>
          </div>
          
          <div className="comp-list" style={{ marginBottom: '24px' }}>
            {activeJob ? (
              renderJobCard(activeJob, true)
            ) : (
              <div className="comp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', border: '1px dashed rgba(255,255,255,0.2)', background: 'transparent' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '12px', fontSize: '12px' }}>You don't have an active job</span>
                <button 
                  className="comp-action comp-action--build" 
                  onClick={() => setShowJobs(true)}
                  style={{ width: 'auto', padding: '8px 24px', background: 'transparent', borderColor: '#22d38a', color: '#22d38a' }}
                >
                  🤝 Take a Job
                </button>
              </div>
            )}
          </div>

          <div className="comp-header">
            <span className="comp-header__title">MY COMPANIES</span>
            <span className="comp-header__subtitle">
              💼 Ent: {Math.round(player.entrepreneurship)}/{player.maxEntrepreneurship}
            </span>
            <button className="comp-build-btn" onClick={() => setShowBuild(true)}>
              + Build
            </button>
          </div>

          <div className="comp-list">
            {companyStore.companies.map((company) => {
              const template = COMPANY_TEMPLATES[company.type]
              const upgCost = getUpgradeCost(company.level)
              const bonus = getProductionBonus(company.level)
              const isProspector = company.type === 'prospection_center'
              const isFull = company.productionProgress >= company.productionMax

              return (
                <div key={company.id} className="comp-card" style={{ borderColor: `${template.color}33` }}>
                  <div className="comp-card__top">
                    <span className="comp-card__icon" style={{ color: template.color }}>
                      {template.icon}
                    </span>
                    <div className="comp-card__info">
                      <span className="comp-card__name">{template.label}</span>
                      <div className="comp-card__meta">
                        <span className="comp-card__level" style={{ color: template.color }}>
                          LVL {company.level}
                        </span>
                        <span className="comp-card__bonus">+{bonus}%</span>
                        {company.autoProduction && (
                          <span className="comp-card__auto">⚡ AUTO</span>
                        )}
                      </div>
                    </div>
                    <span className="comp-card__produces">{template.produces}</span>
                  </div>

                  {/* Per-company production bar (not for prospector) */}
                  {!isProspector && (
                    <div className="comp-prod-bar">
                      <div className="comp-prod-bar__track">
                        <div
                          className="comp-prod-bar__fill"
                          style={{
                            width: `${Math.min(100, Math.floor(company.productionProgress / company.productionMax * 100))}%`,
                            background: template.color,
                            boxShadow: `0 0 6px ${template.color}66`,
                          }}
                        />
                      </div>
                      <span className="comp-prod-bar__text">
                        {Math.floor(company.productionProgress)} pts
                        <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                          +{Number((Math.min(6, company.level) * (1 + bonus / 100)).toFixed(2))} pts/tick
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="comp-card__actions">
                    {isProspector ? (
                      <button
                        className="comp-action comp-action--prospect"
                        onClick={() => handleProspect(company.id)}
                        disabled={player.bitcoin < 1}
                      >
                        ⛏️ Prospect (1₿)
                      </button>
                    ) : (
                      <>
                        <button
                          className="comp-action comp-action--enterprise"
                          onClick={(e) => handleEnterprise(e, company.id)}
                          disabled={player.entrepreneurship <= 0 || isFull}
                        >
                          💼 Enterprise
                        </button>
                        <button
                          className="comp-action comp-action--produce"
                          onClick={(e) => handleProduce(e, company.id)}
                          disabled={company.productionProgress <= 0}
                        >
                          ⚙️ Produce
                        </button>
                      </>
                    )}
                    <button
                      className="comp-action comp-action--upgrade"
                      onClick={() => handleUpgrade(company.id)}
                      title={`Cost: 1 Bitcoin`}
                    >
                      ⬆️
                    </button>
                  </div>

                  <div className="comp-card__upgrade-cost">
                    <span>Upgrade: </span>
                    <span className="comp-cost-item" style={{ color: '#f59e0b' }}>₿ 1</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Deposit History */}
          {companyStore.deposits.length > 0 && (
            <div className="comp-deposits">
              <div className="comp-deposits__title">⛏️ DEPOSIT HISTORY</div>
              {companyStore.deposits.slice(-5).reverse().map((dep) => (
                <div key={dep.id} className="comp-deposit-row">
                  <span className="comp-deposit-row__resource">{dep.resource}</span>
                  <span className="comp-deposit-row__country">{dep.country}</span>
                  <span className="comp-deposit-row__reward">+{dep.bitcoinReward} ₿</span>
                </div>
              ))}
            </div>
          )}

          {/* Transaction Log */}
          {companyStore.transactions.length > 0 && (
            <div className="comp-deposits" style={{ borderColor: 'rgba(34, 211, 138, 0.1)' }}>
              <div className="comp-deposits__title" style={{ color: '#22d38a' }}>📜 TRANSACTION LOG</div>
              {companyStore.transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="comp-deposit-row">
                  <span className="comp-deposit-row__country">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="comp-deposit-row__resource" style={{ marginLeft: 6, fontWeight: 500 }}>
                    {tx.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === JOBS BOARD === */}
      {showJobs && (
        <>
          <div className="comp-header">
            <span className="comp-header__title">WORK ON OTHERS' COMPANIES</span>
            <span className="comp-header__subtitle">
              🔨 Work: {Math.round(player.work)}/{player.maxWork}
            </span>
          </div>

          <div className="comp-list">
            {companyStore.jobs.map((job) => renderJobCard(job, false))}
          </div>
        </>
      )}

      {/* Build Modal */}
      {showBuild && (
        <div className="inv-modal-overlay" onClick={() => setShowBuild(false)}>
          <div className="inv-modal comp-build-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal__title">🏗️ BUILD COMPANY</div>
            <div className="comp-build-list">
              {companyStore.getBuildableTypes().map((type) => {
                const t = COMPANY_TEMPLATES[type]
                const canAfford = player.money >= t.buildCost.money && player.bitcoin >= t.buildCost.bitcoin
                return (
                  <div key={type} className="comp-build-item" style={{ borderColor: `${t.color}33` }}>
                    <div className="comp-build-item__top">
                      <span className="comp-build-item__icon" style={{ color: t.color }}>{t.icon}</span>
                      <div className="comp-build-item__info">
                        <span className="comp-build-item__name">{t.label}</span>
                        <span className="comp-build-item__desc">{t.desc}</span>
                      </div>
                    </div>
                    <div className="comp-build-item__bottom">
                      <div className="comp-build-item__cost">
                        <span style={{ color: player.money >= t.buildCost.money ? '#22d38a' : '#ef4444' }}>
                          💰 ${t.buildCost.money.toLocaleString()}
                        </span>
                        <span style={{ color: player.bitcoin >= t.buildCost.bitcoin ? '#22d38a' : '#ef4444' }}>
                          ₿ {t.buildCost.bitcoin}
                        </span>
                      </div>
                      <button
                        className="comp-action comp-action--build"
                        disabled={!canAfford}
                        onClick={() => handleBuild(type)}
                      >
                        Build
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <button className="inv-btn inv-btn--cancel" style={{ width: '100%', marginTop: '8px' }} onClick={() => setShowBuild(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
