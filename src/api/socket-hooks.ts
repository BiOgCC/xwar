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
import { useRegionStore } from '../stores/regionStore'
import { useUIStore } from '../stores/uiStore'
import { getCountryName } from '../data/countries'


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
      // Preserve client-side damageDealt if it's higher than server value
      // (playerHit events arrive between ticks and push client ahead of server)
      const existingAtkDmg = existing.attacker?.damageDealt ?? 0
      const existingDefDmg = existing.defender?.damageDealt ?? 0
      const serverAtkDmg = data.attacker?.damageDealt ?? 0
      const serverDefDmg = data.defender?.damageDealt ?? 0

      // Build merged battle: defaults < existing < server data < bridged adrenaline
      const merged: any = Object.assign(
        {},
        // Client-only defaults (not sent by server)
        {
          damageFeed: [],
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
        // Fix snap-back: use Math.max for damageDealt so playerHit increments aren't lost
        {
          attacker: {
            ...(data.attacker ?? existing.attacker ?? {}),
            damageDealt: Math.max(existingAtkDmg, serverAtkDmg),
          },
          defender: {
            ...(data.defender ?? existing.defender ?? {}),
            damageDealt: Math.max(existingDefDmg, serverDefDmg),
          },
        },
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
      const sideObj = b[side]
      // Only increment damageDealt for OTHER players' hits.
      // The local player's hits are already applied optimistically in playerAttack().
      // The periodic battle:state handler (Math.max) reconciles the authoritative total.
      const localPlayer = usePlayerStore.getState().name
      const isLocalHit = data.playerName === localPlayer
      return {
        battles: {
          ...s.battles,
          [data.battleId]: {
            ...b,
            [side]: {
              ...sideObj,
              damageDealt: isLocalHit
                ? (sideObj?.damageDealt || 0)         // already applied via HTTP
                : (sideObj?.damageDealt || 0) + data.damage,  // other player's hit
            },
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
    battleId: string; winner: string; loser?: string
    type?: string; regionName?: string
    attackerId?: string; defenderId?: string
    attackerRoundsWon?: number; defenderRoundsWon?: number
    attackerStats: { damageDealt: number }
    defenderStats: { damageDealt: number }
    attackerDamageDealers?: Record<string, number>
    defenderDamageDealers?: Record<string, number>
    rewards?: {
      winnerPlayers: { money: number; xp: number; badges: number }
      loserPlayers: { money: number; xp: number; badges: number }
      territoryChanged: boolean
    }
  }) => {
    const finalStatus = data.winner === (data.attackerId || '') ? 'attacker_won' : 'defender_won'

    useBattleStore.setState((s) => {
      const b = s.battles[data.battleId]
      if (!b) return s
      return {
        battles: {
          ...s.battles,
          [data.battleId]: {
            ...b,
            status: finalStatus as any,
            attacker: { ...b.attacker, damageDealt: data.attackerStats.damageDealt },
            defender: { ...b.defender, damageDealt: data.defenderStats.damageDealt },
            attackerRoundsWon: data.attackerRoundsWon ?? b.attackerRoundsWon,
            defenderRoundsWon: data.defenderRoundsWon ?? b.defenderRoundsWon,
            attackerDamageDealers: data.attackerDamageDealers ?? b.attackerDamageDealers,
            defenderDamageDealers: data.defenderDamageDealers ?? b.defenderDamageDealers,
            // Store battle summary for the BattleDetailView victory screen
            battleSummary: {
              winner: data.winner,
              loser: data.loser || '',
              regionName: data.regionName || b.regionName || '',
              rewards: data.rewards,
              attackerRoundsWon: data.attackerRoundsWon ?? b.attackerRoundsWon ?? 0,
              defenderRoundsWon: data.defenderRoundsWon ?? b.defenderRoundsWon ?? 0,
            },
          },
        },
      }
    })

    // ── Fire notification toast for the player ──
    try {
      const playerName = usePlayerStore.getState().name
      const playerCountry = usePlayerStore.getState().countryCode || ''
      const regionLabel = data.regionName || 'unknown region'
      const winnerName = getCountryName(data.winner)
      const isAttackerSide = playerCountry === data.attackerId
      const isDefenderSide = playerCountry === data.defenderId

      // Check if player participated
      const atkDealers = data.attackerDamageDealers || {}
      const defDealers = data.defenderDamageDealers || {}
      const myDmg = (atkDealers[playerName] || 0) + (defDealers[playerName] || 0)

      if (myDmg > 0) {
        const playerWon = (isAttackerSide && finalStatus === 'attacker_won') ||
                          (isDefenderSide && finalStatus === 'defender_won') ||
                          (!isAttackerSide && !isDefenderSide && atkDealers[playerName] && finalStatus === 'attacker_won') ||
                          (!isAttackerSide && !isDefenderSide && defDealers[playerName] && finalStatus === 'defender_won')

        const rewards = data.rewards
        const r = playerWon ? rewards?.winnerPlayers : rewards?.loserPlayers

        const rewardStr = r ? ` → +$${r.money} +${r.xp}XP${r.badges ? ` +${r.badges}🎖️` : ''}` : ''
        const territoryStr = playerWon && rewards?.territoryChanged ? ` 🏴 ${regionLabel} captured!` : ''

        useUIStore.getState().addNotification({
          type: playerWon ? 'success' : 'warning',
          message: playerWon
            ? `⚔️ VICTORY! ${winnerName} won the battle for ${regionLabel}!${rewardStr}${territoryStr}`
            : `🛡️ DEFEAT. ${winnerName} won the battle for ${regionLabel}.${rewardStr}`,
        })
      } else {
        // Player didn't participate but receives the notification
        useUIStore.getState().addNotification({
          type: 'info',
          message: `⚔️ Battle ended: ${winnerName} won the battle for ${regionLabel}.`,
        })
      }
    } catch (e) {
      console.warn('[WS] battle:end notification failed:', e)
    }
  })

  // Territory capture broadcast — updates region counts in worldStore AND regionStore (for map recoloring)
  socketManager.on('battle:occupationUpdate', (data: {
    regionName: string; regionId?: string; newController: string; prevController: string;
    captureBonus?: { money: number; oil: number; scrap: number };
    isRevolt?: boolean;
  }) => {
    console.log(`[WS] 🏴 Territory transfer: ${data.newController} ← ${data.regionName} (was ${data.prevController})`)

    // Update world store — region counts + conqueror fund bonus
    useWorldStore.setState((s) => ({
      countries: s.countries.map((c: any) => {
        if (c.code === data.newController) {
          return {
            ...c,
            regions: (c.regions || 0) + 1,
            fund: data.captureBonus
              ? { ...c.fund, money: (c.fund?.money || 0) + data.captureBonus.money, oil: (c.fund?.oil || 0) + data.captureBonus.oil }
              : c.fund,
          }
        }
        if (c.code === data.prevController) {
          return { ...c, regions: Math.max(0, (c.regions || 0) - 1) }
        }
        return c
      })
    }))

    // ── KEY: Update regionStore.controlledBy so the map recolors the captured region ──
    // countryCode = permanent native owner (never changes — used as baseline for occupation detection)
    // controlledBy = current ruler (changes on invasion/liberation)
    // GameMap shows occupation overlay when controlledBy !== countryCode
    const isRevolt = !!data.isRevolt

    useRegionStore.setState((s) => ({
      regions: s.regions.map((r) => {
        if (r.name !== data.regionName) return r
        if (isRevolt) {
          // Revolt succeeded: liberated back to native. controlledBy reset = no more occupation overlay
          return { ...r, controlledBy: r.countryCode }
        }
        // Normal invasion: conqueror controls it. countryCode stays as original owner.
        return { ...r, controlledBy: data.newController }
      }),
    }))

    // Notify UI
    const regionLabel = data.regionName
    const newCtrlName = getCountryName(data.newController)
    const prevCtrlName = getCountryName(data.prevController)
    try {
      useUIStore.getState().addNotification({
        type: isRevolt ? 'success' : 'warning',
        message: isRevolt
          ? `🔓 ${regionLabel} liberated! ${newCtrlName} reclaimed their territory.`
          : `🏴 ${newCtrlName} captured ${regionLabel} from ${prevCtrlName}!`,
      })
    } catch (_) {}
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

  // ═══════════════════════════════════════════════
  //  ECONOMY EVENTS → playerStore / worldStore
  // ═══════════════════════════════════════════════

  socketManager.on('salary:paid', (data: {
    amount: number; armyName: string; role: string
  }) => {
    console.log(`[WS] 💰 Salary received: $${data.amount.toLocaleString()} from ${data.armyName}`)
    // Refresh player balance from backend
    usePlayerStore.getState().fetchPlayer().catch(() => {})
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
      attacker: b?.attacker ?? { countryCode: data.attackerCode, damageDealt: 0 },
      defender: b?.defender ?? { countryCode: data.defenderCode, damageDealt: 0 },
      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: b?.combatLog ?? [], attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [],
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
