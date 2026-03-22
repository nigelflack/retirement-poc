# Screen: Retirement Scenario

This is the primary destination screen — the place users spend most of their time. Its job is to make the Monte Carlo simulation results tangible and explorable without exposing any of the underlying statistical complexity.

The screen has two modes that feel like one: adjusting the controls reruns the simulation instantly and updates every panel. The user never explicitly "submits" — changing a spinner or the income field is enough to trigger a new run.

---

## Used in

- [flows/retirement-planning.md](../flows/retirement-planning.md) — Step 3

---

## Purpose and key features

| Panel | Purpose |
|-------|---------|
| Your Retirement Goal | Core controls — retirement ages and income target. The "Retire together" toggle locks both ages to move in step. The solvency bar gives an immediate at-a-glance read on the current scenario. The bar position represents the probability that the portfolio remains solvent to age 100 (i.e. `1 − probabilityOfRuin` from `POST /run`). The left extreme is 0% (certain ruin), the right extreme is 100% (certain survival); the marker `■` shows the current scenario's value. |
| Other options you could consider | Proactive suggestions calculated from the simulation: what income is achievable if they retire earlier; what ages are needed for a higher income target. Requires no interaction — just contextual insight. |
| Some options that might work for you | Three pre-calculated scenario cards bracketing the current plan. Lets users compare adjacent options without manually adjusting spinners. The current plan is highlighted. |
| Adjust your plan | Entry point for reviewing contributions. Out of scope for v0.6 — shown as a static prompt. |

---

## Data received from wizard

| Data | Source | Purpose |
|------|--------|---------|
| Names and ages | Step 1 | Labels and retirement age spinners |
| Account values and contributions | Step 2 | Drives the simulation |
| State pension amounts and ages | Step 2 | Included in every simulation run |

---

## Base Wireframe

```
Bob (50) and Alice (45)                              [Edit details]

┌─────────────────────────────────────────────────────────────────────┐
│                        Your Retirement Goal                         │
│                                                                     │
│          Retire at               │       With an income of          │
│                                  │                                  │
│    Bob          Alice            │               ↑                  │
│     ↑             ↑              │           ┌────────┐             │
│   ┌────┐        ┌────┐           │           │ £3,000 │             │
│   │ 60 │        │ 59 │           │           └────────┘             │
│   └────┘        └────┘           │               ↓                  │
│     ↓             ↓              │           per month              │
│                                  │                                  │
│  ☐  Retire together              │                                  │
│                                                                     │
│  Your current savings of £450,000 are projected to grow to about    │
│  £810,000 by the time you retire. (in today's money)                │
│                                                                     │
│  Will your money last?                                              │
│                                                                     │
│  Unlikely                                              Very likely  │
│  ├────────────────────────────────────■──────────────────────────┤  │
│                                                                     │
│      At these settings, money is likely to last into your 90s.      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  Other options you could consider                   │
│                                                                     │
│   Retire a bit earlier?          │   Want a higher income?          │
│                                  │                                  │
│   If Bob retired at 58 and       │   If you wanted £3,600/mo        │
│   Alice at 55, you could         │   instead, you'd need to         │
│   sustainably draw around:       │   work until                     │
│                                  │                                  │
│       £2,600 / mo                │         Bob age 62               │
│     (in today's money)           │         Alice age 59             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Some options that might work for you                               │
│                                                                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  Retire at 58    │  │  Retire at 60     │  │  Retire at 62    │  │
│  │  Bob · Alice     │  │  Bob · Alice      │  │  Bob · Alice     │  │
│  │  at 55           │  │  at 57            │  │  at 59           │  │
│  │  £2,600 / mo     │  │  £3,000 / mo      │  │  £3,400 / mo     │  │
│  │                  │  │                   │  │                  │  │
│  │  to age 90+      │  │  to age 90+       │  │  to age 90+      │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
│                          ↑ your current plan                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Or, adjust your plan to improve your projection                    │
│                                                                     │
│  Changing what you save now could open up better options.           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  → Review and adjust your contributions                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Interaction rules

- Changing any control (spinner, income field, "Retire together" toggle) immediately reruns `POST /run` and refreshes all panels.
- Retirement age spinners are bounded: minimum is current age + 1, maximum is 80.
- "Retire together" toggle is only shown when there are two people. When shown and checked, only the main (left) spinner is adjustable, and the partner's retirement age is calculated as the same year in the future (e.g. if the partner is 5 years younger, their retirement age will be 5 years younger)
- Income is entered as a monthly £ figure; the simulation uses the annualised equivalent.
- All monetary values displayed are in today's money (real terms).
- `[Edit details]` in the header returns to Step 1 and clears wizard state.
- While a simulation request is in flight, the panels show a loading state (content dims, controls disabled). The spinner and income field revert to their previous values if the request fails.
- When there is only one person, the header shows their name and age only, "Retire together" is hidden, and there is a single retirement age spinner.

---

### Variation — "Retire together" checked

When the toggle is on, the spinners collapse to a single control. The partner's retirement age is derived automatically (same number of years from now, so if the partner is younger their retirement age will be lower by the age gap).

```
│          Retire at               │       With an income of          │
│                                  │                                  │
│       ↑                          │               ↑                  │
│     ┌────┐      ┌────┐           │           ┌────────┐             │
│     │ 60 │      │ 55 │           │           │ £3,000 │             │
│     └────┘      └────┘           │           └────────┘             │
│       ↓                          │               ↓                  │
│      Bob         Alice           │           per month              │
│                                  │                                  │
│  ☑  Retire together              │                                  │
```

Adjusting Bob's spinner (left) moves Alice's spinner (right) in step.

---

## Survivability buckets

Panels 2 and 3 adapt their content based on the likelihood of the portfolio lasting until the youngest person reaches age 90. This threshold is computed from the `survivalTable` entry at age 90 returned by `POST /run`.

| Bucket | Condition | Label (internal) |
|--------|-----------|------------------|
| 1 | Probability solvent at 90 < 50% | Not viable |
| 2 | 50% ≤ probability < 85% | Close to viable |
| 3 | 85% ≤ probability ≤ 95% | Viable |
| 4 | Probability > 95% | Over-saving |

---

## Panel 2 — conditional content

Panel 2 always shows two side-by-side suggestions. The left and right slots change content based on the survivability bucket.

### Buckets 1 and 2 — plan is not viable or borderline

The user needs to adjust. Both suggestions show what needs to change to make the plan work.

| Slot | Content |
|------|---------|
| Left | **Sustainable income** — "At your current retirement age, you could sustainably draw £X/mo." Calculated by binary-searching the withdrawal rate that produces ~85% solvency at age 90. |
| Right | **Required retirement age** — "To draw £X/mo sustainably, you'd need to work until Bob age Y / Alice age Z." Found by stepping retirement ages forward until ~85% solvency at age 90 is reached at the current withdrawal rate. |

Wireframe (bucket 1 / 2):
```
┌─────────────────────────────────────────────────────────────────────┐
│                Other options you could consider                     │
│                                                                     │
│   Sustainable income              │   Work a bit longer?            │
│   at your current retirement age  │                                 │
│                                   │   To draw £3,000/mo you'd       │
│   You could draw around:          │   need to retire at             │
│                                   │                                 │
│       £2,100 / mo                 │         Bob age 64              │
│     (in today's money)            │         Alice age 61            │
└─────────────────────────────────────────────────────────────────────┘
```

### Buckets 3 and 4 — plan is viable or over-saving

The user has headroom. Suggestions explore earlier retirement or a higher income.

| Slot | Content |
|------|---------|
| Left | **Earlier retirement** — "If you retired 2 years earlier, you could sustainably draw £X/mo." Recalculates the sustainable income at `retirementAge − 2`. |
| Right | **Higher income** — "You could earn £X/mo instead, if Bob retired at age Y / Alice age Z." Steps income up by ~20% and finds the retirement age needed to sustain it at ~85% solvency at age 90. |

Wireframe (bucket 3 / 4):
```
┌─────────────────────────────────────────────────────────────────────┐
│                Other options you could consider                     │
│                                                                     │
│   Retire a bit earlier?           │   Want a higher income?         │
│                                   │                                 │
│   If Bob retired at 58 and        │   You could earn £3,600/mo      │
│   Alice at 55, you could          │   instead, if you worked        │
│   sustainably draw around:        │   until:                        │
│                                   │                                 │
│       £2,600 / mo                 │         Bob age 62              │
│     (in today's money)            │         Alice age 59            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Panel 3 — conditional content

Panel 3 always shows three scenario cards. Every card is a viable, sustainable plan (≥ 85% solvent at age 90). The cards form a spectrum; the current plan is either absent (buckets 1 & 2) or the middle card (buckets 3 & 4).

The unifying rule: **three cards, all viable, always a spectrum**.

### Buckets 1 & 2 — plan not viable or borderline

The two extremes are taken from the Panel 2 calculations: the sustainable income at the user's current retirement ages, and the required retirement ages for the user's current income target. The middle card splits the difference — a compromise on both levers.

| Card | Retirement age | Monthly income |
|------|---------------|----------------|
| Left | Current ages | Sustainable income at current ages (= Panel 2 left answer) |
| Middle | Mid-point between current and required ages | Sustainable income at the mid-point ages |
| Right | Required ages for current income (= Panel 2 right answer) | Current income target |

Wireframe (bucket 1 / 2):
```
┌─────────────────────────────────────────────────────────────────────┐
│  Some options that might work for you                               │
│                                                                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  Retire at 60    │  │  Retire at 62     │  │  Retire at 64    │  │
│  │  Bob · Alice     │  │  Bob · Alice      │  │  Bob · Alice     │  │
│  │  at 57           │  │  at 59            │  │  at 61           │  │
│  │  £2,100 / mo     │  │  £2,550 / mo      │  │  £3,000 / mo     │  │
│  │                  │  │                   │  │                  │  │
│  │  to age 90+      │  │  to age 90+       │  │  to age 90+      │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Buckets 3 & 4 — plan viable or over-saving

The current plan sits in the middle, highlighted. The left card retires 2 years earlier with the matching sustainable income; the right card shows a materially higher income (~20% more) with the retirement age needed to sustain it.

| Card | Retirement age | Monthly income |
|------|---------------|----------------|
| Left | Current ages − 2 years | Sustainable income at those earlier ages |
| Middle _(current plan)_ | Current ages | Current income target — highlighted |
| Right | Retirement ages needed for +~20% income | Current income × ~1.2 |

Wireframe (bucket 3 / 4):
```
┌─────────────────────────────────────────────────────────────────────┐
│  Some options that might work for you                               │
│                                                                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  Retire at 58    │  │  Retire at 60  ◀  │  │  Retire at 62    │  │
│  │  Bob · Alice     │  │  Bob · Alice      │  │  Bob · Alice     │  │
│  │  at 55           │  │  at 57  current   │  │  at 59           │  │
│  │  £2,600 / mo     │  │  £3,000 / mo      │  │  £3,600 / mo     │  │
│  │                  │  │                   │  │                  │  │
│  │  to age 90+      │  │  to age 90+       │  │  to age 90+      │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
│                              ↑ your current plan                    │
└─────────────────────────────────────────────────────────────────────┘
```

