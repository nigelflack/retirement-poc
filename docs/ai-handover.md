# AI Handover

_Last updated: v0.13 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.13 (complete)** — Spending rename + per-person income streams + labels.

Key changes from v0.12:
- **Spending rename (breaking):** `monthlyIncomeTarget` → `monthlySpendingTarget`; `incomeSchedule` → `spendingSchedule`; `annualIncomeTarget` → `annualSpendingTarget` in response. Engine variable `incomeTargetByYear` → `spendingTargetByYear`.
- **Per-person `incomeStreams`** (optional array on each person): each entry has `fromYearsFromToday`, optional `toYearsFromToday` (exclusive; absent = run to end), `monthlyAmount`, optional `label`. The adapter resolves these to `otherIncomeByYear` (summed across all people) and passes to the engine. The engine offsets the annual draw: `draw = max(0, inflatedSpendingTarget − totalSP − otherIncome)`.
- **Labels (optional `label` string)** on: top-level scenario, `spendingSchedule[]`, `contributionSchedule[]`, `capitalEvents[]`, `incomeStreams[]`. Display-only; no behavioural effect.
- `docs/api.md` updated with all new field names and `incomeStreams` / `label` documentation.
- Sample JSON files (`cli/inputs/nigel-mimi.json`, `ui/src/scenarios/nigel-mimi.json`) updated with new field names, labels, and an example BTL income stream for Nigel.
- Server tests: 22/22 passing (includes 2 new income stream tests).

**Note:** `statePension.annualAmount` remains annual (unconverted) — intentional. Income streams are only active during drawdown (accumulation-phase income stream support deferred).

---

## What is in progress / next

Nothing in progress. See `docs/backlog.md` for candidate next items.

---

## Known issues / rough edges

- Step-change UI supports exactly 2-entry schedules (flat → one step). Multi-step schedules from file are ignored by the UI (though the server supports them).
- Solve endpoints (Panel 2) always use the flat model — step-change inputs are not forwarded to `/solve/income` or `/solve/ages`.
- Capital events from a loaded file are passed through to the simulation but cannot be edited in the UI.
- Income streams from a loaded file are passed through to the simulation but cannot be edited in the UI.

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
