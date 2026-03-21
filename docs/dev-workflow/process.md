# Development workflow

This document describes how work is structured in this project and what to do at each stage. Follow this process for any non-trivial change.

---

## Document-first principle

**Understand and document before implementing.**

The documents in `docs/` are the source of truth — not the code, and not the AI's implicit understanding of the project. Before writing any code, the relevant doc should describe what you're building and why.

This is not bureaucracy. It is what makes AI sessions coherent across time and what prevents scope drift.

---

## Authoritative documents

| File | What it is for |
|------|---------------|
| `docs/spec.md` | What is in scope for each version. Features must be here before they are built. |
| `docs/architecture.md` | System structure, API contracts, stack, key constraints. Update when the system shape changes. |
| `docs/decisions.md` | Why key decisions were made. Record anything non-obvious or that involved a trade-off. |
| `docs/current-state.md` | What is working right now, what is next, known issues. Keep this accurate. |
| `docs/flow.md` | UI wireframes and screen flows. Update before writing UI code. |

---

## Iteration loop

Each version (v0.n) follows this sequence:

### 1. Define the iteration

Write the next version section in `docs/spec.md`. Include:
- what's new
- what's out of scope / deferred
- any input/output changes
- CLI and UI changes if relevant

Do not start implementation until this exists.

### 2. Update design artefacts

- If the API contract changes, update `docs/architecture.md`
- If a screen or user flow changes, update `docs/flow.md` (or the relevant file under `docs/ui/`)

### 3. Implement

Build the changes. Follow the layer separation defined in `docs/architecture.md` for this project.

### 4. Validate

Exercise the new behaviour against the acceptance checks in the spec. Use whatever validation harness the project defines (CLI, test suite, manual review).

### 5. Implement UI (if applicable)

Build or update UI only after backend validation passes. Compare the result against `docs/flow.md`.

### 6. Close the iteration

- Mark items complete or deferred in `docs/spec.md`
- Update `docs/current-state.md`
- Record any material technical decisions in `docs/decisions.md`

---

## Adding a new feature mid-iteration

If something new comes up that isn't in the current spec:

1. Decide: is it in scope for this iteration, or deferred to the next?
2. If in scope: add it to `docs/spec.md` before implementing
3. If deferred: note it in `docs/spec.md` under "known limitations" for the current version

Do not silently implement things that aren't in the spec.

---

## When to update each document

| Event | Documents to update |
|-------|-------------------|
| Starting a new iteration | `docs/spec.md` |
| API contract changes | `docs/architecture.md` |
| Screen or flow changes | `docs/flow.md` |
| Non-obvious technical decision | `docs/decisions.md` |
| After any meaningful implementation | `docs/current-state.md` |
| Feature complete or deferred | `docs/spec.md` |

---

## AI session continuity

At the start of a new AI session, point the AI at the relevant docs:

- `docs/current-state.md` — to recover where things are
- `docs/spec.md` — to understand what the next iteration contains
- `docs/architecture.md` — if working on the server or API

The `.github/copilot-instructions.md` file is injected automatically and lists these documents. The AI should read them before acting on any non-trivial request.
