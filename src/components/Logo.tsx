import balnceLogo from "@/assets/balnce-logo.webp";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

const Logo = ({ className = "", size = "md", showTagline = false }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-12",
    lg: "h-20",
  };

  return <img src={balnceLogo} alt="Balnce - Your Accounting" className={`${sizeClasses[size]} w-auto ${className}`} />;
};

export default Logo;
