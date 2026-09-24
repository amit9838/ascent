import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

export interface PopoverProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: ReactNode;
  panelClassName?: string;
  children?: ReactNode;
}

// Relative container that shows a dropdown panel under `trigger` while
// `open`, closing on outside mousedown or Escape (when open).
export function Popover({
  open,
  onOpenChange,
  trigger,
  panelClassName,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node | null))
        onOpenChange?.(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      {trigger}
      {open && (
        <div
          className={cx(
            "absolute right-0 z-40 mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900",
            panelClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
