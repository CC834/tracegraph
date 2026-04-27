from __future__ import annotations

from fastapi.testclient import TestClient

from tracegraph.config import Settings
from tracegraph.main import create_app


def test_demo_api_health_schema_and_trace(demo_database) -> None:
    app = create_app(Settings(mode="demo"), demo_database)
    with TestClient(app) as client:
        health = client.get("/api/v1/health")
        schema = client.get("/api/v1/schema")
        trace = client.post(
            "/api/v1/traces",
            json={
                "seed": {
                    "table": {"table_name": "orders"},
                    "column": "order_id",
                    "value": "1001",
                },
                "options": {"max_depth": 3, "max_rows_per_table": 20, "max_nodes": 100},
            },
        )

    assert health.status_code == 200
    assert health.json() == {"status": "ok", "dialect": "sqlite"}
    assert schema.status_code == 200
    assert len(schema.json()["tables"]) == 8
    assert trace.status_code == 200
    assert any(node["table"]["table_name"] == "shipments" for node in trace.json()["nodes"])


def test_unknown_table_returns_safe_error(demo_database) -> None:
    app = create_app(Settings(mode="demo"), demo_database)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/traces",
            json={
                "seed": {
                    "table": {"table_name": "missing"},
                    "column": "id",
                    "value": "1",
                }
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"] == "Unknown seed table: missing"
