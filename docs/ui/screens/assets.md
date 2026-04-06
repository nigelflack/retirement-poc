# Screen: Your Assets (Step 2)

The second screen in the setup wizard. Collects the financial inputs the simulation needs per person (accounts, state pension, contribution schedule, income streams) and household-level fields (scenario label, capital events).

Person inputs are organised in tabs (one per person) plus a **Household** tab. Each person tab has collapsible sections. This screen does not run a simulation — all values are carried forward to the scenario screen.

---

## Used in

- [flows/retirement-planning.md](../flows/retirement-planning.md) — Step 2

---

## Interaction rules

- Person tabs are shown when two people exist; hidden (no tab bar) for a single person.
- The **Household** tab is always shown.
- Switching tabs saves the current tab's data in local state.
- "Continue" is disabled until at least one account with a non-zero current value exists across all people.

**Accounts section (per person):**
- One blank account row is pre-populated on arrival if no existing accounts.
- "+ Add account" appends a blank row.
- Each row has a ✕ remove control; hidden when only one row remains.

**State pension section (per person):**
- Fields optional; default to £0 / age 67 if blank.

**Contributions section (per person, collapsible):**
- Collapsed by default; expands on click.
- Full list editor: any number of rows, each with `From (yrs from today)`, `Monthly (£)`, and optional `Label`.
- "+ Add step" appends a blank row; ✕ removes a row.
- When the list is empty the server falls back to summing per-account monthly contributions.
- Rows are sorted ascending by `fromYearsFromToday` in the payload.

**Income streams section (per person, collapsible):**
- Collapsed by default.
- Full list editor: rows with `From (yrs)`, `To (yrs, optional)`, `Monthly (£)`, `Label (optional)`.
- "+ Add stream" appends a blank row; ✕ removes.

**Scenario label (Household tab):**
- Single text input. Saved to top-level `label` in JSON.

**Capital events (Household tab, collapsible):**
- Full list editor: rows with `Years from today`, `Amount (£, signed)`, `Label (optional)`.
- Positive amount = inflow; negative = outflow (shown with a +/− hint).
- "+ Add event" appends; ✕ removes.

---

## Wireframe

Person tab (Bob shown):

```
┌─────────────────────────────────────────────────────────────────────┐
│  Your details                                                       │
│                                                                     │
│  ┌────────┐  ┌─────────┐  ┌───────────┐                            │
│  │  Bob   │  │  Alice  │  │ Household │                            │
│  └────────┘  └─────────┘  └───────────┘                            │
│                                                                     │
│  ─── Accounts ──────────────────────────────────────────────────   │
│  Name                Type      Value (£)    Monthly contrib (£)    │
│  ┌──────────────┐  ┌────────┐  ┌─────────┐  ┌──────────────────┐  │
│  │ Workplace... │  │Pension │  │ 250,000 │  │              500 │✕ │
│  └──────────────┘  └────────┘  └─────────┘  └──────────────────┘  │
│  + Add account                                                      │
│                                                                     │
│  ─── State pension ─────────────────────────────────────────────   │
│  Annual amount (£)         From age                                 │
│  ┌──────────┐              ┌────────┐                               │
│  │   11,500 │              │     67 │                               │
│  └──────────┘              └────────┘                               │
│                                                                     │
│  ▼ Contributions ───────────────────────────────────────────────   │
│  From (yrs)  Monthly (£)   Label (optional)                        │
│  ┌─────────┐ ┌──────────┐  ┌─────────────────────────────────┐    │
│  │       0 │ │    2,000 │  │ Current rate                    │ ✕  │
│  └─────────┘ └──────────┘  └─────────────────────────────────┘    │
│  ┌─────────┐ ┌──────────┐  ┌─────────────────────────────────┐    │
│  │       8 │ │    1,000 │  │ Wind down                       │ ✕  │
│  └─────────┘ └──────────┘  └─────────────────────────────────┘    │
│  + Add step                                                         │
│                                                                     │
│  ▼ Income streams ──────────────────────────────────────────────   │
│  From   To (opt)  Monthly (£)  Label                               │
│  ┌────┐  ┌──────┐ ┌─────────┐  ┌───────────────────────────┐      │
│  │  0 │  │   10 │ │     800 │  │ BTL rental                │ ✕    │
│  └────┘  └──────┘ └─────────┘  └───────────────────────────┘      │
│  + Add income stream                                                │
│                                                                     │
│  [  Continue  ]                               [  ← Back  ]         │
└─────────────────────────────────────────────────────────────────────┘
```

Household tab:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Your details                                                       │
│                                                                     │
│  ┌────────┐  ┌─────────┐  ┌───────────┐                            │
│  │  Bob   │  │  Alice  │  │ Household │                            │
│  └────────┘  └─────────┘  └───────────┘                            │
│                                                                     │
│  ─── Scenario label ────────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Bob and Alice — base case                                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ▼ Capital events ──────────────────────────────────────────────   │
│  Years from today   Amount (£, +/−)   Label (optional)             │
│  ┌────────────────┐ ┌──────────────┐  ┌──────────────────────┐     │
│  │              3 │ │     −100,000 │  │ Boat purchase        │ ✕   │
│  └────────────────┘ └──────────────┘  └──────────────────────┘     │
│  ┌────────────────┐ ┌──────────────┐  ┌──────────────────────┐     │
│  │             15 │ │     +100,000 │  │ Inheritance          │ ✕   │
│  └────────────────┘ └──────────────┘  └──────────────────────┘     │
│  + Add event                                                        │
│                                                                     │
│  [  Continue  ]                               [  ← Back  ]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fields

**Per account:**
| Field | Type | Validation |
|-------|------|------------|
| Account name | Text | Required |
| Type | Select (Pension / ISA) | Required |
| Current value (£) | Integer ≥ 0 | Required |
| Monthly contribution (£) | Integer ≥ 0 | Optional; fallback when no contribution schedule |

**State pension (per person):**
| Field | Type | Validation |
|-------|------|------------|
| Annual amount (£) | Integer ≥ 0 | Optional, defaults to 0 |
| From age | Integer | Optional, defaults to 67 |

**Contribution schedule entry (per person, any number):**
| Field | Type | Validation |
|-------|------|------------|
| From (years from today) | Integer ≥ 0 | Required |
| Monthly amount (£) | Integer ≥ 0 | Required |
| Label | Text | Optional |

**Income stream entry (per person, any number):**
| Field | Type | Validation |
|-------|------|------------|
| From (years from today) | Integer ≥ 0 | Required |
| To (years from today) | Integer > from | Optional; absent = run to end |
| Monthly amount (£) | Integer > 0 | Required |
| Label | Text | Optional |

**Scenario label (household):**
| Field | Type | Validation |
|-------|------|------------|
| Label | Text | Optional |

**Capital event entry (household, any number):**
| Field | Type | Validation |
|-------|------|------------|
| Years from today | Integer ≥ 0 | Required |
| Amount (£) | Signed integer, ≠ 0 | Required |
| Label | Text | Optional |

---

## Navigation

- "Continue" → Step 3 (scenario screen)
- "Back" → Step 1
