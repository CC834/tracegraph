from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from tracegraph.api import router
from tracegraph.config import Settings, get_settings
from tracegraph.database import Database
from tracegraph.demo import build_demo_database
from tracegraph.graph import GraphExplorer, Redactor


def create_app(settings: Settings | None = None, database: Database | None = None) -> FastAPI:
    active_settings = settings or get_settings()
    active_database = database
    if active_database is None:
        if active_settings.mode == "connected":
            if not active_settings.database_url:
                raise RuntimeError("TRACEGRAPH_DATABASE_URL is required in connected mode")
            active_database = Database(
                active_settings.database_url,
                statement_timeout_ms=active_settings.statement_timeout_ms,
                max_tables=active_settings.max_tables,
            )
        else:
            active_database = build_demo_database()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        active_database.close()

    app = FastAPI(
        title="Relational Lineage Explorer API",
        version="1.0.0",
        description="Read-only record lineage for relational databases",
        lifespan=lifespan,
    )
    app.state.database = active_database
    app.state.explorer = GraphExplorer(
        active_database,
        Redactor(active_settings.extra_redacted_columns),
    )
    app.include_router(router)

    frontend_dist = active_settings.frontend_dist.resolve()
    assets = frontend_dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str) -> FileResponse:
            candidate = frontend_dist / path
            if path and candidate.is_file() and frontend_dist in candidate.resolve().parents:
                return FileResponse(candidate)
            return FileResponse(frontend_dist / "index.html")

    return app


app = create_app()
