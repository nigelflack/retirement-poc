# Screen: Retirement Scenario (`/scenario`)

Primary runtime screen after a scenario is loaded.

Used in flow: retirement-planning.md

---

## Purpose

Interactive scenario explorer. User adjusts retirement ages and spending target; simulation reruns and updates all panels.

---

## Entry condition

Requires a loaded scenario in route state. If no scenario is present, runtime redirects to `/scenarios`.

---

## Wireframe (current + v0.19 nav fix)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Retirement Scenario                                     Back to scenarios │
│ Scenario label                                                       │
│                                                                      │
│ Your Retirement Goal                                                 │
│  - retirement age controls per person                                │
│  - monthly spending/income target control                            │
│  - retire together toggle                                             │
│                                                                      │
│ Your savings are projected to grow to ...                            │
│ Solvency bar                                                         │
│                                                                      │
│ View detailed breakdown ->                                           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Other options you could consider                                    │
│  panel 2 recommendation slots                                        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Some options that might work for you                                 │
│  panel 3 scenario cards                                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Interaction notes

- Any scenario control change reruns `POST /simulate` (debounced).
- Panel 3 card click applies that card's ages and monthly income into panel 1 controls.
- `View detailed breakdown ->` navigates to `/detail` with result state payload.
- v0.19: explicit `Back to scenarios` link navigates to `/scenarios`.
- v0.21: if scenario includes `openingText`, render it as a short narrative block near the header/goal section.

---

## States

| State | Behaviour |
|---|---|
| No scenario loaded | Redirect to `/scenarios` |
| Loading simulation | Keep controls visible; show loading placeholders in panels |
| Run error | Show inline error message and retain previous successful view |
