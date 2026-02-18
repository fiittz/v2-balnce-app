import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  rightContent?: ReactNode;
}

const PageHeader = ({ title, subtitle, showBack = false, backPath = "/dashboard", rightContent }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="bg-background px-6 py-4 card-shadow sticky top-0 z-10">
      <div className="flex items-center justify-between">
        {/* Left side - back button or spacer for hamburger */}
        <div className="w-24 flex items-center">
          {showBack && (
            <button onClick={() => navigate(backPath)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Center - title */}
        <div className="flex-1 text-center">
          <h1 className="font-semibold text-xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Right side - action buttons */}
        <div className="w-24 flex items-center justify-end">{rightContent}</div>
      </div>
    </header>
  );
};

export default PageHeader;
