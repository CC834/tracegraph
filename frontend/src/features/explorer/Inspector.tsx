import type { GraphNode, GraphSelection, TraceGraph } from './types'

type InspectorProps = {
  selection: GraphSelection
  graph: TraceGraph
}

function display(value: unknown): string {
  if (value === null) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function nodeLabel(node: GraphNode | undefined): string {
  if (!node) return 'Unknown record'
  const identity = Object.values(node.identity).map(display).join(', ')
  return `${node.table.table_name} [${identity}]`
}

function InspectorTable({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="property-table">
      {Object.entries(values).map(([key, value]) => (
        <div className="property-row" key={key}>
          <dt>{key}</dt>
          <dd className={value === '<redacted>' ? 'redacted' : ''}>{display(value)}</dd>
        </div>
      ))}
    </div>
  )
}

export function Inspector({ selection, graph }: InspectorProps) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  return (
    <aside className="inspector panel">
      <div className="panel-titlebar">
        <h2>Inspector</h2>
      </div>

      {!selection && (
        <div className="inspector-empty">
          <strong>No graph element selected</strong>
          <p>Select a record or relationship to inspect its technical properties.</p>
        </div>
      )}

      {selection?.kind === 'node' && (
        <div className="inspector-content">
          <div className="inspector-object-header">
            <span className="object-kind">Record</span>
            <h3>{selection.node.table.table_name}</h3>
            <code>{selection.node.id}</code>
          </div>

          <section className="inspector-section">
            <h4>Metadata</h4>
            <dl className="property-table">
              <div className="property-row"><dt>Schema</dt><dd>{selection.node.table.schema_name || 'default'}</dd></div>
              <div className="property-row"><dt>Traversal depth</dt><dd>{selection.node.depth}</dd></div>
              <div className="property-row"><dt>Relationships</dt><dd>{graph.edges.filter((edge) => edge.source === selection.node.id || edge.target === selection.node.id).length}</dd></div>
            </dl>
          </section>

          <section className="inspector-section">
            <h4>Record identity</h4>
            <dl><InspectorTable values={selection.node.identity} /></dl>
          </section>

          <section className="inspector-section">
            <h4>Fields</h4>
            <dl><InspectorTable values={selection.node.attributes} /></dl>
          </section>
        </div>
      )}

      {selection?.kind === 'edge' && (
        <div className="inspector-content">
          <div className="inspector-object-header">
            <span className={`object-kind relationship-${selection.edge.evidence.kind}`}>
              {selection.edge.evidence.kind === 'foreign_key' ? 'Declared relationship' : 'Inferred relationship'}
            </span>
            <h3>{selection.edge.evidence.constraint_name || 'Column match'}</h3>
            <code>{selection.edge.id}</code>
          </div>

          <section className="inspector-section">
            <h4>Endpoints</h4>
            <dl className="property-table">
              <div className="property-row"><dt>Source</dt><dd>{nodeLabel(nodes.get(selection.edge.source))}</dd></div>
              <div className="property-row"><dt>Target</dt><dd>{nodeLabel(nodes.get(selection.edge.target))}</dd></div>
            </dl>
          </section>

          <section className="inspector-section">
            <h4>Evidence</h4>
            <dl className="property-table">
              <div className="property-row"><dt>Type</dt><dd>{selection.edge.evidence.kind}</dd></div>
              <div className="property-row"><dt>Direction</dt><dd>{selection.edge.evidence.direction}</dd></div>
              <div className="property-row"><dt>Local columns</dt><dd>{selection.edge.evidence.local_columns.join(', ')}</dd></div>
              <div className="property-row"><dt>Remote columns</dt><dd>{selection.edge.evidence.remote_columns.join(', ')}</dd></div>
            </dl>
          </section>
        </div>
      )}

      <div className="inspector-safety">
        <span className="state-indicator success" />
        Read-only view. Secret-like fields are redacted before rendering.
      </div>
    </aside>
  )
}

