-- Phase 5: Cross-user vendor aggregates for improved categorization confidence.
-- Anonymized patterns — no user IDs or raw descriptions stored.
-- Minimum 3 users before aggregation is visible (privacy).

CREATE TABLE IF NOT EXISTS vendor_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_pattern TEXT NOT NULL UNIQUE,
  top_category TEXT NOT NULL,
  top_category_percentage NUMERIC(5,2),
  total_users INTEGER DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  last_aggregated TIMESTAMPTZ DEFAULT now()
);

-- Index for lookups during autoCategorise
CREATE INDEX IF NOT EXISTS idx_vendor_aggregates_pattern ON vendor_aggregates(vendor_pattern);

-- RLS: vendor_aggregates is read-only for authenticated users (no user_id column).
-- Only the aggregate edge function (service role) can write.
ALTER TABLE vendor_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendor aggregates"
  ON vendor_aggregates FOR SELECT
  TO authenticated
  USING (true);

-- PostgreSQL function to aggregate vendor categories across all users.
-- Called by scheduled edge function. Privacy: only includes vendors with >= 3 distinct users.
CREATE OR REPLACE FUNCTION aggregate_vendor_categories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Truncate and rebuild — small table, fast operation
  TRUNCATE vendor_aggregates;

  INSERT INTO vendor_aggregates (vendor_pattern, top_category, top_category_percentage, total_users, total_transactions, last_aggregated)
  SELECT
    vc.vendor_pattern,
    mode() WITHIN GROUP (ORDER BY vc.category) AS top_category,
    ROUND(
      COUNT(*) FILTER (WHERE vc.category = mode() WITHIN GROUP (ORDER BY vc.category))::NUMERIC
      / NULLIF(COUNT(*)::NUMERIC, 0) * 100,
      2
    ) AS top_category_percentage,
    COUNT(DISTINCT vc.user_id) AS total_users,
    SUM(COALESCE(vc.hit_count, 1)) AS total_transactions,
    now() AS last_aggregated
  FROM vendor_cache vc
  WHERE vc.user_id IS NOT NULL
  GROUP BY vc.vendor_pattern
  HAVING COUNT(DISTINCT vc.user_id) >= 3;
END;
$$;
