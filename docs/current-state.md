# Current state

_Last updated: 22 March 2026 (v0.7.1)_

---

## What is working

- **`POST /run`** — single-pass Monte Carlo endpoint; accumulation + drawdown in one call
- **State pension offset** — per-person, inflated each year, reduces portfolio draw
- **Income target model** — withdrawal rate sets total income target; surplus state pension reinvests
- **p1–p99 fan chart data** — every percentile by age returned in response, ready for web UI
- **CLI scenario loop** — prompts retirement ages + withdrawal rate, shows previous values in brackets, asks to re-run
- **Household retirement trigger** — triggers on fewest years-to-retirement person, not lowest retirement age
- All income figures displayed in today's money (real terms)
- **React web UI** (`ui/`) — three-step wizard (person details → assets → scenario); Panel 1 fully live with retirement age spinners, income field, retire-together toggle, solvency bar and label; Panels 2/3/4 rendered as placeholders
- **CORS enabled** on Express server for local UI development
- **`POST /solve/income`** — binary-search endpoint: given fixed retirement ages + solvency target + tolerance (default 2%), returns maximum sustainable monthly income
- **`POST /solve/ages`** — binary-search endpoint: over a [floor, floor+20] year window, returns earliest retirement ages that achieve the income + solvency target
- **`math.js`** — pure math utilities (`sampleNormal`, `logNormalParams`, `percentile`, `interpolateSolventAt`) extracted from the former `monteCarlo.js`; no duplication across files
- **CLI `--solve income`** — prompts retirement ages, solvency %, reference age; calls `/solve/income`; re-run loop
- **CLI `--solve ages`** — prompts income target, floor ages (default 67), solvency %, reference age; calls `/solve/ages`; re-run loop
- Input files renamed: `nigel-mimi.json`, `bob-alice.json`

## What is in progress / next

- **v0.8** — Panel 2 (Other options): wire `POST /solve/income` and `POST /solve/ages` into the React UI

## Known issues / rough edges

- `docs/flow.md` contains a now-superseded single-page wireframe. The canonical UI docs are in `docs/ui/flows/` and `docs/ui/screens/`.

## Deferred

- Panel 2 and 3 implementation (solve-for-income / solve-for-age) — v0.7/v0.8
- Annual contribution growth (currently fixed nominal)
- Other income streams (rental, part-time work, defined benefit pensions)
- Tax modelling (ISA vs. pension drawdown, income tax)
- Single asset class only (no bond/equity split or glide path)
- Fan chart / portfolio percentile visualisation in the UI
- Deployment / hosting

## Versions shipped

| Version | What was built |
|---------|---------------|
| v0.1 | Basic accumulation, single portfolio, log-normal returns, Python CLI |
| v0.2 | Multi-person/account, stochastic inflation, real output |
| v0.3 | Two-stage drawdown API, interactive CLI, survival table, income in today's money |
| v0.4 | State pension, income target model, surplus reinvestment |
| v0.5 | Single-pass MC, `POST /run`, scenario loop, p1–p99 fan chart data |
| v0.6 | React web UI: 3-step wizard, Panel 1 live, Panels 2–4 placeholder |
| v0.7 | Server cleanup + `math.js` refactor; `POST /solve/income` + `POST /solve/ages`; CLI `--test` harness |
| v0.7.1 | CLI `--solve income` + `--solve ages`; remove `--test`; tolerance on `/solve/income`; binary search on `/solve/ages`; 2,000 sims for solve search |

## How to run

```bash
# Terminal 1 — server
cd server && node src/index.js

# Terminal 2 — web UI
cd ui && npm run dev
# → http://localhost:5173

# Terminal 2 (alternative) — CLI (venv must be active)
source .venv/bin/activate
cd cli && python retirement.py --input inputs/nigel-mimi.json

# Solve for maximum sustainable income
cd cli && python retirement.py --input inputs/nigel-mimi.json --solve income

# Solve for earliest retirement ages
cd cli && python retirement.py --input inputs/nigel-mimi.json --solve ages
```
