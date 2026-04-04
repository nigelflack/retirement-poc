# Screen: Person Details

The first screen in the setup wizard. Collects just enough to identify who the plan is for — name and age are used to label controls and bound the retirement age spinners on the scenario screen. The partner panel is optional and self-contained; revealing it does not require a separate step.

When navigating back from Assets or from the scenario screen, the form pre-populates from the existing `people` state — names, ages, and the partner toggle.

---

## Used in

- [flows/retirement-planning.md](../flows/retirement-planning.md) — Step 1

---

## Interaction rules

- "Continue" is disabled until name is non-empty and age is a valid integer between 18 and 80.
- If the partner toggle is on, "Continue" is also disabled until the partner's name and age are valid.
- Toggling the partner panel off clears the partner fields and removes any validation errors, but does not destroy partner account data until "Continue" is pressed.
- On mount, the form is populated from the existing `people` state (names, ages, partner toggle) if present.
- "Load from file" opens a hidden `<input type="file" accept=".json">`. On successful parse of a valid scenario JSON, `people` state is replaced and the app jumps to step 3. If the file is invalid, an inline error message is shown.
- "View example scenarios →" links to `/scenarios` via React Router.
- No simulation is triggered on this screen.

---

## Wireframe — toggle off (no partner)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Let's get started                                                  │
│                                                                     │
│  Your name                                                          │
│  ┌───────────────────────────────┐                                  │
│  │ Bob                           │                                  │
│  └───────────────────────────────┘                                  │
│                                                                     │
│  Your age today                                                     │
│  ┌────────┐                                                         │
│  │  50    │                                                         │
│  └────────┘                                                         │
│                                                                     │
│  ☐  Include my partner                                              │
│                                                                     │
│  [  Continue  ]                                                     │
│                                                                     │
│  [  Load from file  ]                                               │
│                                                                     │
│  View example scenarios →                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Wireframe — toggle on (partner panel revealed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Let's get started                                                  │
│                                                                     │
│  Your name                                                          │
│  ┌───────────────────────────────┐                                  │
│  │ Bob                           │                                  │
│  └───────────────────────────────┘                                  │
│                                                                     │
│  Your age today                                                     │
│  ┌────────┐                                                         │
│  │  50    │                                                         │
│  └────────┘                                                         │
│                                                                     │
│  ☑  Include my partner                                              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Partner's name                                               │  │
│  │  ┌───────────────────────────────┐                            │  │
│  │  │ Alice                         │                            │  │
│  │  └───────────────────────────────┘                            │  │
│  │                                                               │  │
│  │  Their age today                                              │  │
│  │  ┌────────┐                                                   │  │
│  │  │  45    │                                                   │  │
│  │  └────────┘                                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [  Continue  ]                                                     │
│                                                                     │
│  [  Load from file  ]                                               │
│                                                                     │
│  View example scenarios →                                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Wireframe — load error state

```
┌─────────────────────────────────────────────────────────────────────┐
│  Let's get started                                                  │
│                                                                     │
│  [... fields ...]                                                   │
│                                                                     │
│  [  Load from file  ]                                               │
│                                                                     │
│  ⚠  Could not load file — invalid format.                           │
│                                                                     │
│  View example scenarios →                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Fields

| Field | Type | Validation |
|-------|------|------------|
| Your name | Text | Required, non-empty |
| Your age | Integer | Required, 18–80 |
| Include my partner | Toggle | Optional, default off |
| Partner's name | Text | Required when toggle is on |
| Partner's age | Integer | Required when toggle is on, 18–80 |

Partner fields are only validated when the toggle is on.

---

## Navigation

- "Continue" → Step 2 (Your assets)
- "Load from file" → Step 3 (on success); inline error (on failure)
- "View example scenarios →" → `/scenarios`
