import type { ChangeState, TraceGraph } from '../explorer/types'

export type GraphChanges = {
  nodes: Map<string, ChangeState>
  edges: Map<string, ChangeState>
  added: number
  changed: number
  removed: number
}

export function graphChanges(previous: TraceGraph | null, current: TraceGraph): GraphChanges {
  const nodes = new Map<string, ChangeState>()
  const edges = new Map<string, ChangeState>()
  if (!previous) {
    current.nodes.forEach((item) => nodes.set(item.id, 'unchanged'))
    current.edges.forEach((item) => edges.set(item.id, 'unchanged'))
    return { nodes, edges, added: 0, changed: 0, removed: 0 }
  }

  const beforeNodes = new Map(previous.nodes.map((item) => [item.id, item]))
  const currentNodeIds = new Set(current.nodes.map((item) => item.id))
  let added = 0
  let changed = 0
  current.nodes.forEach((item) => {
    const before = beforeNodes.get(item.id)
    if (!before) {
      nodes.set(item.id, 'added')
      added += 1
    } else if (JSON.stringify(before.attributes) !== JSON.stringify(item.attributes)) {
      nodes.set(item.id, 'changed')
      changed += 1
    } else {
      nodes.set(item.id, 'unchanged')
    }
  })
  const removed = previous.nodes.filter((item) => !currentNodeIds.has(item.id)).length

  const beforeEdges = new Set(previous.edges.map((item) => item.id))
  current.edges.forEach((item) => edges.set(item.id, beforeEdges.has(item.id) ? 'unchanged' : 'added'))
  return { nodes, edges, added, changed, removed }
}

