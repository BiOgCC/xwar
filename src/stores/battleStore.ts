import { create } from 'zustand'
import { useWorldStore } from './worldStore'

export interface BattleTick {
  startTime: number
  endTime: number
  attackerDamage: number
  defenderDamage: number
  resolved: boolean
}

export interface DamageEvent {
  playerName: string
  side: 'attacker' | 'defender'
  amount: number
  isCrit: boolean
  isDodged: boolean
  time: number
}

export interface BattleRound {
  attackerPoints: number
  defenderPoints: number
  status: 'active' | 'attacker_won' | 'defender_won'
}

export interface Battle {
  id: string
  attackerId: string // ISO
  defenderId: string // ISO
  regionName: string // Target piece of land
  startedAt: number
  
  attackerRoundsWon: number
  defenderRoundsWon: number
  
  attackerDamageDealers: Record<string, number> // playerName -> total damage this battle
  defenderDamageDealers: Record<string, number>
  damageFeed: DamageEvent[] // History of recent hits

  rounds: BattleRound[] // History of rounds + current round at the end
  currentTick: BattleTick
  tickDurationMs: number // Defaults to 3 minutes (180,000 ms)
  
  status: 'active' | 'attacker_won' | 'defender_won'
}

export interface BattleState {
  battles: Record<string, Battle>
  
  launchAttack: (attackerId: string, defenderId: string, regionName: string) => void
  addDamage: (battleId: string, side: 'attacker' | 'defender', amount: number, isCrit: boolean, isDodged: boolean, playerName: string) => void
  resolveTicksAndRounds: () => void // Should be called frequently by a game loop
}

const TICK_DURATION = 3 * 60 * 1000 // 3 minutes
const POINTS_TO_WIN_ROUND = 300
const ROUNDS_TO_WIN_BATTLE = 2

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},

  launchAttack: (attackerId, defenderId, regionName) => set((state) => {
    // Only launch if there are no existing active battles in that specific region
    const existing = Object.values(state.battles).find(b => b.regionName === regionName && b.status === 'active')
    if (existing) return state

    const id = `battle_${Date.now()}_${regionName.replace(/\s+/g, '_')}`
    
    return {
      battles: {
        ...state.battles,
        [id]: {
          id,
          attackerId,
          defenderId,
          regionName,
          startedAt: Date.now(),
          attackerRoundsWon: 0,
          defenderRoundsWon: 0,
          attackerDamageDealers: {},
          defenderDamageDealers: {},
          damageFeed: [],
          rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active' }],
          currentTick: {
            startTime: Date.now(),
            endTime: Date.now() + TICK_DURATION,
            attackerDamage: 0,
            defenderDamage: 0,
            resolved: false
          },
          tickDurationMs: TICK_DURATION,
          status: 'active'
        }
      }
    }
  }),

  addDamage: (battleId, side, amount, isCrit, isDodged, playerName) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return state

    // Ensure we are inside the window
    const now = Date.now()
    if (now > battle.currentTick.endTime) {
       // Tick expired but hasn't been resolved yet by the loop, ignore damage or stash it? 
       // For simplicity, if loop is lagging, ignore it.
       return state 
    }

    const { currentTick, attackerDamageDealers, defenderDamageDealers, damageFeed } = battle

    const newAttackerDealers = { ...attackerDamageDealers }
    const newDefenderDealers = { ...defenderDamageDealers }
    if (side === 'attacker') {
      newAttackerDealers[playerName] = (newAttackerDealers[playerName] || 0) + amount
    } else {
      newDefenderDealers[playerName] = (newDefenderDealers[playerName] || 0) + amount
    }

    const newFeed = [{ playerName, side, amount, isCrit, isDodged, time: now }, ...damageFeed].slice(0, 20) // Keep last 20 hits

    return {
      battles: {
        ...state.battles,
        [battleId]: {
          ...battle,
          attackerDamageDealers: newAttackerDealers,
          defenderDamageDealers: newDefenderDealers,
          damageFeed: newFeed,
          currentTick: {
            ...currentTick,
            attackerDamage: side === 'attacker' ? currentTick.attackerDamage + amount : currentTick.attackerDamage,
            defenderDamage: side === 'defender' ? currentTick.defenderDamage + amount : currentTick.defenderDamage,
          }
        }
      }
    }
  }),

  resolveTicksAndRounds: () => set((state) => {
    const now = Date.now()
    let hasChanges = false
    const newBattles = { ...state.battles }

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return

      if (now >= battle.currentTick.endTime && !battle.currentTick.resolved) {
        hasChanges = true
        
        // 1. Resolve Tick
        const { attackerDamage, defenderDamage } = battle.currentTick
        const totalDamage = attackerDamage + defenderDamage
        
        let pointWinner: 'attacker' | 'defender' | 'tie' = 'tie'
        if (totalDamage > 0) {
          const attackerPct = attackerDamage / totalDamage
          if (attackerPct > 0.5) {
            pointWinner = 'attacker'
          } else if (attackerPct < 0.5) {
            pointWinner = 'defender'
          }
        }

        // Active round is always the last one
        const activeRoundIndex = battle.rounds.length - 1
        const activeRound = { ...battle.rounds[activeRoundIndex] }

        // Award points (User specification: 3 points per tick won)
        const POINTS_PER_TICK = 3
        if (pointWinner === 'attacker') activeRound.attackerPoints += POINTS_PER_TICK
        if (pointWinner === 'defender') activeRound.defenderPoints += POINTS_PER_TICK

        // 2. Check if Round is Over
        if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND || activeRound.defenderPoints >= POINTS_TO_WIN_ROUND) {
          const roundWinner = activeRound.attackerPoints >= POINTS_TO_WIN_ROUND ? 'attacker' : 'defender'
          activeRound.status = `${roundWinner}_won` as any
          
          let { attackerRoundsWon, defenderRoundsWon } = battle
          if (roundWinner === 'attacker') attackerRoundsWon++
          else defenderRoundsWon++

          // 3. Check if Battle is Over
          if (attackerRoundsWon >= ROUNDS_TO_WIN_BATTLE || defenderRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
            const battleWinner = attackerRoundsWon >= ROUNDS_TO_WIN_BATTLE ? 'attacker_won' : 'defender_won'
            
            // Note: Transferring region logic will happen in the external integration (e.g., Game.tsx calling worldStore if battle ends)
            
            newBattles[battle.id] = {
              ...battle,
              attackerRoundsWon,
              defenderRoundsWon,
              rounds: [...battle.rounds.slice(0, activeRoundIndex), activeRound],
              status: battleWinner
            }
            return // End early, battle is completely resolved
          } else {
            // Battle not over, start next round
            newBattles[battle.id] = {
              ...battle,
              attackerRoundsWon,
              defenderRoundsWon,
              rounds: [...battle.rounds.slice(0, activeRoundIndex), activeRound, { attackerPoints: 0, defenderPoints: 0, status: 'active' }],
              // Start a new tick
              currentTick: {
                startTime: now,
                endTime: now + battle.tickDurationMs,
                attackerDamage: 0,
                defenderDamage: 0,
                resolved: false
              }
            }
            return
          }
        } else {
          // Round not over, start next tick
          newBattles[battle.id] = {
            ...battle,
            rounds: [...battle.rounds.slice(0, activeRoundIndex), activeRound],
            currentTick: {
              startTime: now,
              endTime: now + battle.tickDurationMs,
              attackerDamage: 0,
              defenderDamage: 0,
              resolved: false
            }
          }
        }
      }
    })

    if (!hasChanges) return state
    return { battles: newBattles }
  })
}))
