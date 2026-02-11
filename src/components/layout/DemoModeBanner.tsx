import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { disableDemoMode } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";

export function DemoModeBanner() {
  const navigate = useNavigate();

  const handleExitDemo = () => {
    disableDemoMode();
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">Demo Mode</span>
        <span className="hidden sm:inline">— Data is simulated and won't be saved</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExitDemo}
        className="h-6 px-2 text-amber-950 hover:bg-amber-600 hover:text-amber-950"
      >
        <X className="w-4 h-4 mr-1" />
        Exit
      </Button>
    </div>
  );
}
