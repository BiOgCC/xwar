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
  empire:            varchar('empire', { length: 4 }),
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
  staminaPills:  integer('stamina_pills').default(0),
  energyLeaves:  integer('energy_leaves').default(0),
  lootChancePool: integer('loot_chance_pool').default(0),

  // XP & Level
  level:         integer('level').default(1),
  experience:    integer('experience').default(0),
  expToNext:     integer('exp_to_next').default(100),
  skillPoints:   integer('skill_points').default(0),

  // Bars
  stamina:       numeric('stamina', { precision: 6, scale: 1 }).default('100'),
  maxStamina:    integer('max_stamina').default(100),
  hunger:        integer('hunger').default(5),
  maxHunger:     integer('max_hunger').default(5),
  entrepreneurship: integer('entrepreneurship').default(100),
  maxEntrepreneurship: integer('max_entrepreneurship').default(100),
  work:          integer('work').default(100),
  maxWork:       integer('max_work').default(100),
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
})

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
  playerId:     uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  militaryXp:   integer('military_xp').default(0),
  militaryTier: integer('military_tier').default(0),
  economicXp:   integer('economic_xp').default(0),
  economicTier: integer('economic_tier').default(0),
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
})

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
  createdAt:     timestamp('created_at').defaultNow(),
})

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
})

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
})

// ═══════════════════════════════════════════════
//  COMPANIES
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
})

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
})

// ═══════════════════════════════════════════════
//  GOVERNMENTS
// ═══════════════════════════════════════════════

export const governments = pgTable('governments', {
  countryCode:      varchar('country_code', { length: 4 }).primaryKey().references(() => countries.code),
  president:        varchar('president', { length: 32 }),
  taxRate:          integer('tax_rate').default(25),
  swornEnemy:       varchar('sworn_enemy', { length: 4 }),
  congress:         jsonb('congress').default([]),
  laws:             jsonb('laws').default({}),
  nuclearAuthorized: boolean('nuclear_authorized').default(false),
  elections:        jsonb('elections').default({}),
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
  createdAt:   timestamp('created_at').defaultNow(),
})

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
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }),
  maturityAt:   timestamp('maturity_at').notNull(),
  status:       varchar('status', { length: 16 }).default('active'),
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
//  MISSIONS
// ═══════════════════════════════════════════════

export const missions = pgTable('missions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  operationId:       varchar('operation_id', { length: 32 }),
  operationType:     varchar('operation_type', { length: 16 }),
  countryCode:       varchar('country_code', { length: 4 }).references(() => countries.code),
  startedBy:         uuid('started_by').references(() => players.id),
  requiredResources: jsonb('required_resources').notNull(),
  contributedResources: jsonb('contributed_resources').default({}),
  contributors:      jsonb('contributors').default({}),
  status:            varchar('status', { length: 16 }).default('active'),
  startedAt:         timestamp('started_at').defaultNow(),
  expiresAt:         timestamp('expires_at').notNull(),
})
