from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from tracegraph.database import Database, DatabaseError
from tracegraph.graph import GraphExplorer
from tracegraph.models import (
    DiffRequest,
    SchemaCatalog,
    SnapshotDiff,
    SnapshotRequest,
    TraceGraph,
    TraceRequest,
    TraceSnapshot,
)
from tracegraph.snapshots import capture_snapshot, compare_snapshots

router = APIRouter(prefix="/api/v1")


def get_database(request: Request) -> Database:
    return request.app.state.database


def get_explorer(request: Request) -> GraphExplorer:
    return request.app.state.explorer


DatabaseDependency = Annotated[Database, Depends(get_database)]
ExplorerDependency = Annotated[GraphExplorer, Depends(get_explorer)]


@router.get("/health")
def health(database: DatabaseDependency) -> dict[str, str]:
    try:
        database.ping()
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "ok", "dialect": database.dialect}


@router.get("/schema", response_model=SchemaCatalog)
def schema(database: DatabaseDependency) -> SchemaCatalog:
    try:
        return database.catalog()
    except DatabaseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/traces", response_model=TraceGraph)
def trace(
    payload: TraceRequest,
    explorer: ExplorerDependency,
) -> TraceGraph:
    try:
        return explorer.trace(payload)
    except DatabaseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/snapshots", response_model=TraceSnapshot)
def snapshot(
    payload: SnapshotRequest,
    explorer: ExplorerDependency,
) -> TraceSnapshot:
    try:
        return capture_snapshot(explorer.trace(payload.trace))
    except DatabaseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/diffs", response_model=SnapshotDiff)
def diff(payload: DiffRequest) -> SnapshotDiff:
    return compare_snapshots(payload.before, payload.after)
