/**
 * leyline.engine.ts — Core Ley Line computation engine.
 *
 * runLeyLineEngine() is the single entry point.
 * It is pure logic: reads DB → computes state → writes DB + cache.
 * No HTTP context. No side effects beyond DB writes and cache mutation.
 *
 * Idempotent: running twice produces the same result.
 */

import { db } from '../db/connection.js'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import {
  regionOwnership,
  leyLineState,
  leyLineNodeState,
  countryLeyLineBuff,
  alliances,
  leyLineDefs as leyLineDefsTable,
} from '../db/schema.js'
import { leyLineCache } from '../cache/leyLineCache.js'
import {
  LEY_LINE_DEFS as STATIC_LEY_LINE_DEFS,
  CONTINENTAL_RESONANCE,
  CONTINENT_ARCHETYPES,
  DIMINISHING_RETURNS,
  CROSS_CONTINENTAL_TIERS,
} from '../config/leyLineRegistry.server.js'
import type {
  LeyLineBonus,
  LeyLineDef,
  LineComputedState,
  NodeState,
  MergedBuff,
  LeyLineEngineResult,
  ControllerType,
} from '../types/leyline.types.js'
import { logger } from '../utils/logger.js'

// ─────────────────────────────────────────────
//  Load ley line definitions: DB first, static fallback
// ─────────────────────────────────────────────

async function loadLeyLineDefs(): Promise<LeyLineDef[]> {
  try {
    const rows = await db.select().from(leyLineDefsTable).where(eq(leyLineDefsTable.enabled, true))
    if (rows.length > 0) {
      // Merge with static: static lines not in DB are still included
      const dbIds = new Set(rows.map(r => r.id))
      const staticFallback = STATIC_LEY_LINE_DEFS.filter(l => !dbIds.has(l.id))
      const dbDefs: LeyLineDef[] = rows.map(r => ({
        id:        r.id,
        name:      r.name,
        continent: r.continent as LeyLineDef['continent'],
        archetype: r.archetype as LeyLineDef['archetype'],
        blocks:    (r.blocks ?? []) as string[],
        bonuses:   (r.bonuses ?? {}) as LeyLineBonus,
        tradeoffs: (r.tradeoffs ?? {}) as LeyLineBonus,
      }))
      return [...dbDefs, ...staticFallback]
    }
  } catch (err) {
    logger.warn({ err }, '[LEY-LINE-ENGINE] DB defs load failed, using static fallback')
  }
  return STATIC_LEY_LINE_DEFS
}


// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

function mergeBonus(
  target: LeyLineBonus,
  source: LeyLineBonus,
  multiplier = 1.0,
): LeyLineBonus {
  const result: LeyLineBonus = { ...target }
  for (const [k, v] of Object.entries(source)) {
    const key = k as keyof LeyLineBonus
    const current = (result[key] ?? 0) as number
    result[key] = current + (v as number) * multiplier
  }
  return result
}

function allStatBonus(bonus: number): LeyLineBonus {
  return {
    taxIncome:           bonus,
    weaponProduction:    bonus,
    researchSpeed:       bonus,
    troopDamage:         bonus,
    troopMovementSpeed:  bonus,
    oilExtraction:       bonus,
    tradeIncome:         bonus,
    resourceExtraction:  bonus,
  }
}

// ─────────────────────────────────────────────
//  2a. Load region ownership snapshot
// ─────────────────────────────────────────────

async function loadOwnership(): Promise<Map<string, string>> {
  const rows = await db.select({
    regionId:    regionOwnership.regionId,
    countryCode: regionOwnership.countryCode,
  }).from(regionOwnership)

  const map = new Map<string, string>()
  for (const r of rows) {
    if (r.countryCode) map.set(r.regionId, r.countryCode)
  }
  return map
}

// ─────────────────────────────────────────────
//  2b. Load alliance membership: country → allianceId
// ─────────────────────────────────────────────

async function loadAllianceMap(): Promise<Map<string, string>> {
  // alliances.members is a JSONB array of { countryCode: string, ... }
  const rows = await db.select({
    id:      alliances.id,
    members: alliances.members,
  }).from(alliances)

  const map = new Map<string, string>()
  for (const row of rows) {
    const members = (row.members ?? []) as Array<{ countryCode?: string }>
    for (const m of members) {
      if (m.countryCode) map.set(m.countryCode, row.id)
    }
  }
  return map
}

// ─────────────────────────────────────────────
//  2c. Compute each ley line's state
// ─────────────────────────────────────────────

interface RawLineState {
  def:            LeyLineDef
  isActive:       boolean
  controllerType: ControllerType
  controllerIds:  string[]
  completionPct:  number
  criticalRegions: string[]   // regions that are the last missing node(s)
  heldBy:         string | null  // countryCode or allianceId if fully held by one side
}

function computeLineState(
  line: LeyLineDef,
  ownership: Map<string, string>,
  allianceMap: Map<string, string>,
): RawLineState {
  const blockOwners = line.blocks.map(regionId => ({
    regionId,
    owner: ownership.get(regionId) ?? null,
    alliance: (() => {
      const cc = ownership.get(regionId)
      return cc ? allianceMap.get(cc) ?? null : null
    })(),
  }))

  const totalBlocks = line.blocks.length
  const ownedBlocks = blockOwners.filter(b => b.owner !== null)
  const completionPct = (ownedBlocks.length / totalBlocks) * 100

  // Determine if single country holds all blocks
  const allOwners = blockOwners.map(b => b.owner).filter((o): o is string => o !== null)
  const uniqueOwners = new Set(allOwners)

  // For alliance check: every block must resolve to the same non-null alliance ID
  const allianceIds = blockOwners.map(b => b.alliance)
  const firstAlliance = allianceIds[0]
  const allSameAlliance =
    firstAlliance !== null &&
    allianceIds.every(a => a === firstAlliance)
  const uniqueAlliances = allSameAlliance ? new Set([firstAlliance]) : new Set<string>()

  let isActive = false
  let controllerType: ControllerType = 'split'
  let controllerIds: string[] = []
  let heldBy: string | null = null

  if (ownedBlocks.length === totalBlocks) {
    // All blocks owned — check if same country or same alliance
    if (uniqueOwners.size === 1) {
      isActive = true
      controllerType = 'country'
      controllerIds = [...uniqueOwners]
      heldBy = controllerIds[0]!
    } else if (uniqueAlliances.size === 1) {
      // All owned by countries in the same alliance
      isActive = true
      controllerType = 'alliance'
      controllerIds = [...uniqueAlliances]
      heldBy = controllerIds[0]!
    } else {
      // Multiple sides — split (contested)
      controllerType = 'split'
      controllerIds = [...uniqueOwners].slice(0, 4)
    }
  }


  // Critical = exactly one block missing (unowned) while rest belongs to one side
  const unownedBlocks = blockOwners.filter(b => b.owner === null)
  let criticalRegions: string[] = []
  if (!isActive && unownedBlocks.length === 1) {
    // Check all owned blocks belong to same side
    const ownedOwnerSet = new Set(blockOwners.filter(b => b.owner !== null).map(b => b.owner))
    const ownedAllianceSet = new Set(
      blockOwners.filter(b => b.alliance !== null && b.owner !== null).map(b => b.alliance)
    )
    if (ownedOwnerSet.size === 1 || ownedAllianceSet.size === 1) {
      criticalRegions = unownedBlocks.map(b => b.regionId)
    }
  }

  return {
    def: line,
    isActive,
    controllerType,
    controllerIds,
    completionPct,
    criticalRegions,
    heldBy,
  }
}

// ─────────────────────────────────────────────
//  2d. Apply diminishing returns per country
// ─────────────────────────────────────────────

function applyDiminishingReturns(
  rawLines: RawLineState[],
  allianceMap: Map<string, string>,
): Map<string, { line: RawLineState; effectiveness: number }[]> {
  // country-held lines (not alliance) get diminishing returns
  const countryLines = new Map<string, RawLineState[]>()

  for (const raw of rawLines) {
    if (!raw.isActive) continue
    if (raw.controllerType === 'alliance') continue  // alliances always 1.0

    for (const cc of raw.controllerIds) {
      const existing = countryLines.get(cc) ?? []
      existing.push(raw)
      countryLines.set(cc, existing)
    }
  }

  const result = new Map<string, { line: RawLineState; effectiveness: number }[]>()

  countryLines.forEach((lines, cc) => {
    const withEff = lines.map((l, i) => ({
      line: l,
      effectiveness: (DIMINISHING_RETURNS[i] ?? 0.25) as number,
    }))
    result.set(cc, withEff)
  })

  // Alliance-held lines: all member countries get 1.0
  for (const raw of rawLines) {
    if (!raw.isActive || raw.controllerType !== 'alliance') continue
    const allianceId = raw.controllerIds[0]!
    // Find all countries in this alliance
    allianceMap.forEach((aid, cc) => {
      if (aid !== allianceId) return
      const existing = result.get(cc) ?? []
      existing.push({ line: raw, effectiveness: 1.0 })
      result.set(cc, existing)
    })
  }

  return result
}

// ─────────────────────────────────────────────
//  2e–2f. Continental & cross-continental resonance
// ─────────────────────────────────────────────

function computeResonance(
  countryActiveLines: Map<string, { line: RawLineState; effectiveness: number }[]>,
): Map<string, { level: string | null; bonus: LeyLineBonus }> {
  const result = new Map<string, { level: string | null; bonus: LeyLineBonus }>()

  countryActiveLines.forEach((lines, cc) => {
    // Group archetypes per continent for this country
    const heldByContinent = new Map<string, Set<string>>()
    for (const { line } of lines) {
      const { continent, archetype } = line.def
      const set = heldByContinent.get(continent) ?? new Set()
      set.add(archetype)
      heldByContinent.set(continent, set)
    }

    let mergedResonanceBonus: LeyLineBonus = {}
    let resonanceSetsCount = 0

    heldByContinent.forEach((archetypes, continent) => {
      const required = CONTINENT_ARCHETYPES[continent as keyof typeof CONTINENT_ARCHETYPES]
      if (!required) return
      const hasAll = required.every(a => archetypes.has(a))
      if (!hasAll) return

      resonanceSetsCount++
      const res = CONTINENTAL_RESONANCE.find(r => r.continent === continent)
      if (res) {
        mergedResonanceBonus = mergeBonus(mergedResonanceBonus, res.bonus as LeyLineBonus)
      }
    })

    // Cross-continental tier
    let level: string | null = null
    for (const tier of [...CROSS_CONTINENTAL_TIERS].reverse()) {
      if (resonanceSetsCount >= tier.setsRequired) {
        mergedResonanceBonus = mergeBonus(mergedResonanceBonus, allStatBonus(tier.allStatBonus))
        level = tier.name
        break
      }
    }

    if (resonanceSetsCount > 0 && !level) {
      // Had continental resonance but not cross-continental tier
      level = 'continental'
    }

    result.set(cc, { level, bonus: mergedResonanceBonus })
  })

  return result
}

// ─────────────────────────────────────────────
//  2g. Merge all bonuses per country
// ─────────────────────────────────────────────

function computeCountryBuffs(
  countryActiveLines: Map<string, { line: RawLineState; effectiveness: number }[]>,
  resonance: Map<string, { level: string | null; bonus: LeyLineBonus }>,
): Map<string, MergedBuff> {
  const result = new Map<string, MergedBuff>()

  countryActiveLines.forEach((lines, cc) => {
    let merged: LeyLineBonus = {}
    let mergedTradeoffs: LeyLineBonus = {}
    const activeLineIds: string[] = []

    for (const { line, effectiveness } of lines) {
      merged = mergeBonus(merged, line.def.bonuses, effectiveness)
      mergedTradeoffs = mergeBonus(mergedTradeoffs, line.def.tradeoffs, effectiveness)
      activeLineIds.push(line.def.id)
    }

    const res = resonance.get(cc)
    if (res && Object.keys(res.bonus).length > 0) {
      merged = mergeBonus(merged, res.bonus)
    }

    result.set(cc, {
      countryCode:     cc,
      activeLineIds,
      mergedBonuses:   merged,
      mergedTradeoffs: mergedTradeoffs,
      resonanceLevel:  res?.level ?? null,
      resonanceBonus:  res?.bonus ?? {},
    })
  })

  return result
}

// ─────────────────────────────────────────────
//  2h. Detect transitions
// ─────────────────────────────────────────────

function detectTransitions(
  rawLines: RawLineState[],
  previousCache: Map<string, LineComputedState>,
): { newActivations: string[]; newDeactivations: string[] } {
  const newActivations: string[] = []
  const newDeactivations: string[] = []

  for (const raw of rawLines) {
    const prev = previousCache.get(raw.def.id)
    const wasActive = prev?.isActive ?? false
    if (raw.isActive && !wasActive) newActivations.push(raw.def.id)
    if (!raw.isActive && wasActive) newDeactivations.push(raw.def.id)
  }

  return { newActivations, newDeactivations }
}

// ─────────────────────────────────────────────
//  MAIN ENGINE FUNCTION
// ─────────────────────────────────────────────

export async function runLeyLineEngine(): Promise<LeyLineEngineResult> {
  const start = Date.now()

  // 0. Load definitions (DB-first, static fallback)
  const LEY_LINE_DEFS = await loadLeyLineDefs()

  // 2a. Ownership snapshot
  const ownership = await loadOwnership()

  // 2b. Alliance map
  const allianceMap = await loadAllianceMap()

  // 2c. Compute each line
  const rawLines: RawLineState[] = LEY_LINE_DEFS.map((line: LeyLineDef) =>
    computeLineState(line, ownership, allianceMap)
  )

  // 2h. Detect transitions (before overwriting cache)
  const { newActivations, newDeactivations } = detectTransitions(
    rawLines,
    leyLineCache.lineStates,
  )

  // 2d. Diminishing returns
  const countryActiveLines = applyDiminishingReturns(rawLines, allianceMap)

  // 2e–2f. Resonance
  const resonance = computeResonance(countryActiveLines)

  // 2g. Merged buffs per country
  const countryBuffs = computeCountryBuffs(countryActiveLines, resonance)

  // Build LineComputedState map
  const lineStates = new Map<string, LineComputedState>()
  const nodeStates = new Map<string, NodeState>()

  for (const raw of rawLines) {
    // Determine effectiveness for this line's primary controller
    let effectiveness = 1.0
    if (raw.isActive && raw.controllerType === 'country') {
      const cc = raw.controllerIds[0]!
      const lines = countryActiveLines.get(cc) ?? []
      const entry = lines.find(l => l.line.def.id === raw.def.id)
      effectiveness = entry?.effectiveness ?? 1.0
    }

    const state: LineComputedState = {
      def:            raw.def,
      isActive:       raw.isActive,
      controllerType: raw.controllerType,
      controllerIds:  raw.controllerIds,
      effectiveness,
      completionPct:  raw.completionPct,
      appliedBonuses: raw.isActive
        ? Object.fromEntries(
            Object.entries(raw.def.bonuses).map(([k, v]) => [k, (v as number) * effectiveness])
          ) as LeyLineBonus
        : {},
      appliedTradeoffs: raw.isActive
        ? Object.fromEntries(
            Object.entries(raw.def.tradeoffs).map(([k, v]) => [k, (v as number) * effectiveness])
          ) as LeyLineBonus
        : {},
    }
    lineStates.set(raw.def.id, state)

    // Build node states
    for (const regionId of raw.def.blocks) {
      const ownerCode = ownership.get(regionId) ?? null
      const isCritical = raw.criticalRegions.includes(regionId)
      const nodeKey = `${regionId}:${raw.def.id}`
      nodeStates.set(nodeKey, { regionId, lineId: raw.def.id, ownerCode, isCritical })
    }
  }

  const computedAt    = new Date()
  const computedAtISO = computedAt.toISOString()

  // 3. DB write (single transaction)
  await db.transaction(async (tx) => {
    // Upsert ley_line_state
    for (const [lineId, state] of lineStates) {
      const activatedAt   = newActivations.includes(lineId)   ? computedAtISO : null
      const deactivatedAt = newDeactivations.includes(lineId) ? computedAtISO : null
      await tx.execute(sql`
        INSERT INTO ley_line_state
          (line_id, is_active, activated_at, deactivated_at, controller_type,
           controller_ids, effectiveness, applied_bonuses, applied_tradeoffs,
           completion_pct, updated_at)
        VALUES (
          ${lineId},
          ${state.isActive},
          ${activatedAt}::timestamptz,
          ${deactivatedAt}::timestamptz,
          ${state.controllerType},
          ${JSON.stringify(state.controllerIds)}::jsonb,
          ${state.effectiveness},
          ${JSON.stringify(state.appliedBonuses)}::jsonb,
          ${JSON.stringify(state.appliedTradeoffs)}::jsonb,
          ${state.completionPct},
          ${computedAtISO}::timestamptz
        )
        ON CONFLICT (line_id) DO UPDATE SET
          is_active         = EXCLUDED.is_active,
          activated_at      = COALESCE(EXCLUDED.activated_at, ley_line_state.activated_at),
          deactivated_at    = COALESCE(EXCLUDED.deactivated_at, ley_line_state.deactivated_at),
          controller_type   = EXCLUDED.controller_type,
          controller_ids    = EXCLUDED.controller_ids,
          effectiveness     = EXCLUDED.effectiveness,
          applied_bonuses   = EXCLUDED.applied_bonuses,
          applied_tradeoffs = EXCLUDED.applied_tradeoffs,
          completion_pct    = EXCLUDED.completion_pct,
          updated_at        = EXCLUDED.updated_at
      `)
    }

    // Upsert ley_line_node_state
    for (const [, node] of nodeStates) {
      await tx.execute(sql`
        INSERT INTO ley_line_node_state
          (region_id, line_id, owner_code, is_critical, updated_at)
        VALUES (
          ${node.regionId},
          ${node.lineId},
          ${node.ownerCode},
          ${node.isCritical},
          ${computedAtISO}::timestamptz
        )
        ON CONFLICT (region_id, line_id) DO UPDATE SET
          owner_code   = EXCLUDED.owner_code,
          is_critical  = EXCLUDED.is_critical,
          updated_at   = EXCLUDED.updated_at
      `)
    }

    // Upsert country_ley_line_buff
    for (const [cc, buff] of countryBuffs) {
      await tx.execute(sql`
        INSERT INTO country_ley_line_buff
          (country_code, active_line_ids, merged_bonuses, merged_tradeoffs,
           resonance_level, resonance_bonus, computed_at)
        VALUES (
          ${cc},
          ${JSON.stringify(buff.activeLineIds)}::jsonb,
          ${JSON.stringify(buff.mergedBonuses)}::jsonb,
          ${JSON.stringify(buff.mergedTradeoffs)}::jsonb,
          ${buff.resonanceLevel},
          ${JSON.stringify(buff.resonanceBonus)}::jsonb,
          ${computedAtISO}::timestamptz
        )
        ON CONFLICT (country_code) DO UPDATE SET
          active_line_ids   = EXCLUDED.active_line_ids,
          merged_bonuses    = EXCLUDED.merged_bonuses,
          merged_tradeoffs  = EXCLUDED.merged_tradeoffs,
          resonance_level   = EXCLUDED.resonance_level,
          resonance_bonus   = EXCLUDED.resonance_bonus,
          computed_at       = EXCLUDED.computed_at
      `)
    }
  })


  // 3b. Update in-memory cache
  leyLineCache.lineStates.clear()
  leyLineCache.nodeStates.clear()
  leyLineCache.countryBuffs.clear()

  lineStates.forEach((v, k)     => leyLineCache.lineStates.set(k, v))
  nodeStates.forEach((v, k)     => leyLineCache.nodeStates.set(k, v))
  countryBuffs.forEach((v, k)   => leyLineCache.countryBuffs.set(k, v))
  leyLineCache.lastComputedAt = computedAt

  logger.info(`[LEY-LINE-ENGINE] Done in ${Date.now() - start}ms — ` +
    `lines:${lineStates.size} nodes:${nodeStates.size} countries:${countryBuffs.size} ` +
    `activations:${newActivations.length} deactivations:${newDeactivations.length}`)

  return {
    lineStates,
    nodeStates,
    countryBuffs,
    newActivations,
    newDeactivations,
    computedAt,
  }
}
