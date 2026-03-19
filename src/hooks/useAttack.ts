import { useCallback, type RefObject } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { useWorldStore } from '../stores/worldStore'
import { useBattleStore } from '../stores/battleStore'
import { useArmyStore } from '../stores/army'
import { useUIStore } from '../stores/uiStore'
import { COUNTRY_ISO } from '../data/countries'
import { COUNTRY_CENTROIDS, type GameMapHandle } from '../components/map/GameMap'

export interface AttackResult {
  action: 'war_declared' | 'hoi_battle' | 'personal_attack' | 'no_target'
  success: boolean
  damage?: number
  isCrit?: boolean
  isDodged?: boolean
  battleId?: string
}

/**
 * Extracts all attack logic from App.tsx into a single reusable hook.
 * Handles: war declaration → army lookup → HOI battle or personal attack → UI feedback.
 */
export function useAttack(mapRef: RefObject<GameMapHandle | null>) {
  return useCallback((targetCountryName: string, mouseEvent?: React.MouseEvent): AttackResult => {
    const defenderIso = COUNTRY_ISO[targetCountryName]
    if (!defenderIso) return { action: 'no_target', success: false }

    const player = usePlayerStore.getState()
    const world = useWorldStore.getState()
    const battle = useBattleStore.getState()
    const army = useArmyStore.getState()
    const ui = useUIStore.getState()
    const attackerIso = player.countryCode || 'US'

    // ── Step 1: No active war → declare war first ──
    if (!world.canAttack(attackerIso, defenderIso)) {
      world.declareWar(attackerIso, defenderIso)
      ui.addFloatingText(
        '⚠️ WAR DECLARED! Click again to attack.',
        window.innerWidth / 2, window.innerHeight / 2, '#f59e0b'
      )
      return { action: 'war_declared', success: true }
    }

    // ── Step 2: Find army with ready divisions → HOI battle ──
    const myArmies = Object.values(army.armies).filter(a => a.countryCode === attackerIso)
    const armyWithDivs = myArmies.find(a =>
      a.divisionIds.some(id => army.divisions[id]?.status === 'ready')
    )

    if (armyWithDivs) {
      const result = battle.launchHOIBattle(armyWithDivs.id, defenderIso, 'invasion')

      if (result.success) {
        // Fly camera to target
        const coord = COUNTRY_CENTROIDS[targetCountryName] || COUNTRY_CENTROIDS['United States']
        if (coord && mapRef.current) {
          mapRef.current.flyTo(coord[0], coord[1], 4)
        }
      }

      if (mouseEvent) {
        ui.addFloatingText('⚔️ BATTLE LAUNCHED!', mouseEvent.clientX, mouseEvent.clientY, '#ef4444')
      }

      return { action: 'hoi_battle', success: result.success, battleId: result.battleId }
    }

    // ── Step 3: No divisions → fallback personal attack ──
    battle.launchAttack(attackerIso, defenderIso, targetCountryName)
    const { damage, isCrit, isDodged } = player.attack()

    const activeBattle = Object.values(useBattleStore.getState().battles).find(
      b => b.regionName === targetCountryName && b.status === 'active'
    )
    if (activeBattle && (damage > 0 || isDodged)) {
      useBattleStore.getState().addDamage(activeBattle.id, 'attacker', damage, isCrit, isDodged, player.name)
    }

    if (mouseEvent) {
      ui.addFloatingText('ATTACK LAUNCHED', mouseEvent.clientX, mouseEvent.clientY, '#ef4444')
    }

    return { action: 'personal_attack', success: true, damage, isCrit, isDodged }
  }, [mapRef])
}
