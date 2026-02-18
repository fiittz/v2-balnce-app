/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { MOCK_USER, MOCK_SESSION, MOCK_PROFILE, isDemoMode, disableDemoMode } from "@/lib/mockData";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Record<string, unknown> | null;
  isLoading: boolean;
  onboardingComplete: boolean | null;
  directorOnboardingComplete: boolean | null;
  directorCount: number;
  directorsCompleted: number;
  signOut: () => Promise<void>;
  refreshOnboardingStatus: () => Promise<void>;
  refreshDirectorOnboardingStatus: () => void;
  setDirectorOnboardingComplete: (complete: boolean) => void;
  incrementDirectorCompleted: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [directorOnboardingComplete, setDirectorOnboardingComplete] = useState<boolean | null>(null);
  const [directorCount, setDirectorCount] = useState<number>(1);
  const [directorsCompleted, setDirectorsCompleted] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const applyDemoState = () => {
      setUser(MOCK_USER as unknown as User);
      setSession(MOCK_SESSION as unknown as Session);
      setProfile(MOCK_PROFILE);
      setOnboardingComplete(true);
      setDirectorOnboardingComplete(true);
      setDirectorCount(1);
      setDirectorsCompleted(1);
      setIsLoading(false);
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isMounted) return;

      // If a real session exists, it must take precedence over demo mode.
      if (session?.user) {
        if (isDemoMode()) disableDemoMode();
        setSession(session);
        setUser(session.user);
        fetchProfile(session.user.id);
        fetchOnboardingStatus(session.user.id);
        checkDirectorOnboarding(session.user.id);
        return;
      }

      if (isDemoMode()) {
        applyDemoState();
        return;
      }

      setIsLoading(false);
    };

    void init();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Real session always wins.
      if (nextSession?.user) {
        if (isDemoMode()) disableDemoMode();
        setSession(nextSession);
        setUser(nextSession.user);

        // CRITICAL: Defer backend calls to prevent deadlock
        setTimeout(() => {
          fetchProfile(nextSession.user.id);
          fetchOnboardingStatus(nextSession.user.id);
          checkDirectorOnboarding(nextSession.user.id);
        }, 0);
        return;
      }

      // No real session.
      if (isDemoMode()) {
        applyDemoState();
        return;
      }

      setSession(null);
      setUser(null);
      setProfile(null);
      setOnboardingComplete(null);
      setDirectorOnboardingComplete(null);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
      } else {
        // Profile doesn't exist, create one
        const { data: userData } = await supabase.auth.getUser();
        const newProfile = {
          id: userId,
          email: userData?.user?.email || null,
          business_name: null,
          business_type: null,
        };

        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.error("Error creating profile:", createError);
        } else {
          setProfile(createdProfile);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOnboardingStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      setOnboardingComplete(data?.onboarding_completed ?? false);
    } catch (error) {
      console.error("Error fetching onboarding status:", error);
      setOnboardingComplete(false);
    }
  };

  const checkDirectorOnboarding = async (userId: string) => {
    try {
      // Get director count from business onboarding (still from localStorage as it's set during business onboarding)
      const businessExtra = localStorage.getItem("business_onboarding_extra");
      let totalDirectors = 1;
      if (businessExtra) {
        const parsed = JSON.parse(businessExtra);
        totalDirectors = parsed.director_count || 1;
      }
      setDirectorCount(totalDirectors);

      // Fetch director onboarding status from Supabase
      const { data, error } = await supabase
        .from("director_onboarding")
        .select("director_number, onboarding_completed")
        .eq("user_id", userId);

      if (error) throw error;

      // Count completed director onboardings
      const completed = data?.filter((d) => d.onboarding_completed).length || 0;
      setDirectorsCompleted(completed);
      setDirectorOnboardingComplete(completed >= totalDirectors);
    } catch (error) {
      console.error("Error checking director onboarding:", error);
      setDirectorOnboardingComplete(false);
    }
  };

  const signOut = async () => {
    // Clear demo mode if active
    if (isDemoMode()) {
      disableDemoMode();
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setOnboardingComplete(null);
    setDirectorOnboardingComplete(null);
    setDirectorCount(1);
    setDirectorsCompleted(0);
  };

  const refreshOnboardingStatus = async () => {
    if (user) {
      await fetchOnboardingStatus(user.id);
      // Also refresh director onboarding status when business onboarding is refreshed
      checkDirectorOnboarding(user.id);
    }
  };

  const refreshDirectorOnboardingStatus = () => {
    if (user) {
      checkDirectorOnboarding(user.id);
    }
  };

  const updateDirectorOnboardingComplete = (complete: boolean) => {
    setDirectorOnboardingComplete(complete);
  };

  const incrementDirectorCompleted = () => {
    const newCount = directorsCompleted + 1;
    setDirectorsCompleted(newCount);
    if (newCount >= directorCount) {
      setDirectorOnboardingComplete(true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        onboardingComplete,
        directorOnboardingComplete,
        directorCount,
        directorsCompleted,
        signOut,
        refreshOnboardingStatus,
        refreshDirectorOnboardingStatus,
        setDirectorOnboardingComplete: updateDirectorOnboardingComplete,
        incrementDirectorCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Protected route wrapper
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, onboardingComplete, directorOnboardingComplete } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isOnboardingRoute = location.pathname === "/onboarding" || location.pathname === "/onboarding/director";

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
      return;
    }

    // Redirect to business onboarding if not completed
    if (!isLoading && user && onboardingComplete === false && location.pathname !== "/onboarding") {
      navigate("/onboarding");
      return;
    }

    // Redirect to director onboarding if business is done but director is not
    if (
      !isLoading &&
      user &&
      onboardingComplete === true &&
      directorOnboardingComplete === false &&
      location.pathname !== "/onboarding/director"
    ) {
      navigate("/onboarding/director");
      return;
    }
  }, [user, isLoading, onboardingComplete, directorOnboardingComplete, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="animate-pulse text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  // Don't render children until we know onboarding status (except on onboarding pages)
  if ((onboardingComplete === null || directorOnboardingComplete === null) && !isOnboardingRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="animate-pulse text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}
