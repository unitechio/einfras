-- Add license tier support to feature_flags table
ALTER TABLE feature_flags 
ADD COLUMN IF NOT EXISTS key VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS required_tier VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_usage_per_month INTEGER DEFAULT 0;

-- Add constraint for required_tier
ALTER TABLE feature_flags
ADD CONSTRAINT chk_feature_required_tier 
CHECK (required_tier IN ('free', 'professional', 'enterprise', 'custom'));

-- Create index on required_tier for faster queries
CREATE INDEX IF NOT EXISTS idx_feature_flags_tier ON feature_flags(required_tier);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_premium ON feature_flags(is_premium);

-- Update existing records to have a key based on name (if any exist)
UPDATE feature_flags 
SET key = LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_'))
WHERE key IS NULL;
