-- Create director_onboarding table to persist director onboarding status
CREATE TABLE IF NOT EXISTS public.director_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  director_number INTEGER NOT NULL DEFAULT 1,
  onboarding_completed BOOLEAN DEFAULT false,
  -- Key director data for Form 11
  director_name TEXT,
  pps_number TEXT,
  date_of_birth DATE,
  marital_status TEXT,
  assessment_basis TEXT,
  -- Employment info
  annual_salary NUMERIC(12,2),
  receives_dividends BOOLEAN DEFAULT false,
  estimated_dividends NUMERIC(12,2),
  -- Store full onboarding data as JSON for flexibility
  onboarding_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, director_number)
);

ALTER TABLE public.director_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own director onboarding" 
  ON public.director_onboarding FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own director onboarding" 
  ON public.director_onboarding FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own director onboarding" 
  ON public.director_onboarding FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own director onboarding" 
  ON public.director_onboarding FOR DELETE 
  USING (auth.uid() = user_id);

-- Create updated_at trigger for director_onboarding
CREATE TRIGGER update_director_onboarding_updated_at 
  BEFORE UPDATE ON public.director_onboarding 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
