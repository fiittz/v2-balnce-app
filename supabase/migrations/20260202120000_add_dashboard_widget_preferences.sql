-- Add dashboard widget preferences column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS dashboard_widget_preferences jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.dashboard_widget_preferences IS 'User dashboard widget visibility preferences. NULL = use defaults based on business type. Stored as { "widget_id": true/false }.';
