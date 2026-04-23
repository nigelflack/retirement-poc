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

---

## v0.6

### React SPA + Vite + Tailwind + shadcn/ui as the web UI stack
**Decided:** React 18, Vite build tool, Tailwind CSS utility classes, shadcn/ui components (copy-pasted into `ui/src/components/ui/`).
**Rationale:** React is the natural fit for a live-updating, stateful single-page tool. Vite is fast and zero-config. Tailwind and shadcn/ui give a clean, minimal default look with owned, easily-modified component source. No external state management library needed for wizard state of this size.
**Deferred:** Deployment/hosting; routing (single `step` integer state is sufficient for now).

### UI lives in `ui/` at the project root
**Decided:** The React app is a sibling directory to `server/` and `cli/`, not nested inside either.
**Rationale:** Keeps the three concerns (server, CLI, UI) clearly separated with no circular dependency.

### `withdrawalRate` derived iteratively from monthly income input
**Decided:** On first load, `withdrawalRate` defaults to 0.04. After each run, it is recalculated as `(monthlyIncome × 12) / accumulationSnapshot.real.p50` and used on the next call.
**Rationale:** The API takes `withdrawalRate`, not an income target. Iterative derivation converges quickly (typically one run) and avoids a new API parameter for this version.
**Known limitation:** First-load withdrawal rate is a guess; the rate stabilises after the first result is returned.

### Survival table interpolation for age-90 solvency label
**Decided:** The solvency label is keyed to `probabilitySolvent` at age 90, interpolated linearly between the two surrounding survival table entries when age 90 is not an exact table entry.
**Rationale:** The survival table uses 5-year intervals from the household retirement age. Age 90 only lands exactly when the retirement age is a multiple of 5. Interpolation ensures the label always appears regardless of the retirement age chosen.

### Panels 2–4 deferred as visible placeholders
**Decided:** Panels 2, 3, and 4 are rendered as "Not yet available" cards in v0.6.
**Rationale:** Panels 2 and 3 require solve-for-income and solve-for-age iteration — a non-trivial addition. Shipping Panel 1 end-to-end validates the full wizard flow and API integration before that complexity is added.

---

## v0.7

### Pure math extracted into `math.js`; `monteCarlo.js` deleted
**Decided:** `sampleNormal`, `logNormalParams`, `percentile` (which was duplicated in both `monteCarlo.js` and `run.js`), and the new `interpolateSolventAt` live in a single `server/src/simulation/math.js`. `monteCarlo.js` is deleted entirely.
**Rationale:** Removes duplication, gives the solve endpoints a single reliable import for interpolation, and makes the simulation directory easier to read: `math.js` = pure functions, `run.js` = orchestration.

### `interpolateSolventAt` lives on the server, not only in the UI
**Decided:** The linear interpolation function — previously only in `ScenarioScreen.jsx` — is also implemented in `math.js` (JS) and `formatter.py` (Python).
**Rationale:** The solve endpoints need it during their search loops server-side. The CLI test harness needs it to evaluate the `survivalTableAt90` assertion. Having it in one canonical place per runtime avoids three independent implementations drifting apart.

### Solve endpoints use iterative search, not a closed-form solution
**Decided:** `/solve/income` uses binary search (up to 50 iterations); `/solve/ages` steps ages forward one year at a time (up to 50 iterations or until retirement age reaches `toAge`).
**Rationale:** The simulation has no closed-form inverse. Binary search on income converges quickly (~12–15 iterations to ±£1). Age-stepping is coarser but produces directly actionable whole-year results, which is what users need.
**Known limitation:** `/solve/ages` advances all persons' ages uniformly; it cannot independently optimise one person's age while holding another fixed.

### CLI `--test` uses tolerance ranges, not exact values
**Decided:** Each test scenario asserts `min`/`max` bounds on `probabilityOfRuin`, `survivalTableAt90`, and `annualIncomeMedian`; no exact-match assertions.
**Rationale:** Monte Carlo results vary by ~1–3% run-to-run. Tight ranges confirm the simulation is in the right ballpark without being brittle to randomness. Bounds were calibrated to allow ~±20% variation around typical observed values.

---

## v0.7.1

### `/solve/income` convergence tolerance made configurable (default 2%)
**Decided:** The convergence check uses an optional `tolerance` request parameter (default `0.02`). The binary search stops when `solvency >= target` and `abs(solvency - target) <= tolerance`.
**Rationale:** The original hard-coded threshold of `0.001` (0.1 percentage point) was tighter than the MC noise floor at 10,000 simulations (~0.36% SE at p=0.85). The search would always exhaust all 50 iterations rather than converging early. A 2% default is comfortably wider than the noise floor while still being tight enough to be meaningful to users.

### `/solve/ages` switched from linear stepping to binary search
**Decided:** `/solve/ages` now binary-searches over a `[floor, floor+20]` year offset window: `lo=0, hi=20`, bisecting each iteration. The lowest passing offset is returned; if offset 20 does not reach the target, 422 is returned.
**Rationale:** The linear step approach ran up to 50 full simulations in the worst case (one per year). Binary search caps the work at ~5 iterations regardless of how far the solution is from the floor — a 10× improvement at the limit. The 20-year window covers all realistic cases (floor age of 67 to ~87 would be pathological input).
**Trade-off accepted:** The window cap (floor+20) is a hard limit. Scenarios where no retirement age in that window is sufficient return 422, prompting the user to reduce their income or solvency target.

### Solve endpoints use 2,000 simulations per search iteration
**Decided:** Both solve endpoints pass `SOLVE_SEARCH_CONFIG = { ...config, numSimulations: 2000 }` to `runFull` during their search loops. `POST /run` continues to use the full 10,000.
**Rationale:** At p=0.85, the standard error of the solvency estimate is `sqrt(0.85 × 0.15 / n)`: ~0.36% at n=10,000 and ~0.8% at n=2,000. With a 2% convergence tolerance, the extra noise from 2,000 sims is well within the acceptable band. The reduction makes solve calls roughly 5× faster with no meaningful loss of accuracy in the final result.
**Internal detail:** The reduced count is not exposed as an API parameter — it is an implementation constant in `solve.js`.

### `--test` CLI flag removed; input files renamed
**Decided:** The `--test` flag, `run_tests()` function, and `interpolate_solvent_at()` formatter helper are all removed. Input files renamed from `nigel.json`/`example.json` to `nigel-mimi.json`/`bob-alice.json`.
**Rationale:** The test fixture files (`test_*.json`) conflated personal data with test assertions. Renaming to person-pair names makes the purpose of each file clear. With the test harness gone, `interpolate_solvent_at` in the CLI had no remaining caller.

---

## v0.8

### Scenario files bundled in the UI, not served from the API
**Decided:** Pre-built scenarios (`nigel-mimi.json`, `bob-alice.json`) are imported as static JSON modules in `ui/src/scenarios/`. No server endpoint serves them.
**Rationale:** Keeps the API surface clean — scenario loading is a UI concern, not a backend one. Vite bundles the JSON at build time so they add no runtime HTTP call. Display names are derived directly from the import key (filename without `.json`).

### Scenario loader jumps to Step 3, not Step 1
**Decided:** Clicking a scenario card navigates to `/` with `{ state: { people } }` in the router location state. `App` reads `location.state?.people` on mount; if present it initialises at step 3.
**Rationale:** The wizard steps 1 and 2 collect data that is already encoded in the scenario file. Skipping to the scenario screen is the right UX — the user loaded a scenario to see results immediately, not to re-enter data they already have.

### Panel 2 fires after every `POST /run` response via `useEffect([lastResult])`
**Decided:** A `useEffect` keyed to `lastResult` fires the two Panel 2 solve calls. A monotonically-incrementing `p2RunIdRef` guards against stale results from previous runs.
**Rationale:** Panel 2 must update whenever Panel 1 updates (income or age change). Reacting to `lastResult` change is the cleanest hook point — it fires once per completed run and carries `prevRetirementAges.current`/`prevMonthlyIncome.current` for the solve payloads.

### Panel 3 cards derived without additional API calls (except low-bucket middle card)
**Decided:** Panel 3 reuses Panel 2 results to compute its three cards directly. The only exception is the low-bucket middle card, which requires one extra `solve/income` call at the mid-point ages.
**Rationale:** Three `POST /run` calls just to populate static display cards would be wasteful and slow. Panel 2's left/right results contain all the income and age data needed. The mid-point call is unavoidable since the mid-point income is not derivable from Panel 2 output alone.

### Server tests use `node:test` with no external runner
**Decided:** Tests live in `server/src/simulation/*.test.js` and run via `node --test` (Node 18+ built-in runner).
**Rationale:** Avoids adding `jest` or `mocha` as a dev dependency. `node:test` + `assert/strict` covers everything needed for pure-function and integration tests at this scale. Test discovery is automatic for `*.test.js` files.

### CLI `--solve income` and `--solve ages` modes added
**Decided:** A `--solve {income,ages}` argument is added to the CLI. Each mode has its own prompt sequence and re-run loop. The `--input` flag remains required for all modes.
**Rationale:** The solve endpoints existed since v0.7 but were only accessible via raw HTTP. These modes make them first-class citizens of the CLI workflow alongside normal `POST /run` mode, with the same re-run loop pattern and previous-value retention.

---

## v0.9

### Breaking API change accepted: `survivalTable` now annual, `portfolioPercentiles.byAge` gains `real` field
**Decided:** `survivalTable` changed from 5-year intervals to one entry per year; each `portfolioPercentiles.byAge` entry gains a `real` array (p1–p99 in today's money); `accumulationSnapshot` gains a `real` sub-object (p10/p25/p50/p75/p90). Breaking changes applied without backward compatibility.
**Rationale:** The project is pre-production with no live consumers. A clean API is preferable to compatibility shims. Annual `survivalTable` entries give the UI full flexibility to display any interval it chooses. Real percentile values were needed for the breakdown panel and debug table — computing them client-side from nominal values would require the inflation path, which is not in the response.

### CLI subsamples annual `survivalTable` for display
**Decided:** `formatter.py` filters `survivalTable` to entries where `(age − householdRetirementAge) % 5 == 0` before rendering the bar chart and final ruin probability line.
**Rationale:** The server now emits one entry per year. The CLI bar chart has always shown 5-year intervals and that granularity is appropriate for a text terminal. Subsampling in the formatter keeps the server canonical and the display readable.

### "Calculating…" label removed from Panel 1
**Decided:** The `<p>Calculating…</p>` element shown below the solvency bar during a run was removed.
**Rationale:** Panel opacity and disabled controls already communicate the loading state. The label added no information and caused a visible vertical layout jump each time a run started and completed.

---

## v0.10

### Non-destructive wizard navigation via state merge in App
**Decided:** `App.jsx` never clears `people` on navigation. `handlePersonDetailsComplete` merges name/age changes back into existing state, preserving `accounts` and `statePension` for any person whose name is unchanged. Only if a person is new do they start with empty accounts.
**Rationale:** The previous approach (`setPeople([])`) made every back-navigation or "Edit details" click destroy all entered data, forcing the user to re-enter everything. The merge approach is non-destructive and handles the common case (correcting a typo or age) without any account loss.

### File save/load uses Blob download and FileReader; no server involvement
**Decided:** Save uses `Blob` + `URL.createObjectURL` + a transient `<a download>` element. Load uses a hidden `<input type="file">` + `FileReader.readAsText` + `JSON.parse`. Both are handled entirely in the browser.
**Rationale:** There is no server-side persistence layer. The scenario JSON format already existed (`ui/src/scenarios/*.json`, `cli/inputs/*.json`) — reusing it for save/load means files can be used in the CLI as well as the UI. No new endpoint needed.

### JSON validation at system boundary only (no schema library)
**Decided:** A short inline `validatePeopleFile` function checks for `people` array, non-empty entries, `name` string, `currentAge` number, and non-empty `accounts` array. No external schema validation library added.
**Rationale:** The validation is at the file load boundary only. The checks are simple enough that a dedicated library would add more dependency weight than value. Any file that passes this check will produce a working simulation payload.

---

## v0.16

### Year-array engine contract (cashflow model replacing phase-split model)
**Decided:** The engine (`run.js`) receives a fully-resolved `years[]` array — one item per simulation year — containing `{ income[], expense[], capitalOut[], capitalIn[], surplusOrder[], drawOrder[] }`. The engine has no knowledge of retirement phases, pension rules, or person ages.
**Rationale:** The previous model split accumulation and drawdown into phases with separate input shapes. This made per-year variation (e.g., BTL rental income stopping, spending step-downs, capital events) impossible to express without adapter logic anyway. A flat year array makes the engine a pure arithmetic operator and concentrates all domain logic in the adapter.

### Multi-pot model with per-type stochastic returns
**Decided:** Pots have a `type`: `investments` (log-normal μ=7%, σ=12%), `property` (log-normal μ=3%, σ=8%), or `cash` (fixed μ=4%). Each pot's return is sampled independently per simulation year using the per-type parameters from `simulation.json`.
**Rationale:** A single return rate for all assets conflated fundamentally different risk/return profiles. Property in particular behaves very differently from an equity ISA — separating them allows realistic planning for property-heavy households.

### Property excluded from solvency / liquid total
**Decided:** Property pots never contribute to the liquid total used for solvency checks. Solvency is `investments + cash ≥ 0`. Property is tracked for net worth but cannot be drawn automatically.
**Rationale:** Property cannot be partially liquidated on demand. If a household wants to draw on property, they must model an explicit `capitalIn` event (e.g., a sale or equity release). Automatic property-backed solvency would be misleading.

### `surplusOrder` (adaptive) is separate from `capitalOut` (mandatory)
**Decided:** `capitalOut` items are mandatory transfers that happen regardless of primary pot balance. `surplusOrder` items only execute if `primaryPot > 0` — surplus is routed up to `maxAmount` per entry, stopping when the primary pot reaches zero.
**Rationale:** Pension contributions are mandatory (employment contract, PAYE); routing accumulated surplus between ISAs is adaptive. Conflating them would either force dry-run contributions or make mandatory transfers contingent on performance.

### Adapter resolves all domain knowledge; engine is pure arithmetic
**Decided:** Person ages, retirement ages, accessibility windows, state pension timing, and strategy semantics all live in `routes/run.js`. The engine receives a pre-resolved `years[]` array and has no decision logic.
**Rationale:** Clean separation of concerns. The engine is a pure mathematical operator that is easy to test with synthetic inputs. Future changes to pension rules or strategy semantics require only adapter changes, not engine changes.

### Post-ruin simulation continues for net-worth tracking
**Decided:** When a simulation path becomes insolvent (liquid total < 0), the path is marked as ruined and liquid pots are floored at zero, but the loop continues to `toAge`.
**Rationale:** Even after insolvency, property pots and any subsequent income streams continue growing/flowing. Net worth trajectories post-ruin are needed for accurate fan chart data and for any future withdrawal-rate recovery analysis.

### Solve endpoints stubbed 501 (deferred to future iteration)
**Decided:** `POST /solve/income` and `POST /solve/ages` return `501 Not Implemented` in v0.16.
**Rationale:** The solve endpoints were implemented against the old phase-split model. Rebuilding them against the new cashflow adapter requires careful design of what "solve for income" means when income is modelled per-year with schedules. This work is deferred until the v0.16 adapter is stable and in use.

---

## v0.22

### Per-person tax/NI via owner buckets in adapter
**Decided:** Tax and NI are computed per owner bucket (`owner` on income items), then summed to household annual liabilities. Items with no owner are handled in a household fallback bucket.
**Rationale:** UK tax treatment is fundamentally person-based. Owner buckets deliver materially improved accuracy while preserving backward compatibility for existing scenarios.

### Property remains in `pots` model with mortgage/BTL extensions
**Decided:** Property features are added as optional fields on existing property pots (`mortgage`, `monthlyRent`, `monthlyExpenses`) rather than introducing a new top-level schema object in v0.22.
**Rationale:** Keeps the iteration focused on calculation accuracy and minimizes migration risk. A broader JSON/domain refactor is deferred to a follow-on iteration.

### Pragmatic BTL tax approximation accepted
**Decided:** BTL taxable contribution uses `rent - expenses - mortgage payments` and applies a simple mortgage-interest tax credit (`20% × annualInterestPaid`) against tax liability.
**Rationale:** This is intentionally simpler than full Section 24 accounting but aligns with acceptable planning error tolerance while still capturing the first-order mortgage-interest effect.

### Depreciating assets modeled as deterministic non-liquid pots
**Decided:** Added a `depreciating` pot type with deterministic annual depreciation (`annualDepreciationPct`) and no stochastic return volatility.
**Rationale:** Vehicles and similar assets are better represented by deterministic depreciation than investment-style stochastic returns; treating them as non-liquid keeps solvency logic correct.
