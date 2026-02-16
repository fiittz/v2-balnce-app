-- User corrections: tracks when users manually recategorize transactions.
-- After 3 corrections for the same vendor pattern, auto-promotes to vendor_cache.

CREATE TABLE user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_pattern TEXT NOT NULL,
  original_category TEXT,
  corrected_category TEXT NOT NULL,
  corrected_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  corrected_vat_rate NUMERIC,
  transaction_count INTEGER DEFAULT 1,
  promoted_to_cache BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, vendor_pattern)
);

CREATE INDEX idx_user_corrections_user ON user_corrections(user_id);
CREATE INDEX idx_user_corrections_pattern ON user_corrections(vendor_pattern);

-- RLS: users can only access their own corrections.
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own corrections"
  ON user_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corrections"
  ON user_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own corrections"
  ON user_corrections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own corrections"
  ON user_corrections FOR DELETE
  USING (auth.uid() = user_id);
