import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, ChevronRight, User, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";

export function OnboardingProgressCard() {
  const navigate = useNavigate();
  const { 
    user,
    onboardingComplete, 
    directorOnboardingComplete, 
    directorCount, 
    directorsCompleted 
  } = useAuth();

  // Don't show if everything is complete
  if (onboardingComplete && directorOnboardingComplete) {
    return null;
  }

  const totalSteps = 1 + directorCount; // 1 for business + N for directors
  const completedSteps = (onboardingComplete ? 1 : 0) + directorsCompleted;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <Card className="border-0 shadow-lg rounded-3xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-primary" />
          Complete Your Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Finish setting up your account to unlock all features including tax returns and reporting.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <Progress value={progressPercent} className="flex-1 h-2" />
          <span className="text-sm font-medium">{progressPercent}%</span>
        </div>

        <div className="space-y-3">
          {/* Business Onboarding */}
          <div className="flex items-center justify-between p-3 bg-background rounded-xl">
            <div className="flex items-center gap-3">
              {onboardingComplete ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Building2 className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">Business Setup</p>
                <p className="text-xs text-muted-foreground">
                  {onboardingComplete ? "Completed" : "Configure your business details"}
                </p>
              </div>
            </div>
            {!onboardingComplete && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => navigate("/onboarding")}
                className="rounded-full"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>

          {/* Director Onboarding */}
          {onboardingComplete && (
            <div className="flex items-center justify-between p-3 bg-background rounded-xl">
              <div className="flex items-center gap-3">
                {directorOnboardingComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <User className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">Director Details</p>
                  <p className="text-xs text-muted-foreground">
                    {directorOnboardingComplete 
                      ? "All directors completed" 
                      : `${directorsCompleted} of ${directorCount} directors completed`}
                  </p>
                </div>
              </div>
              {!directorOnboardingComplete && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => navigate("/onboarding/director")}
                  className="rounded-full"
                >
                  Continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
