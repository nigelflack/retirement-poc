# Screen: Your Assets (Step 2)

The second screen in the setup wizard. Collects the financial inputs the simulation needs: investment accounts and state pension entitlement. If a partner was added in Step 1, accounts are entered per person via tabs — each person must have at least one account before the wizard can proceed.

This screen does not run a simulation. All values entered here are carried forward to the scenario screen unchanged.

---

## Used in

- [flows/retirement-planning.md](../flows/retirement-planning.md) — Step 2

---

## Interaction rules

- One blank account row is pre-populated on arrival.
- "+ Add another account" appends a new blank row immediately below the existing rows; no page navigation.
- Each account row has a remove control (✕) that deletes that row. The remove control is hidden when only one row remains — at least one account is always required.
- "Continue" is disabled until at least one account with a non-zero current value exists across all people.
- State pension fields are optional; if left empty they default to £0 / age 67.
- Switching person tabs auto-saves the current tab's data.
- When there is no partner (toggle off in Step 1), no person tabs are shown — the screen shows a single account list with no tab bar.

---

## Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Your savings and investments                             [Bob]     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Account name            Type         Value        Monthly    │  │
│  │  ┌────────────────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐  │  │
│  │  │ Workplace pension  │  │ Pension │  │ 250,000 │  │   500 │  │  │
│  │  └────────────────────┘  └─────────┘  └─────────┘  └───────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  + Add another account                                              │
│                                                                     │
│  State pension                                                      │
│  Annual amount (today's £)     From age                             │
│  ┌────────┐                    ┌────────┐                           │
│  │ 11,500 │                    │   67   │                           │
│  └────────┘                    └────────┘                           │
│                                                                     │
│  [  Continue  ]                          [  ← Back  ]               │
└─────────────────────────────────────────────────────────────────────┘
```

If a partner was added, person tabs appear below the heading:

```
┌────────┐  ┌────────┐
│  Bob   │  │ Alice  │
└────────┘  └────────┘
```

Switching tabs saves the current person's data and loads the partner's.

---

## Fields

**Per account:**
| Field | Type | Validation |
|-------|------|------------|
| Account name | Text | Required |
| Type | Select (Pension / ISA) | Required |
| Current value (£) | Integer ≥ 0 | Required |
| Monthly contribution (£) | Integer ≥ 0 | Required |

**State pension (per person):**
| Field | Type | Validation |
|-------|------|------------|
| Annual amount (£) | Integer ≥ 0 | Optional, defaults to 0 |
| From age | Integer | Optional, defaults to 67 |

---

## Navigation

- "Continue" → Step 3 (scenario screen)
- "Back" → Step 1
- "+ Add another account" — appends a blank account row; no page navigation
