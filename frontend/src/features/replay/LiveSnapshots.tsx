import type { TraceGraph } from '../explorer/types'

export type LocalSnapshot = {
  id: string
  capturedAt: Date
  graph: TraceGraph
}

type LiveSnapshotsProps = {
  snapshots: LocalSnapshot[]
  onCapture: () => void
  onSelect: (snapshot: LocalSnapshot) => void
}

export function LiveSnapshots({ snapshots, onCapture, onSelect }: LiveSnapshotsProps) {
  return (
    <section className="history-panel panel" aria-label="Captured trace snapshots">
      <div className="history-header">
        <div>
          <h2>Snapshot history</h2>
          <span>{snapshots.length ? `${snapshots.length} captured` : 'No baseline captured'}</span>
        </div>
        <button className="tool-button" onClick={onCapture}>Capture snapshot</button>
      </div>
      <p className="history-guidance">Capture the same trace at different times to compare record and relationship changes.</p>
      <ol className="history-list snapshot-list" aria-label="Captured snapshots">
        {snapshots.map((snapshot, index) => (
          <li key={snapshot.id}>
            <button className="history-row" onClick={() => onSelect(snapshot)}>
              <span>#{String(index + 1).padStart(2, '0')}</span>
              <time>{snapshot.capturedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              <strong>{snapshot.graph.nodes.length} records · {snapshot.graph.edges.length} relationships</strong>
              <i>CAPTURED</i>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
