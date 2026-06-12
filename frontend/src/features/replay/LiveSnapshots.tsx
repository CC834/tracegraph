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
    <section className="timeline live-snapshots panel" aria-label="Captured trace snapshots">
      <div className="timeline-copy">
        <span className="eyebrow">Local investigation</span>
        <h2>{snapshots.length ? `${snapshots.length} snapshots captured` : 'Capture a baseline'}</h2>
        <p>Run the same trace later, capture it again, then inspect what changed.</p>
      </div>
      <button className="primary-button capture-button" onClick={onCapture}>
        Capture snapshot
      </button>
      <div className="snapshot-list">
        {snapshots.map((snapshot, index) => (
          <button key={snapshot.id} onClick={() => onSelect(snapshot)}>
            <span>#{String(index + 1).padStart(2, '0')}</span>
            <strong>{snapshot.capturedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
          </button>
        ))}
      </div>
    </section>
  )
}

