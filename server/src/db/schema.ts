import {
  pgTable, uuid, varchar, text, integer, bigint, numeric,
  boolean, jsonb, timestamp, primaryKey, index,
} from 'drizzle-orm/pg-core'

// ═══════════════════════════════════════════════
//  COUNTRIES  (must be first — referenced by FK)
// ═══════════════════════════════════════════════

export const countries = pgTable('countries', {
  code:              varchar('code', { length: 4 }).primaryKey(),
  name:              varchar('name', { length: 64 }).notNull(),
  controller:        varchar('controller', { length: 64 }),
  empire:            varchar('empire', { length: 32 }),
  population:        integer('population').default(0),
  regions:           integer('regions').default(0),
  military:          integer('military').default(0),
  color:             varchar('color', { length: 16 }),
  portLevel:         integer('port_level').default(1),
  airportLevel:      integer('airport_level').default(1),
  bunkerLevel:       integer('bunker_level').default(1),
  militaryBaseLevel: integer('military_base_level').default(1),
  hasPort:           boolean('has_port').default(true),
  hasAirport:        boolean('has_airport').default(true),
  taxExempt:         boolean('tax_exempt').default(false),
  fund:              jsonb('fund').default({ money: 0, oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }),
  forceVault:        jsonb('force_vault').default({ money: 0, oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }),
  autoDefenseLimit:  integer('auto_defense_limit').default(-1),
  conqueredResources: jsonb('conquered_resources').default([]),
  activeDepositBonus: jsonb('active_deposit_bonus'),
})

// ═══════════════════════════════════════════════
//  PLAYERS
// ═══════════════════════════════════════════════

export const players = pgTable('players', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          varchar('name', { length: 32 }).unique().notNull(),
  passwordHash:  text('password_hash').notNull(),
  role:          varchar('role', { length: 16 }).default('military'),
  rank:          numeric('rank', { precision: 6, scale: 1 }).default('1'),
  countryCode:   varchar('country_code', { length: 4 }).references(() => countries.code),
  avatar:        text('avatar').default('/assets/avatars/avatar_male.png'),
  enlistedArmyId: uuid('enlisted_army_id'),
  equippedAmmo:  varchar('equipped_ammo', { length: 8 }).default('none'),

  // Resources
  money:         bigint('money', { mode: 'number' }).default(0),
  wheat:         integer('wheat').default(0),
  fish:          integer('fish').default(0),
  steak:         integer('steak').default(0),
  bread:         integer('bread').default(0),
  sushi:         integer('sushi').default(0),
  wagyu:         integer('wagyu').default(0),
  greenBullets:  integer('green_bullets').default(0),
  blueBullets:   integer('blue_bullets').default(0),
  purpleBullets: integer('purple_bullets').default(0),
  redBullets:    integer('red_bullets').default(0),
  oil:           bigint('oil', { mode: 'number' }).default(0),
  materialX:     bigint('material_x', { mode: 'number' }).default(0),
  scrap:         bigint('scrap', { mode: 'number' }).default(0),
  bitcoin:       integer('bitcoin').default(0),
  lootBoxes:     integer('loot_boxes').default(0),
  militaryBoxes: integer('military_boxes').default(0),
  magicTea:     integer('stamina_pills').default(0),
  energyLeaves:  integer('energy_leaves').default(0),
  badgesOfHonor: integer('badges_of_honor').default(0),
  lootChancePool: integer('loot_chance_pool').default(0),

  // XP & Level
  level:         integer('level').default(1),
  experience:    integer('experience').default(0),
  expToNext:     integer('exp_to_next').default(100),
  skillPoints:   integer('skill_points').default(0),

  // Bars
  stamina:       numeric('stamina', { precision: 6, scale: 1 }).default('120'),
  maxStamina:    integer('max_stamina').default(120),
  hunger:        integer('hunger').default(6),
  maxHunger:     integer('max_hunger').default(6),
  entrepreneurship: integer('entrepreneurship').default(120),
  maxEntrepreneurship: integer('max_entrepreneurship').default(120),
  work:          integer('work').default(120),
  maxWork:       integer('max_work').default(120),
  productionBar: integer('production_bar').default(0),
  productionBarMax: integer('production_bar_max').default(100),

  // Stats
  damageDone:    bigint('damage_done', { mode: 'number' }).default(0),
  itemsProduced: integer('items_produced').default(0),
  heroBuffTicks: integer('hero_buff_ticks').default(0),
  heroBuffBattleId: uuid('hero_buff_battle_id'),

  // Shame counters
  muteCount:       integer('mute_count').default(0),
  deathCount:      integer('death_count').default(0),
  battlesLost:     integer('battles_lost').default(0),
  totalCasinoLosses: bigint('total_casino_losses', { mode: 'number' }).default(0),
  bankruptcyCount: integer('bankruptcy_count').default(0),
  countrySwitches: integer('country_switches').default(0),
  casinoSpins:     integer('casino_spins').default(0),
  itemsDestroyed:  integer('items_destroyed').default(0),

  createdAt:     timestamp('created_at').defaultNow(),
  lastLogin:     timestamp('last_login').defaultNow(),
  lastRewardClaimed: timestamp('last_reward_claimed'),
  loginStreak:   integer('login_streak').default(0),
}, (table) => ({
  countryIdx: index('idx_players_country').on(table.countryCode),
  armyIdx: index('idx_players_army').on(table.enlistedArmyId),
  roleIdx: index('idx_players_role').on(table.role),
}))

// ═══════════════════════════════════════════════
//  PLAYER SKILLS
// ═══════════════════════════════════════════════

export const playerSkills = pgTable('player_skills', {
  playerId:     uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  // Military
  attack:       integer('attack').default(0),
  critRate:     integer('crit_rate').default(0),
  critDamage:   integer('crit_damage').default(0),
  armor:        integer('armor').default(0),
  dodge:        integer('dodge').default(0),
  precision:    integer('precision_').default(0),
  // Economic
  work:           integer('work').default(0),
  entrepreneurship: integer('entrepreneurship').default(0),
  production:   integer('production').default(0),
  prospection:  integer('prospection').default(0),
  industrialist: integer('industrialist').default(0),
  trade:        integer('trade').default(0),
  investor:     integer('investor').default(0),
  espionage:    integer('espionage').default(0),
})

// ═══════════════════════════════════════════════
//  PLAYER SPECIALIZATION
// ═══════════════════════════════════════════════

export const playerSpecialization = pgTable('player_specialization', {
  playerId:       uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  militaryXp:     integer('military_xp').default(0),
  militaryTier:   integer('military_tier').default(0),
  economicXp:     integer('economic_xp').default(0),
  economicTier:   integer('economic_tier').default(0),
  politicianXp:   integer('politician_xp').default(0),
  politicianTier: integer('politician_tier').default(0),
  mercenaryXp:    integer('mercenary_xp').default(0),
  mercenaryTier:  integer('mercenary_tier').default(0),
  influencerXp:   integer('influencer_xp').default(0),
  influencerTier: integer('influencer_tier').default(0),
})

// ═══════════════════════════════════════════════
//  DAILY REWARDS
// ═══════════════════════════════════════════════

export const dailyRewards = pgTable('daily_rewards', {
  id:             uuid('id').primaryKey().defaultRandom(),
  playerId:       uuid('player_id').unique().references(() => players.id, { onDelete: 'cascade' }),
  loginStreak:    integer('login_streak').default(0),
  lastClaimedAt:  timestamp('last_claimed_at'),
})

// ═══════════════════════════════════════════════
//  ITEMS (single source of truth)
// ═══════════════════════════════════════════════

export const items = pgTable('items', {
  id:            uuid('id').primaryKey().defaultRandom(),
  ownerId:       uuid('owner_id').notNull().references(() => players.id),
  name:          varchar('name', { length: 64 }).notNull(),
  slot:          varchar('slot', { length: 16 }).notNull(),
  category:      varchar('category', { length: 16 }).notNull(),
  tier:          varchar('tier', { length: 4 }).notNull(),
  equipped:      boolean('equipped').default(false),
  durability:    numeric('durability', { precision: 5, scale: 1 }).default('100'),
  weaponSubtype: varchar('weapon_subtype', { length: 16 }),
  location:      varchar('location', { length: 16 }).default('inventory'),
  vaultArmyId:   uuid('vault_army_id'),
  assignedToDivision: uuid('assigned_to_division'),
  stats:         jsonb('stats').default({}).notNull(),
  createdAt:     timestamp('created_at').defaultNow(),
}, (table) => ({
  ownerIdx:    index('idx_items_owner').on(table.ownerId),
  locationIdx: index('idx_items_location').on(table.location),
}))

// ═══════════════════════════════════════════════
//  WARS
// ═══════════════════════════════════════════════

export const wars = pgTable('wars', {
  id:           uuid('id').primaryKey().defaultRandom(),
  attackerCode: varchar('attacker_code', { length: 4 }).references(() => countries.code),
  defenderCode: varchar('defender_code', { length: 4 }).references(() => countries.code),
  startedAt:    timestamp('started_at').defaultNow(),
  status:       varchar('status', { length: 16 }).default('active'),
}, (table) => ({
  attackerIdx: index('idx_wars_attacker').on(table.attackerCode),
  defenderIdx: index('idx_wars_defender').on(table.defenderCode),
  statusIdx: index('idx_wars_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  REGIONAL DEPOSITS
// ═══════════════════════════════════════════════

export const regionalDeposits = pgTable('regional_deposits', {
  id:           uuid('id').primaryKey().defaultRandom(),
  type:         varchar('type', { length: 16 }).notNull(),
  countryCode:  varchar('country_code', { length: 4 }).references(() => countries.code),
  bonus:        integer('bonus').default(30),
  discoveredBy: uuid('discovered_by').references(() => players.id),
  active:       boolean('active').default(false),
})

// ═══════════════════════════════════════════════
//  ARMIES (Military Forces)
// ═══════════════════════════════════════════════

export const armies = pgTable('armies', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          varchar('name', { length: 64 }).notNull(),
  countryCode:   varchar('country_code', { length: 4 }).references(() => countries.code),
  commanderId:   uuid('commander_id').references(() => players.id),
  vault:         jsonb('vault').default({ ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0 }),
  vaultEquipmentIds: jsonb('vault_equipment_ids').default([]),
  salaryPercent: numeric('salary_percent', { precision: 4, scale: 2 }).default('5.0'),
  salaryIntervalHours: integer('salary_interval_hours').default(24),
  lastSalaryAt:  timestamp('last_salary_at').defaultNow(),
  autoDefenseLimit: integer('auto_defense_limit').default(-1),
  createdAt:     timestamp('created_at').defaultNow(),
}, (table) => ({
  countryIdx: index('idx_armies_country').on(table.countryCode),
  commanderIdx: index('idx_armies_commander').on(table.commanderId),
}))

// ═══════════════════════════════════════════════
//  ARMY MEMBERS
// ═══════════════════════════════════════════════

export const armyMembers = pgTable('army_members', {
  armyId:        uuid('army_id').references(() => armies.id, { onDelete: 'cascade' }).notNull(),
  playerId:      uuid('player_id').references(() => players.id).notNull(),
  role:          varchar('role', { length: 16 }).default('private'),
  joinedAt:      timestamp('joined_at').defaultNow(),
  contributedPower: bigint('contributed_power', { mode: 'number' }).default(0),
  totalDamagePeriod: bigint('total_damage_period', { mode: 'number' }).default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.armyId, table.playerId] }),
}))

// ═══════════════════════════════════════════════
//  DIVISIONS
// ═══════════════════════════════════════════════

export const divisions = pgTable('divisions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  type:          varchar('type', { length: 32 }).notNull(),
  name:          varchar('name', { length: 64 }).notNull(),
  category:      varchar('category', { length: 8 }).notNull(),
  ownerId:       uuid('owner_id').references(() => players.id),
  countryCode:   varchar('country_code', { length: 4 }).references(() => countries.code),
  manpower:      integer('manpower').default(0),
  maxManpower:   integer('max_manpower').default(0),
  health:        integer('health').default(0),
  maxHealth:     integer('max_health').default(0),
  equipment:     jsonb('equipment').default([]),
  experience:    integer('experience').default(0),
  stance:        varchar('stance', { length: 32 }).default('unassigned'),
  autoTraining:  boolean('auto_training').default(false),
  status:        varchar('status', { length: 16 }).default('training'),
  trainingProgress: integer('training_progress').default(0),
  recoveryTicksNeeded: integer('recovery_ticks_needed').default(0),
  readyAt:       bigint('ready_at', { mode: 'number' }).default(0),
  reinforcing:   boolean('reinforcing').default(false),
  reinforceProgress: integer('reinforce_progress').default(0),
  killCount:     integer('kill_count').default(0),
  battlesSurvived: integer('battles_survived').default(0),
  starQuality:   integer('star_quality').default(1),
  statModifiers: jsonb('stat_modifiers').default({}),
}, (table) => ({
  ownerIdx: index('idx_divisions_owner').on(table.ownerId),
  countryIdx: index('idx_divisions_country').on(table.countryCode),
  statusIdx: index('idx_divisions_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  BATTLES
// ═══════════════════════════════════════════════

export const battles = pgTable('battles', {
  id:             uuid('id').primaryKey().defaultRandom(),
  attackerId:     varchar('attacker_id', { length: 4 }).references(() => countries.code),
  defenderId:     varchar('defender_id', { length: 4 }).references(() => countries.code),
  regionName:     varchar('region_name', { length: 64 }),
  status:         varchar('status', { length: 16 }).default('active'),
  round:          integer('round').default(1),
  maxRounds:      integer('max_rounds').default(3),
  attackerDamage: bigint('attacker_damage', { mode: 'number' }).default(0),
  defenderDamage: bigint('defender_damage', { mode: 'number' }).default(0),
  attackerRoundsWon: integer('attacker_rounds_won').default(0),
  defenderRoundsWon: integer('defender_rounds_won').default(0),
  startedAt:      timestamp('started_at').defaultNow(),
  finishedAt:     timestamp('finished_at'),
  winner:         varchar('winner', { length: 4 }),
  battleLog:      jsonb('battle_log').default([]),
}, (table) => ({
  attackerIdx: index('idx_battles_attacker').on(table.attackerId),
  defenderIdx: index('idx_battles_defender').on(table.defenderId),
  statusIdx: index('idx_battles_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  COMPANIES & JOBS
// ═══════════════════════════════════════════════

export const companies = pgTable('companies', {
  id:               uuid('id').primaryKey().defaultRandom(),
  type:             varchar('type', { length: 32 }).notNull(),
  ownerId:          uuid('owner_id').references(() => players.id),
  level:            integer('level').default(1),
  autoProduction:   boolean('auto_production').default(false),
  productionProgress: integer('production_progress').default(0),
  productionMax:    integer('production_max').default(100),
  location:         varchar('location', { length: 4 }).references(() => countries.code),
  disabledUntil:    timestamp('disabled_until'),
  nextMaintenanceDue: timestamp('next_maintenance_due'),
}, (table) => ({
  ownerIdx: index('idx_companies_owner').on(table.ownerId),
  locationIdx: index('idx_companies_location').on(table.location),
}))

export const jobs = pgTable('jobs', {
  id:              uuid('id').primaryKey().defaultRandom(),
  companyId:       uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employerName:    varchar('employer_name', { length: 32 }),
  companyType:     varchar('company_type', { length: 32 }),
  companyLevel:    integer('company_level').default(1),
  payPerPP:        numeric('pay_per_pp', { precision: 10, scale: 2 }).notNull(),
  productionBonus: integer('production_bonus').default(0),
  location:        varchar('location', { length: 4 }).references(() => countries.code),
  createdAt:       timestamp('created_at').defaultNow(),
})

export const companyTransactions = pgTable('company_transactions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  playerId:  uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  message:   text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
})

// ═══════════════════════════════════════════════
//  MARKET ORDERS
// ═══════════════════════════════════════════════

export const marketOrders = pgTable('market_orders', {
  id:            uuid('id').primaryKey().defaultRandom(),
  playerId:      uuid('player_id').references(() => players.id),
  type:          varchar('type', { length: 4 }).notNull(),
  itemType:      varchar('item_type', { length: 16 }).notNull(),
  resourceId:    varchar('resource_id', { length: 32 }),
  amount:        integer('amount').default(0),
  filledAmount:  integer('filled_amount').default(0),
  pricePerUnit:  numeric('price_per_unit', { precision: 14, scale: 2 }),
  totalPrice:    numeric('total_price', { precision: 14, scale: 2 }),
  equipSnapshot: jsonb('equip_snapshot'),
  divSnapshot:   jsonb('div_snapshot'),
  source:        varchar('source', { length: 16 }).default('player'),
  countryCode:   varchar('country_code', { length: 4 }),
  status:        varchar('status', { length: 16 }).default('open'),
  createdAt:     timestamp('created_at').defaultNow(),
}, (table) => ({
  playerIdx: index('idx_market_orders_player').on(table.playerId),
  itemTypeIdx: index('idx_market_orders_item_type').on(table.itemType),
  statusIdx: index('idx_market_orders_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  TRADE HISTORY
// ═══════════════════════════════════════════════

export const tradeHistory = pgTable('trade_history', {
  id:            uuid('id').primaryKey().defaultRandom(),
  resourceId:    varchar('resource_id', { length: 32 }),
  itemType:      varchar('item_type', { length: 16 }),
  buyerId:       uuid('buyer_id').references(() => players.id),
  sellerId:      uuid('seller_id').references(() => players.id),
  amount:        integer('amount'),
  pricePerUnit:  numeric('price_per_unit', { precision: 14, scale: 2 }),
  totalPrice:    numeric('total_price', { precision: 14, scale: 2 }),
  tax:           numeric('tax', { precision: 14, scale: 2 }).default('0'),
  timestamp:     timestamp('timestamp').defaultNow(),
}, (table) => ({
  buyerIdx: index('idx_trade_history_buyer').on(table.buyerId),
  sellerIdx: index('idx_trade_history_seller').on(table.sellerId),
  itemTypeIdx: index('idx_trade_history_item_type').on(table.itemType),
  timestampIdx: index('idx_trade_history_time').on(table.timestamp),
}))

// ═══════════════════════════════════════════════
//  GOVERNMENTS
// ═══════════════════════════════════════════════

export const governments = pgTable('governments', {
  countryCode:      varchar('country_code', { length: 4 }).primaryKey().references(() => countries.code),
  president:        varchar('president', { length: 32 }),
  vicePresident:    varchar('vice_president', { length: 32 }),
  defenseMinister:  varchar('defense_minister', { length: 32 }),
  ecoMinister:      varchar('eco_minister', { length: 32 }),
  taxRate:          integer('tax_rate').default(25),
  swornEnemy:       varchar('sworn_enemy', { length: 4 }),
  congress:         jsonb('congress').default([]),
  laws:             jsonb('laws').default({}),
  nuclearAuthorized: boolean('nuclear_authorized').default(false),
  elections:        jsonb('elections').default({}),
  citizenDividendPercent: integer('citizen_dividend_percent').default(0),
})

// ═══════════════════════════════════════════════
//  PRESTIGE ITEMS
// ═══════════════════════════════════════════════

export const prestigeItems = pgTable('prestige_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  ownerId:     uuid('owner_id').references(() => players.id),
  category:    varchar('category', { length: 16 }),
  subcategory: varchar('subcategory', { length: 16 }),
  equipped:    boolean('equipped').default(false),
  bonusStats:  jsonb('bonus_stats').default({}),
  craftedBy:   varchar('crafted_by', { length: 32 }),
  createdAt:   timestamp('created_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  WAR CARDS
// ═══════════════════════════════════════════════

export const warCards = pgTable('war_cards', {
  id:          uuid('id').primaryKey().defaultRandom(),
  playerId:    uuid('player_id').references(() => players.id),
  cardDefId:   varchar('card_def_id', { length: 32 }).notNull(),
  earnedAt:    timestamp('earned_at').defaultNow(),
  minted:      boolean('minted').default(false),
})

// ═══════════════════════════════════════════════
//  NEWS EVENTS
// ═══════════════════════════════════════════════

export const newsEvents = pgTable('news_events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  type:        varchar('type', { length: 32 }),
  headline:    text('headline'),
  body:        text('body'),
  countryCode: varchar('country_code', { length: 4 }),
  data:        jsonb('data').default({}),
  createdAt:   timestamp('created_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  CASINO RESULTS
// ═══════════════════════════════════════════════

export const casinoResults = pgTable('casino_results', {
  id:          uuid('id').primaryKey().defaultRandom(),
  playerId:    uuid('player_id').references(() => players.id),
  gameType:    varchar('game_type', { length: 16 }),
  betAmount:   bigint('bet_amount', { mode: 'number' }),
  payout:      bigint('payout', { mode: 'number' }),
  resultData:  jsonb('result_data'),
  createdAt:   timestamp('created_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  CASINO SESSIONS (active game state for BJ/Crash)
// ═══════════════════════════════════════════════

export const casinoSessions = pgTable('casino_sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  playerId:     uuid('player_id').references(() => players.id).notNull(),
  gameType:     varchar('game_type', { length: 16 }).notNull(),
  betAmount:    bigint('bet_amount', { mode: 'number' }).notNull(),
  gameState:    jsonb('game_state').notNull(),
  status:       varchar('status', { length: 16 }).default('active'),
  createdAt:    timestamp('created_at').defaultNow(),
}, (table) => ({
  playerIdx: index('idx_casino_sessions_player').on(table.playerId),
  statusIdx: index('idx_casino_sessions_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  BOUNTIES
// ═══════════════════════════════════════════════

export const bounties = pgTable('bounties', {
  id:          uuid('id').primaryKey().defaultRandom(),
  targetId:    uuid('target_id').references(() => players.id),
  placedBy:    uuid('placed_by').references(() => players.id),
  reward:      bigint('reward', { mode: 'number' }).notNull(),
  reason:      text('reason'),
  status:      varchar('status', { length: 16 }).default('active'),
  claimedBy:   uuid('claimed_by').references(() => players.id),
  hunters:     jsonb('hunters').default([]),
  createdAt:   timestamp('created_at').defaultNow(),
  expiresAt:   timestamp('expires_at'),
})

// ═══════════════════════════════════════════════
//  RAID EVENTS (Damage Race Boss Fights)
// ═══════════════════════════════════════════════

export const raidEvents = pgTable('raid_events', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            varchar('name', { length: 32 }).notNull(),
  rank:            varchar('rank', { length: 8 }).notNull(),   // grunt | elite | boss
  countryCode:     varchar('country_code', { length: 4 }).references(() => countries.code),
  status:          varchar('status', { length: 16 }).default('active'), // active | hunters_win | boss_survives
  baseBounty:      bigint('base_bounty', { mode: 'number' }).default(0),
  supportPool:     bigint('support_pool', { mode: 'number' }).default(0),
  totalHunterDmg:  bigint('total_hunter_dmg', { mode: 'number' }).default(0),
  totalBossDmg:    bigint('total_boss_dmg', { mode: 'number' }).default(0),
  currentTick:     integer('current_tick').default(0),
  startedAt:       timestamp('started_at').defaultNow(),
  expiresAt:       timestamp('expires_at').notNull(),
  finishedAt:      timestamp('finished_at'),
}, (table) => ({
  statusIdx: index('idx_raid_events_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  RAID PARTICIPANTS (fighter / supporter per event)
// ═══════════════════════════════════════════════

export const raidParticipants = pgTable('raid_participants', {
  id:           uuid('id').primaryKey().defaultRandom(),
  eventId:      uuid('event_id').references(() => raidEvents.id, { onDelete: 'cascade' }).notNull(),
  playerId:     uuid('player_id').references(() => players.id).notNull(),
  side:         varchar('side', { length: 10 }).notNull(), // 'fighter' | 'supporter'
  totalDmg:     bigint('total_dmg', { mode: 'number' }).default(0),
  totalFunded:  bigint('total_funded', { mode: 'number' }).default(0),
  hits:         integer('hits').default(0),
}, (table) => ({
  eventIdx:  index('idx_raid_participants_event').on(table.eventId),
  playerIdx: index('idx_raid_participants_player').on(table.playerId),
  uniqueParticipant: index('idx_raid_participants_unique').on(table.eventId, table.playerId),
}))

// ═══════════════════════════════════════════════
//  STOCK EXCHANGE
// ═══════════════════════════════════════════════

export const countryStocks = pgTable('country_stocks', {
  countryCode: varchar('country_code', { length: 4 }).primaryKey().references(() => countries.code),
  price:       numeric('price', { precision: 14, scale: 2 }).default('100'),
  openPrice:   numeric('open_price', { precision: 14, scale: 2 }).default('100'),
  high:        numeric('high', { precision: 14, scale: 2 }).default('100'),
  low:         numeric('low', { precision: 14, scale: 2 }).default('100'),
  volume:      bigint('volume', { mode: 'number' }).default(0),
  history:     jsonb('history').default([]),
})

export const stockHoldings = pgTable('stock_holdings', {
  id:          uuid('id').primaryKey().defaultRandom(),
  playerId:    uuid('player_id').references(() => players.id),
  countryCode: varchar('country_code', { length: 4 }).references(() => countries.code),
  shares:      integer('shares').notNull(),
  buyPrice:    numeric('buy_price', { precision: 14, scale: 2 }).notNull(),
  boughtAt:    timestamp('bought_at').defaultNow(),
})

export const bonds = pgTable('bonds', {
  id:           uuid('id').primaryKey().defaultRandom(),
  playerId:     uuid('player_id').references(() => players.id),
  countryCode:  varchar('country_code', { length: 4 }).references(() => countries.code),
  amount:       bigint('amount', { mode: 'number' }).notNull(),
  direction:    varchar('direction', { length: 4 }).default('up'),  // 'up' or 'down'
  openPrice:    numeric('open_price', { precision: 14, scale: 2 }), // price at bond creation
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }),
  maturityAt:   timestamp('maturity_at').notNull(),
  status:       varchar('status', { length: 16 }).default('active'),
})

// ═══════════════════════════════════════════════
//  MARKET POOLS (stock & bond liquidity pools)
// ═══════════════════════════════════════════════

export const marketPools = pgTable('market_pools', {
  id:        varchar('id', { length: 16 }).primaryKey(),       // 'global'
  stockPool: bigint('stock_pool', { mode: 'number' }).default(5_000_000),
  bondPool:  bigint('bond_pool', { mode: 'number' }).default(2_000_000),
})

// ═══════════════════════════════════════════════
//  ALLIANCES
// ═══════════════════════════════════════════════

export const alliances = pgTable('alliances', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 64 }).notNull(),
  tag:         varchar('tag', { length: 8 }),
  leaderId:    uuid('leader_id').references(() => players.id),
  treasury:    bigint('treasury', { mode: 'number' }).default(0),
  members:     jsonb('members').default([]),
  createdAt:   timestamp('created_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  MISSION BOARDS (per-country contribution board)
// ═══════════════════════════════════════════════

export const missionBoards = pgTable('mission_boards', {
  id:             uuid('id').primaryKey().defaultRandom(),
  countryCode:    varchar('country_code', { length: 4 }).references(() => countries.code).notNull(),
  operationType:  varchar('operation_type', { length: 32 }).notNull(), // which cyber op this board is for
  cycle:          integer('cycle').default(1),
  status:         varchar('status', { length: 16 }).default('filling'),  // filling | ready | expired
  slotsRequired:  integer('slots_required').default(5),
  slotsFilled:    integer('slots_filled').default(0),
  charges:        integer('charges').default(0),
  // Array of { playerId, playerName, contributedAt (ISO string) }
  contributors:   jsonb('contributors').default([]),
  createdAt:      timestamp('created_at').defaultNow(),
}, (table) => ({
  countryOpIdx: index('idx_mission_boards_country_op').on(table.countryCode, table.operationType),
  statusIdx: index('idx_mission_boards_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  CYBER OPS (launched operations from charges)
// ═══════════════════════════════════════════════

export const cyberOps = pgTable('cyber_ops', {
  id:             uuid('id').primaryKey().defaultRandom(),
  boardId:        uuid('board_id').references(() => missionBoards.id),
  operationId:    varchar('operation_id', { length: 32 }).notNull(),
  pillar:         varchar('pillar', { length: 16 }).notNull(), // espionage | sabotage | propaganda
  countryCode:    varchar('country_code', { length: 4 }).references(() => countries.code),
  launchedBy:     uuid('launched_by').references(() => players.id),
  targetCountry:  varchar('target_country', { length: 4 }),
  targetRegion:   varchar('target_region', { length: 64 }),
  targetPlayer:   varchar('target_player', { length: 32 }),
  status:         varchar('status', { length: 16 }).default('deploying'), // deploying | completed | failed | detected | expired
  result:         jsonb('result').default({}),
  deployedAt:     timestamp('deployed_at').defaultNow(),
  expiresAt:      timestamp('expires_at'),
}, (table) => ({
  countryIdx: index('idx_cyber_ops_country').on(table.countryCode),
  statusIdx: index('idx_cyber_ops_status').on(table.status),
}))

// ═══════════════════════════════════════════════
//  BREACH ATTEMPTS (puzzle minigame records)
// ═══════════════════════════════════════════════

export const breachAttempts = pgTable('breach_attempts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  cyberOpId:     uuid('cyber_op_id').references(() => cyberOps.id),
  playerId:      uuid('player_id').references(() => players.id).notNull(),
  side:          varchar('side', { length: 8 }).notNull(),  // 'attacker' or 'defender'
  gridSeed:      varchar('grid_seed', { length: 64 }).notNull(),
  gridSize:      integer('grid_size').default(6),
  moves:         jsonb('moves').default([]),       // array of { x, y, tool? }
  toolsUsed:     jsonb('tools_used').default({}),  // { scan: N, bypass: N, decrypt: N }
  integrity:     integer('integrity').default(5),
  nodesCollected: integer('nodes_collected').default(0),
  won:           boolean('won').default(false),
  completedAt:   timestamp('completed_at'),
  startedAt:     timestamp('started_at').defaultNow(),
}, (table) => ({
  opIdx: index('idx_breach_attempts_op').on(table.cyberOpId),
  playerIdx: index('idx_breach_attempts_player').on(table.playerId),
}))

// ═══════════════════════════════════════════════
//  NAVAL OPERATIONS
// ═══════════════════════════════════════════════

export const navalOperations = pgTable('naval_operations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  initiatorId:  uuid('initiator_id').references(() => players.id).notNull(),
  originRegion: varchar('origin_region', { length: 64 }).notNull(),
  targetRegion: varchar('target_region', { length: 64 }).notNull(),
  warshipId:    uuid('warship_id').notNull(),
  playersJoined: jsonb('players_joined').default([]), // array of string (playerName)
  status:       varchar('status', { length: 16 }).default('recruiting'),
  battleId:     varchar('battle_id', { length: 128 }),
  launchedAt:   timestamp('launched_at'),
  createdAt:    timestamp('created_at').defaultNow(),
})

// Keep old missions export for backward compatibility during migration
export const missions = missionBoards

// ═══════════════════════════════════════════════
//  COUNTRY RESEARCH
// ═══════════════════════════════════════════════

export const countryResearch = pgTable('country_research', {
  countryCode:      varchar('country_code', { length: 4 }).primaryKey().references(() => countries.code),
  militaryUnlocked: jsonb('military_unlocked').default([]),
  economyUnlocked:  jsonb('economy_unlocked').default([]),
  currentResearch:  jsonb('current_research').default(null),  // { key, type, startedAt, durationMs }
})

// ═══════════════════════════════════════════════
//  TRADE ROUTE STATE (server-authoritative disruption / objectives)
// ═══════════════════════════════════════════════

export const tradeRouteState = pgTable('trade_route_state', {
  routeId:          varchar('route_id', { length: 64 }).primaryKey(),
  disruptedUntil:   timestamp('disrupted_until'),
  disruptedBy:      uuid('disrupted_by').references(() => players.id),
  disruptedReason:  varchar('disrupted_reason', { length: 128 }),
  strategicTargetOf: uuid('strategic_target_of').references(() => players.id),
  partialIncomeMultiplier: numeric('partial_income_multiplier', { precision: 4, scale: 2 }).default('1.0'),
  updatedAt:        timestamp('updated_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  REGION OWNERSHIP (server-authoritative)
//  Written by region capture events, read by ley line engine.
// ═══════════════════════════════════════════════

export const regionOwnership = pgTable('region_ownership', {
  regionId:    varchar('region_id', { length: 16 }).primaryKey(),  // e.g. 'US-CA'
  countryCode: varchar('country_code', { length: 4 }).references(() => countries.code),
  allianceId:  uuid('alliance_id'),
  capturedAt:  timestamp('captured_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({
  countryIdx: index('idx_region_ownership_country').on(t.countryCode),
}))

// ═══════════════════════════════════════════════
//  LEY LINE STATE (computed per-line per engine tick)
// ═══════════════════════════════════════════════

export const leyLineState = pgTable('ley_line_state', {
  lineId:           varchar('line_id', { length: 32 }).primaryKey(),   // 'NA-PROSPERITY'
  isActive:         boolean('is_active').default(false),
  activatedAt:      timestamp('activated_at'),
  deactivatedAt:    timestamp('deactivated_at'),
  controllerType:   varchar('controller_type', { length: 16 }),        // 'country'|'alliance'|'split'
  controllerIds:    jsonb('controller_ids').default([]),                // string[]
  effectiveness:    numeric('effectiveness', { precision: 4, scale: 2 }).default('1.0'),
  appliedBonuses:   jsonb('applied_bonuses').default({}),
  appliedTradeoffs: jsonb('applied_tradeoffs').default({}),
  completionPct:    numeric('completion_pct', { precision: 5, scale: 1 }).default('0'),
  updatedAt:        timestamp('updated_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  LEY LINE NODE STATE (per-node, for fast API dot rendering)
// ═══════════════════════════════════════════════

export const leyLineNodeState = pgTable('ley_line_node_state', {
  regionId:    varchar('region_id', { length: 16 }).notNull(),
  lineId:      varchar('line_id', { length: 32 }).notNull(),
  ownerCode:   varchar('owner_code', { length: 4 }),
  isCritical:  boolean('is_critical').default(false),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.regionId, t.lineId] }),
  lineIdx: index('idx_ley_node_line').on(t.lineId),
}))

// ═══════════════════════════════════════════════
//  COUNTRY LEY LINE BUFF (merged bonus totals per country)
// ═══════════════════════════════════════════════

export const countryLeyLineBuff = pgTable('country_ley_line_buff', {
  countryCode:     varchar('country_code', { length: 4 }).primaryKey().references(() => countries.code),
  activeLineIds:   jsonb('active_line_ids').default([]),
  mergedBonuses:   jsonb('merged_bonuses').default({}),
  mergedTradeoffs: jsonb('merged_tradeoffs').default({}),
  resonanceLevel:  varchar('resonance_level', { length: 16 }),
  resonanceBonus:  jsonb('resonance_bonus').default({}),
  computedAt:      timestamp('computed_at').defaultNow(),
})

// ═══════════════════════════════════════════════
//  LEY LINE DEFINITIONS (admin-editable at runtime)
//  Replaces the hardcoded leyLineRegistry for the engine.
//  Each row is one ley line that the engine will process.
// ═══════════════════════════════════════════════

export const leyLineDefs = pgTable('ley_line_defs', {
  id:          varchar('id', { length: 32 }).primaryKey(),    // e.g. 'US-DOMINION'
  name:        varchar('name', { length: 128 }).notNull(),
  continent:   varchar('continent', { length: 32 }).notNull(), // north_america | europe | ...
  archetype:   varchar('archetype', { length: 16 }).notNull(), // dominion | prosperity | convergence
  blocks:      jsonb('blocks').notNull().default([]),           // string[] of region IDs
  bonuses:     jsonb('bonuses').notNull().default({}),          // LeyLineBonus
  tradeoffs:   jsonb('tradeoffs').notNull().default({}),        // LeyLineBonus
  enabled:     boolean('enabled').default(true),                // admin can disable without deleting
  autoGen:     boolean('auto_gen').default(false),              // was auto-generated
  countryCode: varchar('country_code', { length: 4 }),          // primary country (for auto-gen lines)
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow(),
}, (t) => ({
  continentIdx: index('idx_ley_defs_continent').on(t.continent),
  countryIdx:   index('idx_ley_defs_country').on(t.countryCode),
  archetypeIdx: index('idx_ley_defs_archetype').on(t.archetype),
  enabledIdx:   index('idx_ley_defs_enabled').on(t.enabled),
}))


