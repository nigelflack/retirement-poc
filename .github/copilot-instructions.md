# Copilot instructions — retirement model

## Authoritative documents
- **`docs/spec.md`** — what is in scope for each version; source of truth for features
- **`docs/architecture.md`** — system structure, API contracts, stack details, constraints
- **`docs/decisions.md`** — why key decisions were made
- **`docs/current-state.md`** — what is working, what is next
- **`docs/flow.md`** — UI wireframes and screen flows

Read the relevant document before implementing or answering questions about architecture, scope, or past decisions.

## Development rules

### Before implementing
- Do not implement undocumented scope. If a feature is not described in `docs/spec.md`, ask before building it.
- For any meaningful change to a screen or user flow, update `docs/flow.md` (or the relevant file under `docs/ui/`) before writing UI code.

### While implementing
- Do not place business logic in UI layers. All simulation and domain logic belongs in the server.
- All server routes must validate inputs before passing to simulation engines.
- Do not return raw simulation paths in API responses. Return computed percentile arrays only.
- The CLI is the validation client for backend work. Validate via CLI before building any web UI.
- Python 3.9 is in use — do not use `X | Y` union type syntax; use `Optional[X]` or omit type annotations.

### After implementing
- Update `docs/current-state.md` to reflect what changed.
- If a material technical decision was made, record it in `docs/decisions.md`.
- If the spec changed, update `docs/spec.md` to mark items complete or deferred.
