// A 3D-looking stack of coins. Shows up to 4 coins no matter how many
// are owned; an empty collection renders one dimmed coin as a placeholder.
// Hovering lifts and fans the stack (parent needs the `group` class).
// `coin` is a coin SVG component (GoldCoin / SapphireCoin).
import type { ComponentType } from "react";

// Indexed by depth from the TOP coin: each coin moves less than half
// of the one above it (28 → 12 → 4 → 1px), so the rule holds for any
// stack height and the bottom coin stays nearly static.
const HOVER_LIFT = [
  "group-hover:-translate-y-3.5",
  "group-hover:-translate-y-1.5",
  "group-hover:-translate-y-0.5",
  "",
  "",
];

const HOVER_SCALE = [
  "group-hover:scale-105",
  "group-hover:scale-[1.03]",
  "group-hover:scale-[1.01]",
  "",
  "",
];

const SIZE = 80;
const GAP = 12;

export function CoinStack({
  coin: Coin,
  count,
}: {
  coin: ComponentType<{ className?: string }>;
  count: number;
}) {
  const shown = Math.min(Math.max(count, 1), 5);
  const empty = count <= 0;
  return (
    <div
      className="group relative shrink-0"
      style={{ width: SIZE, height: SIZE + (shown - 1) * GAP }}
    >
      {Array.from({ length: shown }).map((_, i) => {
        const depth = Math.min(shown - 1 - i, 4);
        return (
          <div
            key={i}
            className={`absolute left-0 transition-transform duration-300 [transform:perspective(400px)_rotateX(30deg)]${empty ? "" : ` ${HOVER_LIFT[depth]} ${HOVER_SCALE[depth]}`}`}
            style={{ top: (shown - 1 - i) * GAP }}
          >
            <Coin
              className={`h-20 w-20 transition-all duration-300 ${
                empty
                  ? "drop-shadow-lg grayscale opacity-40"
                  : "drop-shadow-[0_6px_6px_rgb(0,0,0,0.30)] group-hover:drop-shadow-[0_10px_10px_rgb(0,0,0,0.35)]"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
