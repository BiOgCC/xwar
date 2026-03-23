/**
 * leyline.pipeline.ts — Cron-triggered wrapper around runLeyLineEngine().
 *
 * Runs every 30 seconds (between fast-combat 15s and slow-economy 30m).
 * Responsibilities beyond the engine itself:
 *   - Emit Socket.IO events for line activation / deactivation
 *   - Insert news_events for each activation
 *   - Emit `leyline:state` broadcast so connected frontend clients
 *     can update their Zustand store without polling
 */

import { runLeyLineEngine } from './leyline.engine.js'
import { LEY_LINE_DEFS, ARCHETYPE_META } from '../config/leyLineRegistry.server.js'
import { db } from '../db/connection.js'
import { newsEvents } from '../db/schema.js'
import { logger } from '../utils/logger.js'

// Lazy emitter — avoids circular dep at module load
let _emit: ((event: string, data: unknown, room?: string) => void) | null = null
async function getEmitter() {
  if (!_emit) {
    try {
      const mod = await import('../index.js')
      _emit = mod.emitGameEvent
    } catch { /* ws role may not be running */ }
  }
  return _emit
}

export async function runLeyLinePipeline(): Promise<void> {
  const start = Date.now()

  try {
    const result = await runLeyLineEngine()
    const emit   = await getEmitter()

    // ── Emit full state snapshot to all clients (frontend store sync) ──
    if (emit && result.lineStates.size > 0) {
      const snapshot = Array.from(result.lineStates.values()).map(s => ({
        id:               s.def.id,
        name:             s.def.name,
        archetype:        s.def.archetype,
        isActive:         s.isActive,
        completionPct:    s.completionPct,
        effectiveness:    s.effectiveness,
        controllerIds:    s.controllerIds,
        appliedBonuses:   s.appliedBonuses,
        appliedTradeoffs: s.appliedTradeoffs,
        nodes: LEY_LINE_DEFS.find(l => l.id === s.def.id)?.blocks.map(regionId => {
          const node = result.nodeStates.get(`${regionId}:${s.def.id}`)
          return { regionId, ownerCode: node?.ownerCode ?? null, isCritical: node?.isCritical ?? false }
        }) ?? [],
      }))
      emit('leyline:state', {
        lines: snapshot,
        computedAt: result.computedAt.toISOString(),
      })
    }

    // ── Handle activations ──
    for (const lineId of result.newActivations) {
      const state = result.lineStates.get(lineId)
      const def   = LEY_LINE_DEFS.find(l => l.id === lineId)
      if (!def || !state) continue

      const meta     = ARCHETYPE_META[def.archetype]
      const lineName = def.name

      // Broadcast activation event
      if (emit) {
        emit('leyline:activated', {
          lineId,
          lineName,
          archetype:     def.archetype,
          archetypeColor: meta.color,
          controllerIds: state.controllerIds,
          controllerType: state.controllerType,
          bonuses:       state.appliedBonuses,
          tradeoffs:     state.appliedTradeoffs,
        })
      }

      // Insert news event
      try {
        await db.insert(newsEvents).values({
          type:     'leyline_activated',
          headline: `⚡ ${lineName} has awakened — ${meta.label} bonuses flow to its controllers`,
          body:     null,
          countryCode: null,
          data: {
            lineId,
            archetype:     def.archetype,
            controllerIds: state.controllerIds,
            effectiveness: state.effectiveness,
          },
        })
      } catch (e) {
        logger.warn({ err: e }, `[LEY-LINE] Failed to insert news for activation ${lineId}`)
      }
    }

    // ── Handle deactivations ──
    for (const lineId of result.newDeactivations) {
      const def = LEY_LINE_DEFS.find(l => l.id === lineId)
      if (!def) continue

      if (emit) {
        emit('leyline:deactivated', {
          lineId,
          lineName: def.name,
          archetype: def.archetype,
        })
      }

      try {
        await db.insert(newsEvents).values({
          type:     'leyline_deactivated',
          headline: `💀 ${def.name} has gone dormant — its power has faded`,
          body:     null,
          countryCode: null,
          data: { lineId, archetype: def.archetype },
        })
      } catch (e) {
        logger.warn({ err: e }, `[LEY-LINE] Failed to insert news for deactivation ${lineId}`)
      }
    }

    logger.info(`[LEY-LINE-PIPELINE] Done in ${Date.now() - start}ms`)
  } catch (err) {
    // Pipeline failures must NOT crash the cron scheduler
    logger.error(err, '[LEY-LINE-PIPELINE] Engine error:')
  }
}
