import { useState, useRef, useEffect } from 'react'
import {
  Hammer,
  BriefcaseBusiness,
  Settings,
  Drumstick,
  Swords,
  Shield,
  Monitor,
  Medal,
  CircleDollarSign,
  BarChart2,
  Backpack,
  Package,
  Croissant,
  Fish,
  Beef,
  Anchor
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useBattleStore } from '../../stores/battleStore'
import { useCompanyStore, COMPANY_TEMPLATES } from '../../stores/companyStore'
import { useMissionStore } from '../../stores/missionStore'
import { useArmyStore } from '../../stores/army'
import CompanyIcon from '../companies/CompanyIcon'
import '../../styles/actionbar.css'

const ICON_PROPS = { color: '#22d38a', size: 18, strokeWidth: 2 }
const MENU_ICON_PROPS = { color: '#22d38a', size: 14, strokeWidth: 2 }

export default function ActionBar() {
  const activePanel = useUIStore((s) => s.activePanel)
  const { togglePanel } = useUIStore()
  const player = usePlayerStore()
  const battles = useBattleStore((s) => s.battles)
  const companyStore = useCompanyStore()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const activeBattleCount = Object.values(battles).filter((b) => b.status === 'active').length

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => setOpenMenu(openMenu === id ? null : id)

  // ── Shared flash helper ──
  const flash = (text: string, color?: string) => {
    useUIStore.getState().addFloatingText(text, window.innerWidth / 2, window.innerHeight / 2, color)
  }

  // ── Action handlers ──
  const handleWork = async () => {
    const result = await companyStore.doWork()
    if (result) {
      flash(result.message, result.type === 'error' ? '#ef4444' : '#3b82f6')
      if (result.type !== 'error') useMissionStore.getState().trackWork()
    }
  }

  const handleEnterprise = async (companyId: string) => {
    const result = await companyStore.doEnterprise(companyId)
    if (result) flash(result.message, result.type === 'error' ? '#ef4444' : '#a855f7')
  }

  const handleProduce = async (companyId: string) => {
    const result = await companyStore.produceCompany(companyId)
    if (result) {
      flash(result.message, result.type === 'error' ? '#ef4444' : '#22d38a')
      if (result.type !== 'error') useMissionStore.getState().trackProduce()
    }
  }

  const handleCollectAll = async () => {
    const result = await companyStore.collectAll()
    flash(result.collected > 0 ? `📦 Collected from ${result.collected} companies!` : 'Nothing to collect', '#22d38a')
  }

  const handleEat = (type: 'bread' | 'sushi' | 'wagyu') => {
    const ok = player.consumeFood(type)
    if (ok) {
      const pct = type === 'wagyu' ? 45 : type === 'sushi' ? 30 : 15
      flash(`+${pct}% Stamina`, '#f59e0b')
      useMissionStore.getState().trackEat()
    } else {
      flash('Cannot eat', '#ef4444')
    }
  }

  // ── Status getters ──
  const workPct = Math.floor((player.work / player.maxWork) * 100)
  const hustlePct = Math.floor((player.entrepreneurship / player.maxEntrepreneurship) * 100)
  const totalFood = player.bread + player.sushi + player.wagyu
  const stamina = Math.floor(player.stamina)

  const companies = companyStore.companies.filter(c => c.type !== 'prospection_center')
  const hasProducible = companies.some(c => c.productionProgress > 0)

  // ── Status color helper ──
  const lvl = (pct: number) => pct > 50 ? 'good' : pct > 20 ? 'warn' : 'danger'

  return (
    <div className="action-bar" ref={barRef}>
      {/* ═══ WORK ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${openMenu === 'work' ? ' action-bar__btn--active' : ''}${player.work >= 10 ? ' action-bar__btn--ready' : ''}`}
          onClick={() => toggle('work')}
          title="Work [1]"
        >
          <span className="action-bar__key">1</span>
          <span className="action-bar__icon"><Hammer {...ICON_PROPS} /></span>
          <span className="action-bar__label">WORK</span>
          <span className={`action-bar__status action-bar__status--${lvl(workPct)}`}>{workPct}%</span>
        </button>
        {openMenu === 'work' && (
          <div className="action-bar__menu">
            <div className="action-bar__menu-title">WORK AT JOB</div>
            <button
              className="action-bar__menu-btn"
              onClick={handleWork}
              disabled={Math.floor(player.work) < 10}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Hammer {...MENU_ICON_PROPS} /> Work Now</span>
              <span className="action-bar__menu-cost">-10 Work</span>
            </button>
            {companyStore.activeJobId ? (
              <div className="action-bar__menu-hint">Active job</div>
            ) : companyStore.jobs.length > 0 ? (
              <button
                className="action-bar__menu-btn action-bar__menu-btn--accent"
                onClick={() => {
                  const best = [...companyStore.jobs].sort((a, b) => b.payPerPP - a.payPerPP)[0]
                  if (best) {
                    companyStore.setActiveJob(best.id)
                    flash(`💼 Took job at ${best.employerName} — $${best.payPerPP}/PP`, '#22d38a')
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BriefcaseBusiness {...MENU_ICON_PROPS} /> Take a Job!</span>
                <span className="action-bar__menu-cost">${[...companyStore.jobs].sort((a, b) => b.payPerPP - a.payPerPP)[0]?.payPerPP ?? 0}/PP</span>
              </button>
            ) : (
              <div className="action-bar__menu-hint">No jobs available</div>
            )}
          </div>
        )}
      </div>

      {/* ═══ HUSTLE ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${openMenu === 'hustle' ? ' action-bar__btn--active' : ''}${player.entrepreneurship >= 10 ? ' action-bar__btn--ready' : ''}`}
          onClick={() => toggle('hustle')}
          title="Hustle [2]"
        >
          <span className="action-bar__key">2</span>
          <span className="action-bar__icon"><BriefcaseBusiness {...ICON_PROPS} /></span>
          <span className="action-bar__label">HUSTLE</span>
          <span className={`action-bar__status action-bar__status--${lvl(hustlePct)}`}>{hustlePct}%</span>
        </button>
        {openMenu === 'hustle' && (
          <div className="action-bar__menu">
            <div className="action-bar__menu-title">ENTERPRISE</div>
            {companies.length === 0 && <div className="action-bar__menu-hint">No companies owned</div>}
            {companies.map(c => {
              const t = COMPANY_TEMPLATES[c.type]
              const pct = Math.min(100, Math.floor((c.productionProgress / c.productionMax) * 100))
              return (
                <button
                  key={c.id}
                  className="action-bar__menu-btn"
                  onClick={() => handleEnterprise(c.id)}
                  disabled={Math.floor(player.entrepreneurship) < 10 || c.productionProgress >= c.productionMax}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CompanyIcon type={c.type} color="#22d38a" size={14} /> {t.label} <span style={{ opacity: 0.5 }}>L{c.level}</span></span>
                  <span className="action-bar__menu-cost">{pct}%</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ PRODUCE / COLLECT ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${openMenu === 'produce' ? ' action-bar__btn--active' : ''}${hasProducible ? ' action-bar__btn--ready' : ''}`}
          onClick={() => toggle('produce')}
          title="Produce [3]"
        >
          <span className="action-bar__key">3</span>
          <span className="action-bar__icon"><Settings {...ICON_PROPS} /></span>
          <span className="action-bar__label">COLLECT</span>
          <span className={`action-bar__status action-bar__status--${hasProducible ? 'good' : 'neutral'}`}>
            {companies.filter(c => c.productionProgress > 0).length}/{companies.length}
          </span>
        </button>
        {openMenu === 'produce' && (
          <div className="action-bar__menu">
            <div className="action-bar__menu-title">PRODUCE & COLLECT</div>
            <button
              className="action-bar__menu-btn action-bar__menu-btn--accent"
              onClick={handleCollectAll}
              disabled={!hasProducible}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Package {...MENU_ICON_PROPS} /> Collect All</span>
              <span className="action-bar__menu-cost">{companies.filter(c => c.productionProgress > 0).length} ready</span>
            </button>
            <div className="action-bar__menu-sep" />
            {companies.map(c => {
              const t = COMPANY_TEMPLATES[c.type]
              const pct = Math.min(100, Math.floor((c.productionProgress / c.productionMax) * 100))
              return (
                <button
                  key={c.id}
                  className="action-bar__menu-btn"
                  onClick={() => handleProduce(c.id)}
                  disabled={c.productionProgress <= 0}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CompanyIcon type={c.type} color="#22d38a" size={14} /> {t.label} <span style={{ opacity: 0.5 }}>L{c.level}</span></span>
                  <span className={`action-bar__menu-cost${pct >= 100 ? ' action-bar__menu-cost--full' : ''}`}>{pct}%</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="action-bar__flow">›</div>

      {/* ═══ EAT ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${openMenu === 'eat' ? ' action-bar__btn--active' : ''}${player.hunger > 0 && totalFood > 0 ? ' action-bar__btn--ready' : ''}`}
          onClick={() => toggle('eat')}
          title="Eat [4]"
        >
          <span className="action-bar__key">4</span>
          <span className="action-bar__icon"><Drumstick {...ICON_PROPS} /></span>
          <span className="action-bar__label">EAT</span>
          <span className={`action-bar__status action-bar__status--${totalFood > 10 ? 'good' : totalFood > 0 ? 'warn' : 'danger'}`}>{totalFood}</span>
        </button>
        {openMenu === 'eat' && (
          <div className="action-bar__menu">
            <div className="action-bar__menu-title">EAT FOOD → STAMINA</div>
            <button
              className="action-bar__menu-btn"
              onClick={() => handleEat('bread')}
              disabled={player.bread <= 0 || Math.floor(player.hunger) <= 0}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Croissant {...MENU_ICON_PROPS} /> Bread <span style={{ opacity: 0.5 }}>+15% STA</span></span>
              <span className="action-bar__menu-cost">×{player.bread}</span>
            </button>
            <button
              className="action-bar__menu-btn"
              onClick={() => handleEat('sushi')}
              disabled={player.sushi <= 0 || Math.floor(player.hunger) <= 0}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Fish {...MENU_ICON_PROPS} /> Sushi <span style={{ opacity: 0.5 }}>+30% STA</span></span>
              <span className="action-bar__menu-cost">×{player.sushi}</span>
            </button>
            <button
              className="action-bar__menu-btn"
              onClick={() => handleEat('wagyu')}
              disabled={player.wagyu <= 0 || Math.floor(player.hunger) <= 0}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Beef {...MENU_ICON_PROPS} /> Wagyu <span style={{ opacity: 0.5 }}>+45% STA</span></span>
              <span className="action-bar__menu-cost">×{player.wagyu}</span>
            </button>
            {Math.floor(player.hunger) <= 0 && <div className="action-bar__menu-hint">Hunger bar empty — wait for regen</div>}
          </div>
        )}
      </div>

      <div className="action-bar__flow">›</div>

      {/* ═══ FIGHT ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'combat' ? ' action-bar__btn--active' : ''}${player.stamina >= 10 && activeBattleCount > 0 ? ' action-bar__btn--ready' : ''}`}
          onClick={() => { useUIStore.getState().setWarDefaultTab('battles'); togglePanel('combat') }}
          title="Fight [5]"
        >
          <span className="action-bar__key">5</span>
          <span className="action-bar__icon"><Swords {...ICON_PROPS} /></span>
          <span className="action-bar__label">FIGHT</span>
          <span className={`action-bar__status action-bar__status--${activeBattleCount > 0 ? 'danger' : stamina > 50 ? 'good' : stamina > 20 ? 'warn' : 'danger'}`}>
            {activeBattleCount > 0 ? `${activeBattleCount} WAR${activeBattleCount !== 1 ? 'S' : ''}` : `${stamina} STA`}
          </span>
        </button>
      </div>

      {/* ═══ MY FORCES ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'armed_forces' ? ' action-bar__btn--active' : ''}`}
          onClick={() => { useUIStore.getState().setAfDefaultTab('own'); useUIStore.getState().setActivePanel('armed_forces') }}
          title="My Forces"
        >
          <span className="action-bar__icon"><Shield {...ICON_PROPS} /></span>
          <span className="action-bar__label">MY FORCES</span>
          <span className={`action-bar__status action-bar__status--${Object.values(useArmyStore.getState().divisions).filter((d: any) => d.countryCode === (usePlayerStore.getState().countryCode || 'US')).length > 0 ? 'good' : 'neutral'}`}>
            {Object.values(useArmyStore.getState().divisions).filter((d: any) => d.countryCode === (usePlayerStore.getState().countryCode || 'US')).length} DIV
          </span>
        </button>
      </div>

      {/* ═══ CYBER ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'cyberwarfare' ? ' action-bar__btn--active' : ''}`}
          onClick={() => togglePanel('cyberwarfare')}
          title="Cyber [6]"
        >
          <span className="action-bar__key">6</span>
          <span className="action-bar__icon"><Monitor {...ICON_PROPS} /></span>
          <span className="action-bar__label">CYBER</span>
          <span className="action-bar__status action-bar__status--neutral">OPS</span>
        </button>
      </div>

      {/* ═══ MILITARY ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'military' ? ' action-bar__btn--active' : ''}`}
          onClick={() => togglePanel('military')}
          title="Military [7]"
        >
          <span className="action-bar__key">7</span>
          <span className="action-bar__icon"><Medal {...ICON_PROPS} /></span>
          <span className="action-bar__label">MILITARY</span>
          <span className="action-bar__status action-bar__status--neutral">OPS</span>
        </button>
      </div>

      {/* ═══ TRADE LANES ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'trade_routes' ? ' action-bar__btn--active' : ''}`}
          onClick={() => togglePanel('trade_routes')}
          title="Maritime Trade Routes"
        >
          <span className="action-bar__icon"><Anchor {...ICON_PROPS} /></span>
          <span className="action-bar__label">TRADE</span>
          <span className="action-bar__status action-bar__status--neutral">LANES</span>
        </button>
      </div>

      <div className="action-bar__sep" />

      {/* ═══ BOUNTY ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'bounty' ? ' action-bar__btn--active' : ''}`}
          onClick={() => { useUIStore.getState().setBountyDefaultTab('npc_hunts'); useUIStore.getState().setActivePanel('bounty') }}
          title="Bounty"
        >
          <span className="action-bar__icon"><CircleDollarSign {...ICON_PROPS} /></span>
          <span className="action-bar__label">BOUNTY</span>
          <span className="action-bar__status action-bar__status--neutral">HUNT</span>
        </button>
      </div>

      {/* ═══ MARKET ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'market' ? ' action-bar__btn--active' : ''}`}
          onClick={() => togglePanel('market')}
          title="Market [8]"
        >
          <span className="action-bar__key">8</span>
          <span className="action-bar__icon"><BarChart2 {...ICON_PROPS} /></span>
          <span className="action-bar__label">MARKET</span>
          <span className={`action-bar__status action-bar__status--${player.money > 10000 ? 'good' : player.money > 1000 ? 'warn' : 'danger'}`}>
            ${(player.money / 1000).toFixed(0)}K
          </span>
        </button>
      </div>

      {/* ═══ INVENTORY ═══ */}
      <div className="action-bar__slot">
        <button
          className={`action-bar__btn${activePanel === 'profile' && useUIStore.getState().profileDefaultTab === 'inventory' ? ' action-bar__btn--active' : ''}`}
          onClick={() => { useUIStore.getState().setProfileDefaultTab('inventory'); useUIStore.getState().setActivePanel('profile') }}
          title="Inventory"
        >
          <span className="action-bar__icon"><Backpack {...ICON_PROPS} /></span>
          <span className="action-bar__label">INVENTORY</span>
          <span className="action-bar__status action-bar__status--neutral">ITEMS</span>
        </button>
      </div>
    </div>
  )
}
