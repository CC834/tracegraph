from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class TableRef(BaseModel):
    schema_name: str | None = None
    table_name: str = Field(min_length=1, max_length=128)

    @property
    def key(self) -> str:
        return f"{self.schema_name}.{self.table_name}" if self.schema_name else self.table_name


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    nullable: bool
    primary_key: bool = False


class ForeignKeyInfo(BaseModel):
    name: str | None = None
    local_columns: list[str]
    referred_table: TableRef
    referred_columns: list[str]


class TableInfo(BaseModel):
    ref: TableRef
    columns: list[ColumnInfo]
    primary_key: list[str]
    foreign_keys: list[ForeignKeyInfo]


class SchemaCatalog(BaseModel):
    dialect: str
    tables: list[TableInfo]
    truncated: bool = False


class SeedRecord(BaseModel):
    table: TableRef
    column: str = Field(min_length=1, max_length=128)
    value: str = Field(max_length=2_000)


class TraceOptions(BaseModel):
    relationship_mode: Literal["declared", "declared_and_inferred"] = "declared"
    follow_columns: list[str] = Field(default_factory=list, max_length=20)
    max_depth: int = Field(default=3, ge=1, le=8)
    max_rows_per_table: int = Field(default=50, ge=1, le=1_000)
    max_nodes: int = Field(default=500, ge=10, le=10_000)

    @model_validator(mode="after")
    def inferred_relationships_need_columns(self) -> TraceOptions:
        if self.relationship_mode == "declared_and_inferred" and not self.follow_columns:
            raise ValueError("follow_columns is required when inferred relationships are enabled")
        return self


class TraceRequest(BaseModel):
    seed: SeedRecord
    options: TraceOptions = Field(default_factory=TraceOptions)


class GraphNode(BaseModel):
    id: str
    table: TableRef
    depth: int
    identity: dict[str, Any]
    attributes: dict[str, Any]


class EdgeEvidence(BaseModel):
    kind: Literal["foreign_key", "column_match"]
    direction: Literal["outgoing", "incoming", "inferred"]
    local_columns: list[str]
    remote_columns: list[str]
    constraint_name: str | None = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    evidence: EdgeEvidence


class TraceMetadata(BaseModel):
    dialect: str
    started_from: TableRef
    truncated: bool
    warnings: list[str] = Field(default_factory=list)


class TraceGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    metadata: TraceMetadata


class TraceSnapshot(BaseModel):
    id: str
    captured_at: datetime
    graph: TraceGraph


class SnapshotRequest(BaseModel):
    trace: TraceRequest


class FieldChange(BaseModel):
    field: str
    before: Any = None
    after: Any = None


class NodeChange(BaseModel):
    node_id: str
    fields: list[FieldChange]


class SnapshotDiff(BaseModel):
    before_id: str
    after_id: str
    added_node_ids: list[str]
    removed_node_ids: list[str]
    changed_nodes: list[NodeChange]
    added_edge_ids: list[str]
    removed_edge_ids: list[str]


class DiffRequest(BaseModel):
    before: TraceSnapshot
    after: TraceSnapshot
