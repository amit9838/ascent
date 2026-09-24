import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "../../lib/cx.js";

const BASE =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(BASE, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(BASE, "min-h-24 resize-y", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(BASE, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

const LABEL_CLS = "block text-xs font-medium text-slate-600 dark:text-slate-300";

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children?: ReactNode;
}

// Label + control + hint/error wrapper.
export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <label className={cx(LABEL_CLS, className)}>
      {label}
      <span className="mt-1 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-xs font-normal text-rose-700 dark:text-rose-400">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
