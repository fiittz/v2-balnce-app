-- Vendor cache: stores vendor categorisation results for fast lookup.
-- Entries can be per-user (user_id set) or global (user_id NULL).
-- Sources: 'rule' (seeded from vendorDatabase), 'ai' (AI lookup), 'user' (manual corrections), 'cross_user' (aggregate).

CREATE TABLE vendor_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  vat_type TEXT NOT NULL,
  vat_deductible BOOLEAN NOT NULL DEFAULT true,
  business_purpose TEXT,
  confidence INTEGER NOT NULL DEFAULT 80,
  source TEXT NOT NULL DEFAULT 'rule',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mcc_code INTEGER,
  sector TEXT,
  hit_count INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_pattern, user_id)
);

-- Index for fast user lookups
CREATE INDEX idx_vendor_cache_user ON vendor_cache(user_id);
CREATE INDEX idx_vendor_cache_pattern ON vendor_cache(vendor_pattern);

-- RLS: users can read global entries (user_id IS NULL) and their own entries.
ALTER TABLE vendor_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read global vendor cache"
  ON vendor_cache FOR SELECT
  USING (user_id IS NULL);

CREATE POLICY "Users can read own vendor cache"
  ON vendor_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vendor cache"
  ON vendor_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vendor cache"
  ON vendor_cache FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vendor cache"
  ON vendor_cache FOR DELETE
  USING (auth.uid() = user_id);
