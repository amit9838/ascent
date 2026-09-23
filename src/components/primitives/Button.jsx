import { cx } from "../../lib/cx.js";
import { Spinner } from "./Spinner.jsx";

const VARIANTS = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  ghost:
    "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700",
  danger:
    "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950",
  link: "text-blue-600 hover:underline dark:text-blue-400",
};

const SIZES = {
  xs: "px-2 py-1 text-xs",
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}) {
  return (
    <button
      className={cx(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// Square icon-only button — always requires an aria-label.
const ICON_SIZES = { sm: "p-1.5", md: "p-2" };
const ICON_VARIANTS = {
  ghost:
    "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200",
  secondary:
    "border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800",
};

export function IconButton({
  variant = "ghost",
  size = "sm",
  className,
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center rounded-lg transition disabled:opacity-50",
        ICON_VARIANTS[variant],
        ICON_SIZES[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
