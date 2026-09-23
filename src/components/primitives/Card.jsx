import { cx } from "../../lib/cx.js";

export const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900";

// Standard content card — padding comes from `className` so callers can
// choose density (p-5, p-6, p-0 …).
export function Card({ className, children, ...rest }) {
  return (
    <div className={cx(CARD_CLASS, className)} {...rest}>
      {children}
    </div>
  );
}
