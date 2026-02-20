import { useEffect } from "react";
import { usePostHog } from "@posthog/react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Identifies the user in PostHog when they log in.
 * Place inside <PostHogProvider> + <AuthProvider>.
 */
export default function PostHogTracker() {
  const posthog = usePostHog();
  const { user, profile } = useAuth();

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
  }, [posthog, user?.id, user?.email, profile?.business_name, profile?.business_type]);

  return null;
}
