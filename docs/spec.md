# Retirement Calculator

## v0.1

### Architecture

A two-component system communicating over HTTP:

```
[Python CLI] --POST JSON--> [Node.js/Express API] --returns JSON--> [Python CLI]
```

---

### Backend — Node.js + Express

**Entry point:** `server/src/index.js` — listens on port 3000 (overridable via `PORT` env var).

**Endpoint:** `POST /simulate`

**Input JSON:**
```json
{
  "pension": { "currentValue": 150000, "monthlyContribution": 500 },
  "isa":     { "currentValue": 50000,  "monthlyContribution": 200 },
  "currentAge": 40,
  "retirementAge": 65
}
```

- Pension and ISA are treated as a single combined portfolio
- Contributions are summed and applied annually

**Simulation — Monte Carlo:**
- Configured via `server/config/simulation.json`
- Parameters: `numSimulations`, `annualReturnMean`, `annualReturnStdDev`
- Returns are modelled as **log-normal** (derived from arithmetic mean and std dev)
- Accumulation only — no drawdown phase modelled
- Output is **nominal** (not inflation-adjusted)

**Output JSON:**
```json
{
  "numSimulations": 10000,
  "yearsToRetirement": 25,
  "inflationAdjusted": false,
  "percentiles": {
    "p10": 420000,
    "p25": 560000,
    "p50": 780000,
    "p75": 1050000,
    "p90": 1380000
  }
}
```

---

### CLI — Python

**Entry point:** `cli/retirement.py`

**Usage:**
```bash
python cli/retirement.py --input cli/inputs/example.json [--server http://localhost:3000] [--json]
```

- `--input` — path to input JSON file (required)
- `--server` — server base URL (default: `http://localhost:3000`)
- `--json` — print raw JSON response instead of formatted table

**Dependencies:** `requests` (see `cli/requirements.txt`)

**Virtual environment:** `.venv/` at project root
```bash
source .venv/bin/activate
```

---

## v0.2

### What's new

- Multi-person support — one or more named people per household
- Multi-account support — each person has named accounts of type `pension` or `isa`
- Stochastic inflation — inflation sampled independently each year in the Monte Carlo; output includes both nominal and real (today's money) values
- Per-person and household results in the response

### Architecture

Unchanged from v0.1.

---

### Backend — changes to `POST /simulate`

**Input JSON:**
```json
{
  "people": [
    {
      "name": "Alice",
      "currentAge": 40,
      "retirementAge": 65,
      "accounts": [
        { "name": "Workplace Pension", "type": "pension", "currentValue": 120000, "monthlyContribution": 400 },
        { "name": "Old SIPP",          "type": "pension", "currentValue": 30000,  "monthlyContribution": 100 },
        { "name": "S&S ISA",           "type": "isa",     "currentValue": 50000,  "monthlyContribution": 200 }
      ]
    },
    {
      "name": "Bob",
      "currentAge": 38,
      "retirementAge": 63,
      "accounts": [
        { "name": "Workplace Pension", "type": "pension", "currentValue": 80000,  "monthlyContribution": 300 },
        { "name": "ISA",               "type": "isa",     "currentValue": 20000,  "monthlyContribution": 150 }
      ]
    }
  ]
}
```

- All accounts per person are pooled into a single portfolio for simulation
- Account `type` is stored but not yet used to apply different rules

**Simulation — Monte Carlo:**
- Each year samples both an annual return and an annual inflation rate from independent log-normal distributions
- Nominal value: portfolio compounded by the sampled return each year
- Real value: nominal value deflated by the cumulative inflation path
- Household snapshot is taken at the **earliest retirement age** across all people; each person's individual result is taken at their own retirement age

**Updated `server/config/simulation.json`:**
```json
{
  "numSimulations": 10000,
  "annualReturnMean": 0.07,
  "annualReturnStdDev": 0.15,
  "annualInflationMean": 0.025,
  "annualInflationStdDev": 0.01
}
```

**Output JSON:**
```json
{
  "numSimulations": 10000,
  "people": [
    {
      "name": "Alice",
      "yearsToRetirement": 25,
      "nominal": { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 },
      "real":    { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 }
    },
    {
      "name": "Bob",
      "yearsToRetirement": 25,
      "nominal": { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 },
      "real":    { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 }
    }
  ],
  "household": {
    "referenceAge": "earliest retirement date",
    "nominal": { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 },
    "real":    { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 }
  }
}
```

---

### CLI — changes

- Formatted output shows a table per person (nominal + real side-by-side) followed by a household summary
- `--json` flag behaviour unchanged

---

### Deferred to v0.3

- Annual contribution growth rate
- Per-person `--person` filter on the CLI

---

## v0.3

### What's new

- New `POST /drawdown` endpoint — continues each accumulation path through the drawdown phase
- `POST /simulate` extended to return all 10,000 raw household path values alongside percentiles, enabling path-continuity into drawdown
- Interactive CLI session — accumulation results printed first, then a prompt loop for exploring withdrawal rates
- Survival table output — probability of solvency at each age during drawdown
- Annual income displayed alongside withdrawal rate

---

### Architecture

Two sequential API calls, with Stage 1 output feeding Stage 2:

```
[Python CLI]
  │
  ├─ POST /simulate ──────► [Stage 1: Accumulation MC]
  │    returns percentiles + raw paths array
  │
  └─ POST /drawdown ──────► [Stage 2: Drawdown MC]
       receives paths array + withdrawal params
       returns probability of ruin + survival table + percentiles over time
```

Stage 1 runs once. Stage 2 reruns on each new withdrawal rate without re-running accumulation.

---

### Stage 1 — changes to `POST /simulate`

**Input JSON:** unchanged from v0.2.

**Output JSON:** adds `paths` array to the household object:

```json
{
  "numSimulations": 10000,
  "people": [ ... ],
  "household": {
    "yearsToSnapshot": 25,
    "nominal": { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 },
    "real":    { "p10": 0, "p25": 0, "p50": 0, "p75": 0, "p90": 0 },
    "paths":   [425000, 1100000, 780000, ...]
  }
}
```

- `paths` contains all 10,000 nominal household pot values at the snapshot year, one per simulation path, in path index order
- The CLI passes this array directly to Stage 2; it is not printed to the user

---

### Stage 2 — new `POST /drawdown`

**Input JSON:**

```json
{
  "paths": [425000, 1100000, 780000, ...],
  "withdrawalRate": 0.04,
  "retirementAge": 65,
  "toAge": 100
}
```

- `paths` — the raw array from Stage 1 (`household.paths`)
- `withdrawalRate` — annual withdrawal as a fraction of the **pot value at retirement** (classic 4% rule — fixed real amount)
- `retirementAge` — used to compute age labels in the survival table
- `toAge` — end of simulation horizon

**Simulation:**
- For each of the 10,000 paths, continue from `paths[i]` as the starting pot
- At retirement, fix the annual withdrawal amount: `withdrawalAmount = paths[i] × withdrawalRate`
- Each subsequent year, inflate `withdrawalAmount` by that year's sampled inflation factor
- Deduct the inflated withdrawal from the portfolio, then apply the sampled log-normal return
- First-hit ruin: if the portfolio cannot cover the withdrawal (pot ≤ 0), record the year and stop that path
- Shared inflation path per simulation (same approach as Stage 1)

**Output JSON:**

```json
{
  "numSimulations": 10000,
  "withdrawalRate": 0.04,
  "annualIncomeMedian": 31200,
  "probabilityOfRuin": 0.18,
  "survivalTable": [
    { "age": 70, "probabilitySolvent": 0.99 },
    { "age": 75, "probabilitySolvent": 0.97 },
    { "age": 80, "probabilitySolvent": 0.91 },
    { "age": 85, "probabilitySolvent": 0.78 },
    { "age": 90, "probabilitySolvent": 0.61 },
    { "age": 95, "probabilitySolvent": 0.44 },
    { "age": 100, "probabilitySolvent": 0.31 }
  ],
  "portfolioPercentiles": {
    "byAge": [
      { "age": 66, "nominal": { "p10": 0, "p50": 0, "p90": 0 }, "real": { "p10": 0, "p50": 0, "p90": 0 } }
    ]
  }
}
```

- `annualIncomeMedian` — median of `paths[i] × withdrawalRate` across all paths, in £ (today's money — the fixed real withdrawal amount at the p50 pot)
- `probabilityOfRuin` — fraction of paths that hit zero before `toAge`
- `survivalTable` — percentage of paths still solvent at each 5-year age interval from `retirementAge + 5` to `toAge`
- `portfolioPercentiles.byAge` — p10/p50/p90 nominal and real portfolio values at each age (drives fan chart in future UI)

---

### CLI — interactive session

**Flow:**

```
$ python cli/retirement.py --input cli/inputs/example.json

[accumulation results printed as per v0.2]

── Drawdown ─────────────────────────────────────────
Withdrawal rate % [4.0] (or 'q' to quit): _
```

After each drawdown result:

```
Withdrawal rate 4.0% of median pot (£780,000) = £31,200/year

  Age   Probability solvent
  ───   ───────────────────
  70    99%
  75    97%
  80    91%
  85    78%
  90    61%
  95    44%
  100   31%

Probability of running out before age 100: 18%

Withdrawal rate % [4.0] (or 'q' to quit): _
```

**Rules:**
- Press enter to reuse the previous rate (shown in brackets, defaulting to 4.0 on first prompt)
- Enter a number (e.g. `3.5`) to use a new rate
- Enter `q` to exit

**`--json` flag:** if set, prints raw JSON for accumulation only and skips the interactive session.

---

### Known limitations (v0.3)

- Withdrawal is a fixed real amount (inflated each year) set at retirement — no state pension, other income offsets, or spending step-downs
- No state pension, other income, or spending inputs — deferred to v0.4
- No tax modelling
- Annual contribution growth deferred to v0.4

---

## v0.4

### What's new

- State pension per person — amount and start age, inflated each year in the drawdown simulation
- Income target model — the withdrawal rate sets the **total household income target**, not the portfolio draw; the portfolio only funds the shortfall after state pension
- Surplus handling — if state pension income exceeds the target in any year, the surplus is reinvested into the portfolio

### Core income model

The 4% withdrawal rate now means: *"I want a total household income equal to X% of my portfolio at retirement."*

Each drawdown year:

```
targetIncome    = initialTargetIncome × cumulative inflation factor
statePension    = sum of all active state pensions × cumulative inflation factor
portfolioDraw   = max(0, targetIncome − statePension)
```

- Portfolio is reduced by `portfolioDraw`, then the return is applied
- If `statePension ≥ targetIncome`, portfolio draw is zero and the full return is reinvested (pot grows)
- Ruin = first year `portfolioDraw > portfolio balance`

This means the survival table will show a visible improvement at the ages when state pensions kick in, which is both realistic and informative.

### Input changes — `POST /drawdown`

State pension is added per person to the drawdown payload. The CLI reads it from the input JSON.

**Updated input JSON (people level):**
```json
{
  "people": [
    {
      "name": "Alice",
      "currentAge": 40,
      "accounts": [...],
      "statePension": { "annualAmount": 11500, "fromAge": 67 }
    },
    {
      "name": "Bob",
      "currentAge": 38,
      "accounts": [...],
      "statePension": { "annualAmount": 11500, "fromAge": 67 }
    }
  ]
}
```

- `annualAmount` — full new state pension in today's money (£)
- `fromAge` — state pension age (default 67 for UK)
- `statePension` is optional — omitting it is equivalent to `annualAmount: 0`

**Updated `POST /drawdown` input:**
```json
{
  "paths": [...],
  "realPaths": [...],
  "withdrawalRate": 0.04,
  "retirementAge": 65,
  "toAge": 100,
  "statePensions": [
    { "name": "Alice", "annualAmount": 11500, "fromAge": 67 },
    { "name": "Bob",   "annualAmount": 11500, "fromAge": 67 }
  ]
}
```

- `statePensions` is an array of all household state pensions; amounts are in today's money and are inflated in the simulation
- The drawdown engine sums all active state pensions each year to compute the portfolio shortfall

### CLI changes

- `statePension` is read from each person in the input JSON (optional field)
- Collected and passed through to `POST /drawdown`
- Output shows the household state pension total and the age it reaches full entitlement alongside the income table

### Known limitations (v0.4)

- Other income streams (rental, part-time work, defined benefit pensions) deferred to v0.5
- No tax modelling
- Annual contribution growth deferred to v0.5
