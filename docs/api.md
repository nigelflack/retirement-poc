# API Reference

Server runs on port 3000 (override with `PORT` env var). All endpoints accept and return JSON.

For the simulation model that underpins all three endpoints, see `docs/architecture.md`.

---

## `POST /simulate`

Run a full single-pass Monte Carlo simulation (accumulation + drawdown) and return percentile results.

`POST /run` was removed in v0.11. Any request to `/run` returns 404.

### Request

```json
{
  "people": [
    {
      "name": "Alice",
      "currentAge": 40,
      "retirementAge": 62,
      "accounts": [
        { "name": "SIPP", "currentValue": 100000, "monthlyContribution": 500 }
      ],
      "statePension": { "annualAmount": 11500, "fromAge": 67 },
      "contributionSchedule": [
        { "fromYearsFromToday": 0, "monthlyAmount": 500 },
        { "fromYearsFromToday": 10, "monthlyAmount": 800 }
      ],
      "incomeStreams": [
        { "label": "BTL rental", "fromYearsFromToday": 0, "toYearsFromToday": 10, "monthlyAmount": 800 }
      ]
    }
  ],
  "label": "Base case",
  "monthlySpendingTarget": 3333,
  "spendingSchedule": [
    { "fromYearsFromRetirement": 0, "monthlyAmount": 3333 },
    { "fromYearsFromRetirement": 13, "monthlyAmount": 2333, "label": "Reduced spending" }
  ],
  "capitalEvents": [
    { "yearsFromToday": 18, "amount": 50000, "label": "Inheritance" },
    { "yearsFromToday": 24, "amount": -10000, "label": "Car purchase" }
  ],
  "toAge": 100,
  "debug": false
}
```

- `retirementAge` — each person's intended retirement age; household retirement is the earliest across all people
- `accounts[].currentValue` — current pot value in today's £
- `accounts[].monthlyContribution` — monthly contribution until retirement (used as the default flat contribution if `contributionSchedule` is absent)
- `statePension` — optional; amounts in today's money, inflated in simulation
- `monthlySpendingTarget` — desired total household monthly spending in today's money (£). Required.
- `contributionSchedule` — optional per-person step schedule. `fromYearsFromToday` is years from today (`targetAge - currentAge`). `monthlyAmount` is monthly £ (adapter multiplies by 12). If absent, flat contribution from `accounts[].monthlyContribution` is used. Optional `label` string is for display only.
- `incomeStreams` — optional per-person array of other income sources active during drawdown. Each entry: `fromYearsFromToday` (start year, inclusive), `toYearsFromToday` (end year, exclusive; absent = run to end), `monthlyAmount`, optional `label`. Summed across all people and offset against the spending draw each year.
- `spendingSchedule` — optional household spending step schedule. `fromYearsFromRetirement` is years from household retirement (0 = retirement year). `monthlyAmount` is monthly £ (adapter multiplies by 12). If absent, `monthlySpendingTarget` is used flat for all drawdown years. Optional `label` string is for display only.
- `capitalEvents` — optional household lump-sum events. `yearsFromToday` is years from today. `amount` is signed (positive = inflow, negative = outflow). Applied before that year's return factor. Optional `label` string is for display only.
- `label` — optional top-level scenario label string; for display only.
- `toAge` — simulation horizon (default `100` if omitted)
- `debug` — if `true`, response includes `resolvedSchedules` (the three pre-resolved dense arrays). Default `false`.

### Response

```json
{
  "numSimulations": 10000,
  "householdRetirementAge": 62,
  "householdRetirementName": "Alice",
  "accumulationSnapshot": {
    "yearsToRetirement": 22,
    "nominal": { "p10": ..., "p25": ..., "p50": ..., "p75": ..., "p90": ... },
    "real":    { "p10": ..., "p25": ..., "p50": ..., "p75": ..., "p90": ... }
  },
  "annualSpendingTarget": 40000,
  "withdrawalRate": 0.038,
  "annualIncomeMedian": 40000,
  "annualIncomeP10": 28000,
  "annualIncomeP90": 40000,
  "statePensions": [{ "name": "Alice", "annualAmount": 11500, "fromAge": 67 }],
  "probabilityOfRuin": 0.04,
  "survivalTable": [
    { "age": 63, "probabilitySolvent": 0.99 },
    { "age": 64, "probabilitySolvent": 0.98 },
    ...
  ],
  "portfolioPercentiles": {
    "byAge": [
      { "age": 63, "nominal": [p1, p2, ..., p99], "real": [p1, p2, ..., p99] },
      ...
    ]
  }
}
```

- `annualSpendingTarget` — echoed from the request (spending target at retirement year), in today's money
- `withdrawalRate` — computed output only: `annualSpendingTarget / accumulationSnapshot.real.p50`. Never an input.
- `accumulationSnapshot` — household portfolio at the retirement year (nominal and real percentiles)
- `annualIncome*` — in today's money (real terms)
- `survivalTable` — probability of remaining solvent for every year from `householdRetirementAge+1` to `toAge` (annual)
- `portfolioPercentiles.byAge[n].nominal` — 99-element array (index 0 = p1, index 98 = p99); one entry per year from `currentAge+1` to `toAge`
- `portfolioPercentiles.byAge[n].real` — same shape; each path deflated by its own cumulative inflation (today's money)
- Raw simulation paths are never returned

**Debug-only response fields** (when `debug: true`):
- `resolvedSchedules.contributionByYear` — 2D array `[personIndex][year]`
- `resolvedSchedules.spendingTargetByYear` — 1D array `[year]`
- `resolvedSchedules.capitalEventsByYear` — 1D array `[year]`
- `resolvedSchedules.otherIncomeByYear` — 1D array `[year]`; sum of all `incomeStreams` across all people

---

## `POST /solve/income`

Binary-search for the maximum sustainable monthly income at fixed retirement ages and a given solvency target.

### Request

```json
{
  "people": [ ...same shape as POST /simulate, no schedule fields... ],
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90,
  "tolerance": 0.02
}
```

- `targetSolvencyPct` — desired probability of solvency at `referenceAge`, as a decimal (e.g. `0.85`)
- `referenceAge` — age at which solvency is measured
- `tolerance` — convergence band around `targetSolvencyPct`; default `0.02` (2 pp)
- Schedule fields (`contributionSchedule`, `spendingSchedule`, `capitalEvents`, `incomeStreams`) are not supported on solve endpoints.

### Response

```json
{
  "monthlyIncome": 2600,
  "survivalAtReferenceAge": 0.852
}
```

### Algorithm

Binary search over `monthlyIncome` from £0 to a ceiling of `accumulationSnapshot.real.p50 / 12`. Each iteration runs the simulation with a flat `annualSpendingTarget = mid × 12` and checks whether `interpolateSolventAt(survivalTable, referenceAge)` is within `tolerance` of `targetSolvencyPct`. Capped at 50 iterations. Each search iteration uses 2,000 simulations (vs 10,000 for `/simulate`).

### Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required..." }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| `tolerance` not in (0, 1) | 400 | `{ "error": "tolerance must be between 0 and 1 exclusive" }` |
| Cannot converge | 422 | `{ "error": "Could not find a sustainable income within the simulation bounds" }` |

---

## `POST /solve/ages`

Binary-search for the earliest retirement ages at which a household can sustain a given monthly income at a target solvency level.

### Request

```json
{
  "people": [
    {
      "name": "Bob",
      "currentAge": 50,
      "retirementAge": 55,
      "accounts": [...],
      "statePension": { "annualAmount": 9000, "fromAge": 67 }
    }
  ],
  "monthlyIncome": 3000,
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90
}
```

- `retirementAge` in each person object is the **floor** — the earliest retirement age to search from

### Response

```json
{
  "retirementAges": [
    { "name": "Bob", "retirementAge": 64 },
    { "name": "Alice", "retirementAge": 59 }
  ],
  "monthlyIncome": 3000,
  "survivalAtReferenceAge": 0.863
}
```

### Algorithm

Binary search over an age offset `[0, 20]` years added uniformly to all persons' floor `retirementAge`. The simulation is run at each candidate ages with `annualSpendingTarget = monthlyIncome × 12` (flat). Returns the lowest offset where solvency ≥ target. Each search iteration uses 2,000 simulations. Capped at ~6 iterations.

### Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required..." }` |
| `monthlyIncome` missing or ≤ 0 | 400 | `{ "error": "monthlyIncome must be a positive number" }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| Cannot reach target within 20-year window | 422 | `{ "error": "Could not find retirement ages that satisfy the solvency target" }` |

---

## Simulation configuration

`server/config/simulation.json` — shared by all endpoints:

```json
{
  "numSimulations": 10000,
  "annualReturnMean": 0.07,
  "annualReturnStdDev": 0.15,
  "annualInflationMean": 0.025,
  "annualInflationStdDev": 0.01
}
```

Solve endpoints (`/solve/income`, `/solve/ages`) override `numSimulations` to `2000` per search iteration internally.

---

## CLI input format

Input files in `cli/inputs/` supply people and account data. `retirementAge` and income target are prompted interactively at runtime. Optional schedule fields (`contributionSchedule` etc.) may be added to the JSON for future use.

```json
{
  "people": [
    {
      "name": "Nigel",
      "currentAge": 52,
      "accounts": [
        { "name": "SIPP", "type": "pension", "currentValue": 200000, "monthlyContribution": 800 }
      ],
      "statePension": { "fromAge": 67, "annualAmount": 11500 }
    }
  ]
}
```


---

## `POST /run`

Run a full single-pass Monte Carlo simulation (accumulation + drawdown) and return percentile results.

### Request

```json
{
  "people": [
    {
      "name": "Alice",
      "currentAge": 40,
      "retirementAge": 62,
      "accounts": [
        { "name": "SIPP", "currentValue": 100000, "monthlyContribution": 500 }
      ],
      "statePension": { "annualAmount": 11500, "fromAge": 67 }
    }
  ],
  "withdrawalRate": 0.04,
  "toAge": 100
}
```

- `retirementAge` — each person's intended retirement age; household retirement is the earliest across all people
- `accounts[].currentValue` — current pot value in today's £
- `accounts[].monthlyContribution` — monthly contribution until retirement
- `statePension` — optional; amounts in today's money, inflated in simulation
- `withdrawalRate` — fraction of the real pot at retirement taken as annual income target
- `toAge` — simulation horizon (default `100` if omitted)

### Response

```json
{
  "numSimulations": 10000,
  "householdRetirementAge": 62,
  "householdRetirementName": "Alice",
  "accumulationSnapshot": {
    "yearsToRetirement": 22,
    "nominal": { "p10": ..., "p25": ..., "p50": ..., "p75": ..., "p90": ... },
    "real":    { "p10": ..., "p25": ..., "p50": ..., "p75": ..., "p90": ... }
  },
  "withdrawalRate": 0.04,
  "annualIncomeMedian": 45000,
  "annualIncomeP10": 32000,
  "annualIncomeP90": 61000,
  "statePensions": [{ "name": "Alice", "annualAmount": 11500, "fromAge": 67 }],
  "probabilityOfRuin": 0.04,
  "survivalTable": [
    { "age": 63, "probabilitySolvent": 0.99 },
    { "age": 64, "probabilitySolvent": 0.98 },
    ...
  ],
  "portfolioPercentiles": {
    "byAge": [
      { "age": 63, "nominal": [p1, p2, ..., p99], "real": [p1, p2, ..., p99] },
      ...
    ]
  }
}
```

- `accumulationSnapshot` — household portfolio at the retirement year (nominal and real percentiles)
- `annualIncome*` — in today's money (real terms)
- `survivalTable` — probability of remaining solvent for every year from `householdRetirementAge+1` to `toAge` (annual, not 5-year intervals)
- `portfolioPercentiles.byAge[n].nominal` — 99-element array (index 0 = p1, index 98 = p99); one entry per year from `currentAge+1` to `toAge`
- `portfolioPercentiles.byAge[n].real` — same shape as `nominal`; each path's portfolio value is deflated by that path's own cumulative inflation before percentiles are computed (today's money)
- Raw simulation paths are never returned

---

## `POST /solve/income`

Binary-search for the maximum sustainable monthly income at fixed retirement ages and a given solvency target.

### Request

```json
{
  "people": [ ...same shape as POST /run... ],
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90,
  "tolerance": 0.02
}
```

- `targetSolvencyPct` — desired probability of solvency at `referenceAge`, as a decimal (e.g. `0.85`)
- `referenceAge` — age at which solvency is measured
- `tolerance` — convergence band around `targetSolvencyPct`; default `0.02` (2 pp)

### Response

```json
{
  "monthlyIncome": 2600,
  "withdrawalRate": 0.038,
  "survivalAtReferenceAge": 0.852
}
```

### Algorithm

Binary search over `monthlyIncome` from £0 to a ceiling of `accumulationSnapshot.real.p50 / 12`. Each iteration derives `withdrawalRate = (monthlyIncome × 12) / real.p50`, runs the simulation, and checks whether `interpolateSolventAt(survivalTable, referenceAge)` is within `tolerance` of `targetSolvencyPct`. Capped at 50 iterations. Each search iteration uses 2,000 simulations (vs 10,000 for `/run`).

### Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required..." }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| `tolerance` not in (0, 1) | 400 | `{ "error": "tolerance must be between 0 and 1 exclusive" }` |
| Cannot converge | 422 | `{ "error": "Could not find a sustainable income within the simulation bounds" }` |

---

## `POST /solve/ages`

Binary-search for the earliest retirement ages at which a household can sustain a given monthly income at a target solvency level.

### Request

```json
{
  "people": [
    {
      "name": "Bob",
      "currentAge": 50,
      "retirementAge": 55,
      "accounts": [...],
      "statePension": { "annualAmount": 9000, "fromAge": 67 }
    }
  ],
  "monthlyIncome": 3000,
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90
}
```

- `retirementAge` in each person object is the **floor** — the earliest retirement age to search from

### Response

```json
{
  "retirementAges": [
    { "name": "Bob", "retirementAge": 64 },
    { "name": "Alice", "retirementAge": 59 }
  ],
  "monthlyIncome": 3000,
  "survivalAtReferenceAge": 0.863
}
```

### Algorithm

Binary search over an age offset `[0, 20]` years added uniformly to all persons' floor `retirementAge`. At each step, the simulation is run at the candidate ages; if solvency ≥ target, the offset is a candidate and the search tries smaller values; otherwise it searches higher. Returns the lowest passing offset. Each search iteration uses 2,000 simulations. Capped at ~6 iterations (sufficient for a 20-year window).

### Error responses

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required..." }` |
| `monthlyIncome` missing or ≤ 0 | 400 | `{ "error": "monthlyIncome must be a positive number" }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| Cannot reach target within 20-year window | 422 | `{ "error": "Could not find retirement ages that satisfy the solvency target" }` |

---

## Simulation configuration

`server/config/simulation.json` — shared by all endpoints:

```json
{
  "numSimulations": 10000,
  "annualReturnMean": 0.07,
  "annualReturnStdDev": 0.15,
  "annualInflationMean": 0.025,
  "annualInflationStdDev": 0.01
}
```

Solve endpoints (`/solve/income`, `/solve/ages`) override `numSimulations` to `2000` per search iteration internally.

---

## CLI input format

Input files in `cli/inputs/` supply people and account data. `retirementAge` is **not** included — it is prompted interactively at runtime.

```json
{
  "people": [
    {
      "name": "Nigel",
      "currentAge": 52,
      "accounts": [
        { "name": "SIPP", "type": "pension", "currentValue": 200000, "monthlyContribution": 800 }
      ],
      "statePension": { "fromAge": 67, "annualAmount": 11500 }
    }
  ]
}
```
