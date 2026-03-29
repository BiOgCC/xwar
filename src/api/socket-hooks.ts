/**
 * Socket Hooks — connects socket events to Zustand stores.
 *
 * Call `initSocketHooks()` once after login / on app boot.
 * Each hook subscribes via `socketManager.subscribe()` and
 * dispatches updates into the corresponding store.
 */

import { socketManager } from './socket'
import { usePlayerStore } from '../stores/playerStore'
import { useBattleStore } from '../stores/battleStore'
import { useWorldStore } from '../stores/worldStore'


let _initialized = false

export function initSocketHooks() {
  if (_initialized) return
  _initialized = true

  // ── Join country room when player data is available ──
  const playerState = usePlayerStore.getState()
  if (playerState.countryCode) {
    socketManager.joinCountry(playerState.countryCode)
  }

  // React to country changes (e.g., player switches country)
  usePlayerStore.subscribe((state, prevState) => {
    if (state.countryCode && state.countryCode !== prevState.countryCode) {
      socketManager.joinCountry(state.countryCode)
    }
  })

  // ── Boot: battles are hydrated via /game/state in hydrate.ts — no separate fetch here ──


  // ═══════════════════════════════════════════════
  //  BATTLE EVENTS → battleStore
  // ═══════════════════════════════════════════════

  /**
   * battle:state — Full authoritative battle pushed every tick.
   * Client sets the battle directly — no diffing needed.
   */
  socketManager.on('battle:state', (data: any) => {
    if (!data?.id) return
    useBattleStore.setState((s) => {
      const existing: any = s.battles[data.id] ?? {}
      // Build merged battle: defaults < existing < server data < bridged adrenaline
      const merged: any = Object.assign(
        {},
        // Client-only defaults (not sent by server)
        {
          damageFeed: [],
          divisionCooldowns: {},
          orderMessage: '',
          motd: '',
          playerAdrenaline: {},
          playerSurge: {},
          playerCrash: {},
          playerAdrenalinePeakAt: {},
          vengeanceBuff: { attacker: -1, defender: -1 },
          mercenaryContracts: [],
          weaponPresence: { attacker: {}, defender: {} },
        },
        // Merge existing (keeps damageFeed etc between ticks)
        existing,
        // Server data wins for all shared fields
        data,
        // Bridge adrenalineState → client playerAdrenaline map (always last)
        {
          playerAdrenaline: data.adrenalineState
            ? Object.fromEntries(Object.entries(data.adrenalineState).map(([k, v]: any) => [k, v?.value ?? 0]))
            : (existing.playerAdrenaline ?? {}),
        }
      )
      return { battles: { ...s.battles, [data.id]: merged } }
    })
  })

  socketManager.on('battle:tick', (data: {
    battleId: string; tickNumber: number
    attackerDamage: number; defenderDamage: number
    rounds: any[]; attackerRoundsWon: number; defenderRoundsWon: number; status: string
    attackerDamageTotal?: number; defenderDamageTotal?: number
  }) => {
    // Only used as fallback if server doesn't emit battle:state yet
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      return {
        battles: {
          ...s.battles,
          [data.battleId]: {
            ...b,
            ticksElapsed: data.tickNumber,
            currentTick: { attackerDamage: data.attackerDamage, defenderDamage: data.defenderDamage },
            rounds: data.rounds,
            attackerRoundsWon: data.attackerRoundsWon,
            defenderRoundsWon: data.defenderRoundsWon,
            status: data.status as any,
            attacker: { ...b.attacker, damageDealt: data.attackerDamageTotal ?? b.attacker.damageDealt },
            defender: { ...b.defender, damageDealt: data.defenderDamageTotal ?? b.defender.damageDealt },
          },
        },
      }
    })
  })

  socketManager.on('battle:playerHit', (data: {
    battleId: string; side: string; playerName: string; damage: number; isCrit: boolean; isMiss?: boolean; isDodged?: boolean
  }) => {
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      const newFeed = [
        { playerName: data.playerName, side: data.side as any, amount: data.damage, isCrit: data.isCrit, isDodged: data.isDodged ?? false, time: Date.now() },
        ...(b.damageFeed || []),
      ].slice(0, 20)
      const side = data.side as 'attacker' | 'defender'
      const dealerKey = side === 'attacker' ? 'attackerDamageDealers' : 'defenderDamageDealers'
      return {
        battles: {
          ...s.battles,
          [data.battleId]: {
            ...b,
            damageFeed: newFeed,
            [dealerKey]: {
              ...b[dealerKey],
              [data.playerName]: ((b[dealerKey] || {})[data.playerName] || 0) + data.damage,
            },
          },
        },
      }
    })
  })

  socketManager.on('battle:end', (data: {
    battleId: string; winner: string
    attackerStats: { damageDealt: number; manpowerLost: number; divisionsDestroyed: number }
    defenderStats: { damageDealt: number; manpowerLost: number; divisionsDestroyed: number }
  }) => {
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      return {
        battles: {
          ...s.battles,
          [data.battleId]: {
            ...b,
            status: data.winner === b.attackerId ? 'attacker_won' : 'defender_won',
            attacker: { ...b.attacker, damageDealt: data.attackerStats.damageDealt, manpowerLost: data.attackerStats.manpowerLost, divisionsDestroyed: data.attackerStats.divisionsDestroyed },
            defender: { ...b.defender, damageDealt: data.defenderStats.damageDealt, manpowerLost: data.defenderStats.manpowerLost, divisionsDestroyed: data.defenderStats.divisionsDestroyed },
          },
        },
      }
    })
  })

  // Territory capture broadcast — updates region counts in worldStore
  socketManager.on('battle:occupationUpdate', (data: {
    regionName: string; newController: string; prevController: string;
    captureBonus: { money: number; oil: number; scrap: number };
  }) => {
    console.log(`[WS] 🏴 Territory captured: ${data.newController} took ${data.regionName} from ${data.prevController}`)
    useWorldStore.setState((s) => ({
      countries: s.countries.map((c: any) => {
        if (c.code === data.newController) {
          return { ...c, regions: (c.regions || 0) + 1, fund: { ...c.fund, money: (c.fund?.money || 0) + data.captureBonus.money, oil: (c.fund?.oil || 0) + data.captureBonus.oil } }
        }
        if (c.code === data.prevController) {
          return { ...c, regions: Math.max(0, (c.regions || 0) - 1) }
        }
        return c
      })
    }))
  })

  socketManager.on('battle:roundEnd', (data: {
    battleId: string; roundIndex: number; winner: 'attacker' | 'defender'
  }) => {
    console.log(`[WS] ⚔️ Round ${data.roundIndex + 1} ended — ${data.winner} won`)
  })

  socketManager.on('battle:order', (data: {
    battleId: string; side?: 'attacker' | 'defender'; order?: string; // Tactical order change
    // BattleOrder system (new):
    battleOrder?: any;
  }) => {
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      // Handle tactical order change (legacy)
      if (data.side && data.order && !data.battleOrder) {
        const key = data.side === 'attacker' ? 'attackerOrder' : 'defenderOrder'
        return { battles: { ...s.battles, [data.battleId]: { ...b, [key]: data.order } } }
      }
      // Handle new BattleOrder system
      if (data.battleOrder) {
        const existingOrders = (b as any).battleOrders ?? []
        return { battles: { ...s.battles, [data.battleId]: { ...b, battleOrders: [...existingOrders, data.battleOrder] } } }
      }
      return s
    })
  })

  socketManager.on('battle:deploy', (data: {
    battleId: string; divisionIds: string[]; side: 'attacker' | 'defender'
  }) => {
    console.log(`[WS] 🚀 ${data.divisionIds.length} division(s) deployed to ${data.side}`)
  })

  socketManager.on('battle:recall', (data: {
    battleId: string; divisionId: string; side: string; divisionName: string
  }) => {
    console.log(`[WS] 🛡️ ${data.divisionName} recalled from battle`)
  })

  // ═══════════════════════════════════════════════
  //  ECONOMY EVENTS → playerStore / worldStore
  // ═══════════════════════════════════════════════

  socketManager.on('salary:paid', (data: {
    amount: number; armyName: string; role: string
  }) => {
    console.log(`[WS] 💰 Salary received: $${data.amount.toLocaleString()} from ${data.armyName}`)
    // Refresh player balance from backend
    usePlayerStore.getState().fetchPlayer()
  })

  socketManager.on('fund:update', (data: {
    countryCode: string; money: number; oil: number
  }) => {
    // Update the country fund in worldStore
    useWorldStore.setState((s) => {
      const countries = s.countries.map((c: any) =>
        c.code === data.countryCode
          ? { ...c, fund: { ...c.fund, money: data.money, oil: data.oil } }
          : c
      )
      return { countries }
    })
  })

  // ═══════════════════════════════════════════════
  //  ELECTION EVENTS → governmentStore
  // ═══════════════════════════════════════════════

  socketManager.on('election:result', (data: {
    winner: string; countryCode: string; tally: Record<string, number>
  }) => {
    console.log(`[WS] 🗳️ ${data.winner} elected president of ${data.countryCode}!`)
    // Refresh government data — lazy import to avoid circular dep
    import('../stores/governmentStore').then(({ useGovernmentStore }) => {
      useGovernmentStore.getState().fetchGovernment(data.countryCode)
    })
  })

  // ═══════════════════════════════════════════════
  //  GLOBAL EVENTS (news, trade routes)
  // ═══════════════════════════════════════════════

  socketManager.on('news', (data: {
    type: string; headline: string; countryCode?: string
  }) => {
    console.log(`[WS] 📰 ${data.headline}`)
  })

  socketManager.on('battle:started', (data: {
    battleId: string; attackerCode: string; defenderCode: string
    targetRegion: string; type: string; battle?: any
  }) => {
    console.log(`[WS] ⚔️ Battle started: ${data.attackerCode} → ${data.defenderCode} in ${data.targetRegion}`)
    // Auto-join battle room to receive battle:state tick updates
    socketManager.joinBattle(data.battleId)
    const now = Date.now()
    const b = data.battle
    const shell: any = {
      id: data.battleId,
      type: b?.type ?? data.type ?? 'invasion',
      attackerId: b?.attackerId ?? data.attackerCode,
      defenderId: b?.defenderId ?? data.defenderCode,
      regionName: b?.regionName ?? data.targetRegion,
      startedAt: b?.startedAt ?? now,
      ticksElapsed: 0, status: 'active',
      attacker: b?.attacker ?? { countryCode: data.attackerCode, divisionIds: [], engagedDivisionIds: [], damageDealt: 0, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0 },
      defender: b?.defender ?? { countryCode: data.defenderCode, divisionIds: [], engagedDivisionIds: [], damageDealt: 0, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0 },
      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: b?.combatLog ?? [], attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [], divisionCooldowns: {},
      attackerOrder: 'none', defenderOrder: 'none',
      orderMessage: '', motd: '',
      playerAdrenaline: {}, playerSurge: {}, playerCrash: {}, playerAdrenalinePeakAt: {},
      vengeanceBuff: { attacker: -1, defender: -1 },
      mercenaryContracts: [], weaponPresence: { attacker: {}, defender: {} },
    }
    useBattleStore.setState((s) => ({ battles: { ...s.battles, [data.battleId]: shell } }))
  })

  socketManager.on('route:disrupted', (data: {
    routeId: string; routeName: string; disruptedBy: string; until: string
  }) => {
    console.log(`[WS] 🚢 Trade route disrupted: ${data.routeName} by ${data.disruptedBy}`)
  })

  socketManager.on('route:restored', (data: { routeId: string }) => {
    console.log(`[WS] 🚢 Trade route restored: ${data.routeId}`)
  })
}
