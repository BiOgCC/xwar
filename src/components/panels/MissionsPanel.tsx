import React, { useState, useCallback } from 'react'
import {
  useMissionStore,
  MISSION_DEFS,
  COSMETIC_SHOP,
  RARITY_META,
  getScaledTarget,
  type MissionId,
  type CosmeticRarity,
} from '../../stores/missionStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'

/* ── Navigation map: where each mission card sends the player ── */
const MISSION_NAV_MAP: Record<MissionId, () => void> = {
  work:     () => { useUIStore.getState().setProfileDefaultTab('work');       useUIStore.getState().setActivePanel('profile') },
  produce:  () => { useUIStore.getState().setProfileDefaultTab('companies');  useUIStore.getState().setActivePanel('profile') },
  fight:    () => { useUIStore.getState().setWarDefaultTab('battles');        useUIStore.getState().setActivePanel('combat') },
  eat:      () => { useUIStore.getState().setProfileDefaultTab('inventory');  useUIStore.getState().setActivePanel('profile') },
  cyber:    () => { useUIStore.getState().setWarDefaultTab('operations');     useUIStore.getState().setActivePanel('cyberwarfare') },
  military: () => { useUIStore.getState().setActivePanel('military') },
  market:   () => { useUIStore.getState().setActivePanel('market') },
}

/* ═══════════════════════════════════════════════
   MISSIONS PANEL — Daily Ops + OP Shop
   ═══════════════════════════════════════════════ */

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 100
  const done = pct >= 100
  const nearComplete = pct >= 75 && !done
  return (
    <div className="mission-progress__track">
      <div
        className={`mission-progress__fill${done ? ' mission-progress__fill--done' : ''}${nearComplete ? ' mission-progress__fill--near' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MissionCard({ missionId }: { missionId: MissionId }) {
  const store = useMissionStore()
  const def = MISSION_DEFS.find(d => d.id === missionId)!
  const target = getScaledTarget(def)
  const progress = store.progress[missionId]
  const done = progress.current >= target
  const claimed = progress.claimed

  const handleClaim = () => {
    store.claimMission(missionId)
  }

  const handleNavigate = useCallback(() => {
    MISSION_NAV_MAP[missionId]()
  }, [missionId])

  return (
    <div className={`mission-card mission-card--clickable${done ? ' mission-card--done' : ''}${claimed ? ' mission-card--claimed' : ''}`}>
      <div className="mission-card__icon">{def.icon}</div>
      <div className="mission-card__body mission-card__nav" onClick={handleNavigate} title={`Go to ${def.name}`}>
        <div className="mission-card__header">
          <span className="mission-card__name">{def.name}</span>
          <span className="mission-card__go">GO ➜</span>
          <span className="mission-card__counter">
            {progress.current >= target ? target : progress.current}/{target}
          </span>
        </div>
        <div className="mission-card__desc">{def.description}</div>
        <ProgressBar current={progress.current} max={target} />
      </div>
      <div className="mission-card__action">
        {claimed ? (
          <span className="mission-card__check">✅</span>
        ) : done ? (
          <button className="mission-card__claim" onClick={handleClaim}>CLAIM</button>
        ) : (
          <span className="mission-card__pending">{Math.floor((progress.current / target) * 100)}%</span>
        )}
      </div>
    </div>
  )
}

function OPShop() {
  const store = useMissionStore()
  const [filterRarity, setFilterRarity] = useState<CosmeticRarity | 'all'>('all')

  const items = filterRarity === 'all'
    ? COSMETIC_SHOP
    : COSMETIC_SHOP.filter(c => c.rarity === filterRarity)

  return (
    <div className="op-shop">
      <div className="op-shop__filters">
        {(['all', 'common', 'rare', 'epic', 'legendary'] as const).map(r => (
          <button
            key={r}
            className={`op-shop__filter${filterRarity === r ? ' op-shop__filter--active' : ''}`}
            onClick={() => setFilterRarity(r)}
            style={r !== 'all' ? { color: RARITY_META[r].color } : undefined}
          >
            {r === 'all' ? 'ALL' : RARITY_META[r].label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="op-shop__grid">
        {items.map(item => {
          const owned = store.ownedCosmetics.includes(item.id)
          const equipped =
            store.equippedTitle === item.id ||
            store.equippedBorder === item.id ||
            store.equippedBadge === item.id ||
            store.equippedNameColor === item.id ||
            store.equippedFlair === item.id
          const canAfford = store.opPoints >= item.cost

          return (
            <div
              key={item.id}
              className={`op-shop__item${owned ? ' op-shop__item--owned' : ''}${equipped ? ' op-shop__item--equipped' : ''}`}
              style={{ borderColor: RARITY_META[item.rarity].color + '40' }}
            >
              <div className="op-shop__item-icon">{item.icon}</div>
              <div className="op-shop__item-name" style={{ color: RARITY_META[item.rarity].color }}>{item.name}</div>
              <div className="op-shop__item-preview">{item.preview}</div>
              <div className="op-shop__item-rarity" style={{ color: RARITY_META[item.rarity].color }}>
                {RARITY_META[item.rarity].label}
              </div>
              {owned ? (
                <button
                  className={`op-shop__equip${equipped ? ' op-shop__equip--active' : ''}`}
                  onClick={() => equipped ? store.unequipCosmetic(item.type) : store.equipCosmetic(item.id)}
                >
                  {equipped ? 'UNEQUIP' : 'EQUIP'}
                </button>
              ) : (
                <button
                  className="op-shop__buy"
                  disabled={!canAfford}
                  onClick={() => store.purchaseCosmetic(item.id)}
                >
                  {item.cost} OP
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MissionsPanel() {
  const store = useMissionStore()
  const [tab, setTab] = useState<'missions' | 'shop'>('missions')

  const claimedCount = MISSION_DEFS.filter(d => store.progress[d.id].claimed).length
  const allClaimed = claimedCount === 7
  const dailyOP = store.getDailyOPEarned()

  // Time until next reset (UTC midnight)
  const now = new Date()
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const msLeft = nextReset.getTime() - now.getTime()
  const hoursLeft = Math.floor(msLeft / 3600000)
  const minsLeft = Math.floor((msLeft % 3600000) / 60000)

  return (
    <div className="missions-panel">
      {/* Header */}
      <div className="missions-header">
        <div className="missions-header__left">
          <div className="missions-header__title">📋 DAILY OPS</div>
          <div className="missions-header__sub">
            Reset in <strong>{hoursLeft}h {minsLeft}m</strong>
          </div>
        </div>
        <div className="missions-header__right">
          <div className="missions-header__op">
            <span className="missions-header__op-label">OP</span>
            <span className="missions-header__op-value">{store.opPoints}</span>
          </div>
          <div className="missions-header__streak">
            🔥 {store.streakDays}d streak
          </div>
          <div className="missions-header__daily">
            +{dailyOP} today
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="missions-tabs">
        <button
          className={`missions-tabs__btn${tab === 'missions' ? ' missions-tabs__btn--active' : ''}`}
          onClick={() => setTab('missions')}
        >
          MISSIONS ({claimedCount}/7)
        </button>
        <button
          className={`missions-tabs__btn${tab === 'shop' ? ' missions-tabs__btn--active' : ''}`}
          onClick={() => setTab('shop')}
        >
          OP SHOP
        </button>
      </div>

      {tab === 'missions' ? (
        <div className="missions-list">
          {MISSION_DEFS.map(def => (
            <MissionCard key={def.id} missionId={def.id} />
          ))}

          {/* All-complete bonus */}
          <div className={`missions-bonus${allClaimed ? ' missions-bonus--ready' : ''}`}>
            <div className="missions-bonus__text">
              {store.allClaimedBonus
                ? '✅ All missions bonus claimed! +3 OP'
                : allClaimed
                  ? '🎉 All 7 complete! Claim your bonus'
                  : `Complete all 7 missions for +3 bonus OP (${claimedCount}/7)`
              }
            </div>
            {allClaimed && !store.allClaimedBonus && (
              <button className="missions-bonus__btn" onClick={() => store.claimAllBonus()}>
                CLAIM +3 OP
              </button>
            )}
          </div>
        </div>
      ) : (
        <OPShop />
      )}
    </div>
  )
}
