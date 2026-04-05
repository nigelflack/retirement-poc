# AI Handover

_Last updated: v0.12 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.12 (complete)** — Schedule field renaming + monthly amounts + simple screen step-change inputs.

Key changes:
- All schedule amount fields in the JSON/API now use **monthly** values (`monthlyAmount`, `monthlyIncomeTarget`). The server adapter (`simulate.js`) multiplies them ×12 before the engine.
- Field renames: `fromYear` → `fromYearsFromToday` (contributions) or `fromYearsFromRetirement` (income), `year` → `yearsFromToday` (capital events).
- `annualIncomeTarget` in the `/simulate` request replaced by `monthlyIncomeTarget`.
- UI (`ScenarioScreen.jsx`) now supports inline step-change disclosure sections in Panel 1:
  - Per-person **contribution step-change** (expands below the age spinners): "reduces to £/mo for the last N years before retirement"
  - Household **income step-change** (expands below the income spinner): "reduces to £/mo after N years in retirement"
  - Sections auto-expand on file load if the loaded JSON contains a 2-entry schedule.
- Save/load now includes `monthlyIncomeTarget`, `contributionSchedule` (per person), `incomeSchedule`, and `capitalEvents`.

**Note:** `statePension.annualAmount` remains annual (unconverted) — this is intentional.

---

## What is in progress / next

Nothing in progress. See `docs/backlog.md` for candidate next items.

---

## Known issues / rough edges

- Step-change UI supports exactly 2-entry schedules (flat → one step). Multi-step schedules from file are ignored by the UI (though the server supports them).
- Solve endpoints (Panel 2) always use the flat model — step-change inputs are not forwarded to `/solve/income` or `/solve/ages`.
- Capital events from a loaded file are passed through to the simulation but cannot be edited in the UI.

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
