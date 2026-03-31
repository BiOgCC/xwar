-- Add cooldown timestamp for country switching
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_country_switch_at TIMESTAMP;
