import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "small" | "medium" | "large";
  className?: string;
  showText?: boolean;
}

export const Logo = ({ size = "medium", className, showText = false }: LogoProps) => {
  const sizeClasses = {
    small: "h-6 w-6",
    medium: "h-8 w-8",
    large: "h-16 w-16",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        sizeClasses[size],
        "rounded-full overflow-hidden flex items-center justify-center"
      )}>
        <img 
          src={logo} 
          alt="GRWTH Engine Logo" 
          className="w-full h-full object-cover"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
      {showText && (
        <span className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          GRWTH Engine
        </span>
      )}
    </div>
  );
};
