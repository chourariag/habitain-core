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

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoImg}
        alt="HStack"
        width={iconSize}
        height={iconSize}
        className="shrink-0 rounded-full"
      />
      {showText && (
        <div className="overflow-hidden">
          <h1 className={cn("font-display font-bold text-primary truncate", fontSize)}>
            HStack
          </h1>
          {size === "lg" ? (
            <p className="text-sm text-muted-foreground font-body font-normal">Habitainer Operations Platform</p>
          ) : (
            <p className="text-[10px] font-body font-normal" style={{ color: "#999999" }}>by Habitainer</p>
          )}
        </div>
      )}
    </div>
  );
}
