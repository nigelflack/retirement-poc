# Decision log

Decisions recorded in version order. Each entry explains what was decided and why, with deferred alternatives noted where relevant.

---

## v0.1

### Node.js + Express backend, Python CLI client
**Decided:** Server-side simulation in Node.js/Express; Python CLI as the first client.
**Rationale:** Node is fast enough for CPU-bound Monte Carlo at 10,000 paths; Express keeps the API surface minimal. Python CLI provides fast iteration for backend validation without UI investment.

### Log-normal return model (Box-Muller)
**Decided:** Annual returns modelled as log-normal, sampled via Box-Muller transform.
**Rationale:** Log-normal is the standard model for asset returns — it prevents negative portfolio values and is well-understood in the context of retirement planning. Box-Muller is straightforward to implement without a stats library.
**Deferred:** Correlated asset classes (equity/bond split, glide path) — single asset class only for now.

### Single portfolio per person (accounts aggregated)
**Decided:** Multiple accounts (SIPP, ISA, etc.) per person are summed into a single portfolio value and contribution figure for simulation.
**Rationale:** Account-level distinction (tax treatment, access age) is a v-later concern. Aggregation keeps the model simple and the API surface small.

### Nominal output with real (today's money) shown alongside
**Decided:** Show both nominal and real (inflation-deflated) figures; real is the primary user-facing output.
**Rationale:** Users relate to today's money, not future nominal figures. Real values are computed by deflating by cumulative simulated inflation.

---

## v0.2

### Stochastic inflation with shared path per simulation
**Decided:** Inflation is sampled stochastically (log-normal), and a single inflation path is shared across all people within each simulation run.
**Rationale:** All household members live in the same macroeconomic environment. Sharing one inflation path per sim is more realistic than independent per-person inflation.

### Household snapshot at earliest retirement year
**Decided:** The household accumulation snapshot is taken at the year the first person retires, not when the last person retires.
**Rationale:** This was later revised in v0.5 — see below.

---

## v0.3

### Two-stage API: `/simulate` then `/drawdown`
**Decided:** Accumulation and drawdown run as separate API calls. Accumulation returns all 10,000 paths; drawdown consumes them.
**Rationale:** Decouples the two phases; lets the user change withdrawal rate without re-running accumulation.
**Problem identified later:** Passing 10,000 floats over HTTP is slow and fragile. Retirement age cannot be changed without re-running accumulation anyway, making the separation less useful than expected. Replaced in v0.5.

### Classic 4% rule: fixed real withdrawal inflated each year
**Decided:** Annual withdrawal = `pot × withdrawalRate` at retirement, then inflated each year. Ruin = first year pot ≤ 0.
**Rationale:** Canonical sustainable withdrawal model; widely understood.
**Revised in v0.4:** Withdrawal rate becomes income target; state pension offsets portfolio draw.

### Retirement age prompted in CLI (not in input JSON)
**Decided:** `retirementAge` removed from JSON and prompted interactively in the CLI.
**Rationale:** Retirement age is a scenario variable, not a data fact. Interactive prompting makes it easy to explore.
**Note:** Retirement age returned to the request body in v0.5 when the two-stage API was eliminated.

### Income in today's money via real paths
**Decided:** Annual income in drawdown is `realPot × withdrawalRate`, not `nominalPot × withdrawalRate`.
**Rationale:** Users must see income in today's money to make it meaningful. Real pot is the nominal pot deflated by cumulative inflation at retirement.

---

## v0.4

### Income target model replacing fixed withdrawal
**Decided:** The withdrawal rate sets a total household income target (`pot × rate`). The portfolio only funds the shortfall after state pension: `portfolioDraw = max(0, target − statePension)`.
**Rationale:** More realistic UK model. State pension substantially reduces portfolio draw for most people, especially after age 67. Surplus state pension reinvests into the portfolio.

### State pension per person in input JSON, inflated in simulation
**Decided:** `statePension: { annualAmount, fromAge }` per person, amounts in today's money, inflated by cumulative inflation in the simulation.
**Rationale:** Amounts in today's money are intuitive to enter and reason about. Inflation is handled by the engine.

---

## v0.5

### Single-pass Monte Carlo replacing two-stage API
**Decided:** Accumulation and drawdown in one continuous loop per path. `/simulate` and `/drawdown` routes removed; replaced by single `POST /run`.
**Rationale:**
- Removes the large `paths`/`realPaths` HTTP payload (only percentile arrays returned now)
- Retirement age is a scenario parameter; re-running accumulation on each scenario change is correct and fast
- Simpler, more coherent model: one path, one inflation stream, no cross-call state

### p1–p99 percentiles for fan chart (replacing sparse p10/p50/p90)
**Decided:** `portfolioPercentiles.byAge[n].nominal` is a 99-element array for every year from today to `toAge`.
**Rationale:** Enables smooth fan chart rendering on a future web UI without any client-side computation. 99 values × ~70 years is ~7,000 numbers — well within acceptable response size.

### Household retirement trigger: fewest years to retirement, not lowest age
**Decided:** Household retires when `min(retirementAge - currentAge)` person reaches their age — i.e. whoever is nearest to retirement in real time.
**Rationale:** A person aged 52 retiring at 62 (10 years away) triggers household retirement before a person aged 46 retiring at 59 (13 years away), even though 59 < 62. Calendar time is what matters.

### Scenario loop: all parameters re-promptable each run
**Decided:** Retirement ages and withdrawal rate are all prompted each iteration; previous values shown in brackets so Enter keeps them. Loop ends with `Re-run scenario? [y/n]`.
**Rationale:** Makes retirement age a first-class scenario variable alongside withdrawal rate — the primary value of the single-pass redesign.
