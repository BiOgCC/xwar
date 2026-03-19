import { useBattleStore } from '../stores/battleStore'
import { useCyberStore } from '../stores/cyberStore'
import { useArmyStore, rollStarQuality } from '../stores/army'
import { useCompanyStore } from '../stores/companyStore'
import { useMarketStore } from '../stores/market'
import { useStockStore } from '../stores/stockStore'
import { useGovernmentStore } from '../stores/governmentStore'
import { useNewsStore } from '../stores/newsStore'
import { useBountyStore } from '../stores/bountyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useInventoryStore } from '../stores/inventoryStore'

/**
 * Initialize mock/test data for development.
 * Call once on mount — seeds all subsystems that need representative data.
 */
export function initMockData() {
  const cyberState = useCyberStore.getState()
  const bs = useBattleStore.getState()
  const playerName = usePlayerStore.getState().name || 'Commander'

  // ═══════════════════════════════════════════
  //  1. CYBER OPERATIONS (3)
  // ═══════════════════════════════════════════
  import('../stores/militaryStore').then(mod => {
    const ms = mod.useMilitaryStore.getState()

    if (Object.keys(cyberState.campaigns).length === 0) {
      const now = Date.now()
      useCyberStore.setState(s => ({
        campaigns: {
          ...s.campaigns,
          'mock_cyber_1': {
            id: 'mock_cyber_1', initiatorPlayer: playerName, countryId: 'US',
            invitedPlayers: ['Player2', 'Player3'], operationType: 'company_sabotage' as any,
            targetCountry: 'RU', scrapCost: 0, materialXCost: 0, oilCost: 0, bitcoinCost: 0,
            successChance: 70, detectionChance: 30, duration: 1800000,
            status: 'deploying' as any, deploymentStartTime: now,
            deploymentAcceleratedMs: 0, wasDetected: false,
            createdAt: now, expiresAt: 0, contestState: null, contestResult: 'pending' as any,
          },
          'mock_cyber_2': {
            id: 'mock_cyber_2', initiatorPlayer: playerName, countryId: 'US',
            invitedPlayers: [], operationType: 'resource_intel' as any,
            targetCountry: 'CN', scrapCost: 0, materialXCost: 0, oilCost: 0, bitcoinCost: 0,
            successChance: 80, detectionChance: 30, duration: 1800000,
            status: 'active' as any, deploymentStartTime: now - 600000,
            deploymentAcceleratedMs: 0, wasDetected: false,
            createdAt: now - 600000, expiresAt: now + 1200000, contestState: null, contestResult: 'pending' as any,
          },
          'mock_cyber_3': {
            id: 'mock_cyber_3', initiatorPlayer: playerName, countryId: 'US',
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

    // ═══════════════════════════════════════════
    //  2. MILITARY OPERATIONS (3)
    // ═══════════════════════════════════════════
    if (Object.keys(ms.campaigns).length === 0) {
      const now = Date.now()
      mod.useMilitaryStore.setState({
        campaigns: {
          'mock_mil_1': {
            id: 'mock_mil_1', operationId: 'assault', initiator: playerName,
            originCountry: 'US', targetCountry: 'CA', playersJoined: [playerName, 'General_Y'],
            invitedPlayers: [], createdAt: now, launchedAt: now, battleId: null,
            phase: 'detection_window' as any, detectionWindowStart: now,
            wasDetected: false, contestState: null, result: 'pending',
          },
          'mock_mil_2': {
            id: 'mock_mil_2', operationId: 'invasion', initiator: playerName,
            originCountry: 'US', targetCountry: 'MX', playersJoined: [playerName],
            invitedPlayers: [], createdAt: now, launchedAt: now, battleId: null,
            phase: 'contest' as any, detectionWindowStart: now - 900000,
            wasDetected: true,
            contestState: {
              contestType: 'damage' as any, threshold: 1000,
              startedAt: now - 300000, expiresAt: now + 1800000,
              attackerProgress: 320, defenderProgress: 180,
              attackerContributors: [{ playerId: playerName, contributed: 320 }],
              defenderContributors: [{ playerId: 'Defender_1', contributed: 180 }],
            },
            result: 'pending',
          },
          'mock_mil_3': {
            id: 'mock_mil_3', operationId: 'sabotage', initiator: playerName,
            originCountry: 'US', targetCountry: 'RU', playersJoined: [playerName, 'Ace_Pilot'],
            invitedPlayers: ['SoldierZ'], createdAt: now, launchedAt: null, battleId: null,
            phase: 'deploying' as any, detectionWindowStart: null,
            wasDetected: false, contestState: null, result: 'pending',
          },
        },
      })
    }
  })

  // ═══════════════════════════════════════════
  //  3. BATTLES (3) with divisions on both sides
  // ═══════════════════════════════════════════
  if (Object.keys(bs.battles).length === 0) {
    const now = Date.now()

    // Create mock enemy divisions
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

    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, ...mockDivs }
    }))

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

  // ═══════════════════════════════════════════
  //  4. COMPANIES (4) — player has a small economy
  // ═══════════════════════════════════════════
  const companyState = useCompanyStore.getState()
  if (companyState.companies.length === 0) {
    useCompanyStore.setState({
      companies: [
        { id: 'comp_1', type: 'wheat_farm', level: 2, autoProduction: false, productionProgress: 0, productionMax: 100, location: 'US' },
        { id: 'comp_2', type: 'oil_refinery', level: 1, autoProduction: true, productionProgress: 45, productionMax: 100, location: 'US' },
        { id: 'comp_3', type: 'green_ammo_factory', level: 3, autoProduction: false, productionProgress: 0, productionMax: 100, location: 'US' },
        { id: 'comp_4', type: 'bitcoin_miner', level: 1, autoProduction: true, productionProgress: 72, productionMax: 100, location: 'US' },
      ],
    })
  }

  // ═══════════════════════════════════════════
  //  5. MARKET ORDERS (4) — mix of buy/sell, resource/equipment
  // ═══════════════════════════════════════════
  const marketState = useMarketStore.getState()
  if (marketState.orders.length === 0) {
    const now = Date.now()
    useMarketStore.setState(s => ({
      orders: [
        ...s.orders,
        {
          id: 'mkt_1', playerId: 'Trader_Joe', type: 'sell' as const, itemType: 'resource' as const,
          resourceId: 'wheat', amount: 500, filledAmount: 120, pricePerUnit: 2.5,
          totalPrice: 1250, status: 'partial' as const, source: 'player' as const,
          countryCode: 'US', createdAt: now - 3600000,
        },
        {
          id: 'mkt_2', playerId: playerName, type: 'sell' as const, itemType: 'resource' as const,
          resourceId: 'oil', amount: 200, filledAmount: 0, pricePerUnit: 12,
          totalPrice: 2400, status: 'open' as const, source: 'player' as const,
          countryCode: 'US', createdAt: now - 1800000,
        },
        {
          id: 'mkt_3', playerId: 'Arms_Dealer', type: 'sell' as const, itemType: 'equipment' as const,
          equipmentId: 'mock_eq_t4_rifle', amount: 1, filledAmount: 0, pricePerUnit: 5000,
          totalPrice: 5000, status: 'open' as const, source: 'player' as const,
          equipSnapshot: { name: 'Sniper', tier: 't4', slot: 'weapon', stats: { damage: 135, critRate: 18 } },
          countryCode: 'RU', createdAt: now - 7200000,
        },
        {
          id: 'mkt_4', playerId: 'US', type: 'sell' as const, itemType: 'resource' as const,
          resourceId: 'steak', amount: 1000, filledAmount: 300, pricePerUnit: 3,
          totalPrice: 3000, status: 'partial' as const, source: 'country' as const,
          countryCode: 'US', createdAt: now - 86400000,
        },
      ] as any,
    }))
  }

  // ═══════════════════════════════════════════
  //  6. STOCK EXCHANGE — initial portfolio
  // ═══════════════════════════════════════════
  const stockState = useStockStore.getState()
  if (stockState.portfolio.length === 0) {
    useStockStore.setState({
      portfolio: [
        { code: 'US', shares: 10, avgBuyPrice: 96 },
        { code: 'JP', shares: 5, avgBuyPrice: 88 },
      ],
    })
  }

  // ═══════════════════════════════════════════
  //  7. GOVERNMENT — player is president of US
  // ═══════════════════════════════════════════
  const govState = useGovernmentStore.getState()
  if (!govState.governments['US']?.president) {
    useGovernmentStore.setState(s => ({
      governments: {
        ...s.governments,
        US: {
          ...s.governments['US'],
          president: playerName,
          taxRate: 15,
          swornEnemy: 'RU',
          congress: [
            { name: playerName, party: 'Patriot Front', votes: 1200 },
            { name: 'Senator_Smith', party: 'Liberty Coalition', votes: 800 },
            { name: 'Rep_Jones', party: 'Patriot Front', votes: 650 },
          ],
        },
      },
    }))
  }

  // ═══════════════════════════════════════════
  //  8. NEWS EVENTS (5)
  // ═══════════════════════════════════════════
  const newsState = useNewsStore.getState()
  if (newsState.events.length === 0) {
    const now = Date.now()
    useNewsStore.setState({
      events: [
        { id: 'news_1', type: 'war', headline: '🔥 US declares war on Russia!', body: 'Tensions escalated after border incidents.', countryCode: 'US', data: {}, createdAt: now - 7200000 },
        { id: 'news_2', type: 'battle', headline: '⚔️ Battle rages in Eastern Europe', body: 'Both sides commit armored divisions.', countryCode: 'RU', data: {}, createdAt: now - 3600000 },
        { id: 'news_3', type: 'economy', headline: '📈 US wheat exports surge 40%', body: 'Farm subsidies drive record production.', countryCode: 'US', data: {}, createdAt: now - 1800000 },
        { id: 'news_4', type: 'election', headline: `🏛️ ${playerName} elected President of USA`, body: 'Landslide victory with 60% of congress.', countryCode: 'US', data: {}, createdAt: now - 900000 },
        { id: 'news_5', type: 'cyber', headline: '🖥️ Cyber attack targets German grid', body: 'Intelligence agencies investigating origin.', countryCode: 'DE', data: {}, createdAt: now - 300000 },
      ],
    })
  }

  // ═══════════════════════════════════════════
  //  9. BOUNTIES (3)
  // ═══════════════════════════════════════════
  const bountyState = useBountyStore.getState()
  if (bountyState.bounties.length === 0) {
    const now = Date.now()
    useBountyStore.setState({
      bounties: [
        { id: 'bounty_1', targetName: 'AI_Commander_Putin', placedBy: playerName, reward: 50000, reason: 'War criminal', status: 'active' as const, createdAt: now - 86400000, claimedBy: null },
        { id: 'bounty_2', targetName: 'HackerX', placedBy: 'Senator_Smith', reward: 25000, reason: 'Espionage', status: 'active' as const, createdAt: now - 43200000, claimedBy: null },
        { id: 'bounty_3', targetName: 'Arms_Dealer', placedBy: playerName, reward: 15000, reason: 'Smuggling weapons to enemy', status: 'active' as const, createdAt: now - 3600000, claimedBy: null },
      ] as any,
    })
  }

  // ═══════════════════════════════════════════
  //  10. INVENTORY — ensure player has items across tiers
  // ═══════════════════════════════════════════
  const invState = useInventoryStore.getState()
  if (invState.items.length === 0) {
    useInventoryStore.setState({
      items: [
        // Equipped T3 set
        { id: 'eq_weapon', name: 'Rifle', slot: 'weapon', category: 'weapon', tier: 't3', equipped: true, durability: 95, weaponSubtype: 'rifle', location: 'inventory' as const, stats: { damage: 105, critRate: 14 } },
        { id: 'eq_helmet', name: 'Rare Helmet', slot: 'helmet', category: 'armor', tier: 't3', equipped: true, durability: 88, location: 'inventory' as const, stats: { critDamage: 52 } },
        { id: 'eq_chest', name: 'Rare Chestplate', slot: 'chest', category: 'armor', tier: 't3', equipped: true, durability: 90, location: 'inventory' as const, stats: { armor: 14 } },
        { id: 'eq_legs', name: 'Rare Legging', slot: 'legs', category: 'armor', tier: 't3', equipped: true, durability: 92, location: 'inventory' as const, stats: { armor: 12 } },
        { id: 'eq_boots', name: 'Rare Boots', slot: 'boots', category: 'armor', tier: 't3', equipped: true, durability: 85, location: 'inventory' as const, stats: { dodge: 13 } },
        { id: 'eq_gloves', name: 'Rare Gloves', slot: 'gloves', category: 'armor', tier: 't3', equipped: true, durability: 79, location: 'inventory' as const, stats: { precision: 11 } },
        // Spare inventory
        { id: 'inv_t4_sniper', name: 'Sniper', slot: 'weapon', category: 'weapon', tier: 't4', equipped: false, durability: 100, weaponSubtype: 'sniper', location: 'inventory' as const, stats: { damage: 140, critRate: 19 } },
        { id: 'inv_t2_gun', name: 'Gun', slot: 'weapon', category: 'weapon', tier: 't2', equipped: false, durability: 60, weaponSubtype: 'gun', location: 'inventory' as const, stats: { damage: 68, critRate: 8 } },
        { id: 'inv_t1_helmet', name: 'Common Helmet', slot: 'helmet', category: 'armor', tier: 't1', equipped: false, durability: 100, location: 'inventory' as const, stats: { critDamage: 15 } },
        // Vault item (army vault)
        { id: 'vault_t3_chest', name: 'Rare Chestplate', slot: 'chest', category: 'armor', tier: 't3', equipped: false, durability: 100, location: 'vault' as const, vaultArmyId: 'army_us_1', stats: { armor: 13 } },
        // Division-equipped item
        { id: 'div_t2_rifle', name: 'Rifle', slot: 'weapon', category: 'weapon', tier: 't2', equipped: false, durability: 75, weaponSubtype: 'rifle', location: 'division' as const, assignedToDivision: 'div_us_0', stats: { damage: 72, critRate: 9 } },
        // Market-listed item
        { id: 'mkt_t5_tank', name: 'Tank', slot: 'weapon', category: 'weapon', tier: 't5', equipped: false, durability: 100, weaponSubtype: 'tank', location: 'market' as const, stats: { damage: 180, critRate: 26 } },
      ] as any,
    })
  }
}
