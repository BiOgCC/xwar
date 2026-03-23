import { type ReactNode } from 'react'
import { useSpecializationStore } from '../../../stores/specializationStore'
import { ChevronLeft, Swords, Briefcase, Landmark, Crosshair, Sparkles } from 'lucide-react'

const DETAIL_ICON_PROPS = { size: 24, strokeWidth: 2 }

export type SpecKey = 'mil' | 'eco' | 'pol' | 'mer' | 'inf'

interface SpecDetailPanelProps {
  specKey: SpecKey
  onBack: () => void
}

/* ── Spec metadata ─────────────────────────────────────────────── */
const SPEC_META: Record<SpecKey, {
  name: string
  icon: ReactNode
  color: string
  border: string
  bg: string
  howToEarn: string
  tierLabels: string[]
  stats: { label: string; key: string }[]
}> = {
  mil: {
    name: 'Military',
    icon: <Swords {...DETAIL_ICON_PROPS} color="#f87171" />,
    color: '#f87171',
    border: 'rgba(239,68,68,0.25)',
    bg: 'rgba(239,68,68,0.06)',
    howToEarn: 'Earn points by fighting! Deal damage, win rounds, and train divisions.',
    tierLabels: ['Civilian', 'Initiate', 'Specialist', 'Veteran', 'Expert', 'Warlord'],
    stats: [
      { label: 'Total Damage Dealt', key: 'totalDamage' },
      { label: 'Rounds Won', key: 'roundsWon' },
      { label: 'Training Sessions', key: 'trainingSessions' },
    ],
  },
  eco: {
    name: 'Economic',
    icon: <Briefcase {...DETAIL_ICON_PROPS} color="#38bdf8" />,
    color: '#38bdf8',
    border: 'rgba(56,189,248,0.25)',
    bg: 'rgba(56,189,248,0.06)',
    howToEarn: 'Earn points by producing! Work, run companies, and donate to your country.',
    tierLabels: ['Civilian', 'Initiate', 'Specialist', 'Veteran', 'Expert', 'Tycoon'],
    stats: [
      { label: 'Total Production', key: 'totalProduction' },
      { label: 'Work Sessions', key: 'workSessions' },
      { label: 'Donations Made', key: 'donationsMade' },
    ],
  },
  pol: {
    name: 'Politician',
    icon: <Landmark {...DETAIL_ICON_PROPS} color="#a855f7" />,
    color: '#a855f7',
    border: 'rgba(168,85,247,0.25)',
    bg: 'rgba(168,85,247,0.06)',
    howToEarn: 'Earn points by helping your country! Fight in country wars, win elections, and hold office.',
    tierLabels: ['Civilian', 'Initiate', 'Advocate', 'Senator', 'Minister', 'Statesman'],
    stats: [
      { label: 'Country War Damage', key: 'countryWarDmg' },
      { label: 'Elections Won', key: 'electionsWon' },
      { label: 'Days in Office', key: 'daysInOffice' },
    ],
  },
  mer: {
    name: 'Mercenary',
    icon: <Crosshair {...DETAIL_ICON_PROPS} color="#22d38a" />,
    color: '#22d38a',
    border: 'rgba(34,211,138,0.25)',
    bg: 'rgba(34,211,138,0.06)',
    howToEarn: 'Earn points by grinding damage! Fight abroad, claim bounties, and eliminate enemies.',
    tierLabels: ['Civilian', 'Recruit', 'Operative', 'Enforcer', 'Agent', 'Mercenary'],
    stats: [
      { label: 'Abroad Damage', key: 'abroadDamage' },
      { label: 'Bounties Claimed', key: 'bountiesClaimed' },
      { label: 'Abroad Kills', key: 'abroadKills' },
    ],
  },
  inf: {
    name: 'Influencer',
    icon: <Sparkles {...DETAIL_ICON_PROPS} color="#eab308" />,
    color: '#eab308',
    border: 'rgba(234,179,8,0.25)',
    bg: 'rgba(234,179,8,0.06)',
    howToEarn: 'Earn points by being you! Post on walls, mentor others, publish articles, and level up blood pacts.',
    tierLabels: ['Civilian', 'Supporter', 'Guide', 'Mentor', 'Ambassador', 'Influencer'],
    stats: [
      { label: 'Wall Posts', key: 'wallPosts' },
      { label: 'Mentees Helped', key: 'menteesHelped' },
      { label: 'Articles Published', key: 'articlesPublished' },
    ],
  },
}

/* ── Tier XP thresholds ───────────────────────────────────────── */
const TIER_XP = [0, 100, 500, 1500, 4000, 10000]

/* ── Bonus descriptions per tier ──────────────────────────────── */
function getTierBonuses(specKey: SpecKey): string[] {
  switch (specKey) {
    case 'mil': return [
      '—',
      '+3% DMG',
      '+6% DMG, +1% 🎖️ Drop',
      '+9% DMG, +2% 🎖️ Drop',
      '+12% DMG, +3% 🎖️ Drop, +1 🎖️/win',
      '+15% DMG, +5% CRIT, +5% 🎖️ Drop, +2 🎖️/win',
    ]
    case 'eco': return [
      '—',
      '+1 Company Slot',
      '+2 Company Slots',
      '+3 Company Slots',
      '+4 Company Slots',
      '+5 Company Slots, +5% Production',
    ]
    case 'pol': return [
      '—',
      '+1% Country DMG & Prod',
      '+1% Country DMG, Prod & Prosp',
      '+2% Country DMG, Prod, Prosp & Ind',
      '+2% All Country Bonuses + Agility',
      '+3% All Country Bonuses + Agility',
    ]
    case 'mer': return [
      '—',
      '+3% Abroad DMG',
      '+6% Abroad DMG',
      '+9% Abroad DMG, +2% Loot',
      '+12% Abroad DMG, +2% Loot',
      '+15% Abroad DMG, +3% Loot',
    ]
    case 'inf': return [
      '—',
      '+1 Friend Slot',
      '+2 Friends, -5% Gift Tax',
      '+3 Friends, +2 Mentees, -5% Tax',
      '+4 Friends, +2 Mentees, -10% Tax, +5% Pact XP',
      '+5 Friends, +3 Mentees, -15% Tax, +10% Pact XP',
    ]
  }
}

/* ── Component ────────────────────────────────────────────────── */
export default function SpecDetailPanel({ specKey, onBack }: SpecDetailPanelProps) {
  const meta = SPEC_META[specKey]
  const ss = useSpecializationStore.getState()

  // Get tier info for this spec
  const tierInfo = (() => {
    switch (specKey) {
      case 'mil': return ss.getMilitaryTier()
      case 'eco': return ss.getEconomicTier()
      case 'pol': return ss.getPoliticianTier()
      case 'mer': return ss.getMercenaryTier()
      case 'inf': return ss.getInfluencerTier()
    }
  })()

  const bonuses = getTierBonuses(specKey)

  return (
    <div className="spec-detail" style={{ '--spec-color': meta.color, '--spec-border': meta.border, '--spec-bg': meta.bg } as React.CSSProperties}>
      {/* Back Button */}
      <button className="spec-detail__back" onClick={onBack}>
        <ChevronLeft size={14} />
        <span>Back</span>
      </button>

      {/* Header */}
      <div className="spec-detail__header">
        <span className="spec-detail__icon">{meta.icon}</span>
        <div className="spec-detail__title-wrap">
          <div className="spec-detail__name">{meta.name}</div>
          <div className="spec-detail__tier-label">T{tierInfo.tier} {tierInfo.label}</div>
        </div>
        <div className="spec-detail__xp-badge">
          <span className="spec-detail__xp-val">{tierInfo.xp}</span>
          <span className="spec-detail__xp-sep">/</span>
          <span className="spec-detail__xp-max">{tierInfo.nextXP}</span>
          <span className="spec-detail__xp-unit">XP</span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="spec-detail__xp-track">
        <div className="spec-detail__xp-fill" style={{ width: `${tierInfo.percent}%` }} />
      </div>

      {/* How to Earn */}
      <div className="spec-detail__earn">
        <span className="spec-detail__earn-label">HOW TO EARN</span>
        <span className="spec-detail__earn-desc">{meta.howToEarn}</span>
      </div>

      {/* Tier Bonuses Table */}
      <div className="spec-detail__section-title">TIER PROGRESSION</div>
      <div className="spec-detail__tier-table">
        {meta.tierLabels.map((label, i) => {
          const isCurrent = tierInfo.tier === i
          const isLocked = tierInfo.tier < i
          return (
            <div
              key={i}
              className={`spec-detail__tier-row ${isCurrent ? 'spec-detail__tier-row--current' : ''} ${isLocked ? 'spec-detail__tier-row--locked' : ''}`}
            >
              <div className="spec-detail__tier-num">T{i}</div>
              <div className="spec-detail__tier-name">{label}</div>
              <div className="spec-detail__tier-xp">{TIER_XP[i].toLocaleString()} XP</div>
              <div className="spec-detail__tier-bonus">{bonuses[i]}</div>
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div className="spec-detail__section-title">STATS</div>
      <div className="spec-detail__stats">
        {meta.stats.map(stat => (
          <div key={stat.key} className="spec-detail__stat-card">
            <div className="spec-detail__stat-val">—</div>
            <div className="spec-detail__stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
