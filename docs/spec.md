# Retirement Calculator — Current System

This document describes what the system currently does. For next-iteration plans, see `docs/iterations/`. For API contracts, see `docs/api.md`. For technical architecture, see `docs/architecture.md`. For current version, known issues and how to run, see `docs/ai-handover.md`.

---

## What the system does

A household retirement planning tool. Users provide current ages, savings and contribution rates, state pension entitlements, and an income target in retirement. The system runs a Monte Carlo simulation to show the probability their money lasts through retirement, and can solve for the maximum sustainable income or earliest viable retirement ages.

---

## Domain model and rules

### Household retirement

The household retires when the first person reaches their retirement age — the person with the **fewest years to retirement**, not the lowest absolute retirement age.

```
householdRetirementAge = person with min(retirementAge − currentAge)
```

### Income target model

The withdrawal rate sets the total household annual income target as a fraction of the real pot at retirement. Each drawdown year:

- The income target is inflated by that year's sampled inflation factor
- Active state pensions (per person, paid from their state pension age) offset the portfolio draw
- `portfolioDraw = max(0, inflatedTarget − sumActivePensions)`
- Surplus state pension (when pensions exceed target) is reinvested into the portfolio
- **Ruin**: first year `portfolioDraw > portfolioBalance`

### Monte Carlo simulation

Single-pass: each path runs continuously from today through accumulation and into drawdown in one loop. Returns and inflation are sampled independently from log-normal distributions each year. Default 10,000 paths.

Solve endpoints run 2,000 paths per search iteration for speed.

### Solve modes

**Solve for income** (`POST /solve/income`): binary search over monthly income to find the maximum amount sustainable at fixed retirement ages and a solvency target (default 85% at age 90, tolerance ±2%).

**Solve for ages** (`POST /solve/ages`): binary search over a retirement age offset window (0–20 years from a floor) to find the earliest ages at which a given monthly income meets the solvency target. All people's ages advance together to preserve the gap between them.

---

## Web UI

Three-step wizard: **person details → accounts → scenario screen**. All wizard navigation is non-destructive — `people` state is never cleared when navigating back or editing. Forms repopulate from existing state on re-entry.

### Wizard — Step 1: Person details

Collects name and age for one or two people. Pre-populates from existing state when navigating back. Includes:
- "Load from file" button — opens a file picker; valid scenario JSON jumps to the scenario screen
- "View example scenarios →" link to `/scenarios`

### Wizard — Step 2: Your assets

Collects all per-person and household financial data. Pre-populates from existing state when navigating back ("Edit accounts") from the scenario screen.

**Layout**: tabs — one tab per person, plus a "Household" tab. All sections within each tab are independently collapsible (accordion):

**Per-person tab sections:**
- **Accounts** (always visible) — one row per account: label (text), balance (£), and monthly contribution (£). Add/remove rows.
- **State pension** (always visible) — annual amount (£) and from-age (years). A "Has state pension" checkbox gates the fields.
- **Contributions** (collapsible) — multi-step `contributionSchedule`. Columns: `Month`, `Monthly (£)`, `Label (optional)`, ✕. Entries are sorted by month ascending. If no schedule rows exist, the per-account `monthlyContribution` is used as the flat rate.
- **Income streams** (collapsible) — per-person `incomeStreams`. Columns: `From (yrs)`, `To (yrs)`, `Monthly (£)`, `Label (optional)`, ✕. `To` is optional (blank = run to end of drawdown).

**Household tab sections:**
- **Scenario label** — a text input for the optional top-level `label` string.
- **Capital events** (collapsible) — list of one-off cash flows. Columns: `Year offset`, `Amount (£)`, `Label (optional)`, ✕. Year offset is years from today; negative amounts are outflows.

### Scenario screen header

`[Edit details]` — returns to step 1 (data preserved). `[Edit accounts]` — returns to step 2 (data preserved). `[Save]` — downloads `people` as a JSON file. `[Load]` — opens a file picker; valid JSON replaces people state and stays on the scenario screen.

### Panel 1 — Your retirement goal

Retirement age spinners (per person), monthly income field, retire-together toggle (two-person), solvency bar (`1 − probabilityOfRuin`), projected pot (median real pot at retirement), at-a-glance solvency label. Re-runs on every control change (debounced).

**Spending schedule** (collapsible, under the income field) — a multi-step `spendingSchedule` list. Columns: `From year` (years from retirement), `Monthly (£)`, `Label (optional)`, ✕. "+ Add step" appends a new row. Steps are sent as `spendingSchedule` in the simulation payload; overrides the flat monthly income for those years onwards.

Solvency label thresholds (probability solvent at age 90):

| Condition | Label |
|-----------|-------|
| < 50% | Money is likely to run out before your 90s |
| 50–84% | Reasonable chance money lasts into your 90s |
| 85–95% | Money is likely to last into your 90s |
| > 95% | Money is very likely to last well into your 90s |

**View detailed breakdown** — a text link that appears below the solvency bar once a result is available. Navigates to `/detail` (the detail viewer screen), passing the full simulation result and scenario context via router state.

### Panel 2 — Other options you could consider

Two computed alternatives derived from parallel solve calls, updated after every Panel 1 result:

| Solvency bucket | Left slot | Right slot |
|-----------------|-----------|------------|
| < 85% at 90 (buckets 1 & 2) | Sustainable income at current ages | Ages required for current income |
| ≥ 85% at 90 (buckets 3 & 4) | Income achievable if retired 2 years earlier | Ages needed for 20% higher income |

Shows skeleton placeholders while solve calls are in flight. Shows "Not available" if a solve call returns 422.

### Panel 3 — Some options that might work for you

2–3 scenario cards derived from Panel 2 results. Each card shows retirement ages, monthly income, and "to age 90+" label. The current-plan card is highlighted in buckets 3 & 4. Cards are clickable — clicking a card loads its retirement ages and monthly income into Panel 1 and triggers a new run.

### Detail viewer (`/detail`)

Full-detail breakdown of a simulation result. Reached from the scenario screen via `[View detailed breakdown →]`. Reads all data from React Router location state; shows a fallback if accessed directly without state.

**Header**: household name, ages, retirement ages, monthly spending, solvency at 90 percentage. Back link navigates to the previous page.

All simulation requests include `debug: true`, so responses contain `resolvedSchedules` (the four pre-resolved dense arrays used by the engine).

**Three tabs:**

1. **Year by year** — scrollable table. Columns: calendar year, per-person age, phase (A/D, ← retire at transition), total contributions (£/yr), income streams (£/yr), spending target (£/yr), capital event (coloured, signed; only if events present), per-person state pension (from `fromAge` onward), real p10/p50/p90 portfolio. Data sourced from `resolvedSchedules` + `portfolioPercentiles.byAge`.

2. **Fan chart** — Recharts `ComposedChart`. x = age, y = real portfolio value (today's money). Layers: p10–p90 outer band (light fill), p25–p75 inner band (medium fill), p50 median line. Vertical reference line at `householdRetirementAge`.

3. **Spending sources** — Recharts `BarChart` (stacked), drawdown years only. Monthly £ in today's money. Bars: portfolio draw, state pension, income streams. Line overlay: spending target. Capital events annotated as dashed vertical reference lines.

### `/scenarios` page

Pre-built scenario files (in `ui/src/scenarios/`) listed as cards. Selecting one jumps directly to the scenario screen, bypassing the wizard. Accessible at `/scenarios`.

---

## CLI

Interactive scenario loop: prompts for retirement ages and withdrawal rate (showing previous values in brackets), runs simulation, prints accumulation snapshot and drawdown table in today's money, asks to re-run. `survivalTable` is subsampled to 5-year intervals for display (filters to entries where `(age − householdRetirementAge) % 5 == 0`).

**`--solve income`**: prompts retirement ages, solvency %, and reference age; calls `/solve/income`; re-run loop.

**`--solve ages`**: prompts income target, floor retirement ages (default 67), solvency %, and reference age; calls `/solve/ages`; re-run loop.
