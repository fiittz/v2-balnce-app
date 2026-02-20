import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { posthog } from "@/lib/posthog";
import { useAuth } from "@/hooks/useAuth";

/**
 * Tracks page views on route changes and identifies the user.
 * Drop inside <BrowserRouter> + <AuthProvider>.
 */
export default function PostHogTracker() {
  const location = useLocation();
  const { user, profile } = useAuth();

  // Track page views on route change
  useEffect(() => {
    posthog.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [location.pathname, location.search]);

  // Identify user when they log in
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
        business_name: (profile?.business_name as string) || undefined,
        business_type: (profile?.business_type as string) || undefined,
      });
    } else {
      posthog.reset();
    }
  }, [user?.id, user?.email, profile?.business_name, profile?.business_type]);

  return null;
}
