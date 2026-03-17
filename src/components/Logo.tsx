import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const iconSize = size === "sm" ? 36 : size === "md" ? 36 : 64;
  const fontSize = size === "lg" ? "text-3xl" : "text-sm";
  const subSize = size === "lg" ? "text-sm" : "text-[10px]";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoImg}
        alt="Habitainer"
        width={iconSize}
        height={iconSize}
        className="shrink-0 rounded-full"
      />
      {showText && (
        <div className="overflow-hidden">
          <h1 className={cn("font-display font-bold text-primary truncate", fontSize)}>
            Habitainer
          </h1>
          <p className={cn("text-muted-foreground font-body font-normal", subSize)}>Production OS</p>
        </div>
      )}
    </div>
  );
}
