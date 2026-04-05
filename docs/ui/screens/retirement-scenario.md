# Screen: Retirement Scenario

Primary destination screen. Adjusting any control immediately reruns `POST /simulate` and refreshes all panels — the user never explicitly submits.

Used in: [flows/retirement-planning.md](../flows/retirement-planning.md) — Step 3

---

## Wireframe

```
Bob (50) and Alice (45)    [Edit details]  [Edit accounts]  [Save]  [Load]

┌─────────────────────────────────────────────────────────────────────┐
│                        Your Retirement Goal                         │
│                                                                     │
│          Retire at               │       With an income of          │
│    Bob          Alice            │               ↑                  │
│     ↑             ↑              │           ┌────────┐             │
│   ┌────┐        ┌────┐           │           │ £3,000 │             │
│   │ 60 │        │ 59 │           │           └────────┘             │
│   └────┘        └────┘           │               ↓                  │
│     ↓             ↓              │           per month              │
│                                  │                                  │
│  ☐  Retire together              │  ▼ Add income step-change        │
│  ▼ Add contribution step-changes │                                  │
│                                                                     │
│  Your savings are projected to grow to about £810,000 by            │
│  the time you retire. (in today's money)                            │
│                                                                     │
│  Will your money last?                                              │
│  Unlikely                                              Very likely  │
│  ├────────────────────────────────────■──────────────────────────┤  │
│      At these settings, money is likely to last into your 90s.      │
│                                                                     │
│  ▼ Show detailed breakdown          Show debug table ▼              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                 Other options you could consider                    │
│   Retire a bit earlier?           │   Want a higher income?         │
│   If Bob retired at 58 …          │   You'd need to work until      │
│       £2,600 / mo                 │   Bob 62 · Alice 59             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Some options that might work for you                               │
│  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │ Retire at 58 │  │  Retire at 60      │  │  Retire at 62    │    │
│  │ £2,600 / mo  │  │  £3,000 / mo       │  │  £3,600 / mo     │    │
│  │ to age 90+   │  │  ↑ your plan       │  │  to age 90+      │    │
│  └──────────────┘  └────────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Or, adjust your plan to improve your projection                    │
│  → Review and adjust your contributions                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Panel 1 — Your Retirement Goal

### Controls
- Two retirement age spinners (one per person), bounded: min = current age + 1, max = 80.
- "Retire together" toggle — two-person households only. When checked, adjusting the primary spinner moves the partner's age by the same number of years (preserving the age gap). Only the primary spinner is active; the partner spinner is disabled.
- Monthly income field (£ spinner). All figures are in today's money; the adapter converts to annual for the engine.
- Any change to any control immediately debounces into a new `POST /simulate` call.
- While a request is in flight: panels dim to 60% opacity, controls disabled. On error, reverts to previous values.

### Contribution step-change (per person, collapsed by default)
- Disclosure link: "▼ Add contribution step-changes" / "▲ Hide contribution step-changes".
- Fields: "Reduces to £X/mo" and "in the last N yrs before retirement".
- Both fields must be filled to take effect; if either is blank, no schedule is sent.
- Warning (inline, step ignored) if N ≥ years to that person's retirement.
- Warning (inline, step ignored) if £X ≥ that person's current total monthly contributions.
- Retirement age change: N stays fixed; the step year shifts automatically.

### Income step-change (household, collapsed by default)
- Disclosure link: "▼ Add income step-change" / "▲ Hide income step-change".
- Fields: "Reduces to £X/mo" and "after year N of retirement".
- Both fields must be filled to take effect; if either is blank, no schedule is sent.
- Warning (inline, step ignored) if £X ≥ main monthly income target.
- The two step-change sections are independent — either, both, or neither can be open simultaneously.

### Solvency bar
- Displays `1 − probabilityOfRuin` from the `POST /simulate` response as a filled bar.
- Left = 0% (certain ruin), right = 100% (certain survival).
- Sentence below the bar is derived from the survival probability at age 90 (interpolated from `survivalTable`).

### Projected pot sentence
- Shown once a result exists. Displays `accumulationSnapshot.real.p50` (median at retirement) in today's money.

### Detailed breakdown (collapsed by default, persists across re-runs)
Three sub-sections, shown inline when expanded:
- **Survival by age** — vertical bar chart, one bar per 5-year interval from retirement to 100, height = probability solvent. Display only.
- **Percentile range at retirement** — horizontal track: p10–p90 as full extent, p25–p75 as inner band, p50 marked. Values in today's money, rounded to nearest £10k.
- **State pension** — one line per person with a configured state pension (annual amount + from age). Section omitted if nobody has state pension configured.

### Debug table (collapsed by default, independent of breakdown toggle)
- Summary line: `numSimulations`, `probabilityOfRuin`, `householdRetirementAge` (+ name), `withdrawalRate` — all directly from the API response.
- Scrollable fixed-height table (~12 rows visible), sticky header.
- Columns: Year, each person's age, Phase (A = accumulating / D = drawdown), each person's state pension ("—" before `fromAge`), portfolio p10 / p50 / p90 from `portfolioPercentiles.byAge`.
- Phase switches to D at the household retirement age; that row is annotated "← retire".

---

## Panel 2 — Other options you could consider

Always two side-by-side slots. Content switches on whether the portfolio is on track (≥ 85% solvent at age 90) or not.

**Not on track (< 85% solvent at 90):**
- Left: sustainable income at current retirement ages (solve for income at 85% target).
- Right: retirement ages required to sustain the current income target (solve for ages at 85% target).

**On track (≥ 85% solvent at 90):**
- Left: sustainable income if retiring 2 years earlier (solve for income at current ages − 2).
- Right: retirement ages required to sustain income × 1.2 (solve for ages at 85% target).

**Note:** Both solve endpoints use the flat income/contribution model and do not accept schedule inputs. When step-change fields are active, Panel 2 suggestions are indicative only.

---

## Panel 3 — Some options that might work for you

Always three clickable cards, all viable (≥ 85% solvent at 90), forming a spectrum.

**Not on track:**
- Left: current ages, sustainable income (= Panel 2 left answer).
- Middle: mid-point ages, sustainable income at those ages.
- Right: required ages for current income (= Panel 2 right answer).

**On track:**
- Left: current ages − 2, sustainable income at those ages.
- Middle: current ages + current income — highlighted as "your current plan".
- Right: ages needed for income × 1.2.

Clicking a card loads its retirement ages and monthly income into Panel 1 and triggers a new simulation run.

---

## Header controls

- **[Edit details]** — navigates to Step 1; form repopulates from current state.
- **[Edit accounts]** — navigates to Step 2; form repopulates from current state.
- **[Save]** — downloads a JSON file. Filename: `<name1>-<name2>.json`. Includes `monthlyIncomeTarget`, per-person `contributionSchedule` (if step-change filled), household `incomeSchedule` (if filled), `capitalEvents` (if loaded from file, passed through unchanged).
- **[Load]** — file picker (`<input type="file" accept=".json">`). On success: replaces `people` state; restores `monthlyIncomeTarget`; if a person's `contributionSchedule` has exactly two entries, auto-expands and back-fills that section; same for `incomeSchedule`; stores `capitalEvents` for passthrough. On failure: inline error below the header.
