import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx.js";

// Relative container that shows a dropdown panel under `trigger` while
// `open`, closing on outside mousedown or Escape (when open).
export function Popover({
  open,
  onOpenChange,
  trigger,
  panelClassName,
  children,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOpenChange?.(false);
    };
    const onKey = (e) => {
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
