# API Reference

Server runs on port 3000 (override with `PORT` env var). All endpoints accept and return JSON.

For the simulation model that underpins all endpoints, see `docs/architecture.md`.

---

## `POST /simulate`

Run a full Monte Carlo simulation from a high-level scenario description and return percentile results.

### Request

```json
{
  "pots": [
    { "id": "isa_alice",     "type": "investments", "owner": "alice", "accessFromAge": 0,  "initialValue": 50000  },
    { "id": "pension_alice", "type": "investments", "owner": "alice", "accessFromAge": 57, "initialValue": 150000 },
    {
      "id": "btl_flat",
      "type": "property",
      "owner": "alice",
      "accessFromAge": 0,
      "initialValue": 300000,
      "mortgage": {
        "outstandingBalance": 180000,
        "mortgageType": "interestOnly",
        "interestRate": 0.05
      },
      "monthlyRent": 2000,
      "monthlyExpenses": 300
    },
    { "id": "car",           "type": "depreciating", "owner": "alice", "accessFromAge": 0, "initialValue": 30000, "annualDepreciationPct": 0.15 },
    { "id": "cash_reserve",  "type": "cash",        "owner": "alice", "accessFromAge": 0,  "initialValue": 20000  }
  ],
  "primaryPot": "isa_alice",
  "people": [
    {
      "id": "alice",
      "name": "Alice",
      "currentAge": 40,
      "retirementAge": 60,
      "statePension": { "annualAmount": 12000, "fromAge": 67 }
    }
  ],
  "incomeSchedule": [
    { "id": "salary", "annualAmount": 90000, "fromYear": 0, "toYear": 20, "taxable": true, "employmentIncome": true, "owner": "alice" }
  ],
  "expenseSchedule": [
    { "id": "core_spending", "annualAmount": 40000, "fromYear": 0 },
    { "id": "reduced_spend", "annualAmount": 28000, "fromYear": 30 }
  ],
  "capitalEvents": [
    { "id": "property_sale", "year": 15, "amount": 200000, "toPot": "isa_alice", "propertyPotId": "btl_flat" },
    { "id": "sell_car_quick", "year": 10, "fromPot": "car", "haircut": 0.1 }
  ],
  "surplusStrategy": [
    { "potId": "pension_alice", "annualCap": 6000 },
    { "potId": "isa_alice",     "annualCap": 20000 }
  ],
  "drawStrategy": [ "isa_alice", "pension_alice" ],
  "toAge": 100,
  "debug": false
}
```

**Pots:**
- `id` — semantic identifier (referenced by `primaryPot`, `surplusStrategy`, `drawStrategy`, `capitalEvents.toPot`)
- `type` — `"investments"` (log-normal, μ=7%, σ=12%), `"property"` (log-normal, μ=3%, σ=8%), `"cash"` (fixed μ=4%), or `"depreciating"` (deterministic annual loss)
- `owner` — person `id` (used for accessibility window calculation)
- `accessFromAge` — pot is excluded from `drawStrategy` until `owner` reaches this age; `0` = always accessible
- `initialValue` — current value in today's money (£)
- `annualDepreciationPct` (optional; `depreciating` only) — annual depreciation fraction (`0.15` = 15% drop per year)
- `mortgage` (optional; `property` only):
  - `outstandingBalance` — current balance in today's money
  - `mortgageType` — `"repayment"` (default) or `"interestOnly"`
  - `interestRate` — annual rate (e.g. `0.05`)
  - `annualPayment` (repayment mortgages) — annual payment in today's money
  - `overpaymentAnnual` or `overpaymentPct` (optional) — annual overpayment amount or percentage of outstanding balance
- `monthlyRent` and `monthlyExpenses` (optional; `property` only) — BTL gross rent and operating costs in today's money

**People:**
- `id` — referenced by pot `owner` field
- `retirementAge` — this person's intended retirement age; household retires when the first person reaches theirs
- `statePension` — optional; amounts in today's money, inflated by simulation

**Schedules** (all amounts in today's money, inflated by the adapter before passing to the engine):
- `incomeSchedule` — recurring income items (`fromYear` inclusive, `toYear` exclusive; no `toYear` = runs to end):
  - `id` — semantic identifier
  - `annualAmount` — gross amount in today's money; if `taxable: true`, this is the gross figure that tax and NI are computed from
  - `fromYear`, `toYear` — year indices
  - `owner` (optional) — person id for per-person tax/NI grouping; items with no owner are treated as household-level
  - `taxable` (optional, default `false`) — if `true`, income is subject to UK income tax (grouped by owner and taxed per person)
  - `employmentIncome` (optional, default `false`) — if `true`, income is also subject to employee Class 1 NI (0%/8%/2% bands); implies employment, not pension draws or rental income
  - `employerPensionPct` (optional) — employer pension contribution as a fraction of `annualAmount` (e.g. `0.14` for 14%); generates a contribution to `employerPensionPotId` each year this income is active; no effect outside accumulation (controlled by income schedule's `toYear`)
  - `employerPensionAnnual` (optional) — employer pension contribution as a fixed annual amount (£); takes priority over `employerPensionPct` if both are present
  - `employerPensionPotId` (optional) — pot id to receive employer pension contributions; required if either employer pension field is set; must reference a valid pot id
- `expenseSchedule` — recurring expense items (same year indexing; year 0 is the first simulation year)
- `capitalEvents` — lump sums:
  - `year` is zero-based year index
  - `toPot` is optional (if absent, treated as income/expense directly)
  - `fromPot` (optional) liquidates/transfers value from a source pot to primary pot
  - `haircut` (optional, with `fromPot`) sells below current value; proceeds = `potValue × (1 - haircut)`
  - `propertyPotId` (optional, with sale proceeds `amount`) deducts outstanding mortgage balance from that sale amount

**Strategies:**
- `surplusStrategy` — ordered list of pots to receive surplus from `primaryPot` each year during accumulation; `annualCap` is in today's money
- `drawStrategy` — ordered list of pot ids to draw from when `primaryPot` is negative; pots are skipped if the owner has not reached `accessFromAge`

**Other:**
- `toAge` — simulation horizon age (default 100)
- `debug` — if `true`, includes `resolvedYears` in response

### Response

```json
{
  "numSimulations": 10000,
  "householdRetirementAge": 60,
  "householdRetirementName": "Alice",
  "retirementYear": 20,
  "warnings": ["Estimated pension draw exceeds tapered allowance in years 25-26"],
  "accumulationSnapshot": {
    "yearsToRetirement": 20,
    "nominal": { "p10": 120000, "p25": 160000, "p50": 210000, "p75": 280000, "p90": 360000 },
    "real":    { "p10": 80000,  "p25": 105000, "p50": 140000, "p75": 185000, "p90": 240000 }
  },
  "statePensions": [
    { "name": "Alice", "annualAmount": 12000, "fromAge": 67 }
  ],
  "probabilityOfRuin": 0.12,
  "netWorthPercentiles": {
    "byAge": [
      { "age": 41, "yearIndex": 0, "liquid": { "real": [p1,...,p99] }, "nonLiquid": { "real": [p1,...,p99] }, "total": { "real": [p1,...,p99] } },
      ...
    ]
  },
  "potPercentiles": {
    "byYear": [
      { "age": 41, "yearIndex": 0, "byPot": { "isa_nigel": { "realP50": 59000 }, "pension_nigel": { "realP50": 120000 }, ... } },
      ...
    ]
  },
  "liabilities": {
    "byYear": [
      { "yearIndex": 0, "mortgageBalances": { "main_residence": 410000, "btl_tequila_wharf": 195000 } },
      ...
    ]
  },
  "survivalTable": [
    { "age": 61, "yearIndex": 21, "probabilitySolvent": 0.98 },
    { "age": 62, "yearIndex": 22, "probabilitySolvent": 0.97 },
    ...
  ],
  "portfolioPercentiles": {
    "byAge": [
      { "age": 41, "yearIndex": 0, "nominal": [p1,...,p99], "real": [p1,...,p99] },
      ...
    ]
  }
}
```

- `accumulationSnapshot` — liquid portfolio (investments + cash; not property) at household retirement year
- `warnings` — array of warning strings (e.g., pension taper alerts, high withdrawal rate notices)
- `netWorthPercentiles.byAge` — per-year liquid, non-liquid (e.g., property), and total net worth percentile arrays (p1–p99, real/today's money only); same indexing as `portfolioPercentiles.byAge`
- `potPercentiles.byYear` — per-year, per-pot real p50 value in today's money; `byPot` keyed by pot id with `realP50` field; `age` mapped from `refPerson.currentAge + yearIndex + 1`
- `liabilities.byYear` — per-year outstanding mortgage balances in real (today's money) terms, keyed by pot id; pots with zero balance are omitted
- `survivalTable` — probability of remaining solvent (liquid pots ≥ 0) for every year from retirement+1 to `toAge`; both `age` and `yearIndex` present
- `probabilityOfRuin` — fraction of simulations that became insolvent before `toAge`
- `portfolioPercentiles.byAge` — p1–p99 arrays (index 0 = p1) per year; `age` mapped from `refPerson.currentAge + yearIndex + 1`
- Property and depreciating pots are excluded from solvency checks (never count toward or against liquid total)
- Raw simulation paths are never returned

**Debug-only fields** (when `debug: true`):
- `resolvedYears` — array of per-year objects including:
  - `income[], expense[], capitalOut[], capitalIn[], surplusOrder[], drawOrder[]` as passed to the engine
  - `tax` — estimated UK income tax burden for the year
  - `ni` — estimated employee NI for the year
  - `btlMortgageInterestCredit` — tax credit applied from BTL mortgage interest (`20% × annualInterest`)
  - `mortgageBalances` — per-property outstanding mortgage balance (nominal, not deflated; keyed by pot id, e.g. `{ "main_residence": 410000 }`)
  - `warnings[]` — year-level warning entries (e.g., taper warnings for that specific year)

---

## `POST /solve/income`

**Not implemented in v0.16.** Returns `501 Not Implemented`.

---

## `POST /solve/ages`

**Not implemented in v0.16.** Returns `501 Not Implemented`.

---

## Simulation configuration

`server/config/simulation.json`:

```json
{
  "numSimulations": 10000,
  "inflation": { "mean": 0.025, "stdDev": 0.005 },
  "returns": {
    "investments": { "mean": 0.06, "stdDev": 0.12 },
    "property":    { "mean": 0.03, "stdDev": 0.08 },
    "cash":        { "mean": 0.04, "stdDev": 0.0  }
  },
  "tax": {
    "bands": [
      { "floor": 0,      "rate": 0.0  },
      { "floor": 12570,  "rate": 0.20 },
      { "floor": 50270,  "rate": 0.40 },
      { "floor": 125140, "rate": 0.45 }
    ],
    "personalAllowanceTaper": { "incomeThreshold": 100000, "taperRate": 0.5 },
    "taperedAllowanceThreshold": 60000,
    "taperedAllowanceAnnualMax": 60000
  }
}
```

**Inflation & returns** — used by the Monte Carlo engine to sample random paths.

**Tax** — used by the adapter to approximate UK-style tax obligations:
- `bands` — income tax brackets (floor threshold, marginal rate) applied progressively
- `personalAllowanceTaper` — if income exceeds `incomeThreshold`, allowance reduces by `taperRate` per £1 above
- `taperedAllowanceThreshold` — income threshold above which pension contribution allowance begins to taper (warning-only in v0.20)
- `taperedAllowanceAnnualMax` — standard annual allowance for pension contributions

---

## Scenario file format (CLI + UI)

Scenario files in `cli/inputs/` and `ui/src/scenarios/` use the same structure as the `POST /simulate` request body, with an optional top-level `"label"` string.


---

