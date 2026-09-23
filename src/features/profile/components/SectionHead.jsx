export function SectionHead({ title, sub, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {sub && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        )}
      </div>
      {action}
    </div>
  );
}
