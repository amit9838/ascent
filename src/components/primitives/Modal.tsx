import { useEffect } from "react";
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.js";
import { IconButton } from "./Button.jsx";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  footer?: ReactNode;
  children?: ReactNode;
}

// Centered popup: backdrop (click to close), Escape to close, scroll lock,
// header with title/description/close, optional footer slot.
export function Modal({
  open = true,
  onClose,
  title,
  description,
  size = "sm",
  footer,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cx(
          "w-full rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900",
          SIZES[size]
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <IconButton aria-label="Close" onClick={onClose}>
                ✕
              </IconButton>
            )}
          </div>
        )}
        {children}
        {footer && (
          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
