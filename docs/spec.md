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

Three-step wizard: **person details → accounts → scenario screen**.

### Panel 1 — Your retirement goal

Retirement age spinners (per person), monthly income field, retire-together toggle (two-person), solvency bar (`1 − probabilityOfRuin`), projected pot (median real pot at retirement), at-a-glance solvency label. Re-runs on every control change (debounced).

Solvency label thresholds (probability solvent at age 90):

| Condition | Label |
|-----------|-------|
| < 50% | Money is likely to run out before your 90s |
| 50–84% | Reasonable chance money lasts into your 90s |
| 85–95% | Money is likely to last into your 90s |
| > 95% | Money is very likely to last well into your 90s |

### Panel 2 — Other options you could consider

Two computed alternatives derived from parallel solve calls, updated after every Panel 1 result:

| Solvency bucket | Left slot | Right slot |
|-----------------|-----------|------------|
| < 85% at 90 (buckets 1 & 2) | Sustainable income at current ages | Ages required for current income |
| ≥ 85% at 90 (buckets 3 & 4) | Income achievable if retired 2 years earlier | Ages needed for 20% higher income |

Shows skeleton placeholders while solve calls are in flight. Shows "Not available" if a solve call returns 422.

### Panel 3 — Some options that might work for you

2–3 scenario cards derived from Panel 2 results. Each card shows retirement ages, monthly income, and "to age 90+" label. The current-plan card is highlighted in buckets 3 & 4.

### `/scenarios` page

Pre-built scenario files (in `ui/src/scenarios/`) listed as cards. Selecting one jumps directly to the scenario screen, bypassing the wizard. Accessible at `/scenarios`.

---

## CLI

Interactive scenario loop: prompts for retirement ages and withdrawal rate (showing previous values in brackets), runs simulation, prints accumulation snapshot and drawdown table in today's money, asks to re-run.

**`--solve income`**: prompts retirement ages, solvency %, and reference age; calls `/solve/income`; re-run loop.

**`--solve ages`**: prompts income target, floor retirement ages (default 67), solvency %, and reference age; calls `/solve/ages`; re-run loop.
