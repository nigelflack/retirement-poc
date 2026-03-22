# Product development workflow

This document describes how the AI-assisted digital product development methodology is structured. Follow this process for all work in this project.

---

## Document-first principle

**Understand and document before implementing.**

The documents in `docs/` are the source of truth — not the code, and not the AI's implicit understanding of the project. Before writing any code, the relevant doc should describe what you're building and why.

---

## Authoritative documents

The following specific documents must be maintained and should always be used as reference documentations for all work:

| File | What it is for |
|------|---------------|
| `docs/spec.md` | What is in scope for each version. Features must be here before they are built. |
| `docs/architecture.md` | System structure, API contracts, stack, key constraints. Update when the system shape changes. |
| `docs/decisions.md` | Why key decisions were made. Record anything non-obvious or that involved a trade-off. |
| `docs/current-state.md` | What is working right now, what is next, known issues. Keep this accurate. |
| `docs/flow.md` | UI wireframes and screen flows. Update before writing UI code. |

The most important document is `docs/spec.md`. DO NOT implement code changes that are not acceptably documented here. BE STRICT with the user and push back on this point.

---

## Iterative building

Objectives and requirements must be defined in the docs before building. This approach uses an iterative approach - each version of the product should be defined in v0.1, v0.2, v0.3 etc. rather than a big bang spec defined up front. However, each iteration MUST be acceptably defined in the documentation before implementing.

### 1. Define the iteration

Write the next version section in `docs/spec.md`. Include:
- what's new
- what's out of scope / deferred
- any input/output changes
- acceptance checks — how you will know the iteration is done

Do not start implementation until this exists.

### 2. Update design artefacts

- If the API contract changes, update `docs/architecture.md`
- If a screen or user flow changes, update `docs/flow.md` and other relevant file(s) under `docs/ui/`)

### 3. Implement

Build the changes. Follow the architecture defined in `docs/architecture.md`.

### 4. Validate

Exercise the new behaviour against the acceptance checks defined in `docs/spec.md` for this iteration. Use whatever validation harness the project defines (CLI, test suite, manual review).

### 5. Implement UI (if applicable)

Build or update UI only after backend validation passes. Compare the result against `docs/flow.md` (or the relevant file under `docs/ui/`).

### 6. Close the iteration

- Mark items complete or deferred in `docs/spec.md`
- Update `docs/current-state.md`
- Record any material technical decisions in `docs/decisions.md`

---

## Adding a new feature mid-iteration

If something new comes up that isn't in the current spec, or if a user requests to enhance or refine a just-implemented feature:

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
