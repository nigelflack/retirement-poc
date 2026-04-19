# Flow: Retirement Planning

This document defines the current runtime journey. The app is now scenario-first: users load a scenario and then iterate on outcomes in the explorer.

---

## Overview

```
[/] ─────→ [/scenarios] ─────→ [Scenario explorer (/scenario)] ─────→ [Detail viewer (/detail)]
                                ↑                 │
                                └─────────────────┘
                                explicit back to loader
```

---

## Step 1 — Scenario loader

**Screen:** [screens/scenarios.md](../screens/scenarios.md)

User lands on scenario loader via `/` and selects or creates a scenario. Selected scenario is passed into the explorer runtime.

**Navigation:**
- `/` entry → `/scenarios`
- Load scenario card → `/scenario` with scenario in state
- Create new → `/scenario` with default scenario in state
- Clone scenario → `/scenario` with copied scenario in state

---

## Step 2 — Scenario explorer

**Screen:** [screens/retirement-scenario.md](../screens/retirement-scenario.md)

User adjusts retirement ages and monthly income target. Simulation reruns and updates panels.

**Navigation:**
- `View detailed breakdown ->` → `/detail`
- `Back to scenarios` (v0.19) → `/scenarios`

---

## Step 3 — Detail viewer

**Screen:** [screens/detail.md](../screens/detail.md)

User inspects simulation outcomes with year-specific detail.

**Navigation:**
- `Back to scenario` → `/`
- (Optional in-browser back) returns to scenario explorer
