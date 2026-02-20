import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INDUSTRY_OPTIONS = [
  "Trades & Construction",
  "Construction Support & Property",
  "Transport & Logistics",
  "Retail & Wholesale",
  "Professional Services",
  "Digital & Creative",
  "Food & Hospitality",
  "Agriculture & Environmental",
  "Domestic & Local Services",
  "Education & Training",
  "Manufacturing & Production",
  "Mixed / Other",
];

const ALLOWED_EMAILS = [
  "jamie@oakmont.ie",
  "thomasvonteichman@nomadai.ie",
  "fitzgerald7071jamie@gmail.com",
  "kevin@workstuff.ai",
  "markafmoore+balnce@gmail.com",
  "brendan@coso.ai",
  "harshhc5@proton.me",
];

const isEmailAllowed = (email: string) => ALLOWED_EMAILS.some((e) => e.toLowerCase() === email.trim().toLowerCase());

type Screen = "welcome" | "login" | "signup" | "business-type" | "forgot-password";

const Welcome = () => {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [industryType, setIndustryType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }

    if (!isEmailAllowed(email)) {
      toast.error("Access is restricted. Contact hello@balnce.ie for access.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Welcome back!");

      // Navigate directly on successful login using window.location for reliability
      if (data.session) {
        window.location.href = "/dashboard";
        return; // Exit early to prevent finally from resetting loading
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(errMsg || "Failed to sign in");
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!industryType.trim()) {
      toast.error("Please enter your industry");
      return;
    }

    if (!email || !password || !businessName) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!isEmailAllowed(email)) {
      toast.error("Access is restricted. Contact hello@balnce.ie for access.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            business_name: businessName,
            business_type: industryType.trim(),
          },
        },
      });

      if (error) throw error;

      // If user was created and auto-confirmed
      if (data.user && data.session) {
        toast.success("Account created successfully!");

        // Update profile in background
        (async () => {
          try {
            await supabase
              .from("profiles")
              .update({
                business_name: businessName,
                business_type: industryType.trim(),
              })
              .eq("id", data.user!.id);
            console.log("Profile updated");
          } catch (e) {
            console.error("Profile update error:", e);
          }
        })();

        // Auth state change will trigger the useEffect redirect
      } else if (data.user && !data.session) {
        // No session means either email confirmation is required or
        // the email is already registered (Supabase hides this for security).
        // Since confirmations are disabled, this likely means existing account.
        toast.error("This email may already be registered. Try logging in instead.");
        setIsLoading(false);
      }
    } catch (error: unknown) {
      console.error("Signup error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg?.includes("already registered")) {
        toast.error("This email is already registered. Please log in instead.");
      } else {
        toast.error(errMsg || "Failed to create account");
      }
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (screen === "signup") {
      if (!email || !password || !businessName) {
        toast.error("Please fill in all fields");
        return;
      }
      if (!isEmailAllowed(email)) {
        toast.error("Access is restricted. Contact hello@balnce.ie for access.");
        return;
      }
      setScreen("business-type");
    } else if (screen === "business-type" && industryType.trim()) {
      handleSignup();
    }
  };

  // Shared style constants
  const inputClass =
    "h-14 bg-transparent border border-black/20 font-['IBM_Plex_Mono'] text-sm text-foreground placeholder:text-black/30 rounded-none";
  const labelClass = "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";
  const primaryBtnClass =
    "w-full h-14 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-none mt-6 shadow-none";

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Grid background — 60px spacing */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Orange glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
        style={{
          width: "800px",
          height: "600px",
          background: "radial-gradient(ellipse at center, rgba(232,147,12,0.06) 0%, transparent 70%)",
        }}
      />

      {screen === "welcome" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/enhance-penguin-transparent.png"
              alt="Balnce"
              className="object-contain"
              style={{ height: "clamp(4rem, 12vw, 7rem)", width: "auto" }}
            />
            <div className="inline-flex gap-[0.08em] items-center">
              {"BALNCE".split("").map((char, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden flex items-center justify-center"
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "clamp(3rem, 10vw, 6rem)",
                    width: "0.65em",
                    height: "1.05em",
                    backgroundColor: "#000",
                    color: "#fff",
                  }}
                >
                  {char}
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground text-base mb-12 font-['IBM_Plex_Sans']">Your AI accountant</p>

          <div className="w-full max-w-sm space-y-4">
            <Button
              onClick={() => setScreen("signup")}
              className="w-full h-14 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-none shadow-none"
            >
              Sign Up
            </Button>
            <Button
              onClick={() => setScreen("login")}
              variant="outline"
              className="w-full h-14 border border-black/20 bg-transparent font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-foreground hover:bg-black/5 rounded-none shadow-none"
            >
              Log In
            </Button>
          </div>
        </div>
      )}

      {screen === "login" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("welcome")}
            className="text-muted-foreground hover:text-foreground mb-8 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <img src="/enhance-penguin-transparent.png" alt="Balnce" className="w-10 h-10 object-contain" />
              <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
                Welcome back
              </h1>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className={labelClass}>
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className={labelClass}>
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" disabled={isLoading} className={primaryBtnClass}>
                {isLoading ? "Signing in..." : "Log In"}
              </Button>

              <p className="text-center">
                <button
                  type="button"
                  onClick={() => setScreen("forgot-password")}
                  className="text-muted-foreground hover:text-foreground font-['IBM_Plex_Sans'] text-sm underline transition-colors"
                >
                  Forgot password?
                </button>
              </p>

              <p className="text-center text-muted-foreground font-['IBM_Plex_Sans'] text-sm">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setScreen("signup")}
                  className="font-semibold text-foreground underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {screen === "signup" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("welcome")}
            className="text-muted-foreground hover:text-foreground mb-8 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <img src="/enhance-penguin-transparent.png" alt="Balnce" className="w-10 h-10 object-contain" />
              <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
                Create account
              </h1>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="business" className={labelClass}>
                  Business Name
                </Label>
                <Input
                  id="business"
                  type="text"
                  placeholder="Your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className={labelClass}>
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className={labelClass}>
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <Button onClick={handleContinue} className={primaryBtnClass}>
                Continue
              </Button>

              <p className="text-center text-muted-foreground font-['IBM_Plex_Sans'] text-sm">
                Already have an account?{" "}
                <button onClick={() => setScreen("login")} className="font-semibold text-foreground underline">
                  Log in
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {screen === "forgot-password" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("login")}
            className="text-muted-foreground hover:text-foreground mb-8 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <img src="/enhance-penguin-transparent.png" alt="Balnce" className="w-10 h-10 object-contain" />
              <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
                Reset password
              </h1>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email) {
                  toast.error("Please enter your email");
                  return;
                }
                setIsLoading(true);
                try {
                  await supabase.functions.invoke("send-password-reset", {
                    body: { email, origin: window.location.origin },
                  });
                } catch {
                  // Silently catch — always show success
                }
                setIsLoading(false);
                toast.success("If that email is registered, you'll receive a reset link shortly.");
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="reset-email" className={labelClass}>
                  Email
                </Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </div>

              <Button type="submit" disabled={isLoading} className={primaryBtnClass}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>

              <p className="text-center text-muted-foreground font-['IBM_Plex_Sans'] text-sm">
                Remember your password?{" "}
                <button
                  type="button"
                  onClick={() => setScreen("login")}
                  className="font-semibold text-foreground underline"
                >
                  Log in
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {screen === "business-type" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("signup")}
            className="text-muted-foreground hover:text-foreground mb-6 self-start font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <img src="/enhance-penguin-transparent.png" alt="Balnce" className="w-10 h-10 object-contain" />
              <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
                Your industry
              </h1>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="industry" className={labelClass}>
                  What type of business do you run?
                </Label>
                <Select value={industryType} onValueChange={setIndustryType}>
                  <SelectTrigger className={`${inputClass} w-full`}>
                    <SelectValue placeholder="Select your industry..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm font-['IBM_Plex_Sans']">
                  This helps us tailor your experience
                </p>
              </div>

              <Button
                onClick={handleContinue}
                disabled={!industryType.trim() || isLoading}
                className={`${primaryBtnClass} disabled:opacity-50`}
              >
                {isLoading ? "Creating account..." : "Get Started"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Welcome;
