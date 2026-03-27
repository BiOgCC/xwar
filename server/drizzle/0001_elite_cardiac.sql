CREATE TABLE IF NOT EXISTS "ley_line_defs" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"continent" varchar(32) NOT NULL,
	"archetype" varchar(16) NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bonuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tradeoffs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true,
	"auto_gen" boolean DEFAULT false,
	"country_code" varchar(4),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_pools" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"stock_pool" bigint DEFAULT 5000000,
	"bond_pool" bigint DEFAULT 2000000
);
--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "vice_president" varchar(32);--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "defense_minister" varchar(32);--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "eco_minister" varchar(32);--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "enrichment_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "enrichment_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "governments" ADD COLUMN "citizen_dividend_percent" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ley_defs_continent" ON "ley_line_defs" USING btree ("continent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ley_defs_country" ON "ley_line_defs" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ley_defs_archetype" ON "ley_line_defs" USING btree ("archetype");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ley_defs_enabled" ON "ley_line_defs" USING btree ("enabled");