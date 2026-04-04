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
Bob (50) and Alice (45)          [Edit details]  [Edit accounts]  [Save]  [Load]

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
│                                                                     │
│  ▼ Show detailed breakdown          Show debug table ▼             │
└─────────────────────────────────────────────────────────────────────┘

<!-- Expanded state — shown when "Show detailed breakdown" is clicked -->

┌─────────────────────────────────────────────────────────────────────┐
│                        Your Retirement Goal                         │
│                                                                     │
│  [... controls unchanged ...]                                       │
│                                                                     │
│  Will your money last?                                              │
│                                                                     │
│  Unlikely                                              Very likely  │
│  ├────────────────────────────────────■──────────────────────────┤  │
│                                                                     │
│      At these settings, money is likely to last into your 90s.      │
│                                                                     │
│  ▲ Hide detailed breakdown                                          │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                                     │
│  How likely is your money to last?                                  │
│                                                                     │
│   100% ┤                                                            │
│        │  ██   ██   ██   ██   ██                                    │
│    80% ┤  ██   ██   ██   ██   ██   ██                               │
│        │  ██   ██   ██   ██   ██   ██   ██                          │
│    60% ┤  ██   ██   ██   ██   ██   ██   ██                          │
│        │  ██   ██   ██   ██   ██   ██   ██                          │
│    40% ┤  ██   ██   ██   ██   ██   ██   ██                          │
│        └──────────────────────────────────────                      │
│           70   75   80   85   90   95  100                          │
│           98%  96%  91%  86%  81%  73%  64%                         │
│                                                                     │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                                     │
│  What you might have when you retire  (in today's money)            │
│                                                                     │
│   Pessimistic ──────────────────────────────────── Optimistic       │
│               |────[──────────│──────────]────|                     │
│              £540k  £690k   £810k  £940k   £1.1m                    │
│                p10   p25     p50    p75     p90                     │
│                               ↑ median                              │
│                                                                     │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                                     │
│  State pension                                                      │
│                                                                     │
│  Bob      £9,600 / yr  from age 67                                  │
│  Alice    £11,500 / yr  from age 67                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

<!-- Debug-table expanded state — independent of breakdown toggle -->

┌─────────────────────────────────────────────────────────────────────┐
│                        Your Retirement Goal                         │
│                                                                     │
│  [... controls unchanged ...]                                       │
│                                                                     │
│  Will your money last?                                              │
│                                                                     │
│  Unlikely                                              Very likely  │
│  ├────────────────────────────────────■──────────────────────────┤  │
│                                                                     │
│      At these settings, money is likely to last into your 90s.      │
│                                                                     │
│  ▼ Show detailed breakdown                      ▲ Hide debug table  │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│                                                                     │
│  Debug — POST /run response                                         │
│                                                                     │
│  numSimulations: 10000   probabilityOfRuin: 0.19                    │
│  householdRetirementAge: 60 (Bob)   withdrawalRate: 0.04            │
│                                                                     │
│  Year  Bob  Alice  Phase  Bob SP     Alice SP   p10       p50       p90      │
│  ────  ───  ─────  ─────  ─────────  ─────────  ────────  ────────  ──────── │
│  2026   50    45     A      —          —        £280,000  £450,000  £630,000 │
│  2027   51    46     A      —          —        £295,000  £475,000  £665,000 │
│  2028   52    47     A      —          —        £311,000  £501,000  £701,000 │
│  ...                                                                         │
│  2036   60    55     D      —          —        £540,000  £810,000  £1,100,000 ← retire │
│  2037   61    56     D      —          —        £520,000  £785,000  £1,068,000 │
│  ...                                                                         │
│  2043   67    62     D    £9,600/yr    —        £460,000  £710,000  £980,000 │
│  2048   72    67     D    £9,600/yr  £11,500/yr £400,000  £635,000  £890,000 │
│  ...                                                                         │
│  2076  100    95     D    £9,600/yr  £11,500/yr       £0        £0        £0 │
│                                                                     │
│  (scrollable — all years from current age to toAge)                 │
│                                                                     │
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
│       (hover: ──────)        ↑ your current plan   (hover: ──────)  │
└─────────────────────────────────────────────────────────────────────┘

<!-- Panel 3 card click: loads that card's retirement ages and monthly
     income into Panel 1 controls and triggers a new POST /run.
     The card for the current plan is highlighted (existing behaviour). -->

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
- The "Show detailed breakdown" toggle is collapsed by default. Clicking it expands the breakdown inline within Panel 1 and changes the label to "Hide detailed breakdown". The expanded state persists across re-runs (if open, it stays open when the simulation updates).
- All values in the breakdown are in today's money (real terms), consistent with Panel 1.
- The survival-by-age bars are vertical columns, one per 5-year interval, with height proportional to the probability value. The y-axis runs from 0–100%. They are display-only (not interactive).
- The percentile range track shows p10–p90 as the full extent, with p25–p75 as a highlighted inner band and p50 marked with a tick. Values are rounded to the nearest £10,000.
- The state pension section is omitted if no person has a state pension configured.
- The "Show debug table" toggle is collapsed by default and independent of the breakdown toggle — both can be open simultaneously. Clicking it expands inline within Panel 1 and changes the label to "Hide debug table".
- The debug table shows one row per year from current age to `toAge`, with columns: Year, each person's age, Phase (A = Accumulating / D = Drawdown), each person's state pension ("—" before their `fromAge`, annual amount in today's money from `fromAge`), and portfolio p10/p50/p90 from `portfolioPercentiles.byAge`.
- Phase switches to D in the year the household retirement age is reached; that row is annotated with "← retire".
- Portfolio values in the debug table are nominal (raw from API), not rounded. State pension amounts are in today's money as entered.
- The debug table is displayed in a fixed-height scrollable container (approximately 12 rows visible at a time). The header row is sticky.
- The summary line above the table shows `numSimulations`, `probabilityOfRuin`, `householdRetirementAge` and person name, and `withdrawalRate` directly from the API response.

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

---

## Header controls

| Control | Behaviour |
|---------|-----------|
| `[Edit details]` | Navigates to Step 1. Form repopulates from current `people` state. No data is lost. |
| `[Edit accounts]` | Navigates to Step 2. Form repopulates from current `people` state — account rows and state pension fields pre-filled. No data is lost. |
| `[Save]` | Downloads `people` state as a JSON file. Filename: `<name1>-<name2>.json` (two people) or `<name1>.json` (one person), lowercased with spaces replaced by hyphens. Format matches `ui/src/scenarios/*.json`. |
| `[Load]` | Opens a file picker (`<input type="file" accept=".json">`). On success, replaces `people` state and remains on the scenario screen. On failure (invalid JSON or unexpected shape), shows an inline error message beneath the header. |

---

## Panel 3 — card interaction

Each card is clickable (cursor-pointer, hover border highlight). Clicking a card:
1. Sets Panel 1 retirement ages to the card's retirement ages (per person).
2. Sets Panel 1 monthly income to the card's monthly income.
3. Triggers a new `POST /run` immediately (same debounce path as manual spinner changes).

The card matching the current Panel 1 values is highlighted (existing behaviour, unchanged).
