import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (tokenHash && type === "recovery") {
      // Verify the token_hash directly with Supabase
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ error }) => {
        if (error) {
          console.error("OTP verification failed:", error.message);
          setHasSession(false);
        } else {
          setHasSession(true);
        }
        setChecking(false);
      });
    } else {
      // Fallback: check for PASSWORD_RECOVERY event or existing session
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setHasSession(true);
          setChecking(false);
        }
      });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setHasSession(true);
        }
        setChecking(false);
      });

      return () => subscription.unsubscribe();
    }
  }, [searchParams]);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      toast.error("Please fill in both fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated successfully!");
      navigate("/dashboard");
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(errMsg || "Failed to update password");
      setIsLoading(false);
    }
  };

  const inputClass =
    "h-14 bg-transparent border border-black/20 font-['IBM_Plex_Mono'] text-sm text-foreground placeholder:text-black/30 rounded-none";
  const labelClass = "text-foreground font-medium font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest";
  const primaryBtnClass =
    "w-full h-14 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-none mt-6 shadow-none";

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-['IBM_Plex_Sans']">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Grid background */}
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

      <div className="flex-1 flex flex-col px-6 py-8 animate-fade-in relative z-10">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <div className="flex items-center gap-3 mb-8">
            <img src="/enhance-penguin-transparent.png" alt="Balnce" className="w-10 h-10 object-contain" />
            <h1 className="text-3xl font-semibold text-foreground font-['IBM_Plex_Mono'] tracking-wide">
              Reset password
            </h1>
          </div>

          {hasSession ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReset();
              }}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="new-password" className={labelClass}>
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className={labelClass}>
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" disabled={isLoading} className={primaryBtnClass}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-muted-foreground font-['IBM_Plex_Sans'] text-sm">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={() => navigate("/")}
                className={primaryBtnClass}
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
