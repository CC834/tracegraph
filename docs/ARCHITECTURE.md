# TraceGraph Architecture

TraceGraph is deliberately small, but it separates framework code, graph rules, and database access so each can be tested independently.

```text
React explorer and replay UI
            ↓ versioned JSON
Thin FastAPI routes and schemas
            ↓
Graph traversal, redaction, snapshots, diffs
            ↓
Read-only SQLAlchemy inspection and queries
            ↓
SQLite or PostgreSQL
```

## Backend responsibilities

- `api.py` translates HTTP requests and safe application errors. It contains no graph or SQL rules.
- `graph.py` owns bounded traversal, stable identities, relationship evidence, cycle handling, and redaction.
- `snapshots.py` owns deterministic comparison of two trace results.
- `database.py` validates tables and columns against inspected metadata, quotes identifiers through SQLAlchemy, and owns all database connections and queries.
- `demo.py` is the only synthetic-data constructor. It does not share names or structures with any private source system.

SQLite files are opened with URI `mode=ro` before a connection is created and also use `PRAGMA query_only`. PostgreSQL connections set read-only sessions and a statement timeout. Users should still supply a database account whose permissions are read-only.

## Frontend responsibilities

- `App.tsx` composes the investigation workspace and owns top-level view state.
- `features/explorer` contains typed API access, trace controls, the graph canvas, and record inspection.
- `features/replay` contains snapshot comparison, the deterministic public journey, and replay controls.
- The hosted build sets `VITE_DEMO_ONLY=true`, bundles synthetic snapshots, and never calls a database API.

State stays local because v1 has one workspace and no persistence requirement. A global state library or query abstraction would add indirection without solving a current problem.

## Relationship semantics

Declared foreign keys are authoritative schema evidence and are traversed in both directions. Inferred relationships are opt-in clues based on an explicitly selected, same-named, type-compatible column. They use dashed edges and must not be presented as declared constraints.

Self-links are excluded from inference. A declared recursive foreign key may connect two different records in the same table, but an edge from a record to itself is not rendered.

## Privacy boundary

Connected mode is local by default. Credentials stay in process launch configuration. Record values can reach the local browser to support inspection, but secret-like columns are redacted first. No snapshots are persisted by the server, and exports contain only the already-redacted graph response.

Real databases, dumps, investigation output, connection profiles, and generated exports are ignored and must never become fixtures. Tests and documentation use only deterministic synthetic data.

