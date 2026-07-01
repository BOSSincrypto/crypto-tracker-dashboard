<div align="center">

# 📊 Crypto Portfolio Tracker

**Local-first crypto portfolio dashboard with live CoinGecko prices, average-cost-basis P&L,
allocation, risk metrics and CSV/JSON import & export — no signup, no server, your data never leaves the browser.**

[![Deploy to GitHub Pages](https://github.com/BOSSincrypto/crypto-tracker-dashboard/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/BOSSincrypto/crypto-tracker-dashboard/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-license)
[![GitHub stars](https://img.shields.io/github/stars/BOSSincrypto/crypto-tracker-dashboard?style=social)](https://github.com/BOSSincrypto/crypto-tracker-dashboard/stargazers)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.x-FF4F1A)](https://tanstack.com)
[![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun&logoColor=white)](https://bun.sh)

<br/>

### 🚀 [Live Demo → bossincrypto.github.io/crypto-tracker-dashboard](https://bossincrypto.github.io/crypto-tracker-dashboard/)

</div>

---

## 🧠 Why?

Most crypto trackers force you to create an account and hand over your holdings to a third party.
**Crypto Portfolio Tracker** is different — it is 100% local-first. Every transaction lives in your
browser's `localStorage`; only live prices are fetched (from the free CoinGecko API). That means:

- 🔒 **Zero accounts, zero tracking, zero servers holding your data**
- ⚡ **Instant load** — the homepage is prerendered to static HTML
- 📈 **Real numbers** — proper average-cost-basis accounting, not naive averages
- 📤 **Portable** — export everything to CSV/JSON in one click

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 💹 | **Live prices** | CoinGecko prices auto-refresh every 60s with abort/timeout, retry on `429`/`5xx` and rate-limit-aware chunking |
| 📊 | **KPI summary cards** | Total value, invested capital, total / realized / unrealized P&L at a glance |
| 📈 | **Portfolio value chart** | Daily value history vs. invested baseline (area + line, powered by Recharts) |
| 🥧 | **Allocation pie** | Live weighting of every holding |
| 🧮 | **Analytics panel** | Cost basis, gains and performance per asset |
| ⚠️ | **Risk metrics** | Max drawdown, volatility and win/loss streaks from historical snapshots |
| 💵 | **Cost-vs-value chart** | Visualize invested capital against current market value over time |
| 🌊 | **Cash-flow waterfall** | Monthly in/out capital flow (buys, sells, rewards) |
| 📅 | **Monthly summary** | Per-month aggregated transactions table |
| 📋 | **Holdings & transactions** | Sortable tables with inline add / edit / remove |
| 🔍 | **Coin search** | Search 10,000+ assets via the CoinGecko catalog when adding a transaction |
| 🗂️ | **Multi-portfolio** | Track several portfolios and switch — or view the merged **All** aggregate |
| 📥 | **Import / Export** | Round-trip your whole dataset with **CSV** & **JSON** |
| 🌙 | **Dark, responsive UI** | shadcn/ui (new-york) + Radix + Tailwind v4, mobile-friendly |
| 🛡️ | **Resilient** | Every panel is wrapped in its own `ErrorBoundary`; heavy charts are lazy-loaded |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **UI framework** | [React 19](https://react.dev) |
| **Meta-framework** | [TanStack Start](https://tanstack.com) (SSR/prerender + file-based routing) |
| **Routing / data** | TanStack Router · [TanStack Query](https://tanstack.com/query) |
| **Language** | [TypeScript](https://www.typescriptlang.org) (strict) |
| **Build tool** | [Vite 8](https://vite.dev) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) · `tw-animate-css` |
| **Components** | [shadcn/ui](https://ui.shadcn.com) (new-york) · [Radix UI](https://www.radix-ui.com) |
| **Charts** | [Recharts](https://recharts.org) |
| **Forms** | [React Hook Form](https://react-hook-form.com) · [Zod](https://zod.dev) |
| **Icons** | [lucide-react](https://lucide.dev) |
| **Price data** | [CoinGecko API](https://www.coingecko.com/en/api) (free tier) |
| **Package manager** | [Bun](https://bun.sh) |
| **Deploy** | GitHub Actions → GitHub Pages (static `github_pages` Nitro preset) |

---
## 🚀 Live Demo & Deployment

The site is deployed to **GitHub Pages** straight from the `main` branch — every push triggers
the [`Deploy to GitHub Pages`](.github/workflows/deploy-pages.yml) workflow, which builds a fully
static bundle (Nitro `github_pages` preset, prerendered homepage) and publishes it.

🌐 **Live URL:** <https://bossincrypto.github.io/crypto-tracker-dashboard/>

### How it works

1. Push to `main` → workflow runs `bun install` → `bun run build` (with `DEPLOY_TARGET=github-pages`
   and a base path of `/crypto-tracker-dashboard/`).
2. The build prerenders `/` and `/sitemap.xml` to real HTML, adds a SPA-fallback `404.html` and
   `.nojekyll`, then uploads `.output/public` as a Pages artifact.
3. The `deploy-pages` job publishes the artifact to GitHub Pages.

---

## 💻 Quick Start (Local)

> Requires [Bun](https://bun.sh) ≥ 1.3 (Node ≥ 20 also works).

```bash
# 1. Clone
git clone https://github.com/BOSSincrypto/crypto-tracker-dashboard.git
cd crypto-tracker-dashboard

# 2. Install dependencies
bun install

# 3. Start the dev server (http://localhost:3000)
bun run dev

# 4. Production build (static, GitHub Pages preset)
DEPLOY_TARGET=github-pages VITE_BASE_PATH=/ bun run build

# 5. Preview the production build locally
bun run preview
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React 19 + TanStack Start (file-based routing + SSR)    │
└──────────────────────────────────────────────────────────┘
        │ routes/__root.tsx  → app shell, QueryClient, <head>
        │ routes/index.tsx   → assembles the dashboard
        ▼
┌──────────────── hooks/ ────────────────┐   ┌──── lib/crypto/ ────┐
│ use-portfolios    portfolio state (LS)  │   │ coingecko.ts  API    │
│ use-transactions  CRUD transactions     │   │ calculations  P&L    │
│ use-coin-prices   live prices (RQ)      │   │ analytics     risk   │
│ use-coin-search   catalog search        │   │ storage       LS     │
│ use-dashboard-data single source of truth│   │ import-export CSV   │
└─────────────────────────────────────────┘   └──────────────────────┘
        │                                              │
        ▼                                              ▼
┌──────────────── components/crypto/ (presentational, ErrorBoundary per panel) ────────────────┐
│ Dashboard · KpiCards · PortfolioLineChart · AllocationPieChart · HoldingsTable ·            │
│ AnalyticsPanel · RiskMetricsPanel · CostVsValueChart · CashFlowWaterfall ·                  │
│ MonthlySummaryTable · TransactionsTable · AddTransactionDialog · ImportExportMenu · …      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Design principles**
- **Local-first:** all state in `localStorage`; only prices hit the network.
- **Single source of truth:** `use-dashboard-data` merges portfolios, transactions, prices and the
  derived portfolio model into one reference-stable object so memoized panels skip re-renders.
- **Correct accounting:** average-cost-basis P&L; sells reduce cost basis proportionally and post
  realized gains/losses.
- **Fault-tolerant:** each panel has its own `ErrorBoundary`; Recharts panels are `lazy()`-loaded.

---

## 📂 Project Structure

```text
.
├── .github/workflows/deploy-pages.yml   # CI: build → deploy to GitHub Pages
├── public/                              # favicon, robots.txt, llms.txt, .nojekyll
├── src/
│   ├── components/
│   │   ├── crypto/                      # dashboard feature components
│   │   └── ui/                          # shadcn/ui primitives
│   ├── hooks/                           # state + data hooks
│   ├── lib/crypto/                      # pure logic (calc, risk, storage, API)
│   └── routes/                          # TanStack file-based routes
├── package.json
└── vite.config.ts                       # GH Pages build toggles
```

---

## 🗺️ Roadmap

- [ ] Watchlists & price alerts
- [ ] More fiat currencies & locale formatting
- [ ] Dividends / staking rewards analytics
- [ ] Keyboard-first navigation
- [ ] Optional encrypted cloud sync (opt-in)

---

## 🤝 Contributing

Contributions are welcome! 💜

1. Fork the repo & create a branch: `git checkout -b feat/my-feature`
2. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org)
3. Make sure `bun run lint` passes
4. Open a Pull Request against `main`

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

### 🏷️ Topics

`#crypto` `#portfolio-tracker` `#bitcoin` `#cryptocurrency` `#react` `#react19` `#tanstack-start`
`#typescript` `#vite` `#tailwindcss` `#shadcn-ui` `#coingecko` `#recharts` `#local-first`
`#pwa` `#github-pages` `#opensource`

⭐ **Found this useful? Give the repo a star!** ⭐

</div>
