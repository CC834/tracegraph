from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from sqlalchemy import MetaData, Table, create_engine, event, inspect, select
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.pool import StaticPool

from tracegraph.models import ColumnInfo, ForeignKeyInfo, SchemaCatalog, TableInfo, TableRef


class DatabaseError(RuntimeError):
    """Safe application-level database failure."""


def _readonly_sqlite_url(url: str) -> str:
    prefix = "sqlite:///"
    if not url.startswith(prefix) or url.endswith(":memory:") or "mode=ro" in url:
        return url
    raw_path = url.removeprefix(prefix)
    path = Path(raw_path).expanduser().resolve()
    return f"sqlite+pysqlite:///file:{path.as_posix()}?mode=ro&uri=true"


class Database:
    def __init__(
        self,
        url: str,
        *,
        statement_timeout_ms: int = 5_000,
        max_tables: int = 500,
        engine: Engine | None = None,
    ) -> None:
        self.url = url
        self.statement_timeout_ms = statement_timeout_ms
        self.max_tables = max_tables
        self.engine = engine or self._create_readonly_engine(url)
        self._tables: dict[str, Table] = {}
        self._catalog: SchemaCatalog | None = None

    def _create_readonly_engine(self, url: str) -> Engine:
        safe_url = _readonly_sqlite_url(url)
        engine = create_engine(safe_url, future=True, pool_pre_ping=True)
        dialect = engine.dialect.name

        if dialect == "sqlite":

            @event.listens_for(engine, "connect")
            def sqlite_readonly(dbapi_connection: Any, _connection_record: Any) -> None:
                dbapi_connection.execute("PRAGMA query_only = ON")

        if dialect == "postgresql":
            timeout = int(self.statement_timeout_ms)

            @event.listens_for(engine, "connect")
            def postgres_readonly(dbapi_connection: Any, _connection_record: Any) -> None:
                previous_autocommit = dbapi_connection.autocommit
                dbapi_connection.autocommit = True
                try:
                    with dbapi_connection.cursor() as cursor:
                        cursor.execute("SET default_transaction_read_only = on")
                        cursor.execute(f"SET statement_timeout = {timeout}")
                finally:
                    dbapi_connection.autocommit = previous_autocommit

        return engine

    @property
    def dialect(self) -> str:
        return self.engine.dialect.name

    @contextmanager
    def connect(self) -> Iterator[Connection]:
        try:
            with self.engine.connect() as connection:
                yield connection
        except Exception as exc:
            raise DatabaseError(
                "The configured database could not complete the read-only query"
            ) from exc

    def ping(self) -> None:
        with self.connect() as connection:
            connection.exec_driver_sql("SELECT 1")

    def catalog(self, *, refresh: bool = False) -> SchemaCatalog:
        if self._catalog is not None and not refresh:
            return self._catalog

        inspector = inspect(self.engine)
        schema_names: list[str | None]
        if self.dialect == "postgresql":
            schema_names = [
                name
                for name in inspector.get_schema_names()
                if name not in {"information_schema", "pg_catalog"}
                and not name.startswith("pg_toast")
            ]
        else:
            schema_names = [None]

        tables: list[TableInfo] = []
        truncated = False
        for schema_name in schema_names:
            for table_name in sorted(inspector.get_table_names(schema=schema_name)):
                if len(tables) >= self.max_tables:
                    truncated = True
                    break
                pk = inspector.get_pk_constraint(table_name, schema=schema_name).get(
                    "constrained_columns", []
                )
                columns = [
                    ColumnInfo(
                        name=column["name"],
                        data_type=str(column["type"]),
                        nullable=bool(column.get("nullable", True)),
                        primary_key=column["name"] in pk,
                    )
                    for column in inspector.get_columns(table_name, schema=schema_name)
                ]
                foreign_keys = []
                for fk in inspector.get_foreign_keys(table_name, schema=schema_name):
                    referred_schema = fk.get("referred_schema") or schema_name
                    foreign_keys.append(
                        ForeignKeyInfo(
                            name=fk.get("name"),
                            local_columns=list(fk.get("constrained_columns") or []),
                            referred_table=TableRef(
                                schema_name=referred_schema,
                                table_name=fk["referred_table"],
                            ),
                            referred_columns=list(fk.get("referred_columns") or []),
                        )
                    )
                tables.append(
                    TableInfo(
                        ref=TableRef(schema_name=schema_name, table_name=table_name),
                        columns=columns,
                        primary_key=list(pk),
                        foreign_keys=foreign_keys,
                    )
                )
            if truncated:
                break

        self._catalog = SchemaCatalog(dialect=self.dialect, tables=tables, truncated=truncated)
        return self._catalog

    def table_info(self, ref: TableRef) -> TableInfo:
        for table in self.catalog().tables:
            if table.ref == ref:
                return table
        raise DatabaseError(f"Unknown table: {ref.key}")

    def table(self, ref: TableRef) -> Table:
        info = self.table_info(ref)
        if info.ref.key not in self._tables:
            self._tables[info.ref.key] = Table(
                ref.table_name,
                MetaData(),
                schema=ref.schema_name,
                autoload_with=self.engine,
            )
        return self._tables[info.ref.key]

    def matching_rows(
        self,
        ref: TableRef,
        columns: Sequence[str],
        values: Sequence[Any],
        *,
        limit: int,
    ) -> list[Mapping[str, Any]]:
        if not columns or len(columns) != len(values):
            return []
        table = self.table(ref)
        unknown = [column for column in columns if column not in table.c]
        if unknown:
            raise DatabaseError(f"Unknown column on {ref.key}")
        predicates = [
            table.c[column] == value for column, value in zip(columns, values, strict=True)
        ]
        statement = select(table).where(*predicates).limit(limit)
        with self.connect() as connection:
            return [dict(row) for row in connection.execute(statement).mappings()]

    def close(self) -> None:
        self.engine.dispose()


def memory_database(engine: Engine) -> Database:
    return Database("sqlite+pysqlite:///:memory:", engine=engine)


def create_memory_engine() -> Engine:
    return create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
