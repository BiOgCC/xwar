-- Add infrastructure and revolt columns to region_ownership table
-- All columns have safe defaults so existing rows are unaffected.

ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS bunker_level          INTEGER DEFAULT 0;
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS military_base_level   INTEGER DEFAULT 0;
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS port_level            INTEGER DEFAULT 0;
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS airport_level         INTEGER DEFAULT 0;
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS missile_launcher_level INTEGER DEFAULT 0;
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS infra_enabled         JSONB   DEFAULT '{"bunkerLevel":true,"militaryBaseLevel":true,"portLevel":true,"airportLevel":true,"missileLauncherLevel":true}';
ALTER TABLE region_ownership ADD COLUMN IF NOT EXISTS revolt_pressure       INTEGER DEFAULT 0;
