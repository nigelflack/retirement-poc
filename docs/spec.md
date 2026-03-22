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

---

## v0.6

### What's new

A React web UI — a three-step wizard that collects person and asset data, then displays the scenario screen with Panel 1 (controls and solvency bar). Panels 2, 3, and 4 are visible but rendered as "not yet available" placeholders.

No backend changes in this iteration. The UI calls the existing `POST /run` endpoint directly.

---

### Scope

**In scope:**

- Step 1 — Person Details screen (name, age, optional partner)
- Step 2 — Assets screen (accounts, state pension per person)
- Step 3 — Scenario screen, Panel 1 only:
  - Retirement age spinner(s) per person
  - Monthly income target field
  - "Retire together" toggle (two-person only)
  - Solvency bar (`1 − probabilityOfRuin` at age 100)
  - Projected pot summary sentence (median real pot at retirement)
  - At-a-glance solvency label ("At these settings, money is likely to last into your 90s." etc.)
  - Live re-run on every control change (debounced)
  - Loading / error state
- React SPA served statically; Vite build toolchain
- CORS enabled on Express server for local development

**Out of scope / deferred:**

- Panel 2 — Other options (requires solve-for-income and solve-for-age logic — v0.7)
- Panel 3 — Scenario cards (depends on Panel 2 calculations — v0.7/v0.8)
- Panel 4 — Adjust your plan (contributions review — future version)
- Fan chart / portfolio percentile visualisation
- Deployment / hosting

---

### Frontend stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Component library | shadcn/ui (selected components only) |
| HTTP | Native `fetch` |
| State | React `useState` / `useReducer` (no external state library) |

The React app lives in `ui/` at the project root.

---

### API contract (unchanged)

`POST /run` — no changes to request or response shape. The UI sends:

```json
{
  "people": [
    {
      "name": "Bob",
      "currentAge": 50,
      "retirementAge": 60,
      "accounts": [
        { "name": "Workplace pension", "type": "pension", "currentValue": 250000, "monthlyContribution": 500 }
      ],
      "statePension": { "annualAmount": 11500, "fromAge": 67 }
    }
  ],
  "withdrawalRate": 0.04,
  "toAge": 100
}
```

The UI derives `withdrawalRate` from the monthly income target entered by the user:

```
withdrawalRate = (monthlyIncome × 12) / accumulationSnapshot.real.p50
```

Because `accumulationSnapshot` is only known after the first run, the initial `withdrawalRate` is seeded at `0.04` and updated on every subsequent run using the previous response's `p50`.

Panel 1 consumes:
- `accumulationSnapshot.real.p50` — projected pot (median, real terms)
- `probabilityOfRuin` — drives the solvency bar (`1 − probabilityOfRuin`)
- `survivalTable` — used for the solvency label text

---

### Solvency bar label rules

The at-a-glance label below the solvency bar is driven by `probabilitySolvent` at age 90 from `survivalTable`:

| Condition | Label |
|-----------|-------|
| < 50% | "At these settings, your money is likely to run out before your 90s." |
| 50–84% | "At these settings, there's a reasonable chance your money lasts into your 90s." |
| 85–95% | "At these settings, money is likely to last into your 90s." |
| > 95% | "At these settings, your money is very likely to last well into your 90s." |

---

### Wizard state

State is held in React at the top-level app component and passed down. There is no URL routing — the wizard step is a single integer state variable. Wizard state is cleared when `[Edit details]` is clicked.

| State | Type | Notes |
|-------|------|-------|
| `step` | 1 / 2 / 3 | Current wizard step |
| `people` | Person[] | Names, ages, collected in Steps 1–2 |
| `lastRunResult` | RunResult \| null | Most recent `POST /run` response |
| `scenarioParams` | `{ retirementAges, monthlyIncome }` | Controlled by Panel 1 spinners |
| `isLoading` | boolean | True while a `POST /run` is in flight |
| `error` | string \| null | Non-null if the last run failed |

---

### Acceptance checks

1. Completing Steps 1 and 2 with a single person and one account reaches the scenario screen and triggers a simulation run.
2. Completing Steps 1 and 2 with two people reaches the scenario screen; "Retire together" toggle is visible.
3. Panel 1 renders the solvency bar and projected pot sentence using live data.
4. Adjusting a retirement age spinner or income field triggers a new `POST /run` call and updates Panel 1.
5. While a request is in flight, controls are disabled and content dims.
6. If the request fails, controls re-enable and fields revert to their previous values.
7. Panels 2, 3, and 4 are visible but show a "not yet available" placeholder — they do not make any API calls.
8. `[Edit details]` returns to Step 1 and clears all wizard state.
9. The Express server responds to requests from the Vite dev server without CORS errors.

---

### Known limitations (v0.6)

- Panels 2 and 3 are placeholders — no solve-for-income or solve-for-age logic
- No fan chart or portfolio percentile visualisation
- No deployment — local dev only
- withdrawalRate is derived iteratively from the income target using the previous run's p50; on first load it defaults to 4%

---

## v0.7 — Server cleanup, refactor, solve endpoints, CLI test harness

**Goal**: Add two new server endpoints that invert the simulation (solve for income given ages, and solve for retirement ages given income), clean up dead server code, refactor the simulation directory into a cleaner file structure, and add a test harness to the CLI so server behaviour can be verified against known scenarios.

No web-UI changes in this iteration.

---

### 1. Server cleanup and refactor

#### 1a. Delete dead files

Delete three files that are imported by nothing and were made redundant when the unified `POST /run` endpoint replaced the earlier per-step routes:

| File | Why dead |
|------|----------|
| `server/src/routes/simulate.js` | Was mounted before `/run` consolidated the pipeline; no longer registered in `index.js` |
| `server/src/routes/drawdown.js` | Same — drawdown route superseded |
| `server/src/simulation/drawdown.js` | Simulation logic for the above; unused |

#### 1b. Extract `math.js`

Currently `monteCarlo.js` and `run.js` both contain a `percentile` implementation (duplication), and pure math utilities are mixed into the simulation orchestration logic in both files. Extract all pure math into a single `server/src/simulation/math.js`:

| Function | Moved from |
|----------|-----------|
| `sampleNormal()` | `monteCarlo.js` |
| `logNormalParams(mean, stdDev)` | `monteCarlo.js` |
| `percentile(sorted, p)` | `monteCarlo.js` and `run.js` (duplicate) |
| `interpolateSolventAt(survivalTable, targetAge)` | New — shared by `run.js` and the solve endpoints |

`interpolateSolventAt` performs the same linear interpolation that currently lives in the React front-end (`ScenarioScreen.jsx`). Moving it to the server means solve endpoints can use it directly during their search loops, and the front-end continues to call `POST /run` whose response already contains pre-computed values.

#### 1c. Delete `monteCarlo.js`

Once `math.js` is in place, `monteCarlo.js` is fully superseded. Delete it and update `run.js` to import from `./math`.

#### After refactor — `server/src/simulation/` contains:

| File | Responsibility |
|------|---------------|
| `math.js` | Pure maths: sampling, log-normal params, percentile, solvency interpolation |
| `run.js` | Single-pass Monte Carlo orchestration — imports from `./math` |

`run.js` retains its own `percentilesOf5` and `allPercentiles` helpers (they are specific to how `run.js` structures output, not general-purpose math).

No changes to route files or `index.js` as part of this cleanup step.

---

### 2. `POST /solve/income`

Solve for the maximum sustainable monthly income a household can draw, given fixed retirement ages and a solvency target.

#### Request

```json
{
  "people": [
    {
      "name": "Bob",
      "currentAge": 50,
      "retirementAge": 63,
      "accounts": [
        { "type": "ISA", "balance": 120000, "monthlyContribution": 500 }
      ],
      "statePensionMonthly": 900,
      "statePensionAge": 67
    }
  ],
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90
}
```

- `targetSolvencyPct` — probability-of-solvency threshold to hit, expressed as a decimal (e.g. `0.85` = 85 %)
- `referenceAge` — the age at which solvency is measured (e.g. `90`)
- `toAge` — maximum simulation horizon per person
- All `people` fields follow the same shape as `POST /run`

#### Algorithm

Binary search over `monthlyIncome` (from 0 to a ceiling of gross accumulation / 12):

1. Given a candidate `monthlyIncome`, derive `withdrawalRate = (monthlyIncome × 12) / accumulationSnapshot.real.p50` (same derivation used in `POST /run`).
2. Call the Monte Carlo simulation and compute `interpolateSolventAt(survivalTable, referenceAge)`.
3. If the interpolated probability is within ±0.001 of `targetSolvencyPct`, converge.
4. Otherwise, bisect: too high → lower income, too low → raise income.
5. Cap iterations at 50 to prevent infinite loops.

`interpolateSolventAt` is the same linear interpolation used in the front-end; extract it into a shared utility in `server/src/simulation/run.js` (or a new `server/src/simulation/utils.js`) to avoid duplication.

#### Response

```json
{
  "monthlyIncome": 2600,
  "withdrawalRate": 0.038,
  "survivalAtReferenceAge": 0.852
}
```

#### Error cases

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required and must be a non-empty array" }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| Simulation cannot converge | 422 | `{ "error": "Could not find a sustainable income within the simulation bounds" }` |

---

### 3. `POST /solve/ages`

Solve for the earliest retirement ages at which the household can sustain a given monthly income at the target solvency level.

#### Request

```json
{
  "people": [
    {
      "name": "Bob",
      "currentAge": 50,
      "retirementAge": 55,
      "accounts": [...],
      "statePensionMonthly": 900,
      "statePensionAge": 67
    },
    {
      "name": "Alice",
      "currentAge": 45,
      "retirementAge": 50,
      "accounts": [...],
      "statePensionMonthly": 750,
      "statePensionAge": 67
    }
  ],
  "monthlyIncome": 3000,
  "toAge": 100,
  "targetSolvencyPct": 0.85,
  "referenceAge": 90
}
```

- `retirementAge` in each person object is the *starting* retirement age to test from (i.e. the earliest the person would consider retiring)
- All other fields follow the same shape as `POST /run`

#### Algorithm

Binary search over retirement age offset (all persons advance together to keep relative gap constant):

1. Set `lo = 0`, `hi = 20` (offset in years from each person's supplied `retirementAge`).
2. At each step, test `mid = floor((lo + hi) / 2)`: add `mid` years to each person's `retirementAge`, run the Monte Carlo simulation, and compute `interpolateSolventAt(survivalTable, referenceAge)`.
3. If probability ≥ `targetSolvencyPct`, record this offset as a candidate and set `hi = mid` (try to retire earlier).
4. If probability < `targetSolvencyPct`, set `lo = mid + 1` (need to work longer).
5. After convergence, return the ages at the best candidate offset.
6. If even `offset = 20` does not reach the target, return 422.

Cap at 20 iterations (sufficient for 2⁵ = 32 positions within a 20-year window).

#### Response

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

#### Error cases

| Condition | HTTP | Body |
|-----------|------|------|
| Missing / malformed `people` | 400 | `{ "error": "people is required and must be a non-empty array" }` |
| `monthlyIncome` missing or ≤ 0 | 400 | `{ "error": "monthlyIncome must be a positive number" }` |
| `targetSolvencyPct` not in (0, 1) | 400 | `{ "error": "targetSolvencyPct must be between 0 and 1 exclusive" }` |
| `referenceAge` not a positive integer | 400 | `{ "error": "referenceAge must be a positive integer" }` |
| Cannot reach target within iteration cap | 422 | `{ "error": "Could not find retirement ages that satisfy the solvency target" }` |

---

### 4. CLI `--test` flag

Extend `cli/retirement.py` with a `--test` sub-command that runs a fixed set of named scenarios against the server and reports pass/fail.

#### Invocation

```
python cli/retirement.py --test [--server http://localhost:3000]
```

`--server` defaults to `http://localhost:3000`.

#### Scenarios

Three scenarios, each stored as a JSON file alongside the existing inputs:

| File | Description |
|------|-------------|
| `cli/inputs/test_single_comfortable.json` | Single person, well-funded, expects high solvency |
| `cli/inputs/test_single_tight.json` | Single person, underfunded, expects low solvency |
| `cli/inputs/test_couple_standard.json` | Two-person household, mid-range funding |

Each test file contains:
- A `payload` block — the body to send to `POST /run`
- An `assertions` block — expected values with tolerances

Example assertions block:

```json
{
  "assertions": {
    "probabilityOfRuin": { "max": 0.20 },
    "survivalTableAt90": { "min": 0.70, "max": 0.95 },
    "annualIncomeMedian": { "min": 28000, "max": 40000 }
  }
}
```

Supported assertion keys:

| Key | Source in response | Assertion type |
|-----|--------------------|----------------|
| `probabilityOfRuin` | `result.probabilityOfRuin` | `min`, `max` |
| `survivalTableAt90` | `interpolateSolventAt(result.survivalTable, 90)` | `min`, `max` |
| `annualIncomeMedian` | `result.annualIncomeMedian` | `min`, `max`, `approx` (±5 %) |

#### Output format

```
PASS  test_single_comfortable  (probabilityOfRuin=0.04, survivalTableAt90=0.91, annualIncomeMedian=33600)
PASS  test_couple_standard     (probabilityOfRuin=0.12, survivalTableAt90=0.82, annualIncomeMedian=36000)
FAIL  test_single_tight        survivalTableAt90 expected min=0.70, got 0.45

3 scenarios: 2 passed, 1 failed
```

Exit code 0 if all pass; exit code 1 if any fail.

#### Implementation notes

- Reuse the existing `client.py` HTTP client in the CLI
- `interpolateSolventAt` should be implemented in Python in `formatter.py` (or a small helper) — same linear interpolation logic as the server
- No changes to `formatter.py` output format for non-test runs

---

### Acceptance criteria (v0.7)

1. `server/src/routes/simulate.js`, `server/src/routes/drawdown.js`, and `server/src/simulation/drawdown.js` are deleted; the server starts cleanly with no reference to them.
2. `server/src/simulation/math.js` exists and exports `sampleNormal`, `logNormalParams`, `percentile`, and `interpolateSolventAt`.
3. `server/src/simulation/monteCarlo.js` is deleted; `run.js` imports from `./math` and `POST /run` produces identical output to pre-refactor.
4. `POST /solve/income` returns a response matching the schema above for the `nigel.json` input converted to the new shape.
5. `POST /solve/ages` returns a response matching the schema above for the same input.
6. Both solve endpoints return 400 for missing required fields and 422 when the solver cannot converge.
7. `python cli/retirement.py --test` runs all three scenarios, prints labelled pass/fail lines, and exits with code 0 when all pass.
8. `python cli/retirement.py --test` exits with code 1 and prints the failing assertion when a scenario fails (verified by temporarily setting an impossible assertion value).
9. No regressions: `POST /run` still returns the same response shape as in v0.6.

---

### Known limitations (v0.7)

- Solve endpoints use simple iterative search; no mathematical closed-form solution
- `POST /solve/ages` advances all persons' ages uniformly — it cannot model one person retiring much earlier than another
- Binary search window of floor+20 years; scenarios requiring retirement age above floor+20 return 422
- No web UI in this iteration; Panel 2 and 3 remain as placeholders

---

## v0.7.1 — CLI solve modes, remove --test ✅ COMPLETE

**Goal**: Expose `POST /solve/income` and `POST /solve/ages` as interactive CLI modes, remove the `--test` flag, and add a `tolerance` parameter to `POST /solve/income` so the binary search stops when it is close enough rather than chasing MC noise.

---

### 1. `POST /solve/income` — add `tolerance` parameter

The current convergence check (`abs(solvency - targetSolvencyPct) < 0.001`) is tighter than the MC noise floor (~1–2% at 10,000 simulations) and causes unnecessary extra iterations.

Add an optional `tolerance` field to the request body:

```json
{
  "people": [...],
  "targetSolvencyPct": 0.85,
  "referenceAge": 90,
  "tolerance": 0.02
}
```

- Default: `0.02` (2 percentage points)
- Valid range: `> 0` and `< 1`; reject with 400 otherwise
- Convergence condition: `solvency >= targetSolvencyPct` **and** `abs(solvency - targetSolvencyPct) <= tolerance`
- With the default, a result of 83–87% is acceptable when targeting 85%; the search stops at the first bisection step that lands in that band

No change to the response shape.

---

### 2. `POST /solve/ages` — switch to binary search

The current linear year-step approach runs up to 50 full simulations in the worst case. Replace with binary search over an offset window of `[0, 20]` years from each person's floor `retirementAge`:

- `lo = 0`, `hi = 20`
- At each step test offset `mid = floor((lo + hi) / 2)`, adding `mid` to each person's `retirementAge`
- If solvency ≥ target: record candidate, set `hi = mid - 1` (try earlier)
- If solvency < target: set `lo = mid + 1` (need to work longer)
- After convergence return the ages at the lowest passing offset
- If offset 20 still does not reach the target, return 422

This caps the search at ~5–6 simulations for any input, regardless of how far the answer is from the floor.

No change to the request or response shape. No change to the `tolerance` concept — `/solve/ages` is already whole-year resolution and MC noise is less significant than the year-step granularity.

---

### 3. Solve search simulations — 2,000 runs

Both solve endpoints call `runFull` once per search iteration. Using the full 10,000 runs each time is wasteful; the standard error at 2,000 simulations (SE ≈ 0.8% at p=0.85) is well within the 2% tolerance band.

Internal constant in `solve.js`:

```javascript
const SOLVE_SEARCH_CONFIG = { ...config, numSimulations: 2000 };
```

- Search iterations in both `/solve/income` and `/solve/ages` use `SOLVE_SEARCH_CONFIG` (2,000 simulations)
- `POST /run` continues to use the full config (10,000 simulations)
- This is an internal implementation detail — no API change

---

### 4. Remove `--test`

Remove the `--test` argument from `retirement.py` and the `run_tests()` function. Remove `interpolate_solvent_at` from `formatter.py` (it was added solely for the test harness and is not used by any other output path).

The `cli/inputs/` directory now contains only personal input files (`nigel-mimi.json`, `bob-alice.json`).

---

### 5. `--solve income`

```
python retirement.py --input inputs/nigel-mimi.json --solve income
```

**Prompt sequence:**

1. Retirement age per person (same prompt as normal mode — previous values in brackets on re-run)
2. Target solvency % `[85]` — enter keeps default
3. Reference age `[90]` — enter keeps default

**Calls:** `POST /solve/income` with the people (including prompted retirement ages), `toAge=100`, `targetSolvencyPct`, `referenceAge`.

**Output:**
```
  Solve: maximum sustainable income
  ─────────────────────────────────────────────
  Retirement ages    : Nigel 62, Mimi 55
  Target solvency    : 85% at age 90
  Monthly income     : £2,450
  Annual income      : £29,400
  Withdrawal rate    : 3.8%
  Survival at 90     : 85.1%
```

**Re-run loop:** yes — same "Re-run scenario? [y/n]" pattern as normal mode, retaining previous retirement ages, solvency %, and reference age.

---

### 6. `--solve ages`

```
python retirement.py --input inputs/nigel-mimi.json --solve ages
```

**Prompt sequence:**

1. Monthly income target (£/month) — required, no default
2. Earliest retirement age to consider per person `[67]` — default is state pension age 67; enter keeps it
3. Target solvency % `[85]`
4. Reference age `[90]`

The prompted earliest retirement age is passed as `retirementAge` in the request body — this is the floor the server starts searching from.

**Calls:** `POST /solve/ages` with the people (each using the prompted floor retirement age), `monthlyIncome`, `toAge=100`, `targetSolvencyPct`, `referenceAge`.

**Output:**
```
  Solve: earliest retirement ages for £3,000/month
  ─────────────────────────────────────────────────
  Target solvency    : 85% at age 90
  Nigel retires at   : 64
  Mimi retires at    : 59
  Monthly income     : £3,000
  Survival at 90     : 86.3%
```

If the server returns 422 (cannot converge), print:
```
  Could not find retirement ages that satisfy the target. Try a lower income or solvency %.
```

**Re-run loop:** yes — retains previous income, floor ages, solvency %, and reference age.

---

### 7. Input file rename

The input files have been renamed to reflect both people in each scenario:

| Old name | New name |
|----------|----------|
| `nigel.json` | `nigel-mimi.json` |
| `example.json` | `bob-alice.json` |

No structural changes to the file format.

---

### Acceptance criteria (v0.7.1)

1. `POST /solve/income` accepts `tolerance` and defaults it to `0.02`; passing `tolerance=0.05` causes the search to converge faster than `tolerance=0.001`.
2. `POST /solve/income` returns 400 for `tolerance` outside `(0, 1)`.
3. `POST /solve/ages` uses binary search over a `[floor, floor+20]` window; a scenario requiring floor+25 years returns 422.
4. `--test` flag is gone; `python retirement.py --test` exits with an argparse error.
5. `run_tests()` function is removed from `retirement.py`; `interpolate_solvent_at` is removed from `formatter.py`.
6. `python retirement.py --input inputs/nigel-mimi.json --solve income` prompts for retirement ages, solvency %, and reference age, then prints the solve output.
7. `python retirement.py --input inputs/nigel-mimi.json --solve ages` prompts for monthly income, floor ages (default 67), solvency %, and reference age, then prints the solved retirement ages.
8. Both solve modes support re-run with retained previous values.
9. Normal mode (`--input` only) and `--json` mode are unaffected.
10. `--input` is still required when `--solve` is absent.
11. Both solve endpoints use 2,000 simulations per search iteration; `POST /run` continues to use 10,000.

---

### Known limitations (v0.7.1)

- No `--solve` re-run loop between income and ages modes — each is a separate invocation
- Floor retirement age default of 67 may be above the current age for some users; the prompt validates and rejects values ≤ currentAge
