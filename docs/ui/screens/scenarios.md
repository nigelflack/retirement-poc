# Screen: Scenario Loader (`/scenarios`)

Used in flow: retirement-planning.md

---

## Purpose

Entry point for choosing and starting scenarios.

---

## Actions

- `Load` - open selected scenario in the explorer route.
- `Reload` - refresh scenario list/content visible in loader.
- `Create new` - start from a default scenario template.
- `Clone` - duplicate a selected scenario into runtime state for editing.

In v0.19, `Create new` and `Clone` are runtime actions only (no persistent storage redesign).

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Retirement Calculator - Scenarios                                    │
│                                                                      │
│ [Reload]  [Create new]                                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ nigel-mimi-new-house    2 people      [Load] [Clone]          │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ nigel-mimi-same-house   2 people      [Load] [Clone]          │   │
│  ├────────────────────────────────────────────────────────────────┤   │
│  │ ...                                                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## States

| State | Behaviour |
|---|---|
| Normal | List scenarios with action buttons |
| No scenarios found | Show empty state and `Create new` action |
