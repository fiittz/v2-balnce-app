import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import PenguinIcon from "@/components/PenguinIcon";

interface NavItem {
  path: string;
  label: string;
}

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/bank", label: "Accounts" },
    { path: "/invoices", label: "Invoices" },
    { path: "/expense", label: "Expenses" },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2.5 group"
            >
              <PenguinIcon className="w-9 h-9" />
              <span className="text-lg font-semibold text-foreground tracking-tight">
                Balnce
              </span>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems
                .map((item) => {
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/settings")}
                className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Settings
              </button>

              {/* Mobile menu button */}
              <button
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-300",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div
          className={cn(
            "absolute top-16 left-0 right-0 bg-card border-b border-border shadow-lg transition-all duration-300 ease-premium",
            mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          )}
        >
          <nav className="p-4 space-y-1">
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
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-all duration-200",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {item.label}
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform",
                      active ? "text-accent-foreground" : "text-muted-foreground"
                    )} />
                  </button>
                );
              })}

            <div className="pt-2 mt-2 border-t border-border">
              <button
                type="button"
                onClick={() => handleNavigate("/settings")}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium text-foreground hover:bg-secondary transition-all duration-200"
              >
                Settings
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" />
    </>
  );
};

export default TopNavbar;
