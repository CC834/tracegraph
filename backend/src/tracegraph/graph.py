from __future__ import annotations

import hashlib
import json
from collections import deque
from collections.abc import Mapping
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from tracegraph.database import Database, DatabaseError
from tracegraph.models import (
    EdgeEvidence,
    GraphEdge,
    GraphNode,
    TableInfo,
    TableRef,
    TraceGraph,
    TraceMetadata,
    TraceRequest,
)

SECRET_COLUMN_PARTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "credential",
    "private_key",
)


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return f"<binary:{len(value)} bytes>"
    return str(value)


class Redactor:
    def __init__(self, extra_columns: set[str] | None = None) -> None:
        self.extra_columns = {name.lower() for name in (extra_columns or set())}

    def should_redact(self, column: str) -> bool:
        normalized = column.lower()
        return normalized in self.extra_columns or any(
            marker in normalized for marker in SECRET_COLUMN_PARTS
        )

    def row(self, row: Mapping[str, Any]) -> dict[str, Any]:
        return {
            column: "<redacted>" if self.should_redact(column) else _json_value(value)
            for column, value in row.items()
        }


def _stable_digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def _identity(info: TableInfo, row: Mapping[str, Any]) -> dict[str, Any]:
    if info.primary_key:
        return {column: _json_value(row[column]) for column in info.primary_key}
    safe_row = {column: _json_value(value) for column, value in sorted(row.items())}
    return {"row_hash": _stable_digest(safe_row)}


def _node_id(info: TableInfo, row: Mapping[str, Any]) -> str:
    return f"node_{_stable_digest({'table': info.ref.key, 'identity': _identity(info, row)})}"


def _edge_id(source: str, target: str, evidence: EdgeEvidence) -> str:
    evidence_identity = evidence.model_dump(exclude={"direction"})
    payload = {"source": source, "target": target, "evidence": evidence_identity}
    return f"edge_{_stable_digest(payload)}"


def _type_family(type_name: str) -> str:
    normalized = type_name.upper()
    if any(part in normalized for part in ("INT", "NUMERIC", "DECIMAL", "REAL", "FLOAT")):
        return "number"
    if any(part in normalized for part in ("CHAR", "TEXT", "CLOB", "UUID")):
        return "text"
    if any(part in normalized for part in ("DATE", "TIME")):
        return "time"
    if "BOOL" in normalized:
        return "boolean"
    if any(part in normalized for part in ("BLOB", "BINARY", "BYTEA")):
        return "binary"
    return normalized.split("(", 1)[0]


def _column_type(info: TableInfo, column: str) -> str | None:
    return next((item.data_type for item in info.columns if item.name == column), None)


def _coerce_seed(database: Database, ref: TableRef, column: str, value: str) -> Any:
    table = database.table(ref)
    if column not in table.c:
        raise DatabaseError(f"Unknown seed column on {ref.key}")
    try:
        python_type = table.c[column].type.python_type
    except (AttributeError, NotImplementedError):
        return value
    if python_type is bool:
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        raise DatabaseError("The seed value is not a valid boolean")
    if python_type in {int, float, Decimal}:
        try:
            return python_type(value)
        except (TypeError, ValueError) as exc:
            raise DatabaseError("The seed value does not match the selected column type") from exc
    return value


class GraphExplorer:
    def __init__(self, database: Database, redactor: Redactor | None = None) -> None:
        self.database = database
        self.redactor = redactor or Redactor()

    def trace(self, request: TraceRequest) -> TraceGraph:
        catalog = self.database.catalog()
        table_by_key = {table.ref.key: table for table in catalog.tables}
        seed_info = table_by_key.get(request.seed.table.key)
        if seed_info is None:
            raise DatabaseError(f"Unknown seed table: {request.seed.table.key}")

        options = request.options
        seed_value = _coerce_seed(
            self.database,
            request.seed.table,
            request.seed.column,
            request.seed.value,
        )
        seed_rows = self.database.matching_rows(
            request.seed.table,
            [request.seed.column],
            [seed_value],
            limit=options.max_rows_per_table,
        )

        nodes: dict[str, GraphNode] = {}
        raw_rows: dict[str, Mapping[str, Any]] = {}
        edges: dict[str, GraphEdge] = {}
        queue: deque[tuple[str, int]] = deque()
        expanded: set[str] = set()
        warnings: set[str] = set()
        truncated = False

        def add_node(info: TableInfo, row: Mapping[str, Any], depth: int) -> str | None:
            nonlocal truncated
            node_id = _node_id(info, row)
            if node_id in nodes:
                if depth < nodes[node_id].depth:
                    nodes[node_id].depth = depth
                return node_id
            if len(nodes) >= options.max_nodes:
                truncated = True
                warnings.add("Node limit reached; the trace is incomplete.")
                return None
            nodes[node_id] = GraphNode(
                id=node_id,
                table=info.ref,
                depth=depth,
                identity=_identity(info, row),
                attributes=self.redactor.row(row),
            )
            raw_rows[node_id] = row
            queue.append((node_id, depth))
            return node_id

        for row in seed_rows:
            add_node(seed_info, row, 0)
        if len(seed_rows) == options.max_rows_per_table:
            truncated = True
            warnings.add("Seed row limit reached; additional matching records may exist.")

        incoming: dict[str, list[tuple[TableInfo, Any]]] = {}
        for child in catalog.tables:
            for foreign_key in child.foreign_keys:
                incoming.setdefault(foreign_key.referred_table.key, []).append((child, foreign_key))

        columns_by_name: dict[str, list[tuple[TableInfo, str]]] = {}
        if options.relationship_mode == "declared_and_inferred":
            allowed = set(options.follow_columns)
            for table in catalog.tables:
                for catalog_column in table.columns:
                    if catalog_column.name in allowed:
                        columns_by_name.setdefault(catalog_column.name, []).append(
                            (table, catalog_column.data_type)
                        )

        def add_edge(
            source_id: str,
            target_id: str,
            evidence: EdgeEvidence,
        ) -> None:
            if source_id == target_id:
                return
            if evidence.kind == "column_match" and source_id > target_id:
                source_id, target_id = target_id, source_id
            edge_id = _edge_id(source_id, target_id, evidence)
            edges.setdefault(
                edge_id,
                GraphEdge(id=edge_id, source=source_id, target=target_id, evidence=evidence),
            )

        while queue:
            current_id, depth = queue.popleft()
            if current_id in expanded or depth >= options.max_depth:
                continue
            expanded.add(current_id)
            current_node = nodes[current_id]
            current_info = table_by_key[current_node.table.key]
            current_row = raw_rows[current_id]

            for foreign_key in current_info.foreign_keys:
                if not foreign_key.local_columns or any(
                    current_row.get(column) is None for column in foreign_key.local_columns
                ):
                    continue
                target_info = table_by_key.get(foreign_key.referred_table.key)
                if target_info is None:
                    continue
                values = [current_row[column] for column in foreign_key.local_columns]
                found = self.database.matching_rows(
                    target_info.ref,
                    foreign_key.referred_columns,
                    values,
                    limit=options.max_rows_per_table,
                )
                evidence = EdgeEvidence(
                    kind="foreign_key",
                    direction="outgoing",
                    local_columns=foreign_key.local_columns,
                    remote_columns=foreign_key.referred_columns,
                    constraint_name=foreign_key.name,
                )
                for row in found:
                    target_id = add_node(target_info, row, depth + 1)
                    if target_id:
                        add_edge(current_id, target_id, evidence)

            for child_info, foreign_key in incoming.get(current_info.ref.key, []):
                if not foreign_key.referred_columns or any(
                    current_row.get(column) is None for column in foreign_key.referred_columns
                ):
                    continue
                values = [current_row[column] for column in foreign_key.referred_columns]
                found = self.database.matching_rows(
                    child_info.ref,
                    foreign_key.local_columns,
                    values,
                    limit=options.max_rows_per_table,
                )
                evidence = EdgeEvidence(
                    kind="foreign_key",
                    direction="incoming",
                    local_columns=foreign_key.local_columns,
                    remote_columns=foreign_key.referred_columns,
                    constraint_name=foreign_key.name,
                )
                for row in found:
                    child_id = add_node(child_info, row, depth + 1)
                    if child_id:
                        add_edge(child_id, current_id, evidence)

            if options.relationship_mode != "declared_and_inferred":
                continue
            for follow_column in options.follow_columns:
                value = current_row.get(follow_column)
                source_type = _column_type(current_info, follow_column)
                if value is None or source_type is None:
                    continue
                for target_info, target_type in columns_by_name.get(follow_column, []):
                    if target_info.ref == current_info.ref:
                        continue
                    if _type_family(source_type) != _type_family(target_type):
                        continue
                    found = self.database.matching_rows(
                        target_info.ref,
                        [follow_column],
                        [value],
                        limit=options.max_rows_per_table,
                    )
                    evidence = EdgeEvidence(
                        kind="column_match",
                        direction="inferred",
                        local_columns=[follow_column],
                        remote_columns=[follow_column],
                    )
                    for row in found:
                        target_id = add_node(target_info, row, depth + 1)
                        if target_id:
                            add_edge(current_id, target_id, evidence)

        return TraceGraph(
            nodes=sorted(nodes.values(), key=lambda node: (node.depth, node.table.key, node.id)),
            edges=sorted(edges.values(), key=lambda edge: edge.id),
            metadata=TraceMetadata(
                dialect=catalog.dialect,
                started_from=request.seed.table,
                truncated=truncated or catalog.truncated,
                warnings=sorted(warnings),
            ),
        )
