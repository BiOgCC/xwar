import { useState, useEffect } from 'react'
import { gameClock } from '../engine/GameClock'
import { useBattleStore } from '../stores/battleStore'
import { useCompanyStore } from '../stores/companyStore'
import { usePlayerStore, registerEconFlowHook } from '../stores/playerStore'
import { useCyberStore } from '../stores/cyberStore'
import { useArmyStore } from '../stores/army'
import { useGovernmentStore } from '../stores/governmentStore'
import { useRegionStore } from '../stores/regionStore'
import { useMarketStore } from '../stores/market'
import { useStockStore } from '../stores/stockStore'
import { useWorldStore } from '../stores/worldStore'
import { useTradeRouteStore } from '../stores/tradeRouteStore'
import { checkTimeSanity } from '../engine/AntiExploit'
import { wrapStoreWithIntegrityCheck } from '../engine/storeFreeze'
import { ENABLE_DIVISIONS } from '../config/features'

// Register economy flow hook: playerStore -> worldStore
registerEconFlowHook((source, amount, type, resource) => {
  useWorldStore.getState().recordEconFlow(source, amount, type, resource)
})

// Wrap playerStore with integrity checks (production only)
wrapStoreWithIntegrityCheck(usePlayerStore, 'player')

/**
 * Game loop hook — subscribes all simulation systems to the unified GameClock.
 * 
 * Phase cadences:
 * - 15s: combat, military, cyber, training, government
 * - 10s: region capture, stock market
 * - 30min: economy (companies, market prices)
 *
 * Returns { combatCountdown, economyCountdown, handleManualTick }
 */
export function useGameLoop() {
  const [combatCountdown, setCombatCountdown] = useState(() => gameClock.getCountdown('combat'))
  const [economyCountdown, setEconomyCountdown] = useState(() => gameClock.getCountdown('economy'))

  useEffect(() => {
    // ── Start the clock (idempotent — safe to call multiple times) ──
    gameClock.start()

    // Spawn NPC test battles on first mount (divisions only)
    if (ENABLE_DIVISIONS) {
      try { useBattleStore.getState().spawnNPCBattles() } catch (e) { console.warn('[NPC] spawnNPCBattles:', e) }
    }

    // ── Subscribe phase handlers ──
    const unsubs: (() => void)[] = []

    // COMBAT (15s) — battle resolution + revolt pressure
    unsubs.push(gameClock.subscribe('combat', () => {
      if (ENABLE_DIVISIONS) {
        try { useBattleStore.getState().processHOICombatTick() } catch (e) { console.warn('[Combat] processHOICombatTick:', e) }
      }
      try { useRegionStore.getState().processRevoltTick() } catch (e) { console.warn('[Revolt] processRevoltTick:', e) }
    }))

    // MILITARY — no longer needs a tick (lobby-based quick battles now)


    // CYBER (15s) — cyber detection, stamina contests
    unsubs.push(gameClock.subscribe('cyber', () => {
      try {
        useCyberStore.getState().processDetectionTicks()
        useCyberStore.getState().resolveStaminaContests()
      } catch (e) { console.warn('[Cyber]:', e) }
    }))

    // TRAINING (15s) — army training progress (divisions only)
    if (ENABLE_DIVISIONS) {
      unsubs.push(gameClock.subscribe('training', () => {
        try { useArmyStore.getState().processTrainingTick() } catch (e) { console.warn('[Training]:', e) }
      }))
    }

    // GOVERNMENT (15s) — shop spawn, contract maturity
    unsubs.push(gameClock.subscribe('government', () => {
      try {
        const playerCountry = usePlayerStore.getState().countryCode || 'US'
        const govStore = useGovernmentStore.getState()
        govStore.cleanExpiredListings(playerCountry)
        if (ENABLE_DIVISIONS) govStore.spawnShopDivisions(playerCountry)
        govStore.processContractMaturity()
      } catch (e) { console.warn('[Government]:', e) }
    }))

    // REGION (10s) — region capture progress
    unsubs.push(gameClock.subscribe('region', () => {
      try { useRegionStore.getState().tickCapture() } catch (e) { console.warn('[Region]:', e) }
      try { useRegionStore.getState().processScavengeTick() } catch (e) { console.warn('[Region] scavenge:', e) }
    }))

    // STOCK (10s) — stock market price tick + bond resolution + 12h sessions
    unsubs.push(gameClock.subscribe('stock', () => {
      try { useStockStore.getState().tickMarket() } catch (e) { console.warn('[Stock]:', e) }
      try { useStockStore.getState().resolveExpiredBonds() } catch (e) { console.warn('[Bonds]:', e) }
      try { useStockStore.getState().processSessionBoundary() } catch (e) { console.warn('[Sessions]:', e) }
      try { useStockStore.getState().processResetBand() } catch (e) { console.warn('[ResetBand]:', e) }
    }))

    // ECONOMY (30min) — company production, market prices, world timers
    unsubs.push(gameClock.subscribe('economy', () => {
      try { useCompanyStore.getState().processTick() } catch (e) { console.warn('[Economy] company:', e) }
      try { useRegionStore.getState().processOceanIncome() } catch (e) { console.warn('[Economy] ocean:', e) }
      try { useRegionStore.getState().processNavalPatrolIncome() } catch (e) { console.warn('[Economy] naval patrol:', e) }
      // ── Trade Route income (active = 100%, partial = 30%, disrupted = 0%) ──
      try {
        useTradeRouteStore.getState().tickDisruptions()     // clear expired disruptions first
        useTradeRouteStore.getState().processTradeIncome()  // then pay out
      } catch (e) { console.warn('[Economy] trade routes:', e) }
      try {
        const mkt = useMarketStore.getState()
        mkt.tickPrices()
        mkt.expireOldOrders()
        mkt.cleanupStaleOrders()
      } catch (e) { console.warn('[Economy] market:', e) }
      // World timers: auto-income (8h), daily reset (24h), alliance treaty (12h)
      try {
        checkTimeSanity() // Fix 5: detect clock manipulation
        useWorldStore.getState().expireDeposits()
        useWorldStore.getState().processAutoIncome()
        useWorldStore.getState().processDailyReset()
      } catch (e) { console.warn('[Economy] world timers:', e) }
      try {
        import('../stores/allianceStore').then(m => {
          m.useAllianceStore.getState().processTreatySnapshot()
        })
      } catch (e) { console.warn('[Economy] alliance treaty:', e) }

      // Daily checks: war cards, company maintenance, fund snapshot
      try {
        const player = usePlayerStore.getState()
        import('../stores/warCardsStore').then(m => {
          m.useWarCardsStore.getState().checkAndAwardCards(player.name, player.name, {
            totalDamageDone: player.damageDone,
            totalMoney: player.money,
            totalItemsProduced: player.itemsProduced,
            playerLevel: player.level,
            muteCount: player.muteCount,
            deathCount: player.deathCount,
            battlesLost: player.battlesLost,
            totalCasinoLosses: player.totalCasinoLosses,
            bankruptcyCount: player.bankruptcyCount,
            countrySwitches: player.countrySwitches,
            casinoSpins: player.casinoSpins,
            itemsDestroyed: player.itemsDestroyed,
          })
        })
      } catch (e) { console.warn('[Economy] war cards:', e) }

      try { useWorldStore.getState().snapshotFundHistory() } catch (e) { console.warn('[Economy] fund snapshot:', e) }
      // Prestige hourly snapshot + weekly jackpot
      try {
        import('../stores/prestigeStore').then(m => {
          m.usePrestigeStore.getState().processHourlySnapshot()
        })
      } catch (e) { console.warn('[Economy] prestige:', e) }
      try {
        import('../stores/raffleStore').then(m => {
          m.useRaffleStore.getState().processWeeklyJackpot()
        })
      } catch (e) { console.warn('[Economy] weekly jackpot:', e) }
    }))

    // ── Subscribe to countdown updates for UI ──
    unsubs.push(gameClock.onCountdownUpdate(() => {
      setCombatCountdown(gameClock.getCountdown('combat'))
      setEconomyCountdown(gameClock.getCountdown('economy'))
    }))

    // Also sync the old combatTickLeft in battleStore for backward compat
    unsubs.push(gameClock.onCountdownUpdate(() => {
      useBattleStore.getState().setCombatTickLeft(gameClock.getCountdown('combat'))
    }))

    return () => {
      unsubs.forEach(fn => fn())
    }
  }, [])

  const handleManualTick = () => {
    gameClock.forceEconomy()
  }

  // Return economyCountdown as timeLeft for backward compat with TopBar
  return { timeLeft: economyCountdown, combatCountdown, handleManualTick }
}
