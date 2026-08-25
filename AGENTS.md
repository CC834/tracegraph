# Relational Lineage Explorer Engineering Guide

## Repository context

Relational Lineage Explorer is a local-first relational record-lineage explorer. The backend is synchronous Python 3.12+ with FastAPI, Pydantic, SQLAlchemy, SQLite, PostgreSQL, and pytest. The frontend is React 19, TypeScript, Vite, Cytoscape.js, Vitest, and Playwright. `backend/src/tracegraph` contains production Python, `frontend/src` contains the UI, and all committed examples must be synthetic. Existing `tracegraph` package names and environment-variable prefixes are compatibility identifiers, not the public product name.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing traversal, connection, snapshot, redaction, or hosted-demo behavior.

## Commands

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
cd frontend && npm ci && cd ..

.venv/bin/ruff check backend
.venv/bin/mypy backend/src
.venv/bin/pytest backend --cov=tracegraph
cd frontend && npm run lint && npm test && npm run build && npm run test:e2e
```

Run the API with `.venv/bin/uvicorn tracegraph.main:app --reload --host 127.0.0.1 --port 8000` and the UI with `cd frontend && npm run dev`.

## Working approach

- Inspect callers, contracts, and focused tests before editing. Preserve unrelated work and keep changes reviewable.
- Prefer the smallest implementation that satisfies the current behavior. Do not add dependencies or abstractions for hypothetical connectors or workflows.
- Keep related code together until extraction creates a real responsibility, test seam, reuse point, or dependency boundary. Do not split mechanically by line count.
- Avoid monolithic entry points, routes, pages, and components that mix UI, validation, traversal rules, SQL, configuration, and export behavior.
- Also avoid one file per function, pass-through wrappers, single-use factories/interfaces, and generic `Manager`, `Helper`, `Processor`, `BaseService`, or unrelated utility buckets.

## Boundaries and conventions

- FastAPI routes validate transport data, delegate to graph/snapshot behavior, and translate safe errors. They must not build SQL or contain traversal rules.
- Graph, redaction, and diff logic must remain independent of FastAPI and be unit-testable without HTTP.
- Keep identifier validation, reflection, query construction, connection lifecycle, and dialect behavior inside the database boundary. Use SQLAlchemy Core; never interpolate identifiers or values into raw queries.
- All connected database access is read-only. Never add write endpoints, arbitrary SQL, credential logging, or browser-supplied connection URLs.
- Keep `main.tsx` limited to bootstrapping and `App.tsx` focused on composition. Typed API calls belong in the explorer client; pure comparison logic belongs in replay.
- Feature code may depend on shared configuration and types, but unrelated features must not import each other's UI internals.
- Model loading, empty, success, error, truncation, keyboard, focus, and reduced-motion behavior when changing the UI.

## Sensitive and generated material

Never commit real schemas, table or column names, records, identifiers, connection strings, databases, dumps, CSV extracts, investigation exports, or screenshots from connected mode. Do not derive public fixtures by renaming private data. Create independently synthetic scenarios in `demo.py` and `demoJourney.ts`.

Generated directories include `.venv`, `node_modules`, `dist`, coverage, Playwright output, and caches. Do not edit or commit them.

## Verification

- Add focused tests for changed behavior. Backend rules need unit tests; dialect behavior needs integration coverage; API contracts need route tests; UI interactions need Vitest or Playwright coverage.
- For traversal changes, cover cycles, self-links, duplicates, composite keys, nulls, limits, inferred-versus-declared evidence, and redaction as relevant.
- Run targeted checks while iterating, then the full backend and frontend command set before completion. Report skipped PostgreSQL or browser checks honestly.
- Before any public release, scan the working tree and Git object history for secrets, database/archive files, non-synthetic identifiers, and private-domain terminology.
