# Contributing to Ascent

Thanks for your interest in contributing! This guide covers everything you need to run the project locally and land a clean pull request. For the product vision, see the [README](./README.md).

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce, expected vs actual behavior, and your browser/OS.
- 💡 **Suggest product ideas** — roadmap items, UX improvements, new motivational mechanics. Product suggestions are very welcome.
- 🛠️ **Submit code** — pick an issue or propose one, then follow the workflow below.
- 📖 **Improve docs** — README, this guide, code comments, error messages.

## Prerequisites

- **Node.js 18+** (20+ recommended) and **npm**
- A modern browser (Chrome/Edge/Firefox/Safari)
- Git

No Firebase account needed for most work — the app runs fully offline without any configuration.

## Getting started

```bash
git clone https://github.com/amit9838/ascent.git
cd ascent
npm install
npm run dev        # http://localhost:5173
```

### Scripts

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `npm run dev`    | Start the dev server                 |
| `npm run build`  | Production build → `dist/` (run before every PR) |
| `npm run preview`| Preview the production build locally |
| `npm run deploy` | Build + publish to GitHub Pages (maintainers only) |

### Optional: cloud setup

Only needed if you're working on auth, sync, leaderboard, or profiles. Everything else works without it.

1. Create a Firebase project, add a **Web app**, and copy the config into `.env.local` (see [`.env.example`](./.env.example)).
2. In the Firebase console, enable **Google** and **Email/Password** sign-in providers.
3. Publish [`firestore.rules`](./firestore.rules) to your project (**Rules → Publish**).
4. For local development against emulators instead of production:

```bash
npx firebase-tools emulators:start --only auth,firestore
# .env.local → VITE_USE_EMULATORS=1
```

> Firebase web config values are public by design — real protection comes from Security Rules + Auth authorized domains. Never commit `.env.local`.

## Project structure

```
src/
├── App.jsx                 # Hash routes (gh-pages has no URL rewrites)
├── components/             # Shared UI: Header, AuthMenu, coins, icons, ui
│   └── primitives/         # Design system: Button, Input, Modal, Popover,
│                           #   Badge, Card, Avatar, Divider, Spinner
├── features/               # One folder per product area, each co-locating
│   ├── home/               #   its pages, components, and state
│   ├── topics/
│   ├── notes/
│   ├── progress/
│   ├── leaderboard/
│   ├── profile/            # Public profiles + shared profile components
│   └── settings/           # Settings page + profile backup/restore
├── data/                   # Topic list + CSV loading
├── lib/
│   ├── db.js               # IndexedDB gateway — the ONLY file that touches storage
│   ├── cache.js            # In-memory TTL/tagged cache for async data
│   ├── gamification/       # points, rewards, ranks, streaks, plans
│   ├── notes.js            # Per-note records + aggregate-blob translation
│   ├── progress.js         # useProgress hook (async, ready-gated)
│   ├── auth.js             # Firebase auth helpers + useAuth
│   ├── cloud/              # sync engine, merge strategies, connections, invites
│   └── csv.js, cx.js, theme.js
├── source/  (repo root)    # Raw problem CSVs (14 topics)
└── docs/screenshots/       # README assets
```

## Architecture rules

These keep the codebase consistent — please follow them in every PR:

1. **Storage goes through `src/lib/db.js`.** Never touch `localStorage` or IndexedDB directly from features. All `db.js` functions are **async** — callers must `await` reads/writes. Writes notify subscribers with a `"local"` / `"remote"` source tag.
2. **Cache reads with `src/lib/cache.js`.** Firestore docs, profiles, connection state, and CSVs use `cached(key, loader, { ttl, tags })`. Mutations must invalidate their tags (`forget` / `invalidateTag`); sign-out clears everything (`clearCache`).
3. **Compose UI from `components/primitives/`.** Don't re-declare Tailwind button/input/modal strings — use `Button`, `Input`/`Field`, `Modal`, `Popover`, `Badge`, `Card`, `Avatar`. Use the `cx()` helper for conditional classes.
4. **Keep features co-located.** New product area? New folder under `features/` with its pages + components + state. Shared building blocks go in `components/`.
5. **Stay local-first.** Every feature must work with cloud unconfigured (`cloudEnabled() === false`). Cloud code loads lazily via dynamic `import()` and must never break the offline path.
6. **Sync safely.** The sync engine merges (progress = per-problem newer-wins union; rewards = collected-beats-earned) — solves are never lost. Follow the existing merge strategies in `lib/cloud/merge.js`.
7. **Dark mode everywhere.** Every new UI must include `dark:` classes. Test by toggling the theme in Settings.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/)-style messages so history stays scannable:

```
feat(notes): multi-note list with batched autosave
fix(leaderboard): handle empty-board state for new users
refactor(profile): split hero into shared components
style(settings): responsive account header on mobile
docs: refresh dashboard screenshot
perf(cloud): cache profile reads with 30s TTL
chore(cloud): bump firebase to 12.x
```

Scopes are the area touched (`home`, `notes`, `leaderboard`, `cloud`, `auth`, `ui`, …). Keep commits focused — one logical change each. Small refactors bundled with a feature are fine; unrelated changes belong in separate commits.

## Pull request process

1. **Fork** the repo and create a branch from `main` (`feat/my-thing`, `fix/my-bug`).
2. Make your change following the architecture rules above.
3. **Verify**: `npm run build` must pass. Manually test both **light and dark mode**, and — if you touched cloud code — both **signed-out (offline)** and **signed-in** states.
4. Update docs/screenshots if the UI visibly changed.
5. Open a PR with: what changed, why, how you tested, and screenshots for UI changes.
6. A maintainer will review. Please respond to feedback with follow-up commits on the same branch.

Small PRs get reviewed fastest. If a change needs more than ~400 lines, consider splitting it or opening an issue first to align on approach.

## Reporting issues

Include: clear title, steps to reproduce, expected vs actual, browser + OS, console errors if any, and whether you were signed in. Screenshots or screen recordings help a lot for UI bugs.

## Code of conduct

Be kind and constructive. Assume good intent, critique the code — never the person. Harassment or hostility of any kind is not tolerated.
