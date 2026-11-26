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
    // Also watch the tab list itself: tabs that appear after permissions load widen it without resizing the scroller.
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    // Keep the active tab in view whenever it changes.
    const revealActive = () => {
      const active = el.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!active) return;
      const left = active.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      if (left < el.scrollLeft || left + active.offsetWidth > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: Math.max(0, left - 32), behavior: "smooth" });
      }
      checkOverflow();
    };
    const mo = new MutationObserver(revealActive);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
    revealActive();
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
      mo.disconnect();
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
