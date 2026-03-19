import { useBattleStore } from '../stores/battleStore'
import { useCyberStore } from '../stores/cyberStore'
import { useArmyStore, rollStarQuality } from '../stores/armyStore'

/**
 * Initialize mock/test data for development.
 * Call once on mount — injects cyber ops, military ops, and battles with divisions.
 */
export function initMockData() {
  const cyberState = useCyberStore.getState()
  const bs = useBattleStore.getState()

  import('../stores/militaryStore').then(mod => {
    const ms = mod.useMilitaryStore.getState()

    // 3 Cyber Operations — inject directly to bypass resource checks
    if (Object.keys(cyberState.campaigns).length === 0) {
      const now = Date.now()
      useCyberStore.setState(s => ({
        campaigns: {
          ...s.campaigns,
          'mock_cyber_1': {
            id: 'mock_cyber_1', initiatorPlayer: 'Commander_X', countryId: 'US',
            invitedPlayers: ['Player2', 'Player3'], operationType: 'company_sabotage' as any,
            targetCountry: 'RU', scrapCost: 0, materialXCost: 0, oilCost: 0, bitcoinCost: 0,
            successChance: 70, detectionChance: 30, duration: 1800000,
            status: 'deploying' as any, deploymentStartTime: now,
            deploymentAcceleratedMs: 0, wasDetected: false,
            createdAt: now, expiresAt: 0, contestState: null, contestResult: 'pending' as any,
          },
          'mock_cyber_2': {
            id: 'mock_cyber_2', initiatorPlayer: 'Commander_X', countryId: 'US',
            invitedPlayers: [], operationType: 'resource_intel' as any,
            targetCountry: 'CN', scrapCost: 0, materialXCost: 0, oilCost: 0, bitcoinCost: 0,
            successChance: 80, detectionChance: 30, duration: 1800000,
            status: 'active' as any, deploymentStartTime: now - 600000,
            deploymentAcceleratedMs: 0, wasDetected: false,
            createdAt: now - 600000, expiresAt: now + 1200000, contestState: null, contestResult: 'pending' as any,
          },
          'mock_cyber_3': {
            id: 'mock_cyber_3', initiatorPlayer: 'Commander_X', countryId: 'US',
            invitedPlayers: ['HackerX'], operationType: 'power_grid_attack' as any,
            targetCountry: 'DE', scrapCost: 0, materialXCost: 0, oilCost: 0, bitcoinCost: 0,
            successChance: 60, detectionChance: 40, duration: 1800000,
            status: 'deploying' as any, deploymentStartTime: now,
            deploymentAcceleratedMs: 0, wasDetected: false,
            createdAt: now, expiresAt: 0, contestState: null, contestResult: 'pending' as any,
          },
        },
      }))
    }

    // 3 Military Operations — inject directly to bypass resource checks
    if (Object.keys(ms.campaigns).length === 0) {
      const now = Date.now()
      mod.useMilitaryStore.setState({
        campaigns: {
          'mock_mil_1': {
            id: 'mock_mil_1', operationId: 'assault', initiator: 'Commander_X',
            originCountry: 'US', targetCountry: 'CA', playersJoined: ['Commander_X', 'General_Y'],
            invitedPlayers: [], createdAt: now, launchedAt: now, battleId: null,
            phase: 'detection_window' as any, detectionWindowStart: now,
            wasDetected: false, contestState: null, result: 'pending',
          },
          'mock_mil_2': {
            id: 'mock_mil_2', operationId: 'invasion', initiator: 'Commander_X',
            originCountry: 'US', targetCountry: 'MX', playersJoined: ['Commander_X'],
            invitedPlayers: [], createdAt: now, launchedAt: now, battleId: null,
            phase: 'contest' as any, detectionWindowStart: now - 900000,
            wasDetected: true,
            contestState: {
              contestType: 'damage' as any, threshold: 1000,
              startedAt: now - 300000, expiresAt: now + 1800000,
              attackerProgress: 320, defenderProgress: 180,
              attackerContributors: [{ playerId: 'Commander_X', contributed: 320 }],
              defenderContributors: [{ playerId: 'Defender_1', contributed: 180 }],
            },
            result: 'pending',
          },
          'mock_mil_3': {
            id: 'mock_mil_3', operationId: 'sabotage', initiator: 'Commander_X',
            originCountry: 'US', targetCountry: 'RU', playersJoined: ['Commander_X', 'Ace_Pilot'],
            invitedPlayers: ['SoldierZ'], createdAt: now, launchedAt: null, battleId: null,
            phase: 'deploying' as any, detectionWindowStart: null,
            wasDetected: false, contestState: null, result: 'pending',
          },
        },
      })
    }
  })

  // 3 Active Battles (with divisions on BOTH sides so auto-damage works)
  if (Object.keys(bs.battles).length === 0) {
    const now = Date.now()

    // Create mock enemy divisions first
    const mockDivs: Record<string, any> = {}
    const enemyDivIds: string[][] = [[], [], []]
    const defenderCodes = ['RU', 'CN', 'MX']

    defenderCodes.forEach((code, bi) => {
      for (let i = 0; i < 3; i++) {
        const id = `mock_def_${code}_${i}`
        enemyDivIds[bi].push(id)
        const divTypes: ('assault' | 'rpg' | 'tank')[] = ['assault', 'rpg', 'tank']
        const divNames = ['1st Assault Div', '2nd RPG Div', '3rd Tank Div']
        const divType = divTypes[i]
        const { star: mStar, modifiers: mMods } = rollStarQuality()
        mockDivs[id] = {
          id, name: `${code} ${divNames[i]}`,
          type: divType, category: divType === 'tank' ? 'land' : 'land',
          countryCode: code, ownerId: `AI_${code}`,
          status: 'in_combat', experience: 50,
          manpower: 5000 + i * 2000, maxManpower: 8000,
          equipment: [],
          trainingProgress: 10,
          killCount: 0, battlesSurvived: 0,
          starQuality: mStar, statModifiers: mMods,
        }
      }
    })

    // Inject divisions into armyStore
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, ...mockDivs }
    }))

    // Create 3 battles with both sides populated
    const battleConfigs = [
      { id: 'b1', atkId: 'US', defId: 'RU', region: 'Eastern Europe Front', type: 'invasion' },
      { id: 'b2', atkId: 'US', defId: 'CN', region: 'Pacific Theater', type: 'naval_strike' },
      { id: 'b3', atkId: 'CA', defId: 'MX', region: 'Southern Border', type: 'assault' },
    ]

    const newBattles: Record<string, any> = {}
    battleConfigs.forEach((cfg, idx) => {
      const defDivs = enemyDivIds[idx]
      newBattles[cfg.id] = {
        id: cfg.id, type: cfg.type, attackerId: cfg.atkId, defenderId: cfg.defId,
        regionName: cfg.region, startedAt: now,
        ticksElapsed: 0, status: 'active',
        attacker: {
          countryCode: cfg.atkId, divisionIds: [], engagedDivisionIds: [],
          damageDealt: 0, manpowerLost: 0,
          divisionsDestroyed: 0, divisionsRetreated: 0,
        },
        defender: {
          countryCode: cfg.defId, divisionIds: defDivs, engagedDivisionIds: defDivs,
          damageDealt: 0, manpowerLost: 0,
          divisionsDestroyed: 0, divisionsRetreated: 0,
        },
        attackerRoundsWon: 0, defenderRoundsWon: 0,
        rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: now }],
        currentTick: { attackerDamage: 0, defenderDamage: 0 },
        combatLog: [],
        attackerDamageDealers: {}, defenderDamageDealers: {}, damageFeed: [],
      }
    })

    useBattleStore.setState(s => ({ battles: { ...s.battles, ...newBattles } }))
  }
}
