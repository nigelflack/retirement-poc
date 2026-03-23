# Working guide

This is a practitioner's guide to working in this development structure. Where `process.md` defines the rules and artefacts, this document explains the reasoning behind them and gives guidance on the judgment calls.

---

## Why this structure exists

Without a defined working model, AI-assisted development tends to fail in predictable ways:

- business logic leaks into UI layers
- UI gets built before workflows are understood
- generated code outruns product clarity
- documentation gets skipped and sessions lose continuity
- past decisions get relitigated because there's no record of why they were made

These failure modes are cheap to create with AI — plausible-looking output arrives quickly regardless of whether the underlying thinking was sound. The structure exists to keep the thinking ahead of the code.

The central discipline is simple: **document intent before implementing it**.

---

## How to think about the document set

Each document has a distinct job. Using the wrong one for the wrong purpose causes confusion:

- `spec.md` — what the system currently does. The living product description: domain model, rules, features. Updated after each iteration closes to reflect the new reality.
- `docs/iterations/` — one file per iteration. Written before an iteration starts (the plan), and kept as the permanent record after it closes. This is where you define the next increment of work.
- `architecture.md` — how the system is structured and what constraints apply. Not where you are in the work.
- `decisions.md` — why non-obvious choices were made. Write here when you made a trade-off that a future reader (or AI session) would otherwise question.
- `ai-handover.md` — current version, what is in progress, known issues, how to run. The session start document. Narrow in scope by design — for full system understanding read `spec.md`.
- `backlog.md` — candidate items not yet in an iteration. The input to iteration planning.
- `flow.md` / `docs/ui/` — what the UI looks like and how users move through it. Update this *before* writing UI code, not after.

**The test for `decisions.md`:** if you can imagine a future AI session undoing a decision because there's no record of why it was made, write it down. The two-stage → single-pass API change is a good example.

---

## ASCII wireframes in practice

ASCII wireframes are the most underestimated tool in this approach. They are:

- fast to create and edit (minutes, not hours)
- text-based, so AI can read and update them
- good at communicating structure without getting distracted by visuals
- diffable — you can see exactly what changed

**Before real UI exists:** the wireframe *is* the UI design. It defines what's on screen, in what order, and what the user can do.

**After real UI exists:** wireframes shift to being planning artefacts. Use them for new screens, significantly changed screens, or flow changes before writing any code. The wireframe defines intent; the code provides the platform-specific execution.

### When to split wireframes into separate files

A single `flow.md` is fine early on. It breaks down when:
- screens appear in multiple flows
- flows branch significantly
- individual screens become complex enough to need their own notes

When that happens, split into:
```
docs/ui/
  flows/   ← one file per user journey
  screens/ ← one file per screen (layout + interactions + states)
```

A screen file is useful when a screen has multiple states (loading, empty, error, populated) or when it's shared across flows.

---

## When to move from CLI to real UI

The CLI validates that the system works. Real UI validates that the experience works. These are different questions.

**Stay with CLI when the main uncertainty is:**
- does the domain logic behave correctly?
- is the API contract right?
- does the workflow make sense end-to-end?

**Move to real UI when the main uncertainty becomes:**
- is this navigable?
- is the information hierarchy clear?
- does a real user understand what to do?

Moving to UI too early means building a polished interface on an unstable foundation. Moving too late means missing UX problems that only become visible with real rendering.

---

## How much rigour to apply

Not every project stage needs the same level of process. A rough guide:

| Stage | What matters most |
|-------|------------------|
| Prototype | Speed, architecture shape, workflow validation. Docs are lightweight. Manual testing is fine. |
| MVP | Clearer iteration boundaries. More complete UI states (empty, error, loading). Stronger API contracts. |
| Pre-release | Error handling, test coverage, accessibility, non-functional requirements. |
| Production | Operational resilience, security, deployment, observability. |

Over-engineering at the prototype stage is as harmful as under-engineering at the production stage. The spec and architecture docs should reflect where you actually are.

---

## Using AI effectively in this structure

AI is most useful when given a bounded task with clear context — not when asked to improvise across a whole system.

**Good patterns:**
- "Based on the current spec.md, implement section X"
- "Update ai-handover.md to reflect what was just built"
- "Review whether the implementation of route Y matches the architecture constraints in architecture.md"
- "I want to add feature Z — is it in the current spec? Where should it go?"

**Patterns to avoid:**
- Asking AI to build something without pointing it at the relevant spec
- Letting AI make architectural decisions without updating decisions.md
- Using AI to write extensive code before wireframes exist for new screens

**Session continuity:** at the start of a new session, orient the AI with `ai-handover.md` before asking it to do anything. A well-maintained handover document makes re-orientation take seconds rather than minutes.

### Using `.prompt.md` files for repeatable tasks

Prompt files (stored in `docs/prompts/`) let you invoke a structured task with a single reference. Useful examples:

- **Spec review** — "check whether the implementation matches the current spec version"
- **Handover update** — "read the codebase and refresh ai-handover.md"
- **Architecture audit** — "check whether any code violates the layer constraints in architecture.md"

These turn process discipline into a low-friction habit.

---

## Common mistakes

**Skipping the spec update** — the most common shortcut, and the one that causes the most long-term damage. Even a brief bullet point in spec.md before implementing is enough.

**Forgetting to move deferred items to the backlog** — when closing an iteration, anything not shipped should go into `docs/backlog.md`, not just be noted in the iteration file and forgotten.

**Letting ai-handover.md go stale** — if it's out of date, it becomes noise rather than signal. Update it immediately after any meaningful change, not at the end of a session.

**Wireframing after building** — drawing the wireframe after the code exists defeats the purpose. The wireframe should constrain the code, not describe it.

**Using decisions.md only for big decisions** — small, non-obvious choices are worth recording too. "Why did we use cumulative inflation rather than per-year?" is exactly the kind of thing that gets re-litigated in AI sessions without a record.

**Building real UI before the CLI works** — the CLI surfaces domain logic bugs cheaply. Fixing them through a UI layer is significantly more expensive.
