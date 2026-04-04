# AI Handover

_Last updated: 4 April 2026 (v0.11 complete)_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.11 (complete)** — Schedule-aware simulation engine + API overhaul. `POST /run` renamed to `POST /simulate`. `withdrawalRate` removed as an input; replaced by `annualIncomeTarget` (today's money). Three optional schedule fields added to `/simulate`: `contributionSchedule` (per person), `incomeSchedule` (household), `capitalEvents` (household). Server-side adapter (`resolveSchedules` in `simulate.js`) resolves sparse schedules to dense per-year arrays before calling `runFull`. Engine (`run.js`) updated to accept and use those arrays. Solve routes updated to remove internal `withdrawalRate` derivation. CLI prompt updated from withdrawal rate % to monthly income; `--debug` flag added for year-by-year table output. `withdrawalRate` remains as a computed output field on `/simulate` response.

---

## What is in progress / next

Nothing in progress. See `docs/backlog.md` for candidate next items.

---

## Known issues / rough edges

- UI does not yet expose `contributionSchedule`, `incomeSchedule`, or `capitalEvents` inputs — these are supported by the API and CLI only.

---

## How to run

```bash
# Terminal 1 — server
cd server && node src/index.js

# Terminal 2 — web UI
cd ui && npm run dev
# → http://localhost:5173

# Terminal 2 (alternative) — CLI
source .venv/bin/activate
cd cli && python retirement.py --input inputs/nigel-mimi.json

# Solve modes
python retirement.py --input inputs/nigel-mimi.json --solve income
python retirement.py --input inputs/nigel-mimi.json --solve ages

# Debug table (year-by-year)
python retirement.py --input inputs/nigel-mimi.json --debug

# Server tests
cd server && npm test
```
