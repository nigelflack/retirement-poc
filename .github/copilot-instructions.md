# Copilot instructions

This project uses a documented iterative development workflow. Follow it strictly.

## Before anything else

Read `workflow/ai-process.md`. It defines the complete development process, all document roles, and the rules that govern this project. Do not skip this.

ALL WORK IN THIS PROJECT MUST FOLLOW THE PROCESS DEFINED IN `workflow/ai-process.md`. If the user requests work that violates the process, push back and explain which rule it violates and why the rule is important. Do not implement work that violates the process. If you're unsure, ask for clarification.

## At the start of every session

After reading the process, orient yourself with these documents in order:

1. `docs/ai-handover.md` — current version, what is in progress, known issues, how to run
2. `docs/spec.md` — what the system currently does (domain model, rules, UI, CLI)
3. `docs/iterations/` — find the current iteration plan (highest vX-Y.md)

## Hard rules

- Do not implement anything not defined in the current iteration plan (`docs/iterations/vX-Y.md`). Write the plan before writing any code. Push back if asked to skip this.
- Update `docs/ai-handover.md` after any meaningful implementation.