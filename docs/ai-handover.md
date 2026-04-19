# AI Handover

_Last updated: v0.19 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.20 (complete)** — Tax approximation, net-worth split, pension taper warnings.

Key changes from v0.19:

- **`server/config/simulation.json`**: Added `tax` config block (UK income tax bands, personal allowance taper threshold, pension annual allowance taper threshold).
- **`server/src/routes/simulate.js`**:
	- Tax calculation helpers: `calculateUKTax()` (progressive UK bands + personal allowance taper)
	- Taper detection: `detectTaperWarnings()` (run-level summary + per-year debug entries)
	- Income items now carry `taxable` flag (default `false`, backward-compatible)
	- Response includes `warnings[]` and `netWorthPercentiles`
- **`server/src/simulation/engine.js`**:
	- Engine now tracks non-liquid (property) and total net-worth per path
	- Returns `netWorthPercentiles.byAge` with `liquid`, `nonLiquid`, `total` objects (nominal + real, p1–p99)
- **`ui/src/components/scenario/ScenarioScreen.jsx`**: Displays `warnings` array from API response
- **`ui/src/pages/DetailPage.jsx`**: Net-worth split panel showing liquid/non-liquid/total p50 for selected year
- **Tests**: 3 new engine tests covering `netWorthPercentiles` shape and presence
- **Validation**: All 20 engine tests pass; `npm run build` succeeds in `ui/`.

**Previous (v0.19)** — Scenario navigation improvements and year-detail inspection viewer.

---

## What is in progress / next

Nothing in progress.

Planned:
- **v0.21**: Restore tabbed detail views (year detail, table, fan, spending) + narrative text passthrough (`openingText`, item labels). Plan in `docs/iterations/v0-21.md`.

Candidates:
- Reintroduce and redesign the wizard/data-input flow against the new API contract.
- Add richer scenario management persistence (deferred): JSON editor and/or DB-backed storage.
- See `docs/backlog.md` for further candidates.

---

## Known issues / rough edges

- **Wizard flow is still old-format** and not part of the active scenario-explorer runtime path.
- **Solve endpoints** are 501 stubs. Panel 2 in ScenarioScreen handles this gracefully but cannot return true recommendations yet.
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
