from __future__ import annotations

import pytest

from tracegraph.database import Database
from tracegraph.demo import build_demo_database


@pytest.fixture
def demo_database() -> Database:
    database = build_demo_database()
    yield database
    database.close()
