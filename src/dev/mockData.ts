import { useBattleStore } from '../stores/battleStore'
import { useCyberStore } from '../stores/cyberStore'
import { useArmyStore, rollStarQuality } from '../stores/army'
import { useCompanyStore } from '../stores/companyStore'
import { useMarketStore } from '../stores/market'
import { useStockStore, calculateFundamentals } from '../stores/stockStore'
import { useGovernmentStore } from '../stores/governmentStore'
import { useNewsStore } from '../stores/newsStore'
import { useBountyStore } from '../stores/bountyStore'
import { usePlayerStore } from '../stores/playerStore'
import { useInventoryStore } from '../stores/inventoryStore'
import { register, login } from '../api/client'

/**
 * Initialize mock/test data for development.
 * Call once on mount — seeds all subsystems that need representative data.
 */
export function initMockData() {
  const playerName = usePlayerStore.getState().name || 'Commander'
  const cyberState = useCyberStore.getState()
  const bs = useBattleStore.getState()

  // ═══════════════════════════════════════════
  //  1. CYBER OPERATIONS (3)
  // ═══════════════════════════════════════════
  import('../stores/militaryStore').then(_mod => {
    // Military is now lobby-based (quick battles) — no need for mock campaigns
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
  //  6. STOCK EXCHANGE — 12 nations with fundamentals-based prices
  // ═══════════════════════════════════════════
  const stockState = useStockStore.getState()
  if (stockState.stocks.length === 0) {
    const STOCK_NATIONS: { code: string; name: string }[] = [
      { code: 'US', name: 'United States' },
      { code: 'RU', name: 'Russia' },
      { code: 'CN', name: 'China' },
      { code: 'DE', name: 'Germany' },
      { code: 'BR', name: 'Brazil' },
      { code: 'IN', name: 'India' },
      { code: 'JP', name: 'Japan' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'TR', name: 'Turkey' },
      { code: 'KR', name: 'South Korea' },
      { code: 'SA', name: 'Saudi Arabia' },
      { code: 'AU', name: 'Australia' },
    ]

    const stocks = STOCK_NATIONS.map(({ code, name }) => {
      const basePrice = Math.max(5, calculateFundamentals(code))
      // Generate 10 initial history ticks with slight variance
      const history = Array.from({ length: 10 }, (_, i) => {
        const variance = Math.floor((Math.random() - 0.45) * basePrice * 0.08)
        return { price: Math.max(5, basePrice + variance), timestamp: Date.now() - (10 - i) * 10000 }
      })
      return {
        code, name,
        price: basePrice,
        prevPrice: basePrice,
        history,
        volume: 0,
        netBuyVolume: 0,
      }
    })

    useStockStore.setState({
      stocks,
      marketPool: 500_000,
      portfolio: [
        { code: 'US', shares: 10, avgBuyPrice: stocks.find(s => s.code === 'US')?.price || 96 },
        { code: 'JP', shares: 5, avgBuyPrice: stocks.find(s => s.code === 'JP')?.price || 88 },
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
          congress: [playerName, 'Senator_Smith', 'Rep_Jones'],
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
        { id: 'news_1', category: 'war', message: '🔥 US declares war on Russia — tensions escalated after border incidents', timestamp: now - 7200000, icon: '⚔️', color: '#ef4444' },
        { id: 'news_2', category: 'combat', message: '⚔️ Battle rages in Eastern Europe — both sides commit armored divisions', timestamp: now - 3600000, icon: '💥', color: '#f97316' },
        { id: 'news_3', category: 'economy', message: '📈 US wheat exports surge 40% — farm subsidies drive record production', timestamp: now - 1800000, icon: '💰', color: '#22c55e' },
        { id: 'news_4', category: 'system', message: `🏛️ ${playerName} elected President of USA — landslide victory`, timestamp: now - 900000, icon: '📡', color: '#64748b' },
        { id: 'news_5', category: 'war', message: '🖥️ Cyber attack targets German power grid — investigation ongoing', timestamp: now - 300000, icon: '⚔️', color: '#ef4444' },
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
  // ═══════════════════════════════════════════
  //  11. MILITARY UNIT — player in a 12-member MU
  // ═══════════════════════════════════════════
  import('../stores/muStore').then(({ useMUStore }) => {
    const muState = useMUStore.getState()
    if (Object.keys(muState.units).length === 0) {
      const now = Date.now()
      const mockMembers = [
        { playerId: playerName, name: playerName, level: 12, countryCode: 'US', health: 10, maxHealth: 10, role: 'commander' as const, joinedAt: now - 86400000 * 30, weeklyDamage: 54200, totalDamage: 1240000, terrain: 420, wealth: 5000, lastActive: now - 60000 },
        { playerId: 'Ghost_Viper', name: 'Ghost_Viper', level: 18, countryCode: 'US', health: 8, maxHealth: 10, role: 'commander' as const, joinedAt: now - 86400000 * 25, weeklyDamage: 72100, totalDamage: 1890000, terrain: 580, wealth: 8200, lastActive: now - 300000 },
        { playerId: 'IronWolf_88', name: 'IronWolf_88', level: 15, countryCode: 'US', health: 6, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 20, weeklyDamage: 38900, totalDamage: 920000, terrain: 310, wealth: 3100, lastActive: now - 1800000 },
        { playerId: 'SkyHammer', name: 'SkyHammer', level: 22, countryCode: 'GB', health: 10, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 18, weeklyDamage: 91000, totalDamage: 2450000, terrain: 720, wealth: 12000, lastActive: now - 120000 },
        { playerId: 'RedFox_21', name: 'RedFox_21', level: 10, countryCode: 'US', health: 3, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 15, weeklyDamage: 21500, totalDamage: 410000, terrain: 180, wealth: 1500, lastActive: now - 7200000 },
        { playerId: 'NightOwl', name: 'NightOwl', level: 14, countryCode: 'CA', health: 7, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 12, weeklyDamage: 45800, totalDamage: 780000, terrain: 290, wealth: 4200, lastActive: now - 900000 },
        { playerId: 'StormBreaker', name: 'StormBreaker', level: 20, countryCode: 'US', health: 9, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 10, weeklyDamage: 68200, totalDamage: 1560000, terrain: 510, wealth: 7800, lastActive: now - 240000 },
        { playerId: 'Phoenix_99', name: 'Phoenix_99', level: 8, countryCode: 'DE', health: 5, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 8, weeklyDamage: 15600, totalDamage: 280000, terrain: 120, wealth: 900, lastActive: now - 3600000 },
        { playerId: 'BladeRunner', name: 'BladeRunner', level: 16, countryCode: 'US', health: 4, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 6, weeklyDamage: 52100, totalDamage: 1100000, terrain: 380, wealth: 5600, lastActive: now - 600000 },
        { playerId: 'HawkEye_77', name: 'HawkEye_77', level: 11, countryCode: 'US', health: 10, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 4, weeklyDamage: 29300, totalDamage: 520000, terrain: 210, wealth: 2400, lastActive: now - 180000 },
        { playerId: 'ShadowFang', name: 'ShadowFang', level: 19, countryCode: 'JP', health: 2, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000 * 2, weeklyDamage: 61400, totalDamage: 1380000, terrain: 460, wealth: 6900, lastActive: now - 420000 },
        { playerId: 'CyberNova', name: 'CyberNova', level: 13, countryCode: 'US', health: 8, maxHealth: 10, role: 'member' as const, joinedAt: now - 86400000, weeklyDamage: 33700, totalDamage: 650000, terrain: 250, wealth: 3800, lastActive: now - 1200000 },
      ]

      const mockUnit = {
        id: 'mu_black_lotus',
        name: 'Black Lotus I',
        bannerUrl: '',
        avatarUrl: '',
        ownerId: playerName,
        ownerName: playerName,
        ownerCountry: 'US',
        countryCode: 'US',
        locationRegion: 'United States',
        members: mockMembers,
        applications: [
          { id: 'app_1', playerId: 'Recruit_Alpha', playerName: 'Recruit_Alpha', playerLevel: 6, playerCountry: 'US', message: 'Looking for an active MU!', appliedAt: now - 3600000, status: 'pending' as const },
          { id: 'app_2', playerId: 'WarMonger_X', playerName: 'WarMonger_X', playerLevel: 9, playerCountry: 'BR', message: '', appliedAt: now - 7200000, status: 'pending' as const },
        ],
        badges: [
          { id: 'badge_1', name: 'First Blood', icon: '🗡️', description: 'First combat together' },
          { id: 'badge_2', name: 'Iron Wall', icon: '🛡️', description: 'Defended 10 battles' },
          { id: 'badge_3', name: 'Blitz', icon: '⚡', description: 'Won 5 battles in a day' },
        ],
        transactions: [
          { id: 'txn_m1', type: 'deposit' as const, amount: 50000, currency: 'money', playerName: playerName, description: 'Unit creation fee', timestamp: now - 86400000 * 30 },
          { id: 'txn_m2', type: 'deposit' as const, amount: 75000, currency: 'money', playerName: 'Ghost_Viper', description: 'Donated $75,000', timestamp: now - 86400000 * 10 },
          { id: 'txn_m3', type: 'purchase' as const, amount: 4800, currency: 'money', playerName: playerName, description: 'Bought 2400 wheat @ $2/ea', timestamp: now - 86400000 * 5 },
        ],
        donations: [
          { id: 'don_m1', donorName: 'Ghost_Viper', donorCountry: 'US', amount: 75000, currency: 'money', message: 'For the cause!', timestamp: now - 86400000 * 10 },
          { id: 'don_m2', donorName: 'SkyHammer', donorCountry: 'GB', amount: 500, currency: 'wheat', message: '', timestamp: now - 86400000 * 7 },
          { id: 'don_m3', donorName: 'StormBreaker', donorCountry: 'US', amount: 200, currency: 'greenBullets', message: 'Ammo supply', timestamp: now - 86400000 * 3 },
        ],
        contracts: [
          { id: 'con_m1', title: 'Weekly Damage Goal', description: 'Deal 100K damage this week', reward: 10000, currency: 'money', status: 'active' as const, createdBy: playerName, createdAt: now - 86400000 * 2, expiresAt: now + 86400000 * 5 },
        ],
        createdAt: now - 86400000 * 30,
        weeklyDamageTotal: mockMembers.reduce((s, m) => s + m.weeklyDamage, 0),
        totalDamageTotal: mockMembers.reduce((s, m) => s + m.totalDamage, 0),
        regionId: '',
        upgrades: { warDoctrine: 0, barracks: 0, corporateLicense: 0 },
        cycleDamage: {},
        lastBudgetPayout: 0,
        isStateOwned: false,
        vault: {
          treasury: 125000,
          resources: {
            wheat: 2400,
            steak: 180,
            bread: 600,
            oil: 340,
            scrap: 520,
            greenBullets: 1200,
            blueBullets: 400,
            magicTea: 15,
          } as any,
        },
      }

      useMUStore.setState({
        units: { [mockUnit.id]: mockUnit },
        playerUnitId: mockUnit.id,
      })
    }
  })
}
