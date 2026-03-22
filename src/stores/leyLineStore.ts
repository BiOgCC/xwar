import { create } from 'zustand'
import { useRegionStore } from './regionStore'
import { useAllianceStore } from './allianceStore'
import {
  LEY_LINE_DEFS,
  CONTINENTAL_RESONANCE,
  DIMINISHING_RETURNS,
  CROSS_CONTINENTAL_TIERS,
  type LeyLineDef,
  type LeyLineBonus,
  type Continent,
  type ContinentalResonance,
} from '../data/leyLineRegistry'

/* ══════════════════════════════════════════════
   XWAR — Ley Line Store
   Activation, diminishing returns, alliance
   resonance, and cross-continental stacking
   ══════════════════════════════════════════════ */

// ── Computed state types ──

export interface ActiveLeyLine {
  def: LeyLineDef
  /** Which country/alliance holds it */
  heldBy: string
  /** 1.0 / 0.50 / 0.25 based on how many Lines the same country holds */
  effectiveness: number
  /** Completion ratio: how many blocks are held vs total */
  completion: number
  /** Whether the line is fully activated */
  active: boolean
  /** Countries that control at least one block */
  involvedCountries: string[]
}

export interface ActiveResonance {
  resonance: ContinentalResonance
  allianceId: string
}

export interface CrossContinentalBonus {
  name: string
  allStatBonus: number
  setsCompleted: number
  allianceId: string
}

export interface LeyLineState {
  getActiveLines: () => ActiveLeyLine[]
  getAllLineStatus: () => ActiveLeyLine[]
  getActiveResonances: () => ActiveResonance[]
  getCrossContinentalBonus: (allianceId: string) => CrossContinentalBonus | null
  getBonusesForCountry: (countryCode: string) => LeyLineBonus
  getLinesForRegion: (regionId: string) => ActiveLeyLine[]
  isDenialTarget: (regionId: string) => boolean
}

// ═══════════════════════════════════════════════════════════════
// PURE HELPER FUNCTIONS (no store self-reference)
// ═══════════════════════════════════════════════════════════════

/** Check if a set of country codes all belong to the same alliance */
function areAllied(countryCodes: string[]): { allied: boolean; allianceId: string | null } {
  const allianceState = useAllianceStore.getState()
  for (const alliance of allianceState.alliances) {
    const memberCCs = new Set(alliance.members.map(m => m.countryCode))
    if (countryCodes.every(cc => memberCCs.has(cc))) {
      return { allied: true, allianceId: alliance.id }
    }
  }
  return { allied: false, allianceId: null }
}

/** Compute completion and activation for a single Line */
function computeLineStatus(line: LeyLineDef): ActiveLeyLine {
  const regions = useRegionStore.getState().regions
  const blockRegions = line.blocks.map(b => regions.find(r => r.id === b))

  const controllerCounts = new Map<string, number>()
  let validBlocks = 0

  for (const br of blockRegions) {
    if (!br) continue
    validBlocks++
    const cc = br.controlledBy
    controllerCounts.set(cc, (controllerCounts.get(cc) || 0) + 1)
  }

  const totalBlocks = line.blocks.length
  const involvedCountries = [...controllerCounts.keys()]

  // Single controller owns ALL blocks
  const singleHolder = involvedCountries.find(cc => controllerCounts.get(cc) === totalBlocks)
  if (singleHolder) {
    return { def: line, heldBy: singleHolder, effectiveness: 1.0, completion: 1.0, active: true, involvedCountries }
  }

  // Alliance check: all controllers in the same alliance
  if (involvedCountries.length > 0 && validBlocks === totalBlocks) {
    const { allied, allianceId } = areAllied(involvedCountries)
    if (allied && allianceId) {
      return { def: line, heldBy: allianceId, effectiveness: 1.0, completion: 1.0, active: true, involvedCountries }
    }
  }

  // Partial — largest controller
  const bestHolder = involvedCountries.reduce((best, cc) =>
    (controllerCounts.get(cc) || 0) > (controllerCounts.get(best) || 0) ? cc : best
  , involvedCountries[0] || '')

  const bestCount = controllerCounts.get(bestHolder) || 0

  return { def: line, heldBy: bestHolder, effectiveness: 0, completion: totalBlocks > 0 ? bestCount / totalBlocks : 0, active: false, involvedCountries }
}

/** Apply diminishing returns */
function applyDiminishingReturns(lines: ActiveLeyLine[]): ActiveLeyLine[] {
  const byHolder = new Map<string, ActiveLeyLine[]>()
  for (const line of lines) {
    if (!line.active) continue
    const list = byHolder.get(line.heldBy) || []
    list.push(line)
    byHolder.set(line.heldBy, list)
  }

  const result: ActiveLeyLine[] = []

  for (const [, holderLines] of byHolder) {
    const isAlliance = holderLines[0]?.heldBy.startsWith('alliance_')
    if (isAlliance) {
      // Alliance lines — no diminishing (different members hold different lines)
      for (const line of holderLines) {
        result.push({ ...line, effectiveness: 1.0 })
      }
    } else {
      // Single country — diminishing returns
      holderLines.forEach((line, idx) => {
        const dim = idx < DIMINISHING_RETURNS.length
          ? DIMINISHING_RETURNS[idx]
          : DIMINISHING_RETURNS[DIMINISHING_RETURNS.length - 1]
        result.push({ ...line, effectiveness: dim })
      })
    }
  }

  // Add inactive lines
  for (const line of lines) {
    if (!line.active) result.push(line)
  }

  return result
}

/** Merge multiple LeyLineBonus objects, scaling by effectiveness */
function mergeBonuses(bonuses: { bonus: LeyLineBonus; effectiveness: number }[]): LeyLineBonus {
  const merged: LeyLineBonus = {}
  for (const { bonus, effectiveness } of bonuses) {
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value !== 'number') continue
      const k = key as keyof LeyLineBonus
      merged[k] = (merged[k] || 0) + value * effectiveness
    }
  }
  return merged
}

/** Compute all line statuses */
function computeAllStatuses(): ActiveLeyLine[] {
  return applyDiminishingReturns(LEY_LINE_DEFS.map(computeLineStatus))
}

/** Compute active lines only */
function computeActiveLines(): ActiveLeyLine[] {
  const all = LEY_LINE_DEFS.map(computeLineStatus)
  return applyDiminishingReturns(all.filter(l => l.active))
}

/** Compute active resonances */
function computeActiveResonances(): ActiveResonance[] {
  const active = LEY_LINE_DEFS.map(computeLineStatus).filter(l => l.active)
  const resonances: ActiveResonance[] = []

  const byCont = new Map<Continent, ActiveLeyLine[]>()
  for (const line of active) {
    const list = byCont.get(line.def.continent) || []
    list.push(line)
    byCont.set(line.def.continent, list)
  }

  for (const [continent, lines] of byCont) {
    if (lines.length < 3) continue
    const archetypes = new Set(lines.map(l => l.def.archetype))
    if (archetypes.size < 3) continue

    const allHolders = [...new Set(lines.flatMap(l => l.involvedCountries))]
    const { allied, allianceId } = areAllied(allHolders)

    if (allied && allianceId) {
      const resDef = CONTINENTAL_RESONANCE.find(r => r.continent === continent)
      if (resDef) resonances.push({ resonance: resDef, allianceId })
    } else if (allHolders.length === 1) {
      const resDef = CONTINENTAL_RESONANCE.find(r => r.continent === continent)
      if (resDef) resonances.push({ resonance: resDef, allianceId: `country_${allHolders[0]}` })
    }
  }

  return resonances
}

/** Compute Cross-Continental bonus */
function computeCrossContinentalBonus(allianceId: string): CrossContinentalBonus | null {
  const resonances = computeActiveResonances()
  const setsCompleted = resonances.filter(r => r.allianceId === allianceId).length

  const tier = [...CROSS_CONTINENTAL_TIERS]
    .reverse()
    .find(t => setsCompleted >= t.setsRequired)

  if (!tier) return null

  return { name: tier.name, allStatBonus: tier.allStatBonus, setsCompleted, allianceId }
}

// ═══════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════

export const useLeyLineStore = create<LeyLineState>(() => ({

  getAllLineStatus: computeAllStatuses,
  getActiveLines: computeActiveLines,
  getActiveResonances: computeActiveResonances,
  getCrossContinentalBonus: computeCrossContinentalBonus,

  getBonusesForCountry: (countryCode: string): LeyLineBonus => {
    const allLines = computeActiveLines()

    const relevantLines = allLines.filter(line => {
      if (!line.active) return false
      const regions = useRegionStore.getState().regions
      return line.def.blocks.some(b => {
        const r = regions.find(reg => reg.id === b)
        return r && r.controlledBy === countryCode
      })
    })

    const parts: { bonus: LeyLineBonus; effectiveness: number }[] = []

    for (const line of relevantLines) {
      parts.push({ bonus: line.def.bonuses, effectiveness: line.effectiveness })
      parts.push({ bonus: line.def.tradeoffs, effectiveness: line.effectiveness })
    }

    // Resonance bonuses
    const allianceState = useAllianceStore.getState()
    const playerAlliance = allianceState.alliances.find(a =>
      a.members.some(m => m.countryCode === countryCode)
    )

    if (playerAlliance) {
      const resonances = computeActiveResonances()
      for (const { resonance, allianceId } of resonances) {
        if (allianceId === playerAlliance.id || allianceId === `country_${countryCode}`) {
          parts.push({ bonus: resonance.bonus, effectiveness: 1.0 })
        }
      }

      const crossBonus = computeCrossContinentalBonus(playerAlliance.id)
      if (crossBonus) {
        parts.push({
          bonus: {
            taxIncome: crossBonus.allStatBonus,
            populationGrowth: crossBonus.allStatBonus,
            weaponProduction: crossBonus.allStatBonus,
            troopMovementSpeed: crossBonus.allStatBonus,
            researchSpeed: crossBonus.allStatBonus,
            matxExtraction: crossBonus.allStatBonus,
            defenderBonus: crossBonus.allStatBonus,
            foodYield: crossBonus.allStatBonus,
          },
          effectiveness: 1.0,
        })
      }
    }

    return mergeBonuses(parts)
  },

  getLinesForRegion: (regionId: string): ActiveLeyLine[] => {
    return computeAllStatuses().filter(l => l.def.blocks.includes(regionId))
  },

  isDenialTarget: (regionId: string): boolean => {
    const allLines = LEY_LINE_DEFS.map(computeLineStatus)
    for (const line of allLines) {
      if (line.active) continue
      if (!line.def.blocks.includes(regionId)) continue

      const totalBlocks = line.def.blocks.length
      const regions = useRegionStore.getState().regions
      const blockRegions = line.def.blocks.map(b => regions.find(r => r.id === b))

      const others = blockRegions.filter(r => r && r.id !== regionId)
      if (others.length !== totalBlocks - 1) continue

      const controllers = new Set(others.map(r => r!.controlledBy))
      if (controllers.size === 1) return true
      const { allied } = areAllied([...controllers])
      if (allied) return true
    }
    return false
  },
}))

// ═══════════════════════════════════════════════════════════════
// EXPORTED COMBAT HELPERS (used by battleStore)
// ═══════════════════════════════════════════════════════════════

/**
 * Compute combat-relevant multipliers from Ley Line bonuses for a country.
 * Returns { damageMult, armorMult } ready to multiply into the damage formula.
 */
export function computeLeyLineCombatMods(countryCode: string): { damageMult: number; armorMult: number } {
  const bonuses = useLeyLineStore.getState().getBonusesForCountry(countryCode)

  // Sum up all damage-related bonuses into a single multiplier
  const troopDmg  = bonuses.troopDamage       ?? 0  // e.g. +0.10 = +10%
  const weaponDmg = bonuses.weaponDamage       ?? 0
  const atkAdv    = bonuses.attackerAdvantage   ?? 0
  const damageMult = 1 + troopDmg + weaponDmg + atkAdv

  // DefenderBonus translates to armor multiplier
  const defBonus = bonuses.defenderBonus ?? 0
  const armorMult = 1 + defBonus

  return {
    damageMult: Math.max(0.1, damageMult),  // floor at 10% (can't reduce below)
    armorMult:  Math.max(0.1, armorMult),
  }
}
