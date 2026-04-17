# Backlog

Candidate work items not yet assigned to an iteration. Review this when planning the next iteration.

Items move here when deferred from a completed iteration. They move out when picked up into an iteration plan (`docs/iterations/vX-Y.md`) or explicitly dropped.

---

## UI

- **Panel 3 cards are not interactive** — clicking a scenario card does not load it into Panel 1 (deferred from v0.8)
- **`/scenarios` page not linked from the main wizard** — must be navigated to directly (deferred from v0.8)
- **Panel 4 — Adjust your plan** — contributions review panel; not yet started (deferred from v0.6)
- **Scenario summary panel** — labelled timeline of capital events, income streams, and spending target shown in the detailed breakdown; requires `label` fields on schedule entries and capital events (deferred from v0.13)
- **Retire-together parity** — Panel 2 and 3 solve calls advance all persons' ages uniformly; one person cannot retire significantly earlier than another independently via the solve

- **Mortgage / liability pots** — outstanding mortgage balance should reduce net property equity and be cleared on sale. Requires a `liability` pot type linked to a property pot. Deferred from v0.16.
- **Annual allowance enforcement** — pension £60k/yr and ISA £20k/yr caps should be validated by the adapter against HMRC limits, not just accepted as caller-supplied `annualCap` values. Deferred from v0.16.
- **Partial pot liquidation** — `capitalIn` with a `fraction` field (e.g. sell 50% of BTL). Currently only full liquidation is supported. Deferred from v0.16.
- **Cross-asset return correlation** — equity and property returns are currently sampled independently. Modelling correlation (they tend to fall together) requires a multivariate distribution. Deferred from v0.16.

## Simulation model

- **Annual contribution growth** — contributions are currently fixed nominal amounts; no growth rate (deferred repeatedly from v0.3)
- **Other income streams** — rental income, part-time work, defined benefit pensions (deferred repeatedly from v0.4)
- **Tax modelling** — ISA vs pension drawdown, income tax thresholds, LTA (lifetime allowance) (deferred from v0.4)
- **Multiple asset classes** — no bond/equity split or glide path; single return distribution throughout (deferred from v0.5)
- **Spending step-downs** — no modelling of reduced spending in later retirement (e.g. age 80+)

## Engine / tech debt

- **`runPath` parameter count** — 8 parameters; `isLiquid`, `primaryIdx`, and `potIndex` are all derived from `potDefs` and could be pre-packaged into a context object to reduce the signature length. Deferred from v0.17.
- **Fan chart accumulation memory** — per-year arrays accumulate all simulation values before sorting for percentiles. At higher sim counts (e.g. 10k) this becomes the dominant pressure point. A running order-statistic or reservoir approach would be more efficient. Deferred from v0.17.
- **`drawdownSolvent` per-path allocation** — each path allocates and returns a boolean array that the outer loop then re-iterates to sum. `solventAtDrawdownYear` could be incremented directly inside the path to avoid the intermediate array. Deferred from v0.17.
- **`retirementYear <= 0` edge case in engine** — the engine handles it silently; this is a degenerate scenario that the adapter should reject before calling the engine. Convert to an assertion in `simulate` and a validation error in the adapter. Deferred from v0.17.
- **No input validation in `simulate`** — the engine trusts its caller completely (single caller today). An early guard (e.g. `primaryIdx === -1`) would catch adapter wiring mistakes immediately in tests rather than producing silent wrong results. Deferred from v0.17.



- **`--solve` cross-mode re-run** — income and ages solve modes are separate invocations; no loop that switches between them (deferred from v0.7.1)

## Platform

- **Deployment / hosting** — no deployment pipeline or hosting configuration (deferred from v0.6)
