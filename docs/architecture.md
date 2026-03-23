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
              │ POST /run  POST /solve/income  POST /solve/ages
              ▼
┌─────────────────────────────────────────┐
│  Server (Node.js + Express, port 3000)  │
│  server/src/index.js                    │
│  server/src/routes/run.js               │
│  server/src/routes/solve.js             │
│  server/src/simulation/run.js           │
│  server/src/simulation/math.js          │
└─────────────────────────────────────────┘
              ▲
              │ POST /run
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

**Endpoints:** `POST /run`, `POST /solve/income`, `POST /solve/ages` — see `docs/api.md` for full contracts.

**Constraint:** raw simulation paths are never returned in any response.

### Simulation engine

**`server/src/simulation/run.js`** — single-pass Monte Carlo orchestration  
**`server/src/simulation/math.js`** — pure math utilities (`sampleNormal`, `logNormalParams`, `percentile`, `interpolateSolventAt`)  
**`server/config/simulation.json`** — return/inflation parameters and simulation count

For the simulation model and domain rules, see `docs/spec.md`.

---

## CLI

**Entry point:** `cli/retirement.py`  
**Python:** 3.9 — do not use `X | Y` union type syntax; use `Optional[X]` or omit type annotations.  
**Venv:** `.venv/` at project root

| File | Purpose |
|------|---------|
| `retirement.py` | Scenario loop — prompts for retirement ages + withdrawal rate, calls server, prints results, asks to re-run |
| `client.py` | HTTP wrapper — `call_run(server_url, payload)` |
| `formatter.py` | Terminal output — `format_run(results)` produces accumulation snapshot + drawdown table |
| `inputs/nigel-mimi.json` | Real household input |
| `inputs/bob-alice.json` | Two-person example |

---

## Web UI

**Stack:** React 18, Vite 5, Tailwind 3, shadcn/ui (copy-paste components), Radix UI primitives  
**Location:** `ui/` at project root; dev server on port 5173  
**Server URL:** configured via `VITE_SERVER_URL` env var (default `http://localhost:3000`)  
**Routing:** React Router v6; two routes: `/` (wizard) and `/scenarios` (scenario picker)  
**State:** wizard step state in `App.jsx`; no external state library

See `docs/ui/` for screen definitions and wireframes.
