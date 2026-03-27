/**
 * leylines.router.ts — Read-only API endpoints for Ley Line state.
 *
 * All endpoints read from leyLineCache — never query the DB.
 * The pipeline owns DB writes; the API owns reads.
 *
 * Routes:
 *   GET /api/ley-lines                  → all line states
 *   GET /api/ley-lines/:lineId          → single line + nodes
 *   GET /api/ley-lines/country/:cc      → merged buff totals for a country
 *   GET /api/ley-lines/region/:regionId → which lines pass through this region
 */

import { Router } from 'express'
import { leyLineCache } from '../cache/leyLineCache.js'
import { LEY_LINE_DEFS } from '../config/leyLineRegistry.server.js'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/connection.js'
import { leyLineDefs as leyLineDefsTable } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const router = Router()

// ── GET /api/ley-lines ──────────────────────────────────────────────────────
// All line states with their nodes. Cache-only, no DB.

router.get('/', requireAuth as any, (_req, res) => {
  if (!leyLineCache.initialized) {
    res.status(503).json({ error: 'Ley line engine not yet initialized', code: 'NOT_READY' })
    return
  }

  const lines = Array.from(leyLineCache.lineStates.values()).map(s => ({
    id:               s.def.id,
    name:             s.def.name,
    archetype:        s.def.archetype,
    continent:        s.def.continent,
    isActive:         s.isActive,
    completionPct:    s.completionPct,
    effectiveness:    s.effectiveness,
    controllerType:   s.controllerType,
    controllerIds:    s.controllerIds,
    appliedBonuses:   s.appliedBonuses,
    appliedTradeoffs: s.appliedTradeoffs,
    nodes: s.def.blocks.map(regionId => {
      const node = leyLineCache.nodeStates.get(`${regionId}:${s.def.id}`)
      return {
        regionId,
        ownerCode:  node?.ownerCode  ?? null,
        isCritical: node?.isCritical ?? false,
      }
    }),
  }))

  res.json({
    lines,
    computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null,
  })
})

// ── GET /api/ley-lines/country/:cc ─────────────────────────────────────────
// MUST come before /:lineId — otherwise Express matches "country" as lineId

router.get('/country/:cc', requireAuth as any, (req, res) => {
  const { cc } = req.params
  const buff   = leyLineCache.countryBuffs.get(cc.toUpperCase())

  if (!buff) {
    res.json({
      countryCode: cc.toUpperCase(),
      activeLineIds: [],
      mergedBonuses: {},
      mergedTradeoffs: {},
      resonanceLevel: null,
      resonanceBonus: {},
      computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null,
    })
    return
  }

  res.json({
    ...buff,
    computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null,
  })
})

// ── GET /api/ley-lines/region/:regionId ────────────────────────────────────

router.get('/region/:regionId', requireAuth as any, (req, res) => {
  const { regionId } = req.params

  const linesForRegion = LEY_LINE_DEFS.filter(l => l.blocks.includes(regionId))
  if (linesForRegion.length === 0) {
    res.json({ regionId, lines: [], computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null })
    return
  }

  const lines = linesForRegion.map(def => {
    const state = leyLineCache.lineStates.get(def.id)
    const node  = leyLineCache.nodeStates.get(`${regionId}:${def.id}`)
    return {
      lineId:       def.id,
      lineName:     def.name,
      archetype:    def.archetype,
      isActive:     state?.isActive    ?? false,
      completionPct: state?.completionPct ?? 0,
      effectiveness: state?.effectiveness ?? 1,
      node: {
        ownerCode:  node?.ownerCode  ?? null,
        isCritical: node?.isCritical ?? false,
      },
    }
  })

  res.json({
    regionId,
    lines,
    computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null,
  })
})

// ── GET /api/ley-lines/defs ────────────────────────────────────────────────
// Returns the merged set of ALL ley line definitions (DB + static fallback).
// Used by the frontend map to know which lines to render, even before engine runs.
// MUST come before /:lineId wildcard.

router.get('/defs', async (_req, res) => {
  try {
    // 3-second timeout guard against postgres OOM / slow queries
    const query = db.select().from(leyLineDefsTable).where(eq(leyLineDefsTable.enabled, true))
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    )
    const dbRows = (await Promise.race([query, timeout])) as any[]

    const dbIds = new Set(dbRows.map(r => r.id))
    const staticFallback = LEY_LINE_DEFS.filter(l => !dbIds.has(l.id))

    const defs = [
      ...dbRows.map(r => ({
        id:        r.id,
        name:      r.name,
        lineType:  'land' as const,
        continent: r.continent,
        archetype: r.archetype,
        blocks:    r.blocks ?? [],
        bonuses:   r.bonuses ?? {},
        tradeoffs: r.tradeoffs ?? {},
        source:    'db' as const,
      })),
      ...staticFallback.map(l => ({ ...l, source: 'static' as const })),
    ]

    res.json({ defs, count: defs.length, computedAt: new Date().toISOString() })
  } catch (err: any) {
    if (err?.code === '53200') console.warn('[ley-lines/defs] Postgres OOM — static fallback')
    else if (err?.message === 'DB timeout') console.warn('[ley-lines/defs] DB timeout — static fallback')
    res.json({
      defs: LEY_LINE_DEFS.map(l => ({ ...l, source: 'static' as const })),
      count: LEY_LINE_DEFS.length,
      computedAt: new Date().toISOString(),
      fallback: true,
    })
  }
})

// ── GET /api/ley-lines/:lineId ──────────────────────────────────────────────
// MUST be LAST — wildcard would otherwise eat /country/* and /region/*


router.get('/:lineId', requireAuth as any, (req, res) => {
  const { lineId } = req.params
  const state = leyLineCache.lineStates.get(lineId)

  if (!state) {
    const def = LEY_LINE_DEFS.find(l => l.id === lineId)
    if (!def) {
      res.status(404).json({ error: 'Line not found', code: 'NOT_FOUND' })
      return
    }
    res.json({
      id: def.id, name: def.name, archetype: def.archetype,
      isActive: false, completionPct: 0, effectiveness: 1, nodes: [],
      computedAt: null,
    })
    return
  }

  const nodes = state.def.blocks.map(regionId => {
    const node = leyLineCache.nodeStates.get(`${regionId}:${state.def.id}`)
    return { regionId, ownerCode: node?.ownerCode ?? null, isCritical: node?.isCritical ?? false }
  })

  res.json({
    id:               state.def.id,
    name:             state.def.name,
    archetype:        state.def.archetype,
    continent:        state.def.continent,
    isActive:         state.isActive,
    completionPct:    state.completionPct,
    effectiveness:    state.effectiveness,
    controllerType:   state.controllerType,
    controllerIds:    state.controllerIds,
    appliedBonuses:   state.appliedBonuses,
    appliedTradeoffs: state.appliedTradeoffs,
    nodes,
    computedAt: leyLineCache.lastComputedAt?.toISOString() ?? null,
  })
})

export default router
