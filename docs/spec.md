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

**Input JSON:** `retirementAge` removed from v0.2 — now prompted interactively in the CLI session before the simulation runs.

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

── Retirement ages ──────────────────────────────────
  Retirement age for Alice (currently 40): 65
  Retirement age for Bob (currently 38): 63

[accumulation results printed]

────────────────────────────────────────────────────
  Drawdown explorer
  Retirement age : 63
────────────────────────────────────────────────────
  Withdrawal rate % [4.0] (or 'q' to quit): _
```

After each drawdown result:

```
  Withdrawal rate     : 4.0%
  Annual income       : £31,200 median  (£22,000 – £45,000 range)

  Age    Probability solvent
  ────────────────────────────
  70      99.0%  ████████████████████
  75      97.0%  ███████████████████
  80      91.0%  ██████████████████
  85      78.0%  ███████████████
  90      61.0%  ████████████
  95      44.0%  ████████
  100     31.0%  ██████

  Probability of running out before age 100: 18.0%

  Withdrawal rate % [4.0] (or 'q' to quit): _
```

**Rules:**
- On startup, each person is prompted for their retirement age; current age is shown as context
- Invalid input (non-integer or age ≤ current age) re-prompts
- The household drawdown snapshot uses the **earliest** retirement age across all people
- Press enter to reuse the previous withdrawal rate (shown in brackets, defaulting to 4.0 on first prompt)
- Enter a number (e.g. `3.5`) to use a new rate
- Enter `q` to exit
- Annual income figures are in **today's money** (derived from real pot values)

**`--json` flag:** if set, prompts for retirement ages then prints raw JSON for accumulation only and skips the drawdown session.

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

---

## v0.5

### What's new

1. **Single-pass Monte Carlo** — accumulation and decumulation are simulated in one continuous pass per path, eliminating the two-stage API and the large paths array passed between calls
2. **Interactive scenario loop** — retirement ages join withdrawal rate as scenario parameters; after each run the user is prompted to re-run with new values

---

### Single-pass simulation

#### Why change

The two-stage design (POST /simulate → POST /drawdown) was introduced to allow path continuity and avoid re-running accumulation on every drawdown query. In practice:

- Passing 10,000 × `yearsToRetirement` floats over HTTP is expensive and fragile
- Retirement age is now a scenario parameter that changes between runs — re-running accumulation is the correct behaviour
- A single pass is simpler, more statistically coherent, and fast enough (10,000 paths each covering ~70 years runs in well under a second)

#### New simulation model

Each path runs from today to `toAge` in a single loop:

```
for each year:
  if still in accumulation phase (age < householdRetirementAge):
    pot += annualContribution
    pot *= returnFactor
  else (decumulation phase):
    apply income target / state pension shortfall logic (unchanged from v0.4)
```

- `householdRetirementAge` is the retirement age of whichever person reaches theirs first (minimum years-to-retirement)
- Contributions stop at retirement; return distribution is the same in both phases (single asset class, unchanged from prior versions)
- Real (inflation-deflated) pot tracked throughout using the same cumulative inflation factor

#### API changes

The two separate endpoints are replaced by a single endpoint:

**`POST /run`**

```json
{
  "people": [
    {
      "name": "Alice",
      "currentAge": 40,
      "retirementAge": 62,
      "accounts": [...],
      "statePension": { "annualAmount": 11500, "fromAge": 67 }
    }
  ],
  "withdrawalRate": 0.04,
  "toAge": 100
}
```

- `retirementAge` moves back into the request body (was prompted in CLI, then sent separately to /drawdown)
- `toAge` defaults to 100 if omitted
- `POST /simulate` and `POST /drawdown` are removed

**Response** — combines accumulation snapshot and drawdown results:

```json
{
  "numSimulations": 10000,
  "householdRetirementAge": 62,
  "accumulationSnapshot": {
    "nominal": { "p10": ..., "p50": ..., "p90": ... },
    "real":    { "p10": ..., "p50": ..., "p90": ... }
  },
  "withdrawalRate": 0.04,
  "annualIncomeMedian": 45000,
  "annualIncomeP10": 32000,
  "annualIncomeP90": 61000,
  "statePensions": [...],
  "probabilityOfRuin": 0.04,
  "survivalTable": [...],
  "portfolioPercentiles": { "byAge": [...] }
}
```

- `accumulationSnapshot` reports household portfolio percentiles at the retirement year (replaces the separate /simulate output)
- `portfolioPercentiles.byAge[n].nominal` is a 99-element array where index `i` (0-based) = p`i+1` — every percentile from p1 to p99; enables smooth fan chart rendering on the client with no further computation
- The raw 10,000 simulation paths are **not returned** — percentile arrays are the only output. This eliminates the large `paths`/`realPaths` payloads that existed solely to bridge the old two-stage API

---

### Interactive scenario loop

#### Current behaviour (v0.4)

- Retirement ages prompted once at startup; cannot be changed without restarting
- Withdrawal rate is the only re-promptable parameter

#### New behaviour (v0.5)

The full scenario — retirement ages + withdrawal rate — is re-promptable in one loop. Each iteration:

1. Prompt for each person's retirement age (current age shown; enter to keep previous value)
2. Prompt for withdrawal rate (enter to keep previous value)
3. Run simulation, display results
4. Prompt: `Re-run scenario? [y/n]`

```
── Scenario ─────────────────────────────────────────
  Retirement age for Nigel (currently 52) [62]: 
  Retirement age for Mimi  (currently 46) [59]: 
  Withdrawal rate % [4.0]: 

  Simulations run        : 10,000
  Household retires      : age 62 (Nigel)

  Accumulation at retirement
  Percentile    Nominal          Real (today's £)
  ─────────────────────────────────────────────
  10th     £  1,024,399    £        799,844
  ...

  Withdrawal rate        : 4.0%
  Annual income          : £45,200 median  (£32,100 – £61,400 range)  (today's £)
  State pensions         :
    Nigel        £11,500/yr  from age 67
    Mimi         £11,500/yr  from age 67

  Age    Probability solvent
  ────────────────────────────
  70      95.2%  ███████████████████
  75      88.4%  █████████████████
  ...

  Probability of running out before age 100: 8.3%

Re-run scenario? [y/n]: 
```

**Rules:**
- Retirement age prompt shows previous value in brackets; enter keeps it
- Retirement age must still be > current age; invalid input re-prompts
- Withdrawal rate prompt shows previous value; enter keeps it
- `n` (or `q`) exits
- `--json` flag: runs once, prints raw JSON, no interactive loop

---

### CLI changes

- `retirement.py`: outer scenario loop replaces the current startup-prompt + drawdown-loop structure
- `client.py`: `call_simulate` and `call_drawdown` replaced by a single `call_run`
- `formatter.py`: `format_results` and `format_drawdown` merged into a single `format_run` that prints accumulation snapshot + drawdown results together

---

### Known limitations (v0.5)

- Other income streams (rental, part-time work, defined benefit pensions) deferred to v0.6
- No tax modelling
- Annual contribution growth deferred to v0.6
- Single asset class (no bond/equity split or glide path)
