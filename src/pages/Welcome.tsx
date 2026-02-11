import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PenguinIcon from "@/components/PenguinIcon";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enableDemoMode } from "@/lib/mockData";

type Screen = "welcome" | "login" | "signup" | "business-type";

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
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
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
                business_type: industryType.trim() 
              })
              .eq("id", data.user!.id);
            console.log("Profile updated");
          } catch (e) {
            console.error("Profile update error:", e);
          }
        })();
        
        // Auth state change will trigger the useEffect redirect
      } else if (data.user && !data.session) {
        // Email confirmation required
        toast.success("Check your email to confirm your account!");
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.message?.includes("already registered")) {
        toast.error("This email is already registered. Please log in instead.");
      } else {
        toast.error(error.message || "Failed to create account");
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
      setScreen("business-type");
    } else if (screen === "business-type" && industryType.trim()) {
      handleSignup();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      {/* Golden glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
        style={{
          width: "800px",
          height: "600px",
          background: "radial-gradient(ellipse at center, rgba(252,202,70,0.08) 0%, transparent 70%)",
        }}
      />

      {screen === "welcome" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 animate-fade-in relative z-10">
          <div className="mb-8">
            <PenguinIcon className="w-24 h-24 text-foreground drop-shadow-lg" />
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight mb-4">BALNCE</h1>
          <p className="text-muted-foreground text-xl mb-12">Your Accounting</p>

          <div className="w-full max-w-sm space-y-4">
            <Button
              onClick={() => setScreen("signup")}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-semibold rounded-full shadow-sm"
            >
              Sign Up
            </Button>
            <Button
              onClick={() => setScreen("login")}
              variant="outline"
              className="w-full h-14 bg-card border border-border text-foreground hover:bg-secondary text-lg font-semibold rounded-full"
            >
              Log In
            </Button>
            <Button
              onClick={() => {
                enableDemoMode();
                toast.success("Demo mode activated!");
                navigate("/dashboard");
              }}
              variant="ghost"
              className="w-full h-12 text-muted-foreground hover:text-foreground hover:bg-secondary text-base font-medium rounded-full flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Try Demo
            </Button>
          </div>
        </div>
      )}

      {screen === "login" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("welcome")}
            className="text-muted-foreground hover:text-foreground mb-8 self-start font-medium transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <PenguinIcon className="w-10 h-10 text-foreground" />
              <h1 className="text-3xl font-bold text-foreground">Welcome back</h1>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 bg-[#FCCA46] text-black hover:bg-[#FCCA46]/90 text-lg font-semibold rounded-full mt-6 shadow-sm"
              >
                {isLoading ? "Signing in..." : "Log In"}
              </Button>

              <p className="text-center text-muted-foreground">
                Don't have an account?{" "}
                <button type="button" onClick={() => setScreen("signup")} className="font-semibold text-foreground underline">
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
            className="text-muted-foreground hover:text-foreground mb-8 self-start font-medium transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <PenguinIcon className="w-10 h-10 text-foreground" />
              <h1 className="text-3xl font-bold text-foreground">Create account</h1>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="business" className="text-foreground font-medium">Business Name</Label>
                <Input
                  id="business"
                  type="text"
                  placeholder="Your business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-foreground font-medium">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-foreground font-medium">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                />
              </div>

              <Button
                onClick={handleContinue}
                className="w-full h-14 bg-[#FCCA46] text-black hover:bg-[#FCCA46]/90 text-lg font-semibold rounded-full mt-6 shadow-sm"
              >
                Continue
              </Button>

              <p className="text-center text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => setScreen("login")} className="font-semibold text-foreground underline">
                  Log in
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {screen === "business-type" && (
        <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
          <button
            onClick={() => setScreen("signup")}
            className="text-muted-foreground hover:text-foreground mb-6 self-start font-medium transition-colors"
          >
            ← Back
          </button>

          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="flex items-center gap-3 mb-8">
              <PenguinIcon className="w-10 h-10 text-foreground" />
              <h1 className="text-3xl font-bold text-foreground">Your industry</h1>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-foreground font-medium">What type of business do you run?</Label>
                <Input
                  id="industry"
                  type="text"
                  placeholder="e.g. Construction, Retail, Consulting..."
                  value={industryType}
                  onChange={(e) => setIndustryType(e.target.value)}
                  className="h-14 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-lg text-lg"
                  autoFocus
                />
                <p className="text-muted-foreground text-sm">This helps us tailor your experience</p>
              </div>

              <Button
                onClick={handleContinue}
                disabled={!industryType.trim() || isLoading}
                className="w-full h-14 bg-[#FCCA46] text-black hover:bg-[#FCCA46]/90 text-lg font-semibold rounded-full disabled:opacity-50 mt-6 shadow-sm"
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