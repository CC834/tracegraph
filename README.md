# Relational Lineage Explorer

### Read-only record tracing for undocumented relational databases

Relational Lineage Explorer is a visual, privacy-first tool for following one record through an unfamiliar relational database. It combines declared foreign-key evidence, optional column-match inference, bounded graph traversal, and snapshot replay to make hidden data flows explainable.

[Open the public synthetic demo](https://cc834.github.io/relational-lineage-explorer/)

![Relational Lineage Explorer animated synthetic record journey](docs/tracegraph-demo.gif)

> The public demo and every committed fixture are synthetic. Relational Lineage Explorer contains no employer, client, thesis, or production database schema, records, queries, identifiers, screenshots, or benchmark results.

## Why this project exists

Operational databases are usually designed to run processes—not to explain themselves or provide analysis-ready datasets. Relationships may be incomplete, documentation may be missing, and meaningful events may be spread across tables with different granularities.

Relational Lineage Explorer was inspired by database-investigation challenges encountered while contributing to a collaborative industrial MSc thesis. The original investigation required following selected records, comparing database states, and testing possible relationships before later analytics could be trusted. This public implementation independently generalizes that workflow around a deterministic e-commerce scenario.

## What it shows

- Schema discovery for SQLite and PostgreSQL.
- Read-only tracing from any table, column, and seed value.
- Declared foreign-key traversal in both directions.
- Explicitly labelled, opt-in same-column inference.
- Cycle handling and configurable depth, row, table, and node budgets.
- Automatic redaction for secret-like columns.
- Snapshot capture and animated before/after replay.
- A static, connector-free public demo and a locally connected application.

## Quick start

Requirements: Python 3.12+, Node.js 22+, and npm.

```bash
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
cd frontend && npm ci && cd ..
```

Run the API in one terminal:

```bash
.venv/bin/uvicorn tracegraph.main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend in another:

```bash
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`. Without configuration, Relational Lineage Explorer starts with its synthetic SQLite database.

### Connect a local SQLite database

```bash
TRACEGRAPH_MODE=connected \
TRACEGRAPH_DATABASE_URL='sqlite:////absolute/path/to/database.sqlite3' \
.venv/bin/uvicorn tracegraph.main:app --host 127.0.0.1 --port 8000
```

### Connect PostgreSQL

Use a database role that already has read-only permissions:

```bash
TRACEGRAPH_MODE=connected \
TRACEGRAPH_DATABASE_URL='postgresql+psycopg://readonly_user:password@127.0.0.1/database' \
.venv/bin/uvicorn tracegraph.main:app --host 127.0.0.1 --port 8000
```

Connection URLs are launch configuration only. They are never accepted from, returned to, or persisted by the browser. Relational Lineage Explorer also enables SQLite query-only mode or PostgreSQL read-only sessions, applies a PostgreSQL statement timeout, validates identifiers against inspected metadata, and exposes no arbitrary-SQL endpoint.

## Docker

```bash
docker compose up --build
```

The container is published only on `127.0.0.1:8000` and starts in synthetic demo mode. Copy `compose.yaml` to a private override before adding a real connection URL; never commit credentials.

## Development checks

```bash
.venv/bin/ruff check backend
.venv/bin/mypy backend/src
.venv/bin/pytest backend --cov=tracegraph

cd frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

PostgreSQL integration tests run in CI against an ephemeral service. Locally they are skipped unless `TRACEGRAPH_TEST_POSTGRES_URL` is set.

## Architecture

The React interface depends on versioned FastAPI contracts. Routes delegate to framework-independent graph and snapshot modules, which in turn use a narrow read-only database boundary. See [Architecture](docs/ARCHITECTURE.md) for the data flow, safety model, and module responsibilities.

## Limitations

- Inferred links are investigation clues, not proof of a database relationship.
- Snapshot history is held in browser memory and is not retained after restart.
- Large schemas and traces are intentionally truncated by configured safety budgets.
- Relational Lineage Explorer is an investigation aid; conclusions still require domain knowledge and validation.

## License

[MIT](LICENSE)
