# 💵 Income Calculator

A fully-featured, fully client-side US income calculator. The entire tax engine is
written in **Rust**, compiled to **WebAssembly**, and driven by an **Angular** UI —
so every calculation runs in your browser and nothing you type ever leaves the page.
Deploys to **GitHub Pages** automatically on every push to `main`.

## Features

**Income**
- Multiple income sources: salary, hourly (with overtime hours & multiplier), bonus,
  commission, tips, self-employment/1099, rental, interest
- Every pay frequency: hourly, daily, weekly, biweekly, semi-monthly, monthly,
  quarterly, annual — with a full per-period take-home table (annual → hourly)

**Federal tax (tax year 2025)**
- All four filing statuses, 2025 brackets, standard vs itemized deduction
- FICA: Social Security wage base, Medicare, Additional Medicare surtax
- Self-employment tax with W-2 wage-base coordination and the ½ SE deduction
- Long-term capital gains & qualified dividends with proper bracket stacking
- Net investment income tax (NIIT)
- Child tax credit & other-dependent credit with AGI phase-out
- Interactive federal bracket visualization

**State tax**
- All 50 states + DC: real progressive brackets for CA & NY, exact statutory rates
  for flat-tax states, labeled effective-rate approximations for the rest

**Deductions & benefits**
- Pre-tax: traditional 401(k) (% or $, IRS limits + catch-up), employer match,
  traditional IRA, HSA, FSA, health/dental/vision premiums, commuter — with correct
  FICA treatment of cafeteria-plan items (401(k) still pays FICA; premiums don't)
- Post-tax: Roth 401(k) (shares the elective deferral limit), Roth IRA (shared IRA
  limit), life insurance, union dues, garnishments

**Insights & tools**
- Take-home hero with effective/marginal rates and "where the money goes" donut
- Employer's true cost of employment (employer FICA, FUTA, 401(k) match)
- 50/30/20 budget suggestion
- Savings projection: compound growth, contribution raises, inflation-adjusted
  ("today's dollars") balance, interactive chart
- Scenario A/B comparison (raise, state move, 401(k) change, going freelance…)
- CSV / JSON export, print-friendly layout
- Dark mode, localStorage persistence, input-limit warnings

## Architecture

```
crates/
  core/     income-calc-core    — pure Rust tax engine + unit tests
  wasm/     income-calc-wasm    — wasm-bindgen bindings (JSON in / JSON out)
  server/   income-calc-server  — optional Axum REST API sharing the same core
frontend/   Angular 20 app (signals, standalone components, hand-rolled SVG charts)
.github/workflows/
  deploy.yml  — build WASM + Angular → GitHub Pages on push to main
  ci.yml      — fmt, clippy, tests, full build on PRs/branches
```

The same Rust core powers both deployment modes:

- **GitHub Pages (default):** Rust → WASM runs in the browser. Zero backend.
- **Self-hosted API:** `cargo run -p income-calc-server` exposes
  `POST /api/calculate`, `POST /api/project`, `GET /api/states`, `GET /api/health`
  (set `FRONTEND_DIST=frontend/dist/frontend/browser` to also serve the UI).

## Local development

Prerequisites: Rust (with `wasm32-unknown-unknown` target), Node 22+, wasm-pack.

```bash
rustup target add wasm32-unknown-unknown
npm install -g wasm-pack

# 1. Build the WASM engine (regenerates frontend/src/app/wasm/pkg)
wasm-pack build crates/wasm --target web --release \
  --out-dir ../../frontend/src/app/wasm/pkg --out-name income_calc

# 2. Run the frontend
cd frontend
npm install
npm start          # http://localhost:4200

# Rust tests
cargo test --workspace
```

## Deploying to GitHub

Push to `main` (or run the *Deploy to GitHub Pages* workflow manually). The
workflow builds the site and force-pushes it to the `gh-pages` branch, which
GitHub Pages picks up automatically — the site publishes to
`https://<user>.github.io/<repo>/` a minute or two later.

The workflow injects the repo name as `--base-href`, so it works under any
repository name without configuration. If the site doesn't appear after the
first deploy, check **Settings → Pages** — Source should be
**Deploy from a branch** / `gh-pages`.

## Disclaimer

Estimates for planning purposes only — not tax, legal, or financial advice. State
calculations are simplified (local taxes, state-specific credits, and some
deductions are not modeled). Consult a professional for filing decisions.

## License

[MIT](LICENSE)
