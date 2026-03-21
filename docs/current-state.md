# Current state

_Last updated: 21 March 2026_

---

## What is working

- **`POST /run`** — single-pass Monte Carlo endpoint; accumulation + drawdown in one call
- **State pension offset** — per-person, inflated each year, reduces portfolio draw
- **Income target model** — withdrawal rate sets total income target; surplus state pension reinvests
- **p1–p99 fan chart data** — every percentile by age returned in response, ready for web UI
- **CLI scenario loop** — prompts retirement ages + withdrawal rate, shows previous values in brackets, asks to re-run
- **Household retirement trigger** — triggers on fewest years-to-retirement person, not lowest retirement age
- All income figures displayed in today's money (real terms)

## What is in progress / next

- **Web UI** — wireframe drafted in `docs/flow.md`; framework not yet chosen; no implementation started
- **`docs/` housekeeping** — `architecture.md`, `decisions.md`, `current-state.md` just created; `.github/copilot-instructions.md` just added

## Known issues / rough edges

- Old server files still on disk but not wired up (`server/src/routes/simulate.js`, `server/src/routes/drawdown.js`, `server/src/simulation/monteCarlo.js`, `server/src/simulation/drawdown.js`). Safe to delete once confident v0.5 is stable.
- `docs/flow.md` holds a single wireframe for the whole UI. Should be split into `docs/ui/flows/` and `docs/ui/screens/` when wireframe work picks up.

## Deferred (documented in spec.md v0.5 known limitations)

- Annual contribution growth (currently fixed nominal)
- Other income streams (rental, part-time work, defined benefit pensions)
- Tax modelling (ISA vs. pension drawdown, income tax)
- Single asset class only (no bond/equity split or glide path)

## Versions shipped

| Version | What was built |
|---------|---------------|
| v0.1 | Basic accumulation, single portfolio, log-normal returns, Python CLI |
| v0.2 | Multi-person/account, stochastic inflation, real output |
| v0.3 | Two-stage drawdown API, interactive CLI, survival table, income in today's money |
| v0.4 | State pension, income target model, surplus reinvestment |
| v0.5 | Single-pass MC, `POST /run`, scenario loop, p1–p99 fan chart data |

## How to run

```bash
# Terminal 1 — server
cd server && node src/index.js

# Terminal 2 — CLI (venv must be active)
source .venv/bin/activate
cd cli && python retirement.py --input inputs/nigel.json
```
