# AI Handover

_Last updated: v0.17 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.17 (complete)** — Simulation engine modularisation and naming.

Key changes from v0.16:

- **`server/src/simulation/math.js`**: Renamed `sampleNormal` → `sampleStandardNormal`, `logNormalParams` → `lognormalFromArithmetic`, `percentilesOf5` → `summaryPercentiles` (moved from engine). Added `allPercentiles` (moved from engine), `buildReturnModel(config)`, `sampleInflationFactor(model, year, rng)`, `sampleReturnFactor(model, type, year, rng)`. Removed stale `interpolateSolventAt`.
- **`server/src/simulation/engine.js`** (was `run.js`): Renamed `runFull` → `simulate`. Accepts optional `rng` parameter (defaults to `sampleStandardNormal`) for deterministic testing. Extracted `runPath` (single simulation path), and named cashflow step functions `applyNetCashflow`, `applyCapitalTransfers`, `applySurplus`, `applyDraw`, `checkRuin`. `summaryPercentiles`/`allPercentiles` now sourced from `math.js`.
- **`server/src/routes/simulate.js`** (was `routes/run.js`): Updated to import `{ simulate }` from `engine.js`. No logic changes.
- **`server/src/index.js`**: Updated to mount `routes/simulate.js`.
- **Tests**: 17/17 pass. 4 new deterministic tests using injectable RNG (in `engine.test.js`, was `run.test.js`).

**Previous (v0.16)** — Full cashflow engine rewrite. Pots model, incomeSchedule, expenseSchedule, capitalEvents, surplusStrategy, drawStrategy. See `docs/iterations/v0-16.md`.

---

## What is in progress / next

Nothing in progress. Candidates:
- **UI fix**: Wizard and ScenarioScreen still use the old pre-v0.16 API contract. Do not expect the web UI to work.
- See `docs/backlog.md` for further candidates.

---

## Known issues / rough edges

- **UI is broken** — all wizard and scenario screens use the old API format. Do not expect the web UI to work.
- **Solve endpoints** are 501 stubs. Rebuilding solve requires a new adapter design; deferred.
- **Bob/Alice scenario** has no salary income, so ruin probability is high. Correct per scenario data.

---

## How to run

```bash
# Terminal 1 — server
cd server && node src/index.js

# Terminal 2 — CLI (scenario results only; no prompts)
cd cli && python3 retirement.py --input ../ui/src/scenarios/nigel-mimi.json

# JSON mode (raw response)
python3 retirement.py --input ../ui/src/scenarios/nigel-mimi.json --json

# Debug table (year-by-year)
python3 retirement.py --input ../ui/src/scenarios/nigel-mimi.json --debug

# Server tests
cd server && node --test src/simulation/engine.test.js
```
