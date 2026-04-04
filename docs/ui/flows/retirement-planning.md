# Flow: Retirement Planning

This document defines the end-to-end user journey through the retirement planning tool. The flow is a three-step wizard with non-destructive navigation — all data entered is preserved when navigating back or editing.

---

## Overview

```
[Step 1: Your details] ──────→ [Step 2: Your assets] ──────→ [Step 3: Scenario]
        ↑                               ↑                       │           │
        │                               │               [Edit details]  [Edit accounts]
        └───────────────────────────────┴───────────────────────┘           │
                                                                             │
                        [Load scenario from file] ───────────────────────→──┘
                        [/scenarios page] ───────────────────────────────→──┘
```

**State persistence rule:** `people` state (names, ages, accounts, state pensions) is never cleared by navigation. Going back to step 1 or 2 populates the forms from the existing state. Data is only replaced when the user explicitly saves a step (Continue) or loads a file.

**Partner merge rule:** if the user changes names in step 1, the server payload uses the updated names. If a name is unchanged, the associated accounts are carried forward unchanged. If a partner is removed, their accounts are dropped. If a partner is added, they start with blank accounts.

The scenario screen is the destination. Steps 1 and 2 are a short setup wizard.

---

## Step 1 — Your details

**Screen:** [screens/person-details.md](../screens/person-details.md)

Collect the primary person's name and age. An "Include my partner" toggle reveals an inline partner panel. Form is pre-populated from existing `people` state when navigating back from step 2 or from the scenario screen.

Additional entry points on this screen:
- "Load from file" — opens a file picker; valid scenario JSON jumps directly to step 3
- "View example scenarios →" — navigates to `/scenarios`

**Navigation:**
- "Continue" → Step 2 (Your assets)
- "Load from file" → Step 3 (on success)
- "View example scenarios →" → `/scenarios`

---

## Step 2 — Your assets

**Screen:** [screens/assets.md](../screens/assets.md)

Collect savings and investment accounts (and state pension) for each person. Form is pre-populated from existing `people` state. If a partner was added in Step 1, person tabs allow entry for each in turn.

**Navigation:**
- "Continue" → Step 3 (Scenario screen)
- "Back" → Step 1 (data preserved, Step 1 form repopulates)

---

## Step 3 — Scenario

**Screen:** [screens/retirement-scenario.md](../screens/retirement-scenario.md)

The main interactive screen. No further data collection — the user adjusts the scenario parameters (retirement ages, income target) and sees results update in real time.

See [retirement-scenario.md](../screens/retirement-scenario.md) for the full wireframe and interaction detail.

**Navigation:**
- `[Edit details]` → Step 1 (data preserved, form repopulates)
- `[Edit accounts]` → Step 2 (data preserved, form repopulates)
- `[Save]` → downloads current `people` state as JSON file; stays on Step 3
- `[Load]` → opens file picker; valid JSON replaces people state; stays on Step 3
- Panel 3 card click → updates Panel 1 retirement ages and monthly income to the card's values
