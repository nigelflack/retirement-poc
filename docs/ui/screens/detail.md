# Screen: Detail viewer (`/detail`)

Used in flow: retirement-planning.md (from scenario screen)

---

## Purpose

Full-detail breakdown of a simulation result. Reached by clicking `[View detailed breakdown →]` on the scenario screen. Navigates back via browser back or explicit link.

---

## Entry condition

Requires `location.state` to contain:
- `result` — full POST /simulate response (with `resolvedSchedules`)
- `people` — people array
- `capitalEvents` — household capital events array
- `retirementAges` — `{ [name]: age }` object
- `monthlyIncome` — number

If state is absent (direct navigation to `/detail`), shows a fallback with a back link.

---

## Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to scenario                                              │
│                                                                 │
│ Nigel (52) and Mimi (46) · Nigel retires 62, Mimi retires 62   │
│ £4,000/mo spending · Probability solvent at 90: 87%            │
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ [Year by year]  [Fan chart]  [Spending sources]            │  │
│ ├────────────────────────────────────────────────────────────┤  │
│ │                                                            │  │
│ │  (tab content — see per-tab wireframes below)              │  │
│ │                                                            │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tab 1 — Year by year

Scrollable table, sticky header, max-height with overflow-y auto. Retirement transition row highlighted.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Cal.  │ Nigel │ Mimi │ Phase │ Contrib │ Inc.   │ Spend  │ Cap.   │ Nigel  │ Mimi   │ p10   │ p50   │ p90   │
│ year  │       │      │       │ (£/yr)  │ streams│ target │ event  │ SP     │ SP     │ (real)│ (real)│ (real)│
├───────┼───────┼──────┼───────┼─────────┼────────┼────────┼────────┼────────┼────────┼───────┼───────┼───────┤
│ 2026  │  52   │  46  │  A    │ 50,400  │  7,200 │   —    │   —    │   —    │   —    │  325k │  380k │  440k │
│ ...   │       │      │       │         │        │        │        │        │        │       │       │       │
│ 2036  │  62   │  56  │ D ←   │   0     │  7,200 │ 60,000 │   —    │   —    │   —    │  610k │  720k │  840k │
│ 2044  │  70   │  64  │  D    │   0     │  7,200 │ 60,000 │+200,000│ 12,000 │   —    │  780k │  920k │ 1.1m  │
│ ...   │       │      │       │         │        │        │        │        │        │       │       │       │
│ 2083  │  109  │  103 │  D    │   0     │   —    │ 36,000 │   —    │ 12,000 │10,000  │   0   │   18k │   82k │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- Contrib column: sum of contributions across all people for that year
- Inc. streams: `otherIncomeByYear[y]` annual; `—` if zero
- Spend target: `—` during accumulation; annual £ during drawdown
- Cap. event: `—` if zero; coloured (+green / −red) when non-zero
- SP: `—` before activation age; `£12,000/yr` after
- Phase: `A` = accumulation, `D` = drawdown; transition row shows `D ←`

---

## Tab 2 — Fan chart

Portfolio value over time (real, today's money). Full-width Recharts ComposedChart.

```
 £1.2m ┤                                    ░░░░░░░░░░░░░
 £1.0m ┤                               ░░░░░▒▒▒▒▒▒▒▒▒▒▒░░░
 £800k ┤                          ░░░░░▒▒▒▒▒────────────▒▒░
 £600k ┤                    ░░░░░░▒▒▒▒▒▒│               ▒░
 £400k ┤              ░░░░░░░░▒▒▒▒▒▒    │                ░
 £200k ┤        ░░░░░░░░▒▒▒▒▒▒          │
    £0 ┼────────────────────────────────┼────────────────────
       52  55  58  61  64  67  70  73  76  79  82  85  88  90+

        ░ p10–p90   ▒ p25–p75   ─ p50   │ retirement
```

- x-axis: age (reference person)
- y-axis: abbreviated £ (£100k, £500k, £1m)
- Grey shaded area behind accumulation years (left of retirement line) vs white for drawdown
- Hover tooltip: age, p10/p25/p50/p75/p90 values

---

## Tab 3 — Spending sources

Stacked bar chart, drawdown years only. Shows how each drawdown year's spending is met.

```
 £5,000 ┤                                     ╔══════════════╗
 £4,500 ┤                         ╔═══════════╬──────────────╢
 £4,000 ┤────────────────────────────────────────────────────── ← target
 £3,500 ┤    ╔═══════════════════╬════════════╬              ╢
 £3,000 ┤    ║ Portfolio draw    ║            ║              ║
 £2,500 ┤    ╠═══════════════════╣            ╠══════════════╣
 £2,000 ┤    ║ State pension     ║            ║              ║
 £1,500 ┤    ╠═══════════════════╣            ╠══════════════╣
 £1,000 ┤    ║ Income streams    ║            ║              ║
   £500 ┤    ╚═══════════════════╩════════════╩══════════════╝
    £0  ┼────┴────────────────────────────────────────────────
        62  65  68  71  74  77  80  83  86  89 (age)

        ■ Portfolio draw   ■ State pension   ■ Income streams   — Target
```

- Monthly £ (all values divided by 12)
- Spending target as a line overlay
- Capital events shown as dashed vertical reference lines with label below
- x-axis: household retirement year offset or age

---

## States

| State | Behaviour |
|-------|-----------|
| No state (direct navigation) | Show "No scenario loaded — go back and run a scenario first" with link to `/` |
| Normal | All three tabs render from location.state |
