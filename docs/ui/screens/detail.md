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
- **Household Balance Sheet** — see below
- **Income Statement** — see below
- **Cashflow Statement** — see below

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

**Balance sheet** (selected year `y`):
- Assets: `potPercentiles.byYear[y].byPot[potId].realP50` per pot, ordered by pot definition order
- Liabilities: `liabilities.byYear[y].mortgageBalances` keyed by pot id (real, today's money)
- Net equity: total assets − total liabilities

**Income statement** (selected year `y`):
- Source: `incomeStatementByYear[y]` — real-deflated by `(1 + inflationMean)^(y+1)`
- Gross income: `income[]` items
- Less tax & NI: `tax` and `ni` scalars (always shown, zero if not applicable)
- Net income after tax: gross income − tax − NI
- Expenditure: `expense[]` (excludes `income_tax` and `ni` items)
- Net surplus / deficit: net income − expenditure
- Capital movements: `capitalIn[]` / `capitalOut[]` shown below if non-zero

**Cashflow statement** (selected year `y`):
- Opening net equity: `netEquityAt(y-1)` — or initial pot values minus initial mortgages for year 0
- Net surplus: from income statement
- Capital in/out: from `incomeStatementByYear[y]`
- Implied investment & growth: `closing − opening − netSurplus − capitalIn + capitalOut` (p50 residual)
- Closing net equity: `netEquityAt(y)` — must match balance sheet net equity exactly

Derived values:

- Person ages from each person's `currentAge + yearOffset`

---

## Balance Sheet section

Replaces the former "Net-worth split" 3-card widget. Always shown for the selected year.

```
┌── Household Balance Sheet ───────────────────────────────────────────┐
│ Assets                                                               │
│   pension_nigel                                 £xxx,xxx             │
│   isa_nigel                                     £xxx,xxx             │
│   ... (one row per pot)                         ...                  │
│   ─────────────────────────────────────────                          │
│   Total assets                                  £x,xxx,xxx           │
│                                                                      │
│ Liabilities                                                          │
│   btl_tequila_wharf (mortgage)                  £xxx,xxx             │
│   main_residence (mortgage)                     £xxx,xxx             │
│   ─────────────────────────────────────────                          │
│   Total liabilities                             £xxx,xxx             │
│                                                                      │
│ Net equity                                      £x,xxx,xxx           │
└──────────────────────────────────────────────────────────────────────┘
```

All values are real (today's money, p50 across simulations).

---

## Income Statement section

Shown below the balance sheet for the selected year. All amounts real (today's money).

```
┌── Income Statement — 2031 (age 45) ──────────────────────────────────┐
│ Gross income                                                         │
│   employment_nigel                              £xxx,xxx             │
│   sp_nigel                                      £xxx,xxx             │
│   ─────────────────────────────────────────                          │
│   Total gross income                            £xxx,xxx             │
│                                                                      │
│ Less: tax & NI                                                       │
│   Income tax                                   (£xxx,xxx)            │
│   National Insurance                           (£xxx,xxx)            │
│   ─────────────────────────────────────────                          │
│   Total tax & NI                               (£xxx,xxx)            │
│   Net income after tax                          £xxx,xxx             │
│                                                                      │
│ Expenditure                                                          │
│   groceries                                    (£xxx,xxx)            │
│   holidays                                     (£xxx,xxx)            │
│   ─────────────────────────────────────────                          │
│   Total expenditure                            (£xxx,xxx)            │
│                                                                      │
│ Net surplus / (deficit)                         £xxx,xxx             │
├──────────────────────────────────────────────────────────────────────┤
│ Capital movements (if any)                                           │
│   Capital in: sell_btl                          £xxx,xxx             │
│   Capital out: pension_contribution            (£xxx,xxx)            │
└──────────────────────────────────────────────────────────────────────┘
```

Deductions shown in parentheses. Net surplus coloured primary when positive, destructive when negative.

---

## Cashflow Statement section

Shown below the Income Statement section for the selected year.

```
┌── Cashflow Statement — 2031 (age 45) ────────────────────────────────┐
│   Opening net equity                            £x,xxx,xxx           │
│                                                                      │
│ + Net surplus / (deficit)                       £xxx,xxx             │
│ + Capital in                                    £xxx,xxx             │
│ − Capital out                                  (£xxx,xxx)            │
│ + Implied investment & growth (p50)      [?]    £xxx,xxx             │
│   ─────────────────────────────────────────                          │
│   Closing net equity                            £x,xxx,xxx           │
└──────────────────────────────────────────────────────────────────────┘
```

`[?]` is an inline dotted-underline tooltip explaining the cross-sectional p50 approximation. Implied line shown in muted style. Closing net equity equals balance sheet net equity exactly.

---

## States

| State | Behaviour |
|---|---|
| Missing route state | Show "No scenario loaded" fallback and link to `/` |
| Valid state | Render rail + strip + selected-year panel |
| Missing `resolvedYears` in result | Show inline message: detailed year data unavailable |
