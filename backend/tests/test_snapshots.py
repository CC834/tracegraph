from __future__ import annotations

from copy import deepcopy

from tests.test_graph import order_trace
from tracegraph.graph import GraphExplorer
from tracegraph.models import GraphNode
from tracegraph.snapshots import capture_snapshot, compare_snapshots


def test_snapshot_diff_reports_added_removed_and_changed_nodes(demo_database) -> None:
    graph = GraphExplorer(demo_database).trace(order_trace())
    before = capture_snapshot(graph)
    changed_graph = deepcopy(graph)
    changed_graph.nodes[0].attributes["synthetic_state"] = "changed"
    removed = changed_graph.nodes.pop()
    changed_graph.nodes.append(
        GraphNode(
            id="node_new_synthetic",
            table=removed.table,
            depth=removed.depth,
            identity={"synthetic_id": 999},
            attributes={"state": "new"},
        )
    )
    after = capture_snapshot(changed_graph)

    diff = compare_snapshots(before, after)

    assert diff.added_node_ids == ["node_new_synthetic"]
    assert diff.removed_node_ids == [removed.id]
    assert diff.changed_nodes[0].fields[0].field == "synthetic_state"
