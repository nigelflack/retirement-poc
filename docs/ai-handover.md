# AI Handover

_Last updated: 23 March 2026 (v0.8 complete)_

Read this at the start of a session to get oriented quickly. For what the system does, see `docs/spec.md`. For the next iteration plan, see `docs/iterations/`. For the backlog, see `docs/backlog.md`.

---

## Current version

**v0.8** — React Router; `/scenarios` page; Panel 2 live (solve calls, bucket logic, skeletons, 422 handling); Panel 3 live (scenario cards); 15 server unit tests passing.

---

## What is in progress / next

- **v0.9** — not yet planned. See `docs/backlog.md` to choose scope.

---

## Known issues / rough edges

No current known issues. Deferred items are in `docs/backlog.md`.

---

## How to run

```bash
# Terminal 1 — server
cd server && node src/index.js

# Terminal 2 — web UI
cd ui && npm run dev
# → http://localhost:5173

# Terminal 2 (alternative) — CLI
source .venv/bin/activate
cd cli && python retirement.py --input inputs/nigel-mimi.json

# Solve modes
python retirement.py --input inputs/nigel-mimi.json --solve income
python retirement.py --input inputs/nigel-mimi.json --solve ages

# Server tests
cd server && npm test
```
