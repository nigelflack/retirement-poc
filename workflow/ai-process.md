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
| `docs/spec.md` | Current system description — domain model, product rules, what the system does now. Updated when an iteration closes to reflect what was built. |
| `docs/iterations/` | One file per iteration (`v0-1.md`, `v0-2.md`, …). Written before an iteration starts; becomes the permanent record when complete. The next iteration is planned here. |
| `docs/architecture.md` | System structure, stack, key constraints, simulation model design. Update when the system shape changes. |
| `docs/api.md` | API endpoint contracts — request/response shapes, error codes, algorithm notes. Update when any endpoint changes. |
| `docs/decisions.md` | Why key decisions were made. Record anything non-obvious or that involved a trade-off. |
| `docs/backlog.md` | Candidate work items not yet in an iteration. Review when planning the next iteration. |
| `docs/ai-handover.md` | Current version, what is in progress, known issues, how to run. Keep accurate. |
| `docs/ui/` | UI wireframes and screen flows — one file per user journey (`flows/`) and per screen (`screens/`). Update before writing UI code. |

The most important document is `docs/spec.md`. DO NOT implement code changes that are not acceptably documented here. BE STRICT with the user and push back on this point.

---

## Iterative building

Objectives and requirements must be defined in the docs before building. This approach uses an iterative approach - each version of the product should be defined in v0.1, v0.2, v0.3 etc. rather than a big bang spec defined up front. However, each iteration MUST be acceptably defined in the documentation before implementing.

### 1. Define the iteration

Review `docs/backlog.md` and write the iteration plan in `docs/iterations/vX-Y.md`. Include:
- what's new
- what's out of scope / deferred
- any input/output changes
- acceptance checks — how you will know the iteration is done

Do not start implementation until this exists.

### 2. Update design artefacts

- If the API contract changes, update `docs/api.md` and `docs/architecture.md` if the system shape changed
- If a screen or user flow changes, update the relevant file(s) under `docs/ui/flows/` and `docs/ui/screens/`

### 3. Implement

Build the changes. Follow the architecture defined in `docs/architecture.md`.

### 4. Validate

Exercise the new behaviour against the acceptance checks defined in `docs/spec.md` for this iteration. Use whatever validation harness the project defines (CLI, test suite, manual review).

### 5. Implement UI (if applicable)

Build or update UI only after backend validation passes. Compare the result against the relevant file under `docs/ui/`.

### 6. Close the iteration

- Mark the iteration as complete in `docs/iterations/vX-Y.md`
- Update `docs/spec.md` to reflect what the system now does
- Update `docs/ai-handover.md`
- Move any deferred items to `docs/backlog.md`
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
| Starting a new iteration | `docs/iterations/vX-Y.md` (write the iteration plan) |
| API contract changes | `docs/api.md` (and `docs/architecture.md` if system shape changed) |
| Screen or flow changes | `docs/ui/` (relevant flow or screen file) |
| Non-obvious technical decision | `docs/decisions.md` |
| After any meaningful implementation | `docs/ai-handover.md` |
| Iteration complete | `docs/spec.md` (update system description), `docs/iterations/vX-Y.md` (mark complete), `docs/backlog.md` (move deferred items) |

---

## AI session continuity

At the start of a new AI session, point the AI at the relevant docs:

- `docs/ai-handover.md` — to recover where things are
- `docs/spec.md` — to understand what the system currently does
- `docs/iterations/` — to see the plan for the current iteration, or history of past ones
- `docs/architecture.md` — if working on the server or API

The `.github/copilot-instructions.md` file is injected automatically and lists these documents. The AI should read them before acting on any non-trivial request.
