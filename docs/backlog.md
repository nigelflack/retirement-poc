# Backlog

Candidate work items not yet assigned to an iteration. Review this when planning the next iteration.

Items move here when deferred from a completed iteration. They move out when picked up into an iteration plan (`docs/iterations/vX-Y.md`) or explicitly dropped.

---

## UI

- **Panel 3 cards are not interactive** — clicking a scenario card does not load it into Panel 1 (deferred from v0.8)
- **`/scenarios` page not linked from the main wizard** — must be navigated to directly (deferred from v0.8)
- **Panel 4 — Adjust your plan** — contributions review panel; not yet started (deferred from v0.6)
- **Fan chart** — p1–p99 portfolio percentile visualisation; data already in API response, no UI yet (deferred from v0.6)
- **Retire-together parity** — Panel 2 and 3 solve calls advance all persons' ages uniformly; one person cannot retire significantly earlier than another independently via the solve

## Simulation model

- **Annual contribution growth** — contributions are currently fixed nominal amounts; no growth rate (deferred repeatedly from v0.3)
- **Other income streams** — rental income, part-time work, defined benefit pensions (deferred repeatedly from v0.4)
- **Tax modelling** — ISA vs pension drawdown, income tax thresholds, LTA (lifetime allowance) (deferred from v0.4)
- **Multiple asset classes** — no bond/equity split or glide path; single return distribution throughout (deferred from v0.5)
- **Spending step-downs** — no modelling of reduced spending in later retirement (e.g. age 80+)

## CLI

- **`--solve` cross-mode re-run** — income and ages solve modes are separate invocations; no loop that switches between them (deferred from v0.7.1)

## Platform

- **Deployment / hosting** — no deployment pipeline or hosting configuration (deferred from v0.6)
