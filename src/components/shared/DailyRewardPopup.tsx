import { useEffect } from 'react'
import { useDailyRewardStore, DAILY_REWARDS, type DailyReward } from '../../stores/dailyRewardStore'
import GameModal from '../shared/GameModal'

/* ═══════════════════════════════════════════════════
   Daily Login Reward Popup
   Shows on login, displays streak progress & claim button
   ═══════════════════════════════════════════════════ */

function RewardBadge({ reward, isActive, isClaimed }: { reward: DailyReward; isActive: boolean; isClaimed: boolean }) {
  const bg = isClaimed
    ? 'rgba(34,211,138,0.15)'
    : isActive
    ? 'rgba(168,85,247,0.2)'
    : 'rgba(255,255,255,0.04)'
  const border = isClaimed
    ? 'rgba(34,211,138,0.4)'
    : isActive
    ? 'rgba(168,85,247,0.5)'
    : 'rgba(255,255,255,0.08)'
  const textColor = isClaimed ? '#22d38a' : isActive ? '#a855f7' : '#64748b'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      background: bg, border: `1px solid ${border}`, borderRadius: '8px',
      padding: '8px 6px', minWidth: '60px', position: 'relative',
      transition: 'all 0.3s ease',
      transform: isActive ? 'scale(1.1)' : 'scale(1)',
      boxShadow: isActive ? '0 0 20px rgba(168,85,247,0.3)' : 'none',
    }}>
      {isClaimed && (
        <span style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '14px' }}>✅</span>
      )}
      <span style={{ fontSize: '18px' }}>{reward.day === 7 ? '🏆' : '🎁'}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '9px', fontWeight: 700, color: textColor, textTransform: 'uppercase' }}>
        Day {reward.day}
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: '#94a3b8' }}>
        ${(reward.money / 1000).toFixed(0)}K
      </span>
      {reward.t5Item && (
        <span style={{ fontSize: '8px', color: '#c084fc', fontWeight: 700 }}>+T5 ITEM</span>
      )}
      {reward.bitcoin && (
        <span style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 700 }}>+{reward.bitcoin}₿</span>
      )}
      {reward.lootBoxes && (
        <span style={{ fontSize: '8px', color: '#fbbf24', fontWeight: 700 }}>+📦</span>
      )}
      {reward.militaryBoxes && (
        <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 700 }}>+🎖️</span>
      )}
    </div>
  )
}

export default function DailyRewardPopup() {
  const { showPopup, loginStreak, todayClaimed, claimReward, dismissPopup, canClaim, checkLoginReward } = useDailyRewardStore()

  // Check on mount
  useEffect(() => {
    // Small delay to let the app render first
    const timer = setTimeout(() => checkLoginReward(), 1500)
    return () => clearTimeout(timer)
  }, [])

  const currentReward = DAILY_REWARDS[(loginStreak % 7)]

  return (
    <GameModal isOpen={showPopup} onClose={dismissPopup} size="md" glowColor="#a855f7">
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '4px' }}>📅</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '2px' }}>
            DAILY REWARD
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {loginStreak > 0
              ? `🔥 ${loginStreak}-day streak! Keep it up!`
              : 'Welcome back, Commander!'
            }
          </div>
        </div>

        {/* Streak Progress */}
        <div style={{
          display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          {DAILY_REWARDS.map((reward) => (
            <RewardBadge
              key={reward.day}
              reward={reward}
              isActive={reward.day === (loginStreak % 7) + 1}
              isClaimed={reward.day <= loginStreak}
            />
          ))}
        </div>

        {/* Current Reward Details */}
        <div style={{
          background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: '8px', padding: '12px', marginBottom: '16px',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: '#a855f7', fontWeight: 700, marginBottom: '6px' }}>
            TODAY'S REWARD — DAY {(loginStreak % 7) + 1}
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#22d38a', fontWeight: 700 }}>
              ${currentReward.money.toLocaleString()}
            </span>
            {currentReward.items?.map((item, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: '#f59e0b' }}>
                +{item.amount} {item.type}
              </span>
            ))}
            {currentReward.bitcoin && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: '#f59e0b' }}>
                +{currentReward.bitcoin}₿
              </span>
            )}
            {currentReward.lootBoxes && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: '#fbbf24' }}>
                +{currentReward.lootBoxes} Loot Box
              </span>
            )}
            {currentReward.militaryBoxes && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: '#ef4444' }}>
                +{currentReward.militaryBoxes} Military Box
              </span>
            )}
            {currentReward.t5Item && (
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: '#c084fc', fontWeight: 700 }}>
                +1 Guaranteed T5 Item!
              </span>
            )}
          </div>
        </div>

        {/* Claim Button */}
        {canClaim() && !todayClaimed ? (
          <button
            onClick={() => claimReward()}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 32px', fontSize: '14px', fontWeight: 800,
              fontFamily: 'var(--font-display)', letterSpacing: '2px',
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 4px 20px rgba(168,85,247,0.4)',
              textTransform: 'uppercase',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(168,85,247,0.6)' }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(168,85,247,0.4)' }}
          >
            🎁 CLAIM REWARD
          </button>
        ) : (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: '#64748b' }}>
            {todayClaimed ? '✅ Reward claimed! See you tomorrow.' : 'Come back later to claim!'}
          </div>
        )}

        {/* Grace note */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '9px', color: '#475569', marginTop: '8px' }}>
          24h grace window • Missing 48h resets streak
        </div>
      </div>
    </GameModal>
  )
}
