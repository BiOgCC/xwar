import { create } from 'zustand'

// ── Types ───────────────────────────────────────────────────────────────────
export type SpecCategory = 'military' | 'economic' | 'politician' | 'mercenary' | 'influencer'

export interface SpecTier {
  tier: number
  label: string
  xpRequired: number
}

const TIER_TABLE: SpecTier[] = [
  { tier: 0, label: 'Civilian',   xpRequired: 0 },
  { tier: 1, label: 'Initiate',   xpRequired: 100 },
  { tier: 2, label: 'Specialist', xpRequired: 500 },
  { tier: 3, label: 'Veteran',    xpRequired: 1500 },
  { tier: 4, label: 'Expert',     xpRequired: 4000 },
  { tier: 5, label: 'Master',     xpRequired: 10000 },
]

const MIL_TIER_LABELS = ['Civilian', 'Initiate', 'Specialist', 'Veteran', 'Expert', 'Warlord']
const ECO_TIER_LABELS = ['Civilian', 'Initiate', 'Specialist', 'Veteran', 'Expert', 'Tycoon']
const POL_TIER_LABELS = ['Civilian', 'Initiate', 'Advocate',  'Senator',  'Minister', 'Statesman']
const MER_TIER_LABELS = ['Civilian', 'Recruit',  'Operative', 'Enforcer', 'Agent',    'Mercenary']
const INF_TIER_LABELS = ['Civilian', 'Supporter', 'Guide', 'Mentor', 'Ambassador', 'Influencer']

// ── Per-action daily caps ──
const ACTION_CAPS = {
  // Military
  damage:     25,
  roundWin:    3,
  train:       2,
  // Economic
  work:       12,
  produce:     2,
  donate:      1,   // hard cap (shared econ + pol donate)
  // Politician
  countryDmg: 20,   // damage in country wars
  polDonate:   1,   // hard cap
  election:    1,   // hard cap
  holdOffice:  1,   // 1 passive grant/day
  // Mercenary
  abroadDmg:  20,
  abroadWin:   5,
  bounty:      1,   // hard cap
  abroadKill:  5,
  // Influencer
  wallPost:    5,
  menteeProgress: 3,
  articlePublish: 2,
  referral:    1,   // hard cap
  bloodPactLvl: 2,
} as const

function todayKey(): string {
  const d = new Date()
  // Fix 6: Use UTC to prevent timezone manipulation resetting daily caps
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const DAILY_XP_CAP = 200

// ── Store ───────────────────────────────────────────────────────────────────
export interface SpecializationState {
  // Lifetime XP
  militaryXP: number
  economicXP: number
  politicianXP: number
  mercenaryXP: number
  influencerXP: number

  // Daily tracking
  dailyDate: string
  dailyMilitaryPoints: number
  dailyEconomicPoints: number
  dailyPoliticianPoints: number
  dailyMercenaryPoints: number
  dailyInfluencerPoints: number
  dailyDamageAccumulator: number
  dailyAbroadDamageAccumulator: number
  dailyCountryDamageAccumulator: number

  // Per-action daily counts
  dailyDamageCount: number
  dailyRoundWinCount: number
  dailyTrainCount: number
  dailyWorkCount: number
  dailyProduceCount: number
  dailyDonateCount: number
  dailyCountryDmgCount: number
  dailyPolDonateCount: number
  dailyElectionCount: number
  dailyHoldOfficeCount: number
  dailyAbroadDmgCount: number
  dailyAbroadWinCount: number
  dailyBountyCount: number
  dailyAbroadKillCount: number
  // Influencer daily counts
  dailyWallPostCount: number
  dailyMenteeProgressCount: number
  dailyArticlePublishCount: number
  dailyReferralCount: number
  dailyBloodPactLvlCount: number

  // ── Military Actions ──
  recordDamage: (damage: number) => number
  recordRoundWin: () => number
  recordTrainDivision: () => number
  // ── Economic Actions ──
  recordWork: () => number
  recordProduce: () => number
  recordDonate: (amount: number) => number
  recordMilitaryDonate: (amount: number) => number
  // ── Politician Actions ──
  recordCountryWarDamage: (damage: number) => number
  recordPoliticianDonate: (amount: number) => number
  recordElectionWin: (votePercent: number) => number
  recordHoldOffice: () => number
  // ── Mercenary Actions ──
  recordAbroadDamage: (damage: number) => number
  recordAbroadRoundWin: () => number
  recordBountyClaim: () => number
  recordAbroadKill: () => number
  // ── Influencer Actions ──
  recordWallPost: () => number
  recordMenteeProgress: () => number
  recordArticlePublish: () => number
  recordReferral: () => number
  recordBloodPactLevelUp: () => number

  // ── Getters ──
  getMilitaryTier: () => TierInfo
  getEconomicTier: () => TierInfo
  getPoliticianTier: () => TierInfo
  getMercenaryTier: () => TierInfo
  getInfluencerTier: () => TierInfo
  getMilitaryBonuses: () => { damagePercent: number; critRatePercent: number }
  getEconomicBonuses: () => { extraCompanySlots: number; productionPercent: number }
  getPoliticianBonuses: () => { countryDamage: number; countryProduction: number; countryProspection: number; countryIndustrialist: number; countryDodge: number }
  getMercenaryBonuses: () => { abroadDamagePercent: number; lootChancePercent: number }
  getInfluencerBonuses: () => { extraFriendSlots: number; giftingTaxReduction: number; extraMenteeSlots: number; bloodPactXPBonus: number }
}

type TierInfo = { tier: number; label: string; xp: number; nextXP: number; percent: number }

function ensureToday(state: SpecializationState): Partial<SpecializationState> {
  const today = todayKey()
  if (state.dailyDate !== today) {
    return {
      dailyDate: today,
      dailyMilitaryPoints: 0, dailyEconomicPoints: 0, dailyPoliticianPoints: 0, dailyMercenaryPoints: 0, dailyInfluencerPoints: 0,
      dailyDamageAccumulator: 0, dailyAbroadDamageAccumulator: 0, dailyCountryDamageAccumulator: 0,
      dailyDamageCount: 0, dailyRoundWinCount: 0, dailyTrainCount: 0,
      dailyWorkCount: 0, dailyProduceCount: 0, dailyDonateCount: 0,
      dailyCountryDmgCount: 0, dailyPolDonateCount: 0, dailyElectionCount: 0, dailyHoldOfficeCount: 0,
      dailyAbroadDmgCount: 0, dailyAbroadWinCount: 0, dailyBountyCount: 0, dailyAbroadKillCount: 0,
      dailyWallPostCount: 0, dailyMenteeProgressCount: 0, dailyArticlePublishCount: 0, dailyReferralCount: 0, dailyBloodPactLvlCount: 0,
    }
  }
  return {}
}

const POINTS_KEYS: Record<SpecCategory, keyof SpecializationState> = {
  military: 'dailyMilitaryPoints',
  economic: 'dailyEconomicPoints',
  politician: 'dailyPoliticianPoints',
  mercenary: 'dailyMercenaryPoints',
  influencer: 'dailyInfluencerPoints',
}
const XP_KEYS: Record<SpecCategory, keyof SpecializationState> = {
  military: 'militaryXP',
  economic: 'economicXP',
  politician: 'politicianXP',
  mercenary: 'mercenaryXP',
  influencer: 'influencerXP',
}

function addSpecXP(
  state: SpecializationState,
  category: SpecCategory,
  basePoints: number,
  actionCount: number,
  actionCap: number,
): { updates: Partial<SpecializationState>; gained: number } {
  const reset = ensureToday(state)
  const merged = { ...state, ...reset }
  const pointsKey = POINTS_KEYS[category]
  const xpKey = XP_KEYS[category]
  const currentPoints = merged[pointsKey] as number
  const currentXP = merged[xpKey] as number

  if (currentPoints >= DAILY_XP_CAP) return { updates: reset, gained: 0 }

  const effective = actionCount >= actionCap ? basePoints * 0.5 : basePoints
  const capped = Math.min(effective, DAILY_XP_CAP - currentPoints)
  const rounded = Math.max(0, Math.round(capped * 100) / 100)

  return {
    updates: { ...reset, [pointsKey]: currentPoints + rounded, [xpKey]: currentXP + rounded },
    gained: rounded,
  }
}

function getTierInfo(xp: number, labels: string[]): TierInfo {
  let currentTier = 0
  for (let i = TIER_TABLE.length - 1; i >= 0; i--) {
    if (xp >= TIER_TABLE[i].xpRequired) { currentTier = TIER_TABLE[i].tier; break }
  }
  const nextEntry = TIER_TABLE[currentTier + 1]
  const curEntry = TIER_TABLE[currentTier]
  const nextXP = nextEntry ? nextEntry.xpRequired : curEntry.xpRequired
  const range = nextXP - curEntry.xpRequired
  const progress = range > 0 ? ((xp - curEntry.xpRequired) / range) * 100 : 100
  return {
    tier: currentTier,
    label: labels[currentTier] || 'Unknown',
    xp: Math.round(xp),
    nextXP,
    percent: Math.min(100, Math.max(0, progress)),
  }
}

// ── Damage accumulator helper ──
function handleDamageAccum(
  state: SpecializationState,
  damage: number,
  accumKey: 'dailyDamageAccumulator' | 'dailyAbroadDamageAccumulator' | 'dailyCountryDamageAccumulator',
  category: SpecCategory,
  countKey: keyof SpecializationState,
  cap: number,
): { updates: Partial<SpecializationState>; gained: number } {
  const reset = ensureToday(state)
  const merged = { ...state, ...reset }
  const newAccum = (merged[accumKey] as number) + damage
  const points = Math.floor(newAccum / 10000)
  const remainder = newAccum % 10000

  if (points <= 0) {
    return { updates: { ...reset, [accumKey]: newAccum }, gained: 0 }
  }

  const count = merged[countKey] as number
  const { updates, gained } = addSpecXP({ ...merged, [accumKey]: remainder } as SpecializationState, category, points, count, cap)
  return { updates: { ...updates, [accumKey]: remainder, [countKey]: count + 1 }, gained }
}

// ═══════════════════════════════════════════════════════════════════════════
export const useSpecializationStore = create<SpecializationState>((set, get) => ({
  militaryXP: 0, economicXP: 0, politicianXP: 0, mercenaryXP: 0, influencerXP: 0,

  dailyDate: todayKey(),
  dailyMilitaryPoints: 0, dailyEconomicPoints: 0, dailyPoliticianPoints: 0, dailyMercenaryPoints: 0, dailyInfluencerPoints: 0,
  dailyDamageAccumulator: 0, dailyAbroadDamageAccumulator: 0, dailyCountryDamageAccumulator: 0,

  dailyDamageCount: 0, dailyRoundWinCount: 0, dailyTrainCount: 0,
  dailyWorkCount: 0, dailyProduceCount: 0, dailyDonateCount: 0,
  dailyCountryDmgCount: 0, dailyPolDonateCount: 0, dailyElectionCount: 0, dailyHoldOfficeCount: 0,
  dailyAbroadDmgCount: 0, dailyAbroadWinCount: 0, dailyBountyCount: 0, dailyAbroadKillCount: 0,
  dailyWallPostCount: 0, dailyMenteeProgressCount: 0, dailyArticlePublishCount: 0, dailyReferralCount: 0, dailyBloodPactLvlCount: 0,

  // ═══ MILITARY ═══
  recordDamage: (damage) => {
    let gained = 0
    set((s) => {
      const r = handleDamageAccum(s, damage, 'dailyDamageAccumulator', 'military', 'dailyDamageCount', ACTION_CAPS.damage)
      gained = r.gained
      return r.updates
    })
    return gained
  },
  recordRoundWin: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyRoundWinCount
      const { updates, gained: g } = addSpecXP(m, 'military', 10, c, ACTION_CAPS.roundWin)
      gained = g
      return { ...updates, dailyRoundWinCount: c + 1 }
    })
    return gained
  },
  recordTrainDivision: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyTrainCount
      const { updates, gained: g } = addSpecXP(m, 'military', 3, c, ACTION_CAPS.train)
      gained = g
      return { ...updates, dailyTrainCount: c + 1 }
    })
    return gained
  },

  // ═══ ECONOMIC ═══
  recordWork: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyWorkCount
      const { updates, gained: g } = addSpecXP(m, 'economic', 2, c, ACTION_CAPS.work)
      gained = g
      return { ...updates, dailyWorkCount: c + 1 }
    })
    return gained
  },
  recordProduce: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyProduceCount
      const { updates, gained: g } = addSpecXP(m, 'economic', 3, c, ACTION_CAPS.produce)
      gained = g
      return { ...updates, dailyProduceCount: c + 1 }
    })
    return gained
  },
  recordDonate: (amount) => {
    const units = Math.floor(amount / 100000)
    if (units <= 0) return 0
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyDonateCount >= ACTION_CAPS.donate) return reset
      // Economic XP
      const { updates: u1, gained: g1 } = addSpecXP(m, 'economic', units * 10, 0, 999)
      // Politician XP (on top of economic update)
      const merged2 = { ...m, ...u1 } as SpecializationState
      const { updates: u2 } = addSpecXP(merged2, 'politician', units * 10, 0, 999)
      gained = g1
      return { ...u1, ...u2, dailyDonateCount: m.dailyDonateCount + 1 }
    })
    return gained
  },
  recordMilitaryDonate: (amount) => {
    const units = Math.floor(amount / 100000)
    if (units <= 0) return 0
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyDonateCount >= ACTION_CAPS.donate) return reset
      // Military XP
      const { updates: u1, gained: g1 } = addSpecXP(m, 'military', units * 10, 0, 999)
      // Politician XP (on top of military update)
      const merged2 = { ...m, ...u1 } as SpecializationState
      const { updates: u2 } = addSpecXP(merged2, 'politician', units * 10, 0, 999)
      gained = g1
      return { ...u1, ...u2, dailyDonateCount: m.dailyDonateCount + 1 }
    })
    return gained
  },

  // ═══ POLITICIAN ═══
  recordCountryWarDamage: (damage) => {
    let gained = 0
    set((s) => {
      const r = handleDamageAccum(s, damage, 'dailyCountryDamageAccumulator', 'politician', 'dailyCountryDmgCount', ACTION_CAPS.countryDmg)
      gained = r.gained
      return r.updates
    })
    return gained
  },
  recordPoliticianDonate: (amount) => {
    const units = Math.floor(amount / 100000)
    if (units <= 0) return 0
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyPolDonateCount >= ACTION_CAPS.polDonate) return reset
      const { updates, gained: g } = addSpecXP(m, 'politician', units * 10, 0, 999)
      gained = g
      return { ...updates, dailyPolDonateCount: m.dailyPolDonateCount + 1 }
    })
    return gained
  },
  recordElectionWin: (votePercent) => {
    if (votePercent < 66) return 0
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyElectionCount >= ACTION_CAPS.election) return reset
      const { updates, gained: g } = addSpecXP(m, 'politician', 66, 0, 999)
      gained = g
      return { ...updates, dailyElectionCount: m.dailyElectionCount + 1 }
    })
    return gained
  },
  recordHoldOffice: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyHoldOfficeCount >= ACTION_CAPS.holdOffice) return reset
      const { updates, gained: g } = addSpecXP(m, 'politician', 3, 0, 999)
      gained = g
      return { ...updates, dailyHoldOfficeCount: m.dailyHoldOfficeCount + 1 }
    })
    return gained
  },

  // ═══ MERCENARY ═══
  recordAbroadDamage: (damage) => {
    let gained = 0
    set((s) => {
      const r = handleDamageAccum(s, damage, 'dailyAbroadDamageAccumulator', 'mercenary', 'dailyAbroadDmgCount', ACTION_CAPS.abroadDmg)
      gained = r.gained
      return r.updates
    })
    return gained
  },
  recordAbroadRoundWin: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyAbroadWinCount
      const { updates, gained: g } = addSpecXP(m, 'mercenary', 8, c, ACTION_CAPS.abroadWin)
      gained = g
      return { ...updates, dailyAbroadWinCount: c + 1 }
    })
    return gained
  },
  recordBountyClaim: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyBountyCount >= ACTION_CAPS.bounty) return reset
      const { updates, gained: g } = addSpecXP(m, 'mercenary', 15, 0, 999)
      gained = g
      return { ...updates, dailyBountyCount: m.dailyBountyCount + 1 }
    })
    return gained
  },
  recordAbroadKill: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyAbroadKillCount
      const { updates, gained: g } = addSpecXP(m, 'mercenary', 5, c, ACTION_CAPS.abroadKill)
      gained = g
      return { ...updates, dailyAbroadKillCount: c + 1 }
    })
    return gained
  },

  // ═══ INFLUENCER ═══
  recordWallPost: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyWallPostCount
      const { updates, gained: g } = addSpecXP(m, 'influencer', 3, c, ACTION_CAPS.wallPost)
      gained = g
      return { ...updates, dailyWallPostCount: c + 1 }
    })
    return gained
  },
  recordMenteeProgress: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyMenteeProgressCount
      const { updates, gained: g } = addSpecXP(m, 'influencer', 8, c, ACTION_CAPS.menteeProgress)
      gained = g
      return { ...updates, dailyMenteeProgressCount: c + 1 }
    })
    return gained
  },
  recordArticlePublish: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyArticlePublishCount
      const { updates, gained: g } = addSpecXP(m, 'influencer', 5, c, ACTION_CAPS.articlePublish)
      gained = g
      return { ...updates, dailyArticlePublishCount: c + 1 }
    })
    return gained
  },
  recordReferral: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      if (m.dailyReferralCount >= ACTION_CAPS.referral) return reset
      const { updates, gained: g } = addSpecXP(m, 'influencer', 15, 0, 999)
      gained = g
      return { ...updates, dailyReferralCount: m.dailyReferralCount + 1 }
    })
    return gained
  },
  recordBloodPactLevelUp: () => {
    let gained = 0
    set((s) => {
      const reset = ensureToday(s); const m = { ...s, ...reset }
      const c = m.dailyBloodPactLvlCount
      const { updates, gained: g } = addSpecXP(m, 'influencer', 12, c, ACTION_CAPS.bloodPactLvl)
      gained = g
      return { ...updates, dailyBloodPactLvlCount: c + 1 }
    })
    return gained
  },

  // ═══ GETTERS ═══
  getMilitaryTier:   () => getTierInfo(get().militaryXP,   MIL_TIER_LABELS),
  getEconomicTier:   () => getTierInfo(get().economicXP,   ECO_TIER_LABELS),
  getPoliticianTier: () => getTierInfo(get().politicianXP, POL_TIER_LABELS),
  getMercenaryTier:  () => getTierInfo(get().mercenaryXP,  MER_TIER_LABELS),
  getInfluencerTier: () => getTierInfo(get().influencerXP, INF_TIER_LABELS),

  getMilitaryBonuses: () => {
    const t = getTierInfo(get().militaryXP, MIL_TIER_LABELS).tier
    return { damagePercent: t * 3, critRatePercent: t >= 5 ? 5 : 0 }
  },
  getEconomicBonuses: () => {
    const t = getTierInfo(get().economicXP, ECO_TIER_LABELS).tier
    return { extraCompanySlots: t, productionPercent: t >= 5 ? 5 : 0 }
  },
  getPoliticianBonuses: () => {
    const t = getTierInfo(get().politicianXP, POL_TIER_LABELS).tier
    // T1: +1% dmg/prod, T2: +1% all 3, T3: +2% all 4, T4: +2% all 5, T5: +3% all 5
    if (t <= 0) return { countryDamage: 0, countryProduction: 0, countryProspection: 0, countryIndustrialist: 0, countryDodge: 0 }
    if (t === 1) return { countryDamage: 1, countryProduction: 1, countryProspection: 0, countryIndustrialist: 0, countryDodge: 0 }
    if (t === 2) return { countryDamage: 1, countryProduction: 1, countryProspection: 1, countryIndustrialist: 0, countryDodge: 0 }
    if (t === 3) return { countryDamage: 2, countryProduction: 2, countryProspection: 2, countryIndustrialist: 2, countryDodge: 0 }
    if (t === 4) return { countryDamage: 2, countryProduction: 2, countryProspection: 2, countryIndustrialist: 2, countryDodge: 2 }
    return { countryDamage: 3, countryProduction: 3, countryProspection: 3, countryIndustrialist: 3, countryDodge: 3 }
  },
  getMercenaryBonuses: () => {
    const t = getTierInfo(get().mercenaryXP, MER_TIER_LABELS).tier
    // T1: +3%, T2: +6%, T3: +9% +2% loot, T4: +12%, T5: +15% +3% loot
    return {
      abroadDamagePercent: t * 3,
      lootChancePercent: t >= 5 ? 3 : t >= 3 ? 2 : 0,
    }
  },
  getInfluencerBonuses: () => {
    const t = getTierInfo(get().influencerXP, INF_TIER_LABELS).tier
    // T1: +1 friend, T2: -5% gift tax, T3: +1 mentee, T4: -10% tax +5% pact XP, T5: +2 mentee -15% tax +10% pact XP
    return {
      extraFriendSlots: t >= 1 ? t : 0,
      giftingTaxReduction: t >= 5 ? 15 : t >= 4 ? 10 : t >= 2 ? 5 : 0,
      extraMenteeSlots: t >= 5 ? 3 : t >= 3 ? 2 : 1,
      bloodPactXPBonus: t >= 5 ? 10 : t >= 4 ? 5 : 0,
    }
  },
}))
