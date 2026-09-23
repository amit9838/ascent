<div align="center">

# ⛰️ Ascent

**Stay consistent. Solve daily. Climb together.**

Ascent turns DSA practice into a habit — 250 hand-picked problems, daily goals that keep you honest, and friends to race on the leaderboard. Free forever, private by default, works offline.

[![Live Demo](https://img.shields.io/badge/▶_Try_it_live-brightgreen.svg)](https://amit9838.github.io/ascent/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)

<img src="./docs/screenshots/ascent-dashboard.png" alt="Ascent dashboard — daily goal, streak, and today's question" width="850" />

</div>

---

## Why Ascent exists

Everyone starts DSA with enthusiasm and quits by week three. Not because the problems are too hard — because **consistency is hard**. Tutorials don't fix that. Streaks, visible progress, and a little friendly competition do.

Ascent is built around one belief: **solve a little every day, and the 250 problems solve themselves.**

## Product goals

1. **Make showing up effortless** — open the app, see today's question and your daily target, solve one problem. Zero setup, zero friction.
2. **Make progress impossible to ignore** — per-topic bars, points, streaks, and ranks turn invisible effort into visible momentum.
3. **Make practice social (optionally)** — race friends on a live leaderboard, share a public stats page, invite by email. Everything social is opt-in.
4. **Respect your data** — local-first and offline-capable. Your progress lives in your browser; the cloud is a convenience, never a requirement.

## Who it's for

- **Students** preparing for placements and coding interviews
- **Working engineers** keeping their problem-solving sharp with a daily habit
- **Study groups** who want a shared leaderboard instead of another spreadsheet

## Features

### 📚 Practice that guides you

- **250 curated problems across 14 topics** — Arrays → DP → Graphs, in a sensible order, sourced from the [workat.tech index](https://workat.tech/problem-solving/practice/topics/index.html) with LeetCode / GeeksforGeeks equivalents
- **Question of the Day** — one deterministic pick every day so you never wonder "what should I solve today?"
- **One-click solve toggle** with per-topic progress bars and difficulty-weighted points

### 🎯 Goals that keep you honest

- **Daily targets & weekly goals** derived from your own weekly target — the dashboard tells you exactly where you stand
- **Streaks, heatmaps, and consistency titles** that reward showing up, not just solving hard problems
- **Rank ladder** from *First Light* to *Crown Jewel*, plus Daybreak Stars & Sapphire Crown collectibles for milestones

### 📝 Notes that stick

- **Up to 10 private notes** (12,000 characters each) for approaches, tricks, and problems to revisit
- Autosaved with debounce, lazy-loaded bodies, instant search through the list — your second brain for patterns
- **Collaborate** — share any note by email. Collaborators see and edit, ownership stays with you, changes sync on save

### 🏆 Friends that push you

- **Live leaderboard** ranked by points with tie-breaks, competition ranking, and per-row actions
- **Invite by email**, accept / reject / withdraw connection requests, clear finished invite history
- **Public profile pages** (`#/u/:uid`) — share solved, points, streak, and rank. Notes and history are never shared.

### 🔒 Your data, your call

- **Local-first** — IndexedDB storage, dark mode, JSON import/export backups. Fully usable with no account.
- **Optional cloud sync** — sign in with Google or email to mirror progress across devices with merge-based sync (solves are never lost). Sign out or delete your account any time; local data stays put.

## How a day with Ascent looks

1. **Morning** — open Ascent, check the Question of the Day and your daily target.
2. **Practice** — solve it (or a few more), tap to mark done, watch the bar move.
3. **Evening** — glance at your streak, see where you stand against friends, jot a trick in Notes.

That's it. Repeat for a few months and you're interview-ready.

## Philosophy

- **Habits beat intensity.** Small daily targets outperform weekend marathons.
- **Private by default.** Tracking is personal; sharing is always a choice.
- **Offline is a feature.** No account walls, no spinners when the network drops.
- **Playful, not childish.** Coins and ranks motivate — they never get in the way of solving.

## Roadmap

- [ ] Spaced-repetition reminders for problems you got wrong
- [ ] Custom problem lists and contest mode
- [ ] More leaderboard views (weekly races, topic specialists)
- [ ] PWA install support for a native-app feel

Have an idea? [Open an issue](https://github.com/amit9838/ascent/issues) — product suggestions are very welcome.

## Quick start

```bash
git clone https://github.com/amit9838/ascent.git
cd ascent
npm install
npm run dev        # http://localhost:5173
```

No account or API keys needed — the app runs fully offline out of the box. Cloud sync is opt-in; see [Contributing](./CONTRIBUTING.md#optional-cloud-setup) if you want to enable it locally.

## Built with

React 19 · Vite 7 · Tailwind CSS 4 · Firebase (Auth + Firestore, lazy-loaded only when configured) · GitHub Pages

## Data source

Problems are indexed from [workat.tech](https://workat.tech/problem-solving/practice/topics/index.html) ([`source/*.csv`](./source)) — same order as the site, 250 problems across 14 topics.

<details>
<summary><b>14 topics · 250 problems</b></summary>

1. [Arrays (21)](https://workat.tech/problem-solving/topics/arrays/practice/index.html) · [`arrays.csv`](./source/arrays.csv)
2. [Searching (11)](https://workat.tech/problem-solving/topics/searching/practice/index.html) · [`searching.csv`](./source/searching.csv)
3. [Two Pointers (14)](https://workat.tech/problem-solving/topics/two-pointers/practice/index.html) · [`two-pointers.csv`](./source/two-pointers.csv)
4. [Linked Lists (30)](https://workat.tech/problem-solving/topics/linked-lists/practice/index.html) · [`linked-lists.csv`](./source/linked-lists.csv)
5. [Stacks & Queues (15)](https://workat.tech/problem-solving/topics/stacks-and-queues/practice/index.html) · [`stacks-and-queues.csv`](./source/stacks-and-queues.csv)
6. [Hashing (15)](https://workat.tech/problem-solving/topics/hashing/practice/index.html) · [`hashing.csv`](./source/hashing.csv)
7. [Backtracking (18)](https://workat.tech/problem-solving/topics/backtracking/practice/index.html) · [`backtracking.csv`](./source/backtracking.csv)
8. [Binary Trees (22)](https://workat.tech/problem-solving/topics/binary-trees/practice/index.html) · [`binary-trees.csv`](./source/binary-trees.csv)
9. [BST, Heaps & Map (17)](https://workat.tech/problem-solving/topics/bst-heaps-and-map/practice/index.html) · [`bst-heaps-and-map.csv`](./source/bst-heaps-and-map.csv)
10. [Math & Bit Manipulation (15)](https://workat.tech/problem-solving/topics/maths-and-bits/practice/index.html) · [`maths-and-bits.csv`](./source/maths-and-bits.csv)
11. [Dynamic Programming (27)](https://workat.tech/problem-solving/topics/dynamic-programming/practice/index.html) · [`dynamic-programming.csv`](./source/dynamic-programming.csv)
12. [Greedy Algorithm (4)](https://workat.tech/problem-solving/topics/greedy-algorithm/practice/index.html) · [`greedy-algorithm.csv`](./source/greedy-algorithm.csv)
13. [Graphs (26)](https://workat.tech/problem-solving/topics/graphs/practice/index.html) · [`graphs.csv`](./source/graphs.csv)
14. [String & Tries (15)](https://workat.tech/problem-solving/topics/string-and-tries/practice/index.html) · [`string-and-tries.csv`](./source/string-and-tries.csv)

</details>

---

<div align="center">

**[▶ Try Ascent live](https://amit9838.github.io/ascent/)** · [Contributing](./CONTRIBUTING.md) · [Issues](https://github.com/amit9838/ascent/issues)

Built with React · Vite · Tailwind CSS · Firebase

</div>
