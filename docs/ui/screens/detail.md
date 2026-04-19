# Screen: Detail Viewer (`/detail`)

Used in flow: retirement-planning.md (from scenario screen)

---

## Purpose

Provide both focused and analyst-style inspection views for a simulation result.

- Focused mode: year rail + selected-year panel
- Analyst modes: table, fan chart, spending sources

---

## Entry condition

Requires `location.state` to include at minimum:

- `result` from `POST /simulate` (debug enabled)
- `people`
- `capitalEvents`
- `retirementAges`
- `monthlyIncome`

If state is missing, show fallback and a link back to `/`.

---

## Layout (v0.21)

```
┌──────────────────────────────────────────────────────────────────────┐
│ <- Back to scenario                                                  │
│ Household summary                                                    │
│ (optional opening text block)                                        │
│                                                                      │
│ [Year detail] [Year by year] [Fan chart] [Spending sources]         │
│                                                                      │
│ Tab content                                                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Tab: Year detail

- Year rail (clickable)
- Slim percentile strip
- Selected-year detail panel

### Tab: Year by year

- Scrollable annual table with per-year income/spend/capital and p10/p50/p90

### Tab: Fan chart

- Percentile fan view over time

### Tab: Spending sources

- Drawdown-era stacked source bars with target overlay

---

## Controls and behaviour

- Clicking a year on the rail sets the selected year.
- Selected year updates:
  - detail panel values
  - selected marker on percentile strip
- Optional keyboard support (left/right) may be added if low-cost.
- If no year explicitly selected, default to first simulation year.

---

## Data mapping

For selected year index `y`:

- `resolvedYears[y].income[]` -> income item list and total
- `resolvedYears[y].expense[]` -> expense item list and total
- `resolvedYears[y].capitalIn[]` / `capitalOut[]` -> capital movement totals
- `portfolioPercentiles.byAge[y]` -> p10/p50/p90 for selected year

Derived values:

- `netCashflow = totalIncome - totalExpense + capitalInTotal - capitalOutTotal`
- Person ages from each person's `currentAge + yearOffset`

---

## States

| State | Behaviour |
|---|---|
| Missing route state | Show "No scenario loaded" fallback and link to `/` |
| Valid state | Render rail + strip + selected-year panel |
| Missing `resolvedYears` in result | Show inline message: detailed year data unavailable |
