import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";

export interface DividerProps {
  label?: ReactNode;
  className?: string;
}

// Rule with an optional centered label ("or").
export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cx("border-slate-200 dark:border-slate-700", className)} />;
  }
  return (
    <div
      className={cx("flex items-center gap-3 text-xs text-slate-400", className)}
      role="separator"
    >
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      {label}
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
