// Hand-crafted 3D SVG reward coins. Self-contained (no external images),
// so they work offline and on gh-pages. Gold = daily, purple sapphire =
// weekly. Pair with Tailwind's `grayscale opacity-50` for the locked state.

const STAR_POINTS =
  "32,19 35.2,27.6 44.4,28 37.2,33.7 39.6,42.5 32,37.5 24.4,42.5 26.8,33.7 19.6,28 28.8,27.6";

const STAR_INNER_POINTS =
  "32,24.9 33.8,29.6 38.8,29.8 34.9,32.9 36.2,37.8 32,35 27.8,37.8 29.1,32.9 25.2,29.8 30.2,29.6";

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
        <radialGradient id="goldcoin-face" cx="40%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#fffce8" />
          <stop offset="30%" stopColor="#ffefa8" />
          <stop offset="55%" stopColor="#ffd94d" />
          <stop offset="78%" stopColor="#f0a01e" />
          <stop offset="92%" stopColor="#c07f0a" />
          <stop offset="100%" stopColor="#9a5200" />
        </radialGradient>
        <linearGradient id="goldcoin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="35%" stopColor="#f7d54a" />
          <stop offset="65%" stopColor="#dd9a12" />
          <stop offset="85%" stopColor="#a86e0c" />
          <stop offset="100%" stopColor="#7c5208" />
        </linearGradient>
        <linearGradient id="goldcoin-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7c4" />
          <stop offset="55%" stopColor="#ffdf5e" />
          <stop offset="100%" stopColor="#eda200" />
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
        r="27"
        fill="none"
        stroke="#ffedb0"
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
      <polygon
        points={STAR_INNER_POINTS}
        fill="none"
        stroke="#ffedb0"
        strokeWidth="0.8"
        opacity="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M 12.8 25 A 20.5 20.5 0 0 0 25 12.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <ellipse
        cx="24"
        cy="19"
        rx="10"
        ry="5.5"
        transform="rotate(-25 24 19)"
        fill="#ffffff"
        opacity="0.35"
      />
      <circle cx="42" cy="43" r="3" fill="#ffffff" opacity="0.25" />
    </svg>
  );
}

export function SapphireCoin({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="sapphirecoin-face" cx="40%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#f6f0ff" />
          <stop offset="30%" stopColor="#c9b3f7" />
          <stop offset="55%" stopColor="#8f6ff0" />
          <stop offset="78%" stopColor="#5b36c4" />
          <stop offset="92%" stopColor="#3d2278" />
          <stop offset="100%" stopColor="#241257" />
        </radialGradient>
        <linearGradient id="sapphirecoin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ece4ff" />
          <stop offset="35%" stopColor="#b79af5" />
          <stop offset="65%" stopColor="#7f56dd" />
          <stop offset="85%" stopColor="#552fa5" />
          <stop offset="100%" stopColor="#2a1656" />
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
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke="#e6dcff"
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
      <g
        transform="translate(32 33) scale(1.35) translate(-12 -11.5)"
        fill="none"
        stroke="#d9c8ff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M16.5 3.5H7.5V9a4.5 4.5 0 0 0 9 0V3.5Z" />
      </g>
      <path
        d="M17 29.8 L17.6 31.4 L19.2 32 L17.6 32.6 L17 34.2 L16.4 32.6 L14.8 32 L16.4 31.4 Z"
        fill="#f3e8ff"
        opacity="0.9"
      />
      <path
        d="M47 29.8 L47.6 31.4 L49.2 32 L47.6 32.6 L47 34.2 L46.4 32.6 L44.8 32 L46.4 31.4 Z"
        fill="#f3e8ff"
        opacity="0.9"
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
