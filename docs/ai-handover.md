# AI Handover

_Last updated: v0.23 complete_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.25 (complete)** — Cashflow Statement per year: UI-only derived section reconciling opening equity → net surplus → capital flows → implied investment return → closing equity. Closing equity matches balance sheet exactly.

**v0.24 (complete)** — Income Statement per year: `incomeStatementByYear` in API response (real amounts, tax/NI scalars, expense stripped of tax items), structured Income Statement UI section.

**v0.23 (complete)** — Household Balance Sheet: per-pot real p50 values, mortgage liabilities in API response, balance sheet UI on detail page.

Key changes from v0.22:

- **`server/src/simulation/engine.js`**:
  - `runPath` now tracks `realPotsByYear`: per-pot, per-year value deflated by cumulative inflation. Returned as `realPotsByYear` from each path.
  - `simulate` accumulates these into `realPotValsByYear` (year × pot × path), then computes median per pot per year → `potPercentiles.byYear[y].byPot[potId].realP50`.
  - `netWorthPercentiles` now returns **real only** (nominal arrays dropped). Each `byAge` entry has `liquid.real`, `nonLiquid.real`, `total.real` (p1–p99).
- **`server/src/routes/simulate.js`**:
  - `mortgageBalances` in per-year state is now flat: `{ potId: outstandingBalance }` (was nested object).
  - After year-array construction, `liabilitiesByYear` is built: `liabilities.byYear[y].mortgageBalances` keyed by pot id.
  - Response gains two new top-level fields: `potPercentiles` and `liabilities`.
- **`server/src/simulation/engine.test.js`**:
  - All tests updated to use `real[49]` instead of `nominal[49]` for net-worth assertions.
  - Depreciating and haircut test expected values updated to correct real-deflated amounts.
  - New test: `potPercentiles: response includes byYear entries with realP50 per pot`.
- **`ui/src/components/scenario/ScenarioScreen.jsx`**: Passes `pots: scenario?.pots ?? []` in navigate state to detail page.
- **`ui/src/pages/DetailPage.jsx`**: Balance sheet section replaces the former net-worth 3-card widget. Shows per-pot asset rows (real p50), mortgage liability rows, total assets, total liabilities, net equity.
- **`ui/src/scenarios/nigel-mimi-same-house.json`**: Added `main_residence` property pot (£625k value, £415k mortgage, repayment, 4.34%, £50k/year). Removed manual mortgage expense entry that would have double-counted. Removed `tequila_wharf_sale` capital event.

Validation:
- `cd server && npm test` — 43 tests, 0 failures
- `cd ui && npm run build` — build succeeds


- **`server/src/routes/simulate.js`**:
  - Added per-person tax/NI grouping via optional income `owner` field (with household fallback bucket for backward compatibility)
  - Added property-level mortgage resolution (repayment and interest-only) with auto-stop at payoff
  - Added BTL fields on property pots: `monthlyRent`, `monthlyExpenses`
  - Added BTL taxable approximation: `rent - expenses - mortgage payments`
  - Added BTL mortgage-interest tax credit: `20% × annualInterestPaid` against annual tax liability
  - Added optional `capitalEvents.fromPot` + `haircut` mapping to engine `capitalIn`
  - Added optional `capitalEvents.propertyPotId` mortgage-payoff deduction from property sale amount
  - Debug output now includes `btlMortgageInterestCredit` and `mortgageBalances`
- **`server/src/simulation/engine.js`**:
  - Added `depreciating` pot behavior (`annualDepreciationPct`, deterministic annual value decline)
  - Treated `depreciating` as non-liquid for solvency checks and net-worth split
  - Added `capitalIn.haircut` support (`proceeds = potValue × (1 - haircut)`)
- **Tests**:
  - `server/src/routes/simulate.test.js` added (per-person tax/NI and BTL mortgage helper behavior)
  - `server/src/simulation/engine.test.js` expanded with depreciating + haircut liquidation tests
  - `server/src/simulation/math.js` compatibility aliases restored for existing tests (`sampleNormal`, `logNormalParams`, `interpolateSolventAt`)
- **Scenario**:
  - `ui/src/scenarios/nigel-mimi-same-house.json` now models BTL as property fields and removes guessed rental income line from `incomeSchedule`
  - Added `car_family` as `depreciating` pot and `owner` on employment income lines

Validation:
- `cd server && npm test` passes
- `cd ui && npm run build` passes

**Previous (v0.21)** — Gross pay taxing, employee NI, employer pension contributions, relief-at-source.

Key changes from v0.20:

- **`server/src/routes/simulate.js`**:
  - **Bugfix**: `calculateUKTax()` was computing tax on `income − allowance` and then comparing against absolute band floors — producing significantly understated tax. Fixed: basic-rate band now starts at the effective personal allowance, not the nominal band floor (critical for taper scenarios where allowance < £12,570).
  - Added `calculateUKNI(income)` — employee Class 1 NI: 0% up to £12,570; 8% on £12,570–£50,270; 2% above £50,270.
  - Added `getMarginalRate(income, taxConfig)` — returns statutory marginal rate, used for higher/additional-rate pension relief.
  - Income items now carry `employmentIncome` flag (default `false`); NI applies only to these items.
  - Tax and NI are injected as **cashflow expense items** (`income_tax`, `ni`) — no longer debug-only.
  - Employer pension contributions: `employerPensionPct` or `employerPensionAnnual` + `employerPensionPotId` per income line. Routed as non-taxable income + capitalOut to the pension pot (net effect on primary pot = zero).
  - Surplus entries for pension pots carry `grossUpFactor: 1.25` (HMRC relief-at-source top-up).
  - Higher/additional-rate relief against tax: `grossContrib × max(0, marginalRate − 0.20)`, estimated from surplus pension caps.
  - `detectTaperWarnings()` now sums only taxable income (not employer contribution pass-through items).
  - Debug output includes `ni` field per year alongside `tax`.
- **`server/src/simulation/engine.js`**:
  - `applySurplus()` supports optional `grossUpFactor` on surplus entries — pension pot receives `transfer × grossUpFactor`; primary pot loses only the net amount. The 25% uplift is "free money" from HMRC.
- **`server/src/simulation/engine.test.js`**: 5 new tests covering `grossUpFactor`, tax-as-expense, NI-as-expense, and employer pension routing pattern.
- **`ui/src/scenarios/nigel-mimi-same-house.json`**: Updated with `taxable`, `employmentIncome`, `employerPensionPct`, `employerPensionPotId` fields.
- **Docs**: `api.md`, `spec.md`, `architecture.md` updated.

**Accuracy**: ±5% for typical PAYE scenarios. Model is intentionally pessimistic (NI on full gross, no salary sacrifice reduction). NI amounts and tax amounts both appear in debug output.

**Previous (v0.20)** — Tax scaffold (debug-only), net-worth split, pension taper warnings.

---

## What is in progress / next

Nothing in progress.

No immediate candidates queued. See `docs/backlog.md` for next items.

Candidates:
- Reintroduce and redesign the wizard/data-input flow against the new API contract.
- Add richer scenario management persistence (deferred): JSON editor and/or DB-backed storage.
- See `docs/backlog.md` for further candidates.

---

## Known issues / rough edges

- **Wizard flow is still old-format** and not part of the active scenario-explorer runtime path.
- **Solve endpoints** are 501 stubs. Panel 2 in ScenarioScreen handles this gracefully but cannot return true recommendations yet.
- **Bob/Alice scenario** has no salary income, so ruin probability is high. Correct per scenario data.
- **nigel-mimi scenario expenses** were calibrated pre-tax. With gross income now taxed, the scenario will show a net deficit in accumulation years — reflecting real financial pressure, not a bug. Expenses or income figures may need recalibration.

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
