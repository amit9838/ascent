import { Badge } from "../../../components/primitives/index.js";

// Small pill badge (rank title, states, …) — thin wrapper over the
// shared Badge primitive.
export function Pill({ children, tone = "slate", className = "" }) {
  return (
    <Badge tone={tone} className={className}>
      {children}
    </Badge>
  );
}
