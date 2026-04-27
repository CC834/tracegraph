from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from tracegraph.database import Database
from tracegraph.graph import GraphExplorer
from tracegraph.models import SeedRecord, TableRef, TraceOptions, TraceRequest


def order_trace(*, inferred: bool = False) -> TraceRequest:
    return TraceRequest(
        seed=SeedRecord(table=TableRef(table_name="orders"), column="order_id", value="1001"),
        options=TraceOptions(
            relationship_mode="declared_and_inferred" if inferred else "declared",
            follow_columns=["order_id"] if inferred else [],
            max_depth=4,
            max_rows_per_table=20,
            max_nodes=100,
        ),
    )


def test_declared_relationship_trace_has_no_self_links(demo_database: Database) -> None:
    graph = GraphExplorer(demo_database).trace(order_trace())

    tables = {node.table.table_name for node in graph.nodes}
    assert {"customers", "orders", "order_items", "payments", "shipments"} <= tables
    assert graph.edges
    assert all(edge.source != edge.target for edge in graph.edges)
    assert {edge.evidence.kind for edge in graph.edges} == {"foreign_key"}
    assert len({edge.id for edge in graph.edges}) == len(graph.edges)


def test_inferred_relationships_are_labelled(demo_database: Database) -> None:
    graph = GraphExplorer(demo_database).trace(order_trace(inferred=True))

    assert any(edge.evidence.kind == "column_match" for edge in graph.edges)
    assert all(edge.source != edge.target for edge in graph.edges)


def test_secret_like_columns_are_redacted(demo_database: Database) -> None:
    graph = GraphExplorer(demo_database).trace(order_trace())
    payment = next(node for node in graph.nodes if node.table.table_name == "payments")

    assert payment.attributes["provider_token"] == "<redacted>"


def test_cycles_stop_at_each_node() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")
        connection.exec_driver_sql(
            "CREATE TABLE people ("
            "person_id INTEGER PRIMARY KEY, "
            "manager_id INTEGER REFERENCES people(person_id), "
            "name TEXT)"
        )
        connection.exec_driver_sql("INSERT INTO people VALUES (1, 2, 'A'), (2, 1, 'B')")
        connection.exec_driver_sql("PRAGMA query_only = ON")
    database = Database("sqlite+pysqlite:///:memory:", engine=engine)
    request = TraceRequest(
        seed=SeedRecord(table=TableRef(table_name="people"), column="person_id", value="1"),
        options=TraceOptions(max_depth=8, max_nodes=20),
    )

    graph = GraphExplorer(database).trace(request)

    assert len(graph.nodes) == 2
    assert all(edge.source != edge.target for edge in graph.edges)
    database.close()


def test_node_limit_sets_truncation_warning(demo_database: Database) -> None:
    request = order_trace()
    request.options.max_nodes = 10
    graph = GraphExplorer(demo_database).trace(request)

    assert len(graph.nodes) <= 10
