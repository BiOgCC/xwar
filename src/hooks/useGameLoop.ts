import { useState, useEffect } from 'react'
import { useBattleStore } from '../stores/battleStore'
import { useCompanyStore } from '../stores/companyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useCyberStore } from '../stores/cyberStore'
import { useArmyStore } from '../stores/army'
import { useGovernmentStore } from '../stores/governmentStore'
import { useRegionStore } from '../stores/regionStore'
import { useMarketStore } from '../stores/market'

/**
 * Game loop hook — handles:
 * - 15s combat tick (battle resolution, operations, training, shop)
 * - 30min economy tick (companies, market prices)
 * - 10s region capture tick
 *
 * Returns { timeLeft, handleManualTick } for the economy timer display.
 */
export function useGameLoop() {
  const [timeLeft, setTimeLeft] = useState(1800)

  // Main 1-second interval: combat + economy ticks
  useEffect(() => {
    const interval = setInterval(() => {
      // ---- Combat Tick (every 15 seconds) ----
      const bs = useBattleStore.getState()
      const nextTick = bs.combatTickLeft - 1
      if (nextTick <= 0) {
        // FIRE: process all battle & operation ticks (wrapped in try-catch to never kill the timer)
        try {
          bs.resolveTicksAndRounds()
        } catch (e) { console.warn('[CombatTick] resolveTicksAndRounds error:', e) }
        try {
          bs.processHOICombatTick()
        } catch (e) { console.warn('[CombatTick] processHOICombatTick error:', e) }
        try {
          import('../stores/militaryStore').then(m => {
            m.useMilitaryStore.getState().processDetectionWindows()
            m.useMilitaryStore.getState().resolveContests()
          })
        } catch (e) { console.warn('[CombatTick] military error:', e) }
        try {
          useCyberStore.getState().processDetectionTicks()
          useCyberStore.getState().resolveStaminaContests()
        } catch (e) { console.warn('[CombatTick] cyber error:', e) }
        try {
          useArmyStore.getState().processTrainingTick()
        } catch (e) { console.warn('[CombatTick] training error:', e) }
        // Division shop: spawn + cleanup for player's country
        try {
          const playerCountry = usePlayerStore.getState().countryCode || 'US'
          const govStore = useGovernmentStore.getState()
          govStore.cleanExpiredListings(playerCountry)
          govStore.spawnShopDivisions(playerCountry)
          govStore.processContractMaturity()
        } catch (e) { console.warn('[CombatTick] shop spawn error:', e) }

        bs.setCombatTickLeft(15) // Always reset
      } else {
        bs.setCombatTickLeft(nextTick)
      }

      // ---- Economy Tick (every 30 min) ----
      setTimeLeft((prev) => {
        if (prev <= 1) {
          useCompanyStore.getState().processTick()
          const mkt = useMarketStore.getState()
          mkt.tickPrices()
          mkt.expireOldOrders()
          mkt.cleanupStaleOrders()
          return 1800
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Region capture tick — every 10 seconds, advance captures
  useEffect(() => {
    const ticker = setInterval(() => {
      useRegionStore.getState().tickCapture()
    }, 10000)
    return () => clearInterval(ticker)
  }, [])

  const handleManualTick = () => {
    useCompanyStore.getState().processTick()
    setTimeLeft(1800)
  }

  return { timeLeft, handleManualTick }
}
