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
