from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine

from tracegraph.database import Database
from tracegraph.graph import GraphExplorer
from tracegraph.models import SeedRecord, TableRef, TraceOptions, TraceRequest


@pytest.mark.postgres
def test_postgres_schema_and_trace_are_read_only() -> None:
    url = os.getenv("TRACEGRAPH_TEST_POSTGRES_URL")
    if not url:
        pytest.skip("TRACEGRAPH_TEST_POSTGRES_URL is not configured")

    setup_engine = create_engine(url)
    with setup_engine.begin() as connection:
        connection.exec_driver_sql("DROP SCHEMA IF EXISTS tracegraph_test CASCADE")
        connection.exec_driver_sql("CREATE SCHEMA tracegraph_test")
        connection.exec_driver_sql(
            "CREATE TABLE tracegraph_test.accounts ("
            "account_id INTEGER PRIMARY KEY, label TEXT NOT NULL)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE tracegraph_test.records ("
            "record_id INTEGER PRIMARY KEY, "
            "account_id INTEGER NOT NULL REFERENCES tracegraph_test.accounts(account_id), "
            "state TEXT NOT NULL)"
        )
        connection.exec_driver_sql("INSERT INTO tracegraph_test.accounts VALUES (1, 'Synthetic')")
        connection.exec_driver_sql("INSERT INTO tracegraph_test.records VALUES (10, 1, 'ready')")

    database = Database(url, max_tables=100)
    try:
        graph = GraphExplorer(database).trace(
            TraceRequest(
                seed=SeedRecord(
                    table=TableRef(schema_name="tracegraph_test", table_name="records"),
                    column="record_id",
                    value="10",
                ),
                options=TraceOptions(max_depth=2, max_nodes=20),
            )
        )
        assert {node.table.table_name for node in graph.nodes} == {"accounts", "records"}
        assert len(graph.edges) == 1
    finally:
        database.close()
        with setup_engine.begin() as connection:
            connection.exec_driver_sql("DROP SCHEMA tracegraph_test CASCADE")
        setup_engine.dispose()
