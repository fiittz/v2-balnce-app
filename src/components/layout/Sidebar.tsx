import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import PenguinIcon from "@/components/PenguinIcon";
import { Button } from "@/components/ui/button";

interface NavItem {
  path: string;
  label: string;
  hidden?: boolean;
}

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: onboarding } = useOnboardingSettings();
  const [isOpen, setIsOpen] = useState(false);

  const isRctIndustry = ["construction", "forestry", "meat_processing", "carpentry_joinery", "electrical", "plumbing_heating"].includes(
    onboarding?.business_type || "",
  );
  const showRct = isRctIndustry && onboarding?.rct_registered;

  const navItems: NavItem[] = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/bank", label: "Transactions" },
    { path: "/invoices", label: "Invoices" },
    { path: "/expense", label: "Expenses" },
    { path: "/chart-of-accounts", label: "Chart of Accounts" },
    { path: "/vat", label: "VAT" },
    { path: "/rct", label: "RCT", hidden: !showRct },
    { path: "/settings", label: "Settings" },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Trigger - Always visible */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:top-6 md:left-6"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 h-full w-60 bg-background border-r border-border px-4 py-6 flex-col gap-6 z-40 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 text-lg font-semibold mt-12">
          <PenguinIcon className="w-8 h-8" />
          <span>Balnce</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 text-sm mt-6">
          {navItems
            .filter((item) => !item.hidden)
            .map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-colors",
                    active
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;