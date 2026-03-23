# AI-Assisted Digital Product Development  
## A Practical Operating Model for Fast, Structured, Architecture-Led Delivery

### Draft for internal discussion

## Executive summary

This paper describes a working model for AI-assisted digital product development, developed and refined by the author through experience building a project over many iterations. It is an illustration of techniques that the author believes may be more widely applicable, shared here as a starting point for discussion rather than a definitive prescription.

AI-assisted coding is often framed as a loose, improvisational activity. In the author's experience, it becomes far more effective when treated as a disciplined product development method rather than an ad hoc code generation tool.

This paper outlines a practical operating model for **AI-assisted digital product development**. The approach is built around a small number of durable principles:

- separate backend and UI concerns from the start
- work in short, explicit iterations
- use text-first artefacts that AI can reliably read and update
- validate workflows and screen design before investing in polished UI
- maintain lightweight but mandatory documentation
- use AI not only to generate code, but to enforce process discipline

The model is especially suited to prototypes, proofs of concept, internal tools, and emerging product ideas, but it can also scale into more mature product delivery if governance and quality thresholds are increased over time.

The central claim is simple: **AI works best when placed inside a clear development operating model**. The productivity gains do not come primarily from asking AI to “write the app.” They come from creating a structured loop in which AI helps define iterations, maintain artefacts, implement features, and validate alignment between intent and execution.

## 1. Introduction

Recent discussion of AI-assisted coding has often focused on raw speed: faster UI generation, faster scaffolding, faster prototyping. While these gains are real, they can be misleading if they encourage a collapse of design, architecture, and implementation discipline.

A more useful framing is to see AI as an accelerator for the full digital product development cycle. Under this framing, AI does not replace product thinking or engineering judgment. Instead, it supports a structured lifecycle involving:

- iteration planning
- architecture shaping
- interface design
- code implementation
- documentation maintenance
- validation of consistency across artefacts

This is not “AI coding” in the narrow sense. It is **AI-assisted digital product development**.

The approach described in this paper has a particular bias: it assumes that speed matters, but that speed without structural clarity is self-defeating. As a result, the model emphasizes text-first artefacts, clear separation of concerns, lightweight governance, and explicit development workflow.

## 2. The core problem with unstructured AI coding

Working without a defined operating model, the author observed the following failure modes emerge repeatedly:

- business logic leaks into presentation layers
- architectural boundaries blur
- UI is built before workflows are understood
- generated code outruns product clarity
- documentation is skipped or immediately becomes stale
- multiple sessions produce inconsistent design and implementation choices
- future work becomes harder because the rationale for prior decisions is lost

These failure modes are not unique to AI, but AI amplifies them by making it cheap to create plausible-looking output quickly. The result is often a prototype that appears productive in the short term, but becomes difficult to reason about, extend, or hand over.

These observations form the basis for the model described in this paper.

## 3. Core design principles

A practical AI-assisted product development approach should be grounded in a small set of principles.

### 3.1 Separate UI from backend

Backend services, domain logic, and persistence should remain separate from client presentation layers. This helps prevent architectural drift and keeps the system adaptable across multiple interfaces.

A typical early structure may involve:

- backend: Node + Express
- early client / test harness: Python CLI
- later clients as needed: native iOS app, web UI in React or Angular

The exact stack may vary, but the principle remains the same: **presentation is not the home of business logic**.

This separation also implies a build sequence. In general: build and confirm backend and domain logic first, before investing in any UI layer. UI work done before backend behaviour is confirmed tends to get revisited — either because the API changes, or because assumptions about data turn out to be wrong.

### 3.2 Use iterative specification rather than large upfront design

Instead of attempting to specify the whole product in detail from the outset, define work in small versioned increments such as:

- v0.1
- v0.2
- v0.3

Each iteration should describe:
- goal
- in-scope items
- out-of-scope items
- acceptance checks

This gives AI a bounded planning horizon and reduces the risk of uncontrolled scope expansion.

### 3.3 Use text-first design artefacts

AI interacts more reliably with structured text than with images or ambiguous verbal descriptions. Text-first artefacts are therefore valuable not only for human clarity, but also for machine usability.

Useful artefacts include:
- the governing system description (`spec.md`) — always-current, updated when an iteration closes
- the active iteration plan (`docs/iterations/vX-Y.md`) — written before an iteration starts
- ASCII UI wireframes
- architecture notes
- decision logs
- session handover notes

### 3.4 Validate interaction flow before polished UI

Early UI design should focus on:
- screens
- information hierarchy
- user actions
- navigation
- loading, empty, and error states

Low-fidelity ASCII wireframes are particularly effective here. They are quick to create, easy to revise, and directly usable by AI. Their role is not visual polish but structural clarity.

### 3.5 Keep documentation lightweight but mandatory

The right goal is not comprehensive documentation. It is **minimum sufficient durable documentation**.

This provides continuity across sessions, helps prevent re-litigation of past decisions, and gives AI a stable source of project truth.

### 3.6 Use AI to enforce discipline, not just generate output

AI should not only write code. It should also be used to:
- validate whether documentation is ready
- check whether implementation still matches the current spec
- flag missing artefacts
- propose updates to architecture and decision logs
- identify scope drift

This is one of the highest-value uses of AI in a development workflow.

## 4. Recommended operating model

The recommended model is architecture-led, iteration-driven, and text-first.

### 4.1 Early system shape

A typical early product structure looks like this:

- one monorepo
- backend service
- CLI as lightweight client and test harness
- optional web client when UX becomes important
- optional mobile client when device-native experience is needed

The monorepo usually remains effective well into prototype, PoC, and early product stages because it reduces coordination friction and helps AI reason across the codebase more easily.

### 4.2 Iteration loop

A practical workflow for each iteration is:

1. define the next iteration in `docs/iterations/vX-Y.md`
2. update relevant UI wireframes if screens or flows change
3. update architecture or decisions if needed
4. validate documentation readiness
5. implement backend/domain changes
6. exercise flows via CLI
7. implement web/mobile UI if appropriate
8. update `docs/spec.md` with implementation details
9. update other authoritative documents and close the iteration

This loop is deliberately lightweight, but it imposes a clear order:
**understand and document first, then implement**.

Three techniques within this model deserve particular attention: the CLI as first client, ASCII wireframes, and documentation as operating memory. The following sections examine each in detail.

## 5. The role of the CLI as first client

A scripted command-line client deserves particular attention as a technique. It is not a necessary part of this model, but it has proven highly effective and is worth adopting deliberately when the conditions suit it.

It is the practical expression of a backend-first development sequence. Build backend logic first; use the CLI to confirm it behaves correctly; move to UI only once the foundation is stable. This keeps logic validation cheap and prevents UI investment from running ahead of proven behaviour.

The approach used in this project was a Python CLI client calling the backend API. The choice of Python is not critical — what matters is having a lightweight, scriptable client that exercises real backend behaviour without any UI investment.

### 5.1 Why CLI first

A CLI client is:
- fast to write — a basic interactive loop and HTTP call takes minutes
- cheap to change — no rendering logic, no state management, no visual regression
- directly exercisable — run a scenario, inspect the output, re-run immediately
- readable by AI — plain text output is easy for an AI to analyse and validate
- decoupled from design — lets you test workflows before any UX decisions are made

In the retirement planning project, the CLI allowed the Monte Carlo simulation, income target model, and solve endpoints to be fully validated — including edge cases and failure modes — before a single UI component was written.

### 5.2 What the CLI validates

CLI is the right tool when the main uncertainty is:
- does the backend logic behave correctly?
- is the API contract right?
- does the end-to-end workflow make sense?
- are the domain rules implemented correctly?

These are questions the CLI can answer cheaply. They are expensive to answer through a UI layer because UI bugs and logic bugs become hard to separate.

### 5.3 What the CLI cannot validate

CLI cannot answer:
- is this navigable?
- is the information hierarchy clear?
- does a real user understand what to do?
- does the visual layout communicate the right things?

These become the relevant questions once backend behaviour is confirmed. That is the signal to move to real UI.

### 5.4 CLI validation and automated testing

The CLI functions as a test harness in all but name: it exercises real backend behaviour, confirms API contracts, and surfaces logic errors before UI investment. At prototype and early product stages, this is often sufficient. The feedback loop is fast, the output is human-readable, and AI can review it directly. As a product matures, however, CLI validation is not a substitute for a formal test suite. Unit tests give regression protection that a manually-run CLI cannot. Integration tests confirm behaviour across failure paths and edge cases that are tedious to exercise interactively. The practical path is additive: start with CLI validation to confirm the design is right, then layer in automated tests as the implementation stabilises and the cost of regression rises.

## 6. The role of ASCII wireframes

ASCII wireframes deserve particular attention because they occupy an unusual but highly effective position in AI-assisted development.

### 6.1 Why ASCII works

ASCII wireframes are:

- low-friction
- text-based and diffable
- easy for AI to parse
- good at expressing structure without cosmetic distraction
- suitable for rapid iteration

They support thinking about:
- which screens exist
- what appears on each screen
- how users move between screens
- what actions and states matter

### 6.2 Scaling the wireframe approach

At very small scale, it is possible to document an entire user flow in one file. This breaks down quickly once screens are reused, flows branch, or state complexity increases.

A more scalable model is:

- one file per flow
- one file per screen

For example, in a retirement planning tool:

- `flows/retirement-planning.md` — the main wizard journey from inputs to scenario screen
- `screens/retirement-scenario.md` — the scenario screen: solvency bar, solve results, scenario cards

The flow file describes the journey. The screen file describes the screen contract, including the ASCII layout and interaction notes.

### 6.3 Role after real UI exists

ASCII wireframes should not be discarded once web or mobile UI exists. Instead, their role changes.

Before real UI exists, they may be the primary UI design artefact.

After real UI exists, they remain the preferred planning artefact for:
- new screens
- materially changed screens
- meaningful flow changes

In this mature role, they define intent while real UI code provides platform-specific execution.

## 7. Documentation as operating memory

One of the most important lessons in AI-assisted development is that documentation is not primarily for compliance. It is for continuity.

Without a lightweight documentation layer, both humans and AI lose track of:
- why key decisions were made
- which iteration is current
- which changes are intentional
- what remains in scope or deferred

### 7.1 Minimum durable document set

A useful baseline set is:

- `spec.md` — the current system description (domain model, rules, features); updated when an iteration closes
- `docs/iterations/` — one file per iteration; written before starting, kept as permanent record after closing
- `docs/backlog.md` — candidate items not yet in an iteration; input to iteration planning
- `ai-handover.md` — current version, known issues, how to run; the session start document
- `docs/ui/flows/` and `docs/ui/screens/` — flow and screen artefacts
- `architecture.md` — current system structure and boundaries
- `api.md` — API endpoint contracts; updated when any endpoint changes
- `decisions.md` — decision log and rationale

This is not burdensome, but it provides enough continuity to make repeated AI-assisted sessions much more coherent.

### 7.2 Documentation gates

Documentation becomes more effective when it is treated as a gate rather than a suggestion.

A pre-implementation gate might require confirmation that:
- the current iteration is documented
- scope and exclusions exist
- acceptance checks are stated
- relevant screens are wireframed
- architecture and decisions are updated where needed

A post-implementation gate might require:
- current-state update
- decision log update if new decisions were made
- architecture update if boundaries changed
- spec update to reflect completed or deferred work

This turns AI into a process enforcer, not just a generator.

## 8. AI governance through repository structure

It is not possible to guarantee that a general-purpose AI assistant will follow a preferred development method perfectly in every case. However, it is possible to make the preferred approach the dominant context.

The general mechanism is the same across tools: inject persistent, structured instructions into the AI's context so that the preferred working model is active on every request, without relying on the user to re-state it each session.

The specific mechanism varies by tool. The example below uses **VS Code + GitHub Copilot with Claude Sonnet**, which is the toolchain used to develop the model described in this paper. Other AI coding environments offer equivalent capabilities under different names.

### 8.1 VS Code + GitHub Copilot — specific mechanisms

VS Code Copilot provides structured mechanisms for injecting persistent instructions into AI sessions. These are not hints or suggestions — they become part of the model's context on every request where they apply.

#### `.github/copilot-instructions.md` — always-on workspace rules

Place a file at `.github/copilot-instructions.md` in the repository root. Its contents are injected automatically into every Copilot Chat request in that workspace, without any user action.

This is the right place for:
- development principles (e.g. no business logic in UI layers)
- documentation gates (e.g. "update spec.md before implementing a new feature")
- anti-patterns to avoid
- file naming and structure conventions
- rule precedence statements

Example content:

```
## Development rules

- Do not implement anything not defined in the current iteration plan. Push back if asked to skip this.
- Do not place business logic in UI components.
- Do not implement new UI capabilities without first documenting them as flows and ASCII wireframes.
- After each meaningful implementation step, update docs/ai-handover.md.
- Record material technical decisions in docs/decisions.md.
- Do not skip the CLI validation step before building real UI.
```

#### `.instructions.md` files — scoped rules per file type or folder

Instruction files with an `applyTo` frontmatter glob apply only when the active file matches the pattern. This allows different rules for different parts of the codebase.

Example at `frontend/.instructions.md`:

```
---
applyTo: "frontend/**"
---

Do not fetch data directly in components. All data access must go through a service layer.
Do not use inline styles. Use Tailwind classes only.
```

Example at `server/.instructions.md`:

```
---
applyTo: "server/**"
---

All routes must validate inputs before calling simulation engines.
Do not return raw simulation paths in API responses.
```

This is more precise than a single top-level rules file, especially as the project grows to include distinct frontend, backend, and CLI layers.

#### `.prompt.md` files — repeatable task prompts

Prompt files define reusable tasks that can be invoked from the Copilot Chat input using `#filename.prompt.md`. They execute a structured prompt against the current workspace context.

Useful for repeatable workflow steps:

`docs/prompts/spec-review.prompt.md`
```markdown
Review the current spec.md. For each item marked as complete, confirm the implementation matches the spec.
List any mismatches or items that appear incomplete.
```

`docs/prompts/update-ai-handover.prompt.md`
```markdown
Read the current codebase and update docs/ai-handover.md to accurately reflect:
- what is working
- what is in progress
- known issues
- what comes next
```

Prompt files turn documentation discipline into a one-click operation rather than a manual effort.

#### `.agent.md` / custom agent modes — specialised AI personas

VS Code Copilot supports defining custom agent modes. A custom agent can be given a specific set of instructions, a restricted or expanded tool set, and a name that appears in the agent picker.

For example, a `spec-writer` agent could be configured to only edit markdown files and always follow the spec template structure. A `reviewer` agent could be restricted to read-only tools and tasked with checking consistency between spec, wireframes, and implementation.

#### VS Code settings — user-level persistent instructions

Additional instructions can be set in VS Code user settings under `github.copilot.chat.codeGeneration.instructions`. These apply across all workspaces for the current user and are combined with any repo-level instructions. Use this for personal preferences (e.g. preferred formatting, language style) rather than project-specific rules.

### 8.2 Recommended setup for this operating model

A minimal but effective governance setup:

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Always-on development rules and documentation gates |
| `server/.instructions.md` | Backend-specific constraints (validation, no raw paths, etc.) |
| `frontend/.instructions.md` | UI layer constraints (no business logic, data access patterns) |
| `docs/prompts/spec-review.prompt.md` | Trigger a spec vs. implementation consistency check |
| `docs/prompts/update-ai-handover.prompt.md` | Trigger a session handover documentation update |

This setup requires no manual context injection — the rules are always active when working in the relevant parts of the codebase.

## 9. Stage-based maturity model

Not every stage of development requires the same level of rigor. A practical model introduces stronger controls over time.

### 9.1 Prototype stage
Focus:
- speed
- architecture shape
- workflow validation
- low-friction documentation
- manual testing acceptable

### 9.2 MVP stage
Focus:
- clearer iteration boundaries
- more complete UI states
- stronger API contracts
- better continuity across sessions
- more explicit acceptance checks

### 9.3 Pre-release stage
Focus:
- error handling
- broader test coverage
- accessibility and responsiveness
- stronger non-functional requirements
- more formal handoff readiness

### 9.4 Production stage
Focus:
- operational resilience
- security and governance
- deployment and observability
- team-scale maintainability
- formalized support model

This staged approach prevents over-engineering too early while still giving a path toward industrialization.

## 10. Limitations and cautions

This approach is practical, but not universal.

Potential limitations include:

- documentation still requires effort and judgment
- AI compliance with workflow rules is strong but not absolute
- over-documentation can become a burden if not controlled
- some highly visual design work will outgrow ASCII wireframes
- team adoption may require deliberate training and examples
- quality risks remain if human review is weak

The model therefore depends on maintaining balance:
enough structure to preserve coherence, but not so much that it undermines iteration speed.

## 11. Conclusion

AI-assisted development becomes substantially more effective when understood not as a coding trick, but as a structured digital product development cycle.

The most effective use of AI is not simply to generate implementation. It is to participate in a repeatable loop of:

- planning
- design
- documentation
- implementation
- validation
- refinement

The approach described here relies on a few straightforward ideas:
- separate backend from UI
- iterate explicitly
- use text-first artefacts
- validate low-fidelity interaction flows before polished UI
- keep documentation lightweight but mandatory
- use AI to enforce workflow discipline as well as generate output

This creates an operating model that is fast enough for experimentation, disciplined enough for serious product work, and adaptable enough to mature over time.

In that sense, the real opportunity is not “AI-assisted coding.”  
It is **AI-assisted digital product development**.

## Appendix A: Example artefact set

A minimal project structure might include:

```text
/project-root
  AI_WORKFLOW_RULES.md
  README.md
  /docs
    spec.md            ← current system description
    architecture.md
    decisions.md
    ai-handover.md
    backlog.md
    /iterations        ← one file per completed iteration
      v0-1.md
      v0-2.md
      ...
    /ui
      /flows
      /screens
  /apps
    /api
    /cli
    /web
    /ios
  /packages
    /shared-types
```

## Appendix B: Example workflow rule statements

Examples of useful repository rules:

- For non-trivial features, update the current iteration spec before implementation.
- For meaningful UI changes, update the relevant screen and flow wireframes first.
- Do not place business logic in UI layers.
- Use the Python CLI as the default early client for backend workflow validation.
- Do not implement undocumented scope unless explicitly instructed.
- Update the session handover document after each meaningful implementation step.
- Record material technical decisions in the decision log.

## Appendix C: Example screen documentation structure

A screen file might include:

- purpose
- data shown
- ASCII wireframe
- interactions
- states
- notes on current scope
- links to relevant flows

This allows AI and humans to reason about the screen independently of code.
