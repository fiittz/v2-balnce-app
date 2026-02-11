// Mock user and data for demo mode

export const MOCK_USER = {
  // Must be a valid UUID because many queries filter on user_id (uuid column)
  id: "00000000-0000-0000-0000-000000000123",
  email: "demo@balnce.app",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    business_name: "Demo Construction Ltd"
  }
};

export const MOCK_SESSION = {
  access_token: "demo-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "demo-refresh-token",
  user: MOCK_USER
};

export const MOCK_PROFILE = {
  id: "00000000-0000-0000-0000-000000000123",
  email: "demo@balnce.app",
  business_name: "Demo Construction Ltd",
  business_type: "construction",
  created_at: new Date().toISOString()
};

export const isDemoMode = () => {
  return localStorage.getItem('demo_mode') === 'true';
};

export const enableDemoMode = () => {
  localStorage.setItem('demo_mode', 'true');
};

export const disableDemoMode = () => {
  localStorage.removeItem('demo_mode');
};
