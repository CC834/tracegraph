from __future__ import annotations

from sqlalchemy import text

from tracegraph.database import Database, create_memory_engine, memory_database


def build_demo_database() -> Database:
    engine = create_memory_engine()
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")
        connection.exec_driver_sql(
            """
            CREATE TABLE customers (
                customer_id INTEGER PRIMARY KEY,
                display_name TEXT NOT NULL,
                email TEXT NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE orders (
                order_id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
                status TEXT NOT NULL,
                total_amount NUMERIC NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE order_items (
                item_id INTEGER PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(order_id),
                sku TEXT NOT NULL,
                quantity INTEGER NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE payments (
                payment_id INTEGER PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(order_id),
                status TEXT NOT NULL,
                provider_token TEXT
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE shipments (
                shipment_id INTEGER PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES orders(order_id),
                status TEXT NOT NULL,
                tracking_code TEXT NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE tracking_events (
                event_id INTEGER PRIMARY KEY,
                shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id),
                event_type TEXT NOT NULL,
                occurred_at TEXT NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE support_cases (
                case_id INTEGER PRIMARY KEY,
                customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
                order_id INTEGER,
                state TEXT NOT NULL
            )
            """
        )
        connection.exec_driver_sql(
            """
            CREATE TABLE audit_events (
                audit_id INTEGER PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                recorded_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            text("INSERT INTO customers VALUES (1, 'Avery Stone', 'avery@example.test')")
        )
        connection.execute(
            text("INSERT INTO orders VALUES (1001, 1, 'shipped', 149.50, '2026-01-15T09:00:00Z')")
        )
        connection.execute(
            text(
                "INSERT INTO order_items VALUES "
                "(2001, 1001, 'SYNTH-LAMP', 1), "
                "(2002, 1001, 'SYNTH-BULB', 2)"
            )
        )
        connection.execute(
            text("INSERT INTO payments VALUES (3001, 1001, 'captured', 'demo-secret-token')")
        )
        connection.execute(
            text("INSERT INTO shipments VALUES (4001, 1001, 'in_transit', 'DEMO-TRACK-001')")
        )
        connection.execute(
            text(
                "INSERT INTO tracking_events VALUES "
                "(5001, 4001, 'label_created', '2026-01-15T09:08:00Z'), "
                "(5002, 4001, 'carrier_scan', '2026-01-15T12:30:00Z')"
            )
        )
        connection.execute(text("INSERT INTO support_cases VALUES (6001, 1, 1001, 'resolved')"))
        connection.execute(
            text(
                "INSERT INTO audit_events VALUES "
                "(7001, 'order', 1001, 'created', '2026-01-15T09:00:00Z'), "
                "(7002, 'order', 1001, 'shipped', '2026-01-15T12:25:00Z')"
            )
        )
        connection.exec_driver_sql("PRAGMA query_only = ON")
    return memory_database(engine)
