/**
 * leyline.types.ts — Server-side types for the Ley Line engine.
 * Mirrors the frontend leyLineRegistry shape but lives in the backend
 * so the engine can be strictly typed without frontend imports.
 */

export type LeyLineArchetype = 'dominion' | 'prosperity' | 'convergence'

export type Continent =
  | 'north_america'
  | 'south_america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania'

export interface LeyLineBonus {
  taxIncome?:           number
  populationGrowth?:    number
  weaponProduction?:    number
  troopMovementSpeed?:  number
  researchSpeed?:       number
  matxExtraction?:      number
  defenderBonus?:       number
  attackerAdvantage?:   number
  troopDamage?:         number
  foodYield?:           number
  armyUpkeep?:          number
  buildSpeed?:          number
  oilExtraction?:       number
  navalSupport?:        number
  deploymentSpeed?:     number
  deploymentRange?:     number
  tradeIncome?:         number
  resourceExtraction?:  number
  techBaseline?:        number
  infraMaintenance?:    number
  weaponDamage?:        number
  politicalPower?:      number
  navalAirEffectiveness?: number
}

export interface LeyLineDef {
  id:         string
  name:       string
  continent:  Continent
  archetype:  LeyLineArchetype
  blocks:     string[]         // region IDs ordered geographically
  bonuses:    LeyLineBonus
  tradeoffs:  LeyLineBonus
}

// ── Engine output types ──

export type ControllerType = 'country' | 'alliance' | 'split'

export interface LineComputedState {
  def:            LeyLineDef
  isActive:       boolean
  controllerType: ControllerType
  controllerIds:  string[]       // country codes or alliance ID
  effectiveness:  number         // 0.25 / 0.50 / 1.0
  completionPct:  number         // 0–100
  appliedBonuses: LeyLineBonus
  appliedTradeoffs: LeyLineBonus
  previouslyActive?: boolean     // set by engine to detect transitions
}

export interface NodeState {
  regionId:   string
  lineId:     string
  ownerCode:  string | null
  isCritical: boolean
}

export interface MergedBuff {
  countryCode:     string
  activeLineIds:   string[]
  mergedBonuses:   LeyLineBonus
  mergedTradeoffs: LeyLineBonus
  resonanceLevel:  string | null
  resonanceBonus:  LeyLineBonus
}

export interface LeyLineEngineResult {
  lineStates:      Map<string, LineComputedState>
  nodeStates:      Map<string, NodeState>           // key: `${regionId}:${lineId}`
  countryBuffs:    Map<string, MergedBuff>
  newActivations:  string[]   // lineIds that just became active
  newDeactivations: string[]  // lineIds that just became inactive
  computedAt:      Date
}
