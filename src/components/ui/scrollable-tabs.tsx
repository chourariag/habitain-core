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

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  return (
    <div className={cn("flex items-center w-full gap-0", className)}>
      {showLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          className="flex-shrink-0 flex items-center justify-center w-7 h-full"
          style={{ background: "#FFFFFF", color: "#006039" }}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-w-0 overflow-x-auto overflow-y-visible scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>

      {showRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          className="flex-shrink-0 flex items-center justify-center w-7 h-full"
          style={{ background: "#FFFFFF", color: "#006039" }}
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
