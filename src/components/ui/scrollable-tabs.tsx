import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollableTabsWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTabsWrapper({ children, className }: ScrollableTabsWrapperProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(false);

  const checkOverflow = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow]);

  return (
    <div className={cn("relative", className)}>
      <div ref={scrollRef} className="overflow-x-auto overflow-y-visible scrollbar-none">
        {children}
      </div>

      {/* Left fade + chevron */}
      {showLeft && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-start pl-1.5 pointer-events-none z-10"
          style={{ background: "linear-gradient(to right, #FFFFFF 30%, transparent)" }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "#006039" }} />
        </div>
      )}

      {/* Right fade + chevron */}
      {showRight && (
        <div
          className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-end pr-1.5 pointer-events-none z-10"
          style={{ background: "linear-gradient(to left, #FFFFFF 30%, transparent)" }}
        >
          <ChevronRight className="h-4 w-4" style={{ color: "#006039" }} />
        </div>
      )}
    </div>
  );
}
