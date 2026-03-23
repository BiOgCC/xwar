CREATE TABLE IF NOT EXISTS "alliances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"tag" varchar(8),
	"leader_id" uuid,
	"treasury" bigint DEFAULT 0,
	"members" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "armies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"country_code" varchar(4),
	"commander_id" uuid,
	"vault" jsonb DEFAULT '{"ammo":0,"jets":0,"tanks":0,"oil":0,"money":0}'::jsonb,
	"vault_equipment_ids" jsonb DEFAULT '[]'::jsonb,
	"salary_percent" numeric(4, 2) DEFAULT '5.0',
	"salary_interval_hours" integer DEFAULT 24,
	"last_salary_at" timestamp DEFAULT now(),
	"auto_defense_limit" integer DEFAULT -1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "army_members" (
	"army_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" varchar(16) DEFAULT 'private',
	"joined_at" timestamp DEFAULT now(),
	"contributed_power" bigint DEFAULT 0,
	"total_damage_period" bigint DEFAULT 0,
	CONSTRAINT "army_members_army_id_player_id_pk" PRIMARY KEY("army_id","player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attacker_id" varchar(4),
	"defender_id" varchar(4),
	"region_name" varchar(64),
	"status" varchar(16) DEFAULT 'active',
	"round" integer DEFAULT 1,
	"max_rounds" integer DEFAULT 3,
	"attacker_damage" bigint DEFAULT 0,
	"defender_damage" bigint DEFAULT 0,
	"attacker_rounds_won" integer DEFAULT 0,
	"defender_rounds_won" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"finished_at" timestamp,
	"winner" varchar(4),
	"battle_log" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bonds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"country_code" varchar(4),
	"amount" bigint NOT NULL,
	"direction" varchar(4) DEFAULT 'up',
	"open_price" numeric(14, 2),
	"interest_rate" numeric(5, 2),
	"maturity_at" timestamp NOT NULL,
	"status" varchar(16) DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid,
	"placed_by" uuid,
	"reward" bigint NOT NULL,
	"reason" text,
	"status" varchar(16) DEFAULT 'active',
	"claimed_by" uuid,
	"hunters" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "breach_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cyber_op_id" uuid,
	"player_id" uuid NOT NULL,
	"side" varchar(8) NOT NULL,
	"grid_seed" varchar(64) NOT NULL,
	"grid_size" integer DEFAULT 6,
	"moves" jsonb DEFAULT '[]'::jsonb,
	"tools_used" jsonb DEFAULT '{}'::jsonb,
	"integrity" integer DEFAULT 5,
	"nodes_collected" integer DEFAULT 0,
	"won" boolean DEFAULT false,
	"completed_at" timestamp,
	"started_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "casino_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"game_type" varchar(16),
	"bet_amount" bigint,
	"payout" bigint,
	"result_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "casino_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"game_type" varchar(16) NOT NULL,
	"bet_amount" bigint NOT NULL,
	"game_state" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"owner_id" uuid,
	"level" integer DEFAULT 1,
	"auto_production" boolean DEFAULT false,
	"production_progress" integer DEFAULT 0,
	"production_max" integer DEFAULT 100,
	"location" varchar(4),
	"disabled_until" timestamp,
	"next_maintenance_due" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"company_id" uuid,
	"message" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "countries" (
	"code" varchar(4) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"controller" varchar(64),
	"empire" varchar(32),
	"population" integer DEFAULT 0,
	"regions" integer DEFAULT 0,
	"military" integer DEFAULT 0,
	"color" varchar(16),
	"port_level" integer DEFAULT 1,
	"airport_level" integer DEFAULT 1,
	"bunker_level" integer DEFAULT 1,
	"military_base_level" integer DEFAULT 1,
	"has_port" boolean DEFAULT true,
	"has_airport" boolean DEFAULT true,
	"tax_exempt" boolean DEFAULT false,
	"fund" jsonb DEFAULT '{"money":0,"oil":0,"scraps":0,"materialX":0,"bitcoin":0,"jets":0}'::jsonb,
	"force_vault" jsonb DEFAULT '{"money":0,"oil":0,"scraps":0,"materialX":0,"bitcoin":0,"jets":0}'::jsonb,
	"auto_defense_limit" integer DEFAULT -1,
	"conquered_resources" jsonb DEFAULT '[]'::jsonb,
	"active_deposit_bonus" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country_ley_line_buff" (
	"country_code" varchar(4) PRIMARY KEY NOT NULL,
	"active_line_ids" jsonb DEFAULT '[]'::jsonb,
	"merged_bonuses" jsonb DEFAULT '{}'::jsonb,
	"merged_tradeoffs" jsonb DEFAULT '{}'::jsonb,
	"resonance_level" varchar(16),
	"resonance_bonus" jsonb DEFAULT '{}'::jsonb,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country_research" (
	"country_code" varchar(4) PRIMARY KEY NOT NULL,
	"military_unlocked" jsonb DEFAULT '[]'::jsonb,
	"economy_unlocked" jsonb DEFAULT '[]'::jsonb,
	"current_research" jsonb DEFAULT 'null'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country_stocks" (
	"country_code" varchar(4) PRIMARY KEY NOT NULL,
	"price" numeric(14, 2) DEFAULT '100',
	"open_price" numeric(14, 2) DEFAULT '100',
	"high" numeric(14, 2) DEFAULT '100',
	"low" numeric(14, 2) DEFAULT '100',
	"volume" bigint DEFAULT 0,
	"history" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cyber_ops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid,
	"operation_id" varchar(32) NOT NULL,
	"pillar" varchar(16) NOT NULL,
	"country_code" varchar(4),
	"launched_by" uuid,
	"target_country" varchar(4),
	"target_region" varchar(64),
	"target_player" varchar(32),
	"status" varchar(16) DEFAULT 'deploying',
	"result" jsonb DEFAULT '{}'::jsonb,
	"deployed_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"login_streak" integer DEFAULT 0,
	"last_claimed_at" timestamp,
	CONSTRAINT "daily_rewards_player_id_unique" UNIQUE("player_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"category" varchar(8) NOT NULL,
	"owner_id" uuid,
	"country_code" varchar(4),
	"manpower" integer DEFAULT 0,
	"max_manpower" integer DEFAULT 0,
	"health" integer DEFAULT 0,
	"max_health" integer DEFAULT 0,
	"equipment" jsonb DEFAULT '[]'::jsonb,
	"experience" integer DEFAULT 0,
	"stance" varchar(32) DEFAULT 'unassigned',
	"auto_training" boolean DEFAULT false,
	"status" varchar(16) DEFAULT 'training',
	"training_progress" integer DEFAULT 0,
	"recovery_ticks_needed" integer DEFAULT 0,
	"ready_at" bigint DEFAULT 0,
	"reinforcing" boolean DEFAULT false,
	"reinforce_progress" integer DEFAULT 0,
	"kill_count" integer DEFAULT 0,
	"battles_survived" integer DEFAULT 0,
	"star_quality" integer DEFAULT 1,
	"stat_modifiers" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "governments" (
	"country_code" varchar(4) PRIMARY KEY NOT NULL,
	"president" varchar(32),
	"tax_rate" integer DEFAULT 25,
	"sworn_enemy" varchar(4),
	"congress" jsonb DEFAULT '[]'::jsonb,
	"laws" jsonb DEFAULT '{}'::jsonb,
	"nuclear_authorized" boolean DEFAULT false,
	"elections" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"slot" varchar(16) NOT NULL,
	"category" varchar(16) NOT NULL,
	"tier" varchar(4) NOT NULL,
	"equipped" boolean DEFAULT false,
	"durability" numeric(5, 1) DEFAULT '100',
	"weapon_subtype" varchar(16),
	"location" varchar(16) DEFAULT 'inventory',
	"vault_army_id" uuid,
	"assigned_to_division" uuid,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employer_name" varchar(32),
	"company_type" varchar(32),
	"company_level" integer DEFAULT 1,
	"pay_per_pp" numeric(10, 2) NOT NULL,
	"production_bonus" integer DEFAULT 0,
	"location" varchar(4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ley_line_node_state" (
	"region_id" varchar(16) NOT NULL,
	"line_id" varchar(32) NOT NULL,
	"owner_code" varchar(4),
	"is_critical" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ley_line_node_state_region_id_line_id_pk" PRIMARY KEY("region_id","line_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ley_line_state" (
	"line_id" varchar(32) PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT false,
	"activated_at" timestamp,
	"deactivated_at" timestamp,
	"controller_type" varchar(16),
	"controller_ids" jsonb DEFAULT '[]'::jsonb,
	"effectiveness" numeric(4, 2) DEFAULT '1.0',
	"applied_bonuses" jsonb DEFAULT '{}'::jsonb,
	"applied_tradeoffs" jsonb DEFAULT '{}'::jsonb,
	"completion_pct" numeric(5, 1) DEFAULT '0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"type" varchar(4) NOT NULL,
	"item_type" varchar(16) NOT NULL,
	"resource_id" varchar(32),
	"amount" integer DEFAULT 0,
	"filled_amount" integer DEFAULT 0,
	"price_per_unit" numeric(14, 2),
	"total_price" numeric(14, 2),
	"equip_snapshot" jsonb,
	"div_snapshot" jsonb,
	"source" varchar(16) DEFAULT 'player',
	"country_code" varchar(4),
	"status" varchar(16) DEFAULT 'open',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mission_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(4) NOT NULL,
	"operation_type" varchar(32) NOT NULL,
	"cycle" integer DEFAULT 1,
	"status" varchar(16) DEFAULT 'filling',
	"slots_required" integer DEFAULT 5,
	"slots_filled" integer DEFAULT 0,
	"charges" integer DEFAULT 0,
	"contributors" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "naval_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiator_id" uuid NOT NULL,
	"origin_region" varchar(64) NOT NULL,
	"target_region" varchar(64) NOT NULL,
	"warship_id" uuid NOT NULL,
	"players_joined" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(16) DEFAULT 'recruiting',
	"battle_id" varchar(128),
	"launched_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(32),
	"headline" text,
	"body" text,
	"country_code" varchar(4),
	"data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_skills" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"attack" integer DEFAULT 0,
	"crit_rate" integer DEFAULT 0,
	"crit_damage" integer DEFAULT 0,
	"armor" integer DEFAULT 0,
	"dodge" integer DEFAULT 0,
	"precision_" integer DEFAULT 0,
	"work" integer DEFAULT 0,
	"entrepreneurship" integer DEFAULT 0,
	"production" integer DEFAULT 0,
	"prospection" integer DEFAULT 0,
	"industrialist" integer DEFAULT 0,
	"trade" integer DEFAULT 0,
	"investor" integer DEFAULT 0,
	"espionage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_specialization" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"military_xp" integer DEFAULT 0,
	"military_tier" integer DEFAULT 0,
	"economic_xp" integer DEFAULT 0,
	"economic_tier" integer DEFAULT 0,
	"politician_xp" integer DEFAULT 0,
	"politician_tier" integer DEFAULT 0,
	"mercenary_xp" integer DEFAULT 0,
	"mercenary_tier" integer DEFAULT 0,
	"influencer_xp" integer DEFAULT 0,
	"influencer_tier" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(32) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(16) DEFAULT 'military',
	"rank" numeric(6, 1) DEFAULT '1',
	"country_code" varchar(4),
	"avatar" text DEFAULT '/assets/avatars/avatar_male.png',
	"enlisted_army_id" uuid,
	"equipped_ammo" varchar(8) DEFAULT 'none',
	"money" bigint DEFAULT 0,
	"wheat" integer DEFAULT 0,
	"fish" integer DEFAULT 0,
	"steak" integer DEFAULT 0,
	"bread" integer DEFAULT 0,
	"sushi" integer DEFAULT 0,
	"wagyu" integer DEFAULT 0,
	"green_bullets" integer DEFAULT 0,
	"blue_bullets" integer DEFAULT 0,
	"purple_bullets" integer DEFAULT 0,
	"red_bullets" integer DEFAULT 0,
	"oil" bigint DEFAULT 0,
	"material_x" bigint DEFAULT 0,
	"scrap" bigint DEFAULT 0,
	"bitcoin" integer DEFAULT 0,
	"loot_boxes" integer DEFAULT 0,
	"military_boxes" integer DEFAULT 0,
	"stamina_pills" integer DEFAULT 0,
	"energy_leaves" integer DEFAULT 0,
	"badges_of_honor" integer DEFAULT 0,
	"loot_chance_pool" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"experience" integer DEFAULT 0,
	"exp_to_next" integer DEFAULT 100,
	"skill_points" integer DEFAULT 0,
	"stamina" numeric(6, 1) DEFAULT '120',
	"max_stamina" integer DEFAULT 120,
	"hunger" integer DEFAULT 6,
	"max_hunger" integer DEFAULT 6,
	"entrepreneurship" integer DEFAULT 120,
	"max_entrepreneurship" integer DEFAULT 120,
	"work" integer DEFAULT 120,
	"max_work" integer DEFAULT 120,
	"production_bar" integer DEFAULT 0,
	"production_bar_max" integer DEFAULT 100,
	"damage_done" bigint DEFAULT 0,
	"items_produced" integer DEFAULT 0,
	"hero_buff_ticks" integer DEFAULT 0,
	"hero_buff_battle_id" uuid,
	"mute_count" integer DEFAULT 0,
	"death_count" integer DEFAULT 0,
	"battles_lost" integer DEFAULT 0,
	"total_casino_losses" bigint DEFAULT 0,
	"bankruptcy_count" integer DEFAULT 0,
	"country_switches" integer DEFAULT 0,
	"casino_spins" integer DEFAULT 0,
	"items_destroyed" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"last_login" timestamp DEFAULT now(),
	"last_reward_claimed" timestamp,
	"login_streak" integer DEFAULT 0,
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prestige_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"category" varchar(16),
	"subcategory" varchar(16),
	"equipped" boolean DEFAULT false,
	"bonus_stats" jsonb DEFAULT '{}'::jsonb,
	"crafted_by" varchar(32),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raid_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(32) NOT NULL,
	"rank" varchar(8) NOT NULL,
	"country_code" varchar(4),
	"status" varchar(16) DEFAULT 'active',
	"base_bounty" bigint DEFAULT 0,
	"support_pool" bigint DEFAULT 0,
	"total_hunter_dmg" bigint DEFAULT 0,
	"total_boss_dmg" bigint DEFAULT 0,
	"current_tick" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raid_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side" varchar(10) NOT NULL,
	"total_dmg" bigint DEFAULT 0,
	"total_funded" bigint DEFAULT 0,
	"hits" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "region_ownership" (
	"region_id" varchar(16) PRIMARY KEY NOT NULL,
	"country_code" varchar(4),
	"alliance_id" uuid,
	"captured_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(16) NOT NULL,
	"country_code" varchar(4),
	"bonus" integer DEFAULT 30,
	"discovered_by" uuid,
	"active" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"country_code" varchar(4),
	"shares" integer NOT NULL,
	"buy_price" numeric(14, 2) NOT NULL,
	"bought_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" varchar(32),
	"item_type" varchar(16),
	"buyer_id" uuid,
	"seller_id" uuid,
	"amount" integer,
	"price_per_unit" numeric(14, 2),
	"total_price" numeric(14, 2),
	"tax" numeric(14, 2) DEFAULT '0',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_route_state" (
	"route_id" varchar(64) PRIMARY KEY NOT NULL,
	"disrupted_until" timestamp,
	"disrupted_by" uuid,
	"disrupted_reason" varchar(128),
	"strategic_target_of" uuid,
	"partial_income_multiplier" numeric(4, 2) DEFAULT '1.0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "war_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid,
	"card_def_id" varchar(32) NOT NULL,
	"earned_at" timestamp DEFAULT now(),
	"minted" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attacker_code" varchar(4),
	"defender_code" varchar(4),
	"started_at" timestamp DEFAULT now(),
	"status" varchar(16) DEFAULT 'active'
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alliances" ADD CONSTRAINT "alliances_leader_id_players_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "armies" ADD CONSTRAINT "armies_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "armies" ADD CONSTRAINT "armies_commander_id_players_id_fk" FOREIGN KEY ("commander_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_members" ADD CONSTRAINT "army_members_army_id_armies_id_fk" FOREIGN KEY ("army_id") REFERENCES "public"."armies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "army_members" ADD CONSTRAINT "army_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_attacker_id_countries_code_fk" FOREIGN KEY ("attacker_id") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_defender_id_countries_code_fk" FOREIGN KEY ("defender_id") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bonds" ADD CONSTRAINT "bonds_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bonds" ADD CONSTRAINT "bonds_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounties" ADD CONSTRAINT "bounties_target_id_players_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounties" ADD CONSTRAINT "bounties_placed_by_players_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bounties" ADD CONSTRAINT "bounties_claimed_by_players_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "breach_attempts" ADD CONSTRAINT "breach_attempts_cyber_op_id_cyber_ops_id_fk" FOREIGN KEY ("cyber_op_id") REFERENCES "public"."cyber_ops"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "breach_attempts" ADD CONSTRAINT "breach_attempts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "casino_results" ADD CONSTRAINT "casino_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "casino_sessions" ADD CONSTRAINT "casino_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_location_countries_code_fk" FOREIGN KEY ("location") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_transactions" ADD CONSTRAINT "company_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country_ley_line_buff" ADD CONSTRAINT "country_ley_line_buff_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country_research" ADD CONSTRAINT "country_research_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "country_stocks" ADD CONSTRAINT "country_stocks_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cyber_ops" ADD CONSTRAINT "cyber_ops_board_id_mission_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."mission_boards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cyber_ops" ADD CONSTRAINT "cyber_ops_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cyber_ops" ADD CONSTRAINT "cyber_ops_launched_by_players_id_fk" FOREIGN KEY ("launched_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_rewards" ADD CONSTRAINT "daily_rewards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "divisions" ADD CONSTRAINT "divisions_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "divisions" ADD CONSTRAINT "divisions_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "governments" ADD CONSTRAINT "governments_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_location_countries_code_fk" FOREIGN KEY ("location") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mission_boards" ADD CONSTRAINT "mission_boards_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "naval_operations" ADD CONSTRAINT "naval_operations_initiator_id_players_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_specialization" ADD CONSTRAINT "player_specialization_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "players" ADD CONSTRAINT "players_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prestige_items" ADD CONSTRAINT "prestige_items_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raid_events" ADD CONSTRAINT "raid_events_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raid_participants" ADD CONSTRAINT "raid_participants_event_id_raid_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."raid_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "raid_participants" ADD CONSTRAINT "raid_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "region_ownership" ADD CONSTRAINT "region_ownership_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regional_deposits" ADD CONSTRAINT "regional_deposits_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regional_deposits" ADD CONSTRAINT "regional_deposits_discovered_by_players_id_fk" FOREIGN KEY ("discovered_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_holdings" ADD CONSTRAINT "stock_holdings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_holdings" ADD CONSTRAINT "stock_holdings_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_history" ADD CONSTRAINT "trade_history_buyer_id_players_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_history" ADD CONSTRAINT "trade_history_seller_id_players_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_route_state" ADD CONSTRAINT "trade_route_state_disrupted_by_players_id_fk" FOREIGN KEY ("disrupted_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trade_route_state" ADD CONSTRAINT "trade_route_state_strategic_target_of_players_id_fk" FOREIGN KEY ("strategic_target_of") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "war_cards" ADD CONSTRAINT "war_cards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wars" ADD CONSTRAINT "wars_attacker_code_countries_code_fk" FOREIGN KEY ("attacker_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wars" ADD CONSTRAINT "wars_defender_code_countries_code_fk" FOREIGN KEY ("defender_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_armies_country" ON "armies" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_armies_commander" ON "armies" USING btree ("commander_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_battles_attacker" ON "battles" USING btree ("attacker_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_battles_defender" ON "battles" USING btree ("defender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_battles_status" ON "battles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_breach_attempts_op" ON "breach_attempts" USING btree ("cyber_op_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_breach_attempts_player" ON "breach_attempts" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_casino_sessions_player" ON "casino_sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_casino_sessions_status" ON "casino_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_owner" ON "companies" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_companies_location" ON "companies" USING btree ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cyber_ops_country" ON "cyber_ops" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cyber_ops_status" ON "cyber_ops" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_divisions_owner" ON "divisions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_divisions_country" ON "divisions" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_divisions_status" ON "divisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_owner" ON "items" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_items_location" ON "items" USING btree ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ley_node_line" ON "ley_line_node_state" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_orders_player" ON "market_orders" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_orders_item_type" ON "market_orders" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_market_orders_status" ON "market_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mission_boards_country_op" ON "mission_boards" USING btree ("country_code","operation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_mission_boards_status" ON "mission_boards" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_country" ON "players" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_army" ON "players" USING btree ("enlisted_army_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_players_role" ON "players" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_events_status" ON "raid_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_participants_event" ON "raid_participants" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_participants_player" ON "raid_participants" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_raid_participants_unique" ON "raid_participants" USING btree ("event_id","player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_region_ownership_country" ON "region_ownership" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_history_buyer" ON "trade_history" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_history_seller" ON "trade_history" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_history_item_type" ON "trade_history" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trade_history_time" ON "trade_history" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wars_attacker" ON "wars" USING btree ("attacker_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wars_defender" ON "wars" USING btree ("defender_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wars_status" ON "wars" USING btree ("status");