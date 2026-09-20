// Hand-crafted 3D SVG reward coins. Self-contained (no external images),
// so they work offline and on gh-pages. Gold = daily, purple sapphire =
// weekly. Pair with Tailwind's `grayscale opacity-50` for the locked state.

const STAR_POINTS =
  "32,19 35.2,27.6 44.4,28 37.2,33.7 39.6,42.5 32,37.5 24.4,42.5 26.8,33.7 19.6,28 28.8,27.6";

const SAPPHIRE_STUDS = [
  [57.5, 32],
  [6.5, 32],
  [32, 6.5],
  [32, 57.5],
  [50, 14],
  [14, 14],
  [50, 50],
  [14, 50],
];

export function GoldCoin({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="goldcoin-face" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fffbe0" />
          <stop offset="38%" stopColor="#ffe977" />
          <stop offset="68%" stopColor="#f7b731" />
          <stop offset="88%" stopColor="#d97f06" />
          <stop offset="100%" stopColor="#9a5200" />
        </radialGradient>
        <linearGradient id="goldcoin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3c2" />
          <stop offset="45%" stopColor="#f3c53d" />
          <stop offset="78%" stopColor="#c07f0a" />
          <stop offset="100%" stopColor="#7c5208" />
        </linearGradient>
        <linearGradient id="goldcoin-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffef9e" />
          <stop offset="100%" stopColor="#f5b301" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#6e4204" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="#4a2d02"
        strokeWidth="2"
        strokeDasharray="2.5 2"
        opacity="0.8"
      />
      <circle cx="32" cy="32" r="28.5" fill="url(#goldcoin-rim)" />
      <circle
        cx="32"
        cy="32"
        r="28.5"
        fill="none"
        stroke="#4a2d02"
        strokeWidth="1"
        opacity="0.5"
      />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="url(#goldcoin-face)"
        stroke="#8a5a0a"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="32"
        r="19"
        fill="none"
        stroke="#a86e0c"
        strokeWidth="1"
        strokeDasharray="1.5 2.5"
        opacity="0.9"
      />
      <circle
        cx="32"
        cy="32"
        r="17.5"
        fill="none"
        stroke="#fff6c9"
        strokeWidth="1"
        opacity="0.8"
      />
      <polygon
        points={STAR_POINTS}
        transform="translate(0.9 1.2)"
        fill="#8a5a0a"
        opacity="0.85"
      />
      <polygon
        points={STAR_POINTS}
        fill="url(#goldcoin-star)"
        stroke="#a86e0c"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <ellipse
        cx="24"
        cy="19"
        rx="10"
        ry="5.5"
        transform="rotate(-25 24 19)"
        fill="#ffffff"
        opacity="0.4"
      />
      <circle cx="42" cy="43" r="3" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

export function SapphireCoin({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="sapphirecoin-face" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#f1eaff" />
          <stop offset="38%" stopColor="#b9a5f5" />
          <stop offset="68%" stopColor="#7c5ce0" />
          <stop offset="88%" stopColor="#4c2fb3" />
          <stop offset="100%" stopColor="#2e1a72" />
        </radialGradient>
        <linearGradient id="sapphirecoin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6dcff" />
          <stop offset="45%" stopColor="#a78bfa" />
          <stop offset="78%" stopColor="#6d3fd4" />
          <stop offset="100%" stopColor="#3d2278" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#2a1656" />
      <circle
        cx="32"
        cy="32"
        r="30"
        fill="none"
        stroke="#1c0e3c"
        strokeWidth="2"
        strokeDasharray="2.5 2"
        opacity="0.8"
      />
      <circle cx="32" cy="32" r="28.5" fill="url(#sapphirecoin-rim)" />
      <circle
        cx="32"
        cy="32"
        r="28.5"
        fill="none"
        stroke="#1c0e3c"
        strokeWidth="1"
        opacity="0.5"
      />
      {SAPPHIRE_STUDS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="#f3e8ff" opacity="0.85" />
      ))}
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke="#d9c8ff"
        strokeWidth="1"
        strokeDasharray="1.5 2.5"
        opacity="0.6"
      />
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="url(#sapphirecoin-face)"
        stroke="#3d2278"
        strokeWidth="1.5"
      />
      <circle
        cx="32"
        cy="32"
        r="19"
        fill="none"
        stroke="#f3e8ff"
        strokeWidth="1"
        opacity="0.8"
      />
      <g
        transform="translate(32.8 33.8) scale(1.35) translate(-12 -11.5)"
        fill="none"
        stroke="#241257"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.65"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </g>
      <g
        transform="translate(32 33) scale(1.35) translate(-12 -11.5)"
        fill="none"
        stroke="#2e1a72"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </g>
      <ellipse
        cx="24"
        cy="19"
        rx="10"
        ry="5.5"
        transform="rotate(-25 24 19)"
        fill="#ffffff"
        opacity="0.4"
      />
      <circle cx="42" cy="43" r="3" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}
