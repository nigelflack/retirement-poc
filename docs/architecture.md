# Architecture

For request/response contracts and endpoint behaviour, see `docs/api.md`.
For domain model, simulation rules, and product behaviour, see `docs/spec.md`.

---

## System overview

Personal retirement planning calculator. Monte Carlo simulation backend (Node.js), Python CLI client, React web UI.

```
┌─────────────────────────────────────────┐
│  CLI (Python 3.9)                       │
│  cli/retirement.py                      │
│  cli/client.py — HTTP wrapper           │
│  cli/formatter.py — terminal output     │
└─────────────┬───────────────────────────┘
              │ POST /simulate
              ▼
┌─────────────────────────────────────────┐
│  Server (Node.js + Express, port 3000)  │
│  server/src/index.js                    │
│  server/src/routes/run.js    (adapter)  │
│  server/src/routes/solve.js  (501 stub) │
│  server/src/simulation/run.js           │
│  server/src/simulation/math.js          │
└─────────────────────────────────────────┘
              ▲
              │ POST /simulate
┌─────────────┴───────────────────────────┐
│  Web UI (React + Vite, port 5173)       │
│  ui/src/App.jsx                         │
│  ui/src/components/wizard/              │
│  ui/src/components/scenario/            │
└─────────────────────────────────────────┘
```

---

## Server

**Entry point:** `server/src/index.js`  
**Port:** 3000 (env `PORT` to override)  
**CORS:** enabled for local dev (Vite on port 5173)

**Endpoints:** `POST /simulate` — see `docs/api.md`. `POST /solve/income` and `POST /solve/ages` return 501.

**Constraint:** raw simulation paths are never returned in any response.

### Adapter: `server/src/routes/run.js`

Translates the high-level `POST /simulate` request body into the year-array format required by the engine.

Responsibilities:
- Validate `pots`, `primaryPot`, `people`, schedules, strategies
- Build a `years[]` array with one item per simulation year from today to `toAge`
- Each year item: `{ income[], expense[], capitalOut[], capitalIn[], surplusOrder[], drawOrder[] }`
- Inflate `statePension` items as income from the relevant age
- Apply `accessFromAge` windows: exclude pots from `drawOrder` until the owner reaches that age
- Apply `surplusOrder` only during accumulation (before each person's `retirementAge`)
- Decorate response: map `yearIndex` → `age` using the reference person's `currentAge`

### Simulation engine: `server/src/simulation/engine.js`

Pure cashflow Monte Carlo. Receives the fully-resolved year array; has no knowledge of retirement rules, pension access, or person ages.

Per-year loop (each of N simulations):
1. Sample inflation factor (log-normal)
2. Net cashflow (income − expense × cumulative inflation) → `primaryPot`
3. `capitalOut` mandatory transfers from `primaryPot` to target pots
4. `capitalIn` transfers from source pots to `primaryPot`
5. `surplusOrder` — route surplus from `primaryPot` to secondary pots (capped per entry)
6. `drawOrder` — if `primaryPot < 0`, draw from ordered pots to cover deficit
7. Ruin check: if liquid total (investments + cash) < 0, mark simulation as ruined; floor liquid pots at 0
8. Apply stochastic returns to every pot independently (per-type log-normal or fixed-rate)
9. Record liquid portfolio value and non-liquid/total net-worth for output
10. Return percentile arrays for liquid, non-liquid (e.g., property), and total net worth

Engine output: `survivalTable`, `portfolioPercentiles.byYear`, `netWorthPercentiles.byYear` (liquid/nonLiquid/total), `accumulationSnapshot`, `probabilityOfRuin`.

### Tax approximation layer

The adapter (`server/src/routes/simulate.js`) performs UK-style tax calculations after the engine output is available:

- For each year: identify income items marked `taxable: true`
- Apply `income - personalAllowance → taxable income`
- If income exceeds `personalAllowanceTaper.incomeThreshold`, reduce allowance by `taperRate` per pound
- Apply progressive tax brackets from `server/config/simulation.json` to compute estimated tax burden
- Subtracts estimated tax from p50 output to estimate available spend
- Accumulates warnings if pension contributions (via `surplusStrategy` to pension pots) exceed tapered allowance thresholds

**`server/src/simulation/math.js`** — pure math utilities (`sampleNormal`, `logNormalParams`, `percentile`)  
**`server/config/simulation.json`** — tax bands + allowance parameters, per-type return params + inflation params + simulation count

For domain rules, see `docs/spec.md`.

---

## CLI

**Entry point:** `cli/retirement.py`  
**Python:** 3.9 — do not use `X | Y` union type syntax; use `Optional[X]` or omit type annotations.

| File | Purpose |
|------|---------|
| `retirement.py` | Reads scenario JSON, sends to `/simulate`, prints results, re-run loop |
| `client.py` | HTTP wrapper — `call_simulate(server_url, payload)` |
| `formatter.py` | Terminal output — `format_run(results)` and `format_debug(results)` |
| `inputs/nigel-mimi.json` | Real household scenario |
| `inputs/bob-alice.json` | Two-person example |

The JSON input files are also stored in `ui/src/scenarios/` for UI use. CLI reads the file, appends `toAge` and `debug` flags, and posts the whole object directly to `/simulate`.

---

## Web UI

**Stack:** React 18, Vite 5, Tailwind 3, shadcn/ui (copy-paste components), Radix UI primitives  
**Location:** `ui/` at project root; dev server on port 5173  
**Server URL:** configured via `VITE_SERVER_URL` env var (default `http://localhost:3000`)  
**Note:** UI is currently broken (v0.16 updated server contract; UI update deferred to v0.17)

See `docs/ui/` for screen definitions and wireframes.
