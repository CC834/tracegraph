from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from tracegraph.models import (
    FieldChange,
    NodeChange,
    SnapshotDiff,
    TraceGraph,
    TraceSnapshot,
)


def capture_snapshot(graph: TraceGraph) -> TraceSnapshot:
    return TraceSnapshot(id=str(uuid4()), captured_at=datetime.now(UTC), graph=graph)


def compare_snapshots(before: TraceSnapshot, after: TraceSnapshot) -> SnapshotDiff:
    before_nodes = {node.id: node for node in before.graph.nodes}
    after_nodes = {node.id: node for node in after.graph.nodes}
    shared_node_ids = sorted(before_nodes.keys() & after_nodes.keys())

    changed_nodes: list[NodeChange] = []
    for node_id in shared_node_ids:
        before_attributes = before_nodes[node_id].attributes
        after_attributes = after_nodes[node_id].attributes
        fields = []
        for field in sorted(before_attributes.keys() | after_attributes.keys()):
            old_value = before_attributes.get(field)
            new_value = after_attributes.get(field)
            if old_value != new_value:
                fields.append(FieldChange(field=field, before=old_value, after=new_value))
        if fields:
            changed_nodes.append(NodeChange(node_id=node_id, fields=fields))

    before_edges = {edge.id for edge in before.graph.edges}
    after_edges = {edge.id for edge in after.graph.edges}
    return SnapshotDiff(
        before_id=before.id,
        after_id=after.id,
        added_node_ids=sorted(after_nodes.keys() - before_nodes.keys()),
        removed_node_ids=sorted(before_nodes.keys() - after_nodes.keys()),
        changed_nodes=changed_nodes,
        added_edge_ids=sorted(after_edges - before_edges),
        removed_edge_ids=sorted(before_edges - after_edges),
    )
