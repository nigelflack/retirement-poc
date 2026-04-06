# AI Handover

_Last updated: v0.14 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.14 (complete)** — Full UI field coverage: all JSON-editable fields now have UI counterparts.

Key changes from v0.13:
- **Assets.jsx completely rewritten**: person tabs + Household tab layout. Per-person tabs include collapsible Contributions (multi-step `contributionSchedule`) and Income streams (`incomeStreams`) sections. Household tab includes Scenario label (text input) and Capital events (collapsible list editor). `onComplete` now receives `{ people, capitalEvents, label }` instead of a flat array.
- **App.jsx**: added `capitalEvents` (array) and `scenarioLabel` (string) state, threaded through to both Assets (for editing) and ScenarioScreen (for simulation + save/load). New `handleHouseholdLoad` callback for load-from-file to restore household fields.
- **ScenarioScreen.jsx**: contribution step-change UI removed (now handled in Assets). Income step-change replaced with a full **spending schedule** list editor (collapsible, multi-row, `fromYearsFromRetirement` / `monthlyAmount` / `label` columns). `buildPayload` reads contribution/income data directly from `people` objects (embedded by Assets). Payload uses `capitalEvents` and `scenarioLabel` from props.
- `docs/spec.md` updated: Step 2 now describes full person-tab + Household-tab structure; Panel 1 spending schedule section updated.
- No server changes. No CLI changes. No test changes required (server tests: 22/22).

**Previous (v0.13)** — Spending rename + per-person income streams + labels.

Key changes from v0.12:
- **Spending rename (breaking):** `monthlyIncomeTarget` → `monthlySpendingTarget`; `incomeSchedule` → `spendingSchedule`; `annualIncomeTarget` → `annualSpendingTarget` in response. Engine variable `incomeTargetByYear` → `spendingTargetByYear`.
- **Per-person `incomeStreams`** (optional array on each person): each entry has `fromYearsFromToday`, optional `toYearsFromToday` (exclusive; absent = run to end), `monthlyAmount`, optional `label`. The adapter resolves these to `otherIncomeByYear` (summed across all people) and passes to the engine. The engine offsets the annual draw: `draw = max(0, inflatedSpendingTarget − totalSP − otherIncome)`.
- **Labels (optional `label` string)** on: top-level scenario, `spendingSchedule[]`, `contributionSchedule[]`, `capitalEvents[]`, `incomeStreams[]`. Display-only; no behavioural effect.

---

## What is in progress / next

Nothing in progress. See `docs/backlog.md` for candidate next items.

---

## Known issues / rough edges

- Solve endpoints (Panel 2) always use the flat model — spending schedule and capital events are not forwarded to `/solve/income` or `/solve/ages`.

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
cd cli && python retirement.py --input ../ui/src/scenarios/nigel-mimi.json

# Solve modes
python retirement.py --input ../ui/src/scenarios/nigel-mimi.json --solve income
python retirement.py --input ../ui/src/scenarios/nigel-mimi.json --solve ages

# Debug table (year-by-year)
python retirement.py --input ../ui/src/scenarios/nigel-mimi.json --debug

# Server tests
cd server && npm test
```
