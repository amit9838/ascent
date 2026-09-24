import type { ComponentType, ReactNode } from "react";
import { CoinStack } from "../../../components/CoinStack.jsx";

// Borderless coin display: stack + big count sitting directly on the
// section background (no card-within-card).
export function CoinCard({
  coin,
  count,
  name,
  req,
  accent = "amber",
}: {
  coin: ComponentType<{ className?: string }>;
  count: number;
  name: ReactNode;
  req: ReactNode;
  accent?: string;
}) {
  const amber = accent === "amber";
  return (
    <div className="flex items-center gap-4 py-1 sm:gap-5">
      <CoinStack coin={coin} count={count} />
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold uppercase tracking-widest ${
            amber
              ? "text-amber-600 dark:text-amber-400"
              : "text-violet-600 dark:text-violet-400"
          }`}
        >
          {name}
        </p>
        <p className="mt-0.5 text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          × {count}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{req}</p>
      </div>
    </div>
  );
}
