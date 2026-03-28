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

  // ═══════════════════════════════════════════════
  //  BATTLE EVENTS → battleStore
  // ═══════════════════════════════════════════════

  socketManager.on('battle:tick', (data: {
    battleId: string
    tickNumber: number
    attackerDamage: number
    defenderDamage: number
    attackerCrits: number
    defenderCrits: number
    rounds: any[]
    attackerRoundsWon: number
    defenderRoundsWon: number
    status: string
    attackerEngaged: number
    defenderEngaged: number
  }) => {
    // Update the battle in the store with server-authoritative tick data
    const store = useBattleStore.getState()
    const battle = store.battles[data.battleId]
    if (!battle) return

    useBattleStore.setState((s) => ({
      battles: {
        ...s.battles,
        [data.battleId]: {
          ...s.battles[data.battleId],
          ticksElapsed: data.tickNumber,
          currentTick: {
            attackerDamage: data.attackerDamage,
            defenderDamage: data.defenderDamage,
          },
          rounds: data.rounds,
          attackerRoundsWon: data.attackerRoundsWon,
          defenderRoundsWon: data.defenderRoundsWon,
          status: data.status as any,
        },
      },
    }))
  })

  socketManager.on('battle:playerHit', (data: {
    battleId: string; side: string; playerName: string; damage: number; isCrit: boolean
  }) => {
    const store = useBattleStore.getState()
    const battle = store.battles[data.battleId]
    if (!battle) return

    // Append to damage feed
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      const newFeed = [
        { playerName: data.playerName, side: data.side as any, amount: data.damage, isCrit: data.isCrit, isDodged: false, time: Date.now() },
        ...(b.damageFeed || []),
      ].slice(0, 20)
      return {
        battles: { ...s.battles, [data.battleId]: { ...b, damageFeed: newFeed } },
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

  socketManager.on('battle:roundEnd', (data: {
    battleId: string; roundIndex: number; winner: 'attacker' | 'defender'
  }) => {
    console.log(`[WS] ⚔️ Round ${data.roundIndex + 1} ended — ${data.winner} won`)
  })

  socketManager.on('battle:order', (data: {
    battleId: string; side: 'attacker' | 'defender'; order: string
  }) => {
    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      const key = data.side === 'attacker' ? 'attackerOrder' : 'defenderOrder'
      return { battles: { ...s.battles, [data.battleId]: { ...b, [key]: data.order } } }
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
    targetRegion: string; type: string
  }) => {
    console.log(`[WS] ⚔️ Battle started: ${data.attackerCode} → ${data.defenderCode} in ${data.targetRegion}`)
    // Fetch full battle from server and inject into store
    import('./client').then(({ getBattle }) => {
      getBattle(data.battleId).then((res: any) => {
        if (res?.battle) {
          useBattleStore.setState((s) => ({
            battles: { ...s.battles, [data.battleId]: res.battle }
          }))
        }
      }).catch(() => {})
    })
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
