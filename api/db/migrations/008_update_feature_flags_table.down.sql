-- Rollback feature_flags table changes
DROP INDEX IF EXISTS idx_feature_flags_premium;
DROP INDEX IF EXISTS idx_feature_flags_key;
DROP INDEX IF EXISTS idx_feature_flags_tier;

ALTER TABLE feature_flags
DROP CONSTRAINT IF EXISTS chk_feature_required_tier,
DROP COLUMN IF EXISTS max_usage_per_month,
DROP COLUMN IF EXISTS is_premium,
DROP COLUMN IF EXISTS required_tier,
DROP COLUMN IF EXISTS key;
