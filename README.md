<div align="center">

# ⛰️ Ascent

**A gamified DSA practice tracker** — solve 250 curated problems, earn coins, climb ranks, and race friends on the leaderboard.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![GitHub](https://img.shields.io/badge/GitHub-amit9838%2Fascent-181717?logo=github&logoColor=white)](https://github.com/amit9838/ascent)
[![Live](https://img.shields.io/badge/Live-Demo-brightgreen.svg)](https://amit9838.github.io/ascent/)

<img src="./docs/screenshots/ascent-dashboard.png" alt="Ascent dashboard screenshot" width="850" />

</div>

---

## Features

- **Topic-wise practice** — 250 problems across 14 topics (Arrays → DP → Graphs), sourced from the [workat.tech index](https://workat.tech/problem-solving/practice/topics/index.html) with LeetCode/GeeksforGeeks equivalents
- **Progress tracking** — one-click solve toggle, per-topic progress bars, points weighted by difficulty
- **Gamification** — daily targets, weekly goals, Daybreak Stars & Sapphire Crowns, a rank ladder from *First Light* to *Crown Jewel*, streak & consistency titles
- **Notes** — up to 10 private plain-text notes (12k characters each), one storage record per note, collapsible list, debounce autosave
- **Leaderboard & social** — invite friends by email, accept/reject connections, live rankings, public profile sharing (you choose what's shared)
- **Cloud sync (optional)** — Firebase Auth (Google + email) with Firestore merge-based sync; runs **100% local/offline** when unconfigured
- **Local-first storage** — IndexedDB, dark mode, import/export JSON backups

## Quick start

```bash
git clone https://github.com/amit9838/ascent.git
cd ascent
npm install
npm run dev        # http://localhost:5173
```

Cloud features are optional — the app works fully offline out of the box.

### Enable cloud sync & leaderboard

1. Create a Firebase project, add a **Web app**, copy the config into `.env.local` (see [`.env.example`](./.env.example))
2. Enable **Google** and **Email/Password** sign-in providers
3. Publish [`firestore.rules`](./firestore.rules) (must match your project ID)
4. Optional local dev against emulators:

```bash
npx firebase-tools emulators:start --only auth,firestore
# .env.local → VITE_USE_EMULATORS=1
```

> Firebase web config values are public by design — real protection comes from Security Rules + Auth authorized domains.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build + publish to GitHub Pages |

## Project structure

```
src/
├── components/     # UI: header, auth menu, profile, coins, icons
├── pages/          # Home, Topics, Progress, Notes, Leaderboard, Settings, Profile
├── data/           # Topic list + CSV problem sets
├── lib/            # storage (IndexedDB), rewards, titles, activity
│   └── cloud/      # Firebase sync, merge strategies, connections
└── App.jsx         # Hash routes (gh-pages-friendly)
```

---

<div align="center">

Built with React · Vite · Tailwind CSS · Firebase

</div>
