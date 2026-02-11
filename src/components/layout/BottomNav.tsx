import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: "/dashboard", label: "Home", icon: LayoutDashboard },
    { path: "/bank", label: "Accounts", icon: ArrowLeftRight },
    { path: "/expense", label: "Expenses", icon: Receipt },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 md:hidden z-50 safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto px-2 py-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center w-16 py-2 rounded-2xl transition-all duration-200",
                active
                  ? "bg-accent"
                  : "active:scale-95"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                active ? "text-accent-foreground" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-[10px] mt-1 font-medium transition-colors",
                active ? "text-accent-foreground" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
