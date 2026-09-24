import type { ReactNode } from "react";
import { Badge } from "../../../components/primitives/index.js";
import type { BadgeTone } from "../../../components/primitives/index.js";

// Small pill badge (rank title, states, …) — thin wrapper over the
// shared Badge primitive.
export function Pill({
  children,
  tone = "slate",
  className = "",
}: {
  children?: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Badge tone={tone} className={className}>
      {children}
    </Badge>
  );
}
