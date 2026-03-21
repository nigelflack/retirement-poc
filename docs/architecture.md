# Architecture

## System overview

Personal retirement planning calculator. Monte Carlo simulation backend with a Python CLI client. Web UI planned but not yet started.

```
┌─────────────────────────────────────────┐
│  CLI (Python 3.9)                       │
│  cli/retirement.py                      │
│  cli/client.py — HTTP wrapper           │
│  cli/formatter.py — terminal output     │
└─────────────┬───────────────────────────┘
              │ POST /run (JSON over HTTP)
              ▼
┌─────────────────────────────────────────┐
│  Server (Node.js + Express, port 3000)  │
│  server/src/index.js                    │
│  server/src/routes/run.js               │
│  server/src/simulation/run.js           │
└─────────────────────────────────────────┘
```

---

## Server

**Entry point:** `server/src/index.js`
**Port:** 3000 (env `PORT` to override)
**Body limit:** default (old 10 MB limit removed in v0.5 — no raw paths in responses)

### API

#### `POST /run`

Single endpoint introduced in v0.5, replacing the old two-stage `/simulate` + `/drawdown`.

**Request:**
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

**Response:**
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
  "survivalTable": [{ "age": 70, "probabilitySolvent": 0.96 }, ...],
  "portfolioPercentiles": {
    "byAge": [
      { "age": 63, "nominal": [p1, p2, ..., p99] },
      ...
    ]
  }
}
```

- `portfolioPercentiles.byAge[n].nominal` — 99-element array (index 0 = p1, index 98 = p99); covers every year from age `currentAge+1` to `toAge`
- Raw simulation paths are never returned

### Simulation engine

**`server/src/simulation/run.js`** — single-pass Monte Carlo

Each of 10,000 paths runs from today to `toAge` in one continuous loop:

**Accumulation phase** (until household retirement year):
- Per-person pots grow: `pot += annualContribution`, then `pot *= logNormalReturn`
- Shared stochastic inflation path per simulation (same macro environment for all people)

**Drawdown phase** (from household retirement year to `toAge`):
- Income target model: `targetIncome = retirementPot × withdrawalRate`, inflated each year
- State pension offset: `portfolioDraw = max(0, inflatedTarget − sumActivePensions)`
- Surplus state pension (when pension > target) is reinvested — pot can grow
- Ruin detection: first year `portfolioDraw > pot`

**Return model:**
- Log-normal with Box-Muller transform
- Parameters derived from arithmetic mean and std dev via: `σ²_ln = ln(1 + (σ/(1+μ))²)`

**Config:** `server/config/simulation.json`
```json
{
  "numSimulations": 10000,
  "annualReturnMean": 0.07,
  "annualReturnStdDev": 0.15,
  "annualInflationMean": 0.025,
  "annualInflationStdDev": 0.01
}
```

### Dead code (not wired up, retained for reference)
- `server/src/routes/simulate.js` — old v0.1–v0.4 accumulation route
- `server/src/routes/drawdown.js` — old v0.4 drawdown route
- `server/src/simulation/monteCarlo.js` — old accumulation engine
- `server/src/simulation/drawdown.js` — old drawdown engine

---

## CLI

**Entry point:** `cli/retirement.py`
**Python:** 3.9
**Venv:** `.venv/` at project root

### Files

| File | Purpose |
|------|---------|
| `retirement.py` | Scenario loop — prompts for retirement ages + withdrawal rate, calls server, prints results, asks to re-run |
| `client.py` | HTTP wrapper — `call_run(server_url, payload)` |
| `formatter.py` | Terminal output — `format_run(results)` produces accumulation snapshot + drawdown table |
| `inputs/example.json` | Two-person example (Alice + Bob) |
| `inputs/nigel.json` | Real household input |

### Input JSON structure

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

`retirementAge` is **not** in the JSON — it is prompted interactively in the CLI session.

---

## Household retirement rule

> The household retires when the person with the **fewest years to retirement** reaches their retirement age.

Computed as `min(retirementAge - currentAge)` across all people, i.e. years away, not the youngest absolute retirement age.

---

## Web UI (planned, not started)

- Framework: TBD
- Will consume the same `POST /run` endpoint
- Fan chart (p1–p99 by age) data is already in the response
- See `docs/flow.md` for current wireframe
