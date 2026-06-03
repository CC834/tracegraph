import type { GraphNode } from './types'

type InspectorProps = {
  node: GraphNode | null
}

function display(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function Inspector({ node }: InspectorProps) {
  return (
    <aside className="inspector panel">
      <div className="panel-heading">
        <span className="eyebrow">Evidence inspector</span>
        <span className="panel-index">03</span>
      </div>
      {node ? (
        <>
          <h2>{node.table.table_name}</h2>
          <p className="muted">Depth {node.depth} · {node.id.slice(0, 15)}</p>
          <div className="field-list">
            {Object.entries(node.attributes).map(([key, value]) => (
              <div className="field" key={key}>
                <span>{key}</span>
                <strong className={value === '<redacted>' ? 'redacted' : ''}>{display(value)}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-inspector">
          <span className="target-mark">⌖</span>
          <h2>Select a record</h2>
          <p>Inspect its identity, visible fields, and place in the trace.</p>
        </div>
      )}
      <div className="privacy-note">
        <span className="status-dot" />
        Secret-like columns are redacted before they reach this view.
      </div>
    </aside>
  )
}

