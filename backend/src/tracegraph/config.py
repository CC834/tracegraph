from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRACEGRAPH_", extra="ignore")

    mode: str = Field(default="demo", pattern="^(demo|connected)$")
    database_url: str | None = None
    bind_host: str = "127.0.0.1"
    bind_port: int = Field(default=8000, ge=1, le=65535)
    statement_timeout_ms: int = Field(default=5_000, ge=100, le=60_000)
    max_tables: int = Field(default=500, ge=1, le=5_000)
    max_depth: int = Field(default=4, ge=1, le=8)
    max_rows_per_table: int = Field(default=100, ge=1, le=1_000)
    max_nodes: int = Field(default=1_000, ge=10, le=10_000)
    redacted_columns: str = ""
    frontend_dist: Path = Path("frontend/dist")

    @property
    def extra_redacted_columns(self) -> set[str]:
        return {part.strip().lower() for part in self.redacted_columns.split(",") if part.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
