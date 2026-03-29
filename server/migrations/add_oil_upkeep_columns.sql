-- Add oil upkeep tracking columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS oil_starved_since TIMESTAMP;
