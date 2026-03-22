# Flow: Retirement Planning

This document defines the end-to-end user journey through the retirement planning tool. The flow is a simple three-step wizard; no branching is required.

---

## Overview

```
[Step 1: Your details] → [Step 2: Your assets] → [Step 3: Scenario]
                                                         │
                                          [Edit details] └──────────────→ Step 1
```

The scenario screen is the destination. Steps 1 and 2 are a short setup wizard that collects the minimum data needed to run the first simulation.

---

## Step 1 — Your details

**Screen:** [screens/person-details.md](../screens/person-details.md)

Collect the primary person's name and age. An "Include my partner" toggle reveals an inline partner panel on the same screen.

**Navigation:**
- "Continue" → Step 2 (Your assets)

---

## Step 2 — Your assets

**Screen:** [screens/assets.md](../screens/assets.md)

Collect savings and investment accounts (and state pension) for each person. If a partner was added in Step 1, person tabs allow entry for each in turn.

**Navigation:**
- "Continue" → Step 3 (Scenario screen)
- "Back" → Step 1

---

## Step 3 — Scenario

**Screen:** [screens/retirement-scenario.md](../screens/retirement-scenario.md)

The main interactive screen. No further data collection — the user adjusts the scenario parameters (retirement ages, income target) and sees results update in real time.

See [retirement-scenario.md](../screens/retirement-scenario.md) for the full wireframe and interaction detail.

**Navigation:**
- `[Edit details]` link in the header → returns to Step 1 (clears state, restarts the wizard)
