import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const iconSize = size === "sm" ? 32 : size === "md" ? 40 : 64;
  const fontSize = size === "lg" ? "text-3xl" : "text-sm";
  const subSize = size === "lg" ? "text-sm" : "text-[10px]";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Hexagon */}
        <path
          d="M32 4L56.785 18V46L32 60L7.215 46V18L32 4Z"
          fill="hsl(153, 100%, 19%)"
        />
        {/* H letter */}
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="700"
          fontSize="28"
          fill="white"
        >
          H
        </text>
      </svg>
      {showText && (
        <div className="overflow-hidden">
          <h1 className={cn("font-display font-bold text-primary truncate", fontSize)}>
            Habitainer
          </h1>
          <p className={cn("text-muted-foreground font-body", subSize)}>Production OS</p>
        </div>
      )}
    </div>
  );
}
