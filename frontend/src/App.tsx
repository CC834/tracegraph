import type { Core } from 'cytoscape'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from './config'
import { fetchSchema, runTrace } from './features/explorer/api'
import { GraphCanvas } from './features/explorer/GraphCanvas'
import { Inspector } from './features/explorer/Inspector'
import { TraceControls } from './features/explorer/TraceControls'
import type { GraphSelection, SchemaCatalog, TraceGraph, TraceRequest } from './features/explorer/types'
import { demoCatalog, demoJourney } from './features/replay/demoJourney'
import { graphChanges } from './features/replay/diff'
import { type LocalSnapshot, LiveSnapshots } from './features/replay/LiveSnapshots'
import { Timeline } from './features/replay/Timeline'

const initialRequest: TraceRequest = {
  seed: { table: { table_name: 'orders' }, column: 'order_id', value: '1001' },
  options: {
    relationship_mode: 'declared',
    follow_columns: [],
    max_depth: 3,
    max_rows_per_table: 50,
    max_nodes: 500,
  },
}

function download(name: string, body: string, type: string) {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(new Blob([body], { type }))
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

function selectionExists(selection: GraphSelection, graph: TraceGraph): GraphSelection {
  if (selection?.kind === 'node') {
    return graph.nodes.some((node) => node.id === selection.node.id) ? selection : null
  }
  if (selection?.kind === 'edge') {
    return graph.edges.some((edge) => edge.id === selection.edge.id) ? selection : null
  }
  return null
}

export function App() {
  const [catalog, setCatalog] = useState<SchemaCatalog>(demoCatalog)
  const [traceRequest, setTraceRequest] = useState(initialRequest)
  const [view, setView] = useState<'journey' | 'live'>('journey')
  const [journeyIndex, setJourneyIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [liveGraph, setLiveGraph] = useState<TraceGraph | null>(null)
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([])
  const [selection, setSelection] = useState<GraphSelection>(null)
  const [executionMs, setExecutionMs] = useState<number | null>(null)
  const [loading, setLoading] = useState(!config.demoOnly)
  const [error, setError] = useState<string | null>(null)
  const graphInstance = useRef<Core | null>(null)

  useEffect(() => {
    if (config.demoOnly) return
    fetchSchema()
      .then((schema) => {
        setCatalog(schema)
        const orders = schema.tables.find((table) => table.ref.table_name === 'orders')
        const first = orders || schema.tables[0]
        if (first) {
          setTraceRequest((current) => ({
            ...current,
            seed: {
              table: first.ref,
              column: first.primary_key[0] || first.columns[0]?.name || '',
              value: orders ? '1001' : '',
            },
          }))
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load schema'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!playing || view !== 'journey') return
    const timer = window.setInterval(
      () => setJourneyIndex((index) => (index + 1) % demoJourney.length),
      2300,
    )
    return () => window.clearInterval(timer)
  }, [playing, view])

  const graph = view === 'journey' ? demoJourney[journeyIndex].graph : liveGraph || demoJourney[0].graph
  const previousGraph = useMemo(() => {
    if (view === 'journey') return journeyIndex > 0 ? demoJourney[journeyIndex - 1].graph : null
    return snapshots.at(-1)?.graph || null
  }, [journeyIndex, snapshots, view])
  const changes = useMemo(() => graphChanges(previousGraph, graph), [graph, previousGraph])
  const tableCount = new Set(graph.nodes.map((node) => node.table.table_name)).size
  const visibleSelection = selectionExists(selection, graph)
  const selectedElementId = visibleSelection?.kind === 'node'
    ? visibleSelection.node.id
    : visibleSelection?.kind === 'edge'
      ? visibleSelection.edge.id
      : null
  const traceContext = view === 'journey'
    ? `${demoJourney[journeyIndex].time} / ${demoJourney[journeyIndex].title}`
    : `${traceRequest.seed.table.table_name}.${traceRequest.seed.column} = ${traceRequest.seed.value}`
  const depth = Math.max(0, ...graph.nodes.map((node) => node.depth))

  const selectGraphElement = useCallback((nextSelection: GraphSelection) => setSelection(nextSelection), [])
  const graphReady = useCallback((instance: Core) => {
    graphInstance.current = instance
  }, [])

  async function executeTrace() {
    setLoading(true)
    setError(null)
    const startedAt = performance.now()
    try {
      const result = await runTrace(traceRequest)
      setExecutionMs(performance.now() - startedAt)
      setLiveGraph(result)
      setView('live')
      setPlaying(false)
      setSelection(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The trace failed')
    } finally {
      setLoading(false)
    }
  }

  function capture() {
    if (!liveGraph) return
    setSnapshots((current) => [
      ...current,
      { id: crypto.randomUUID(), capturedAt: new Date(), graph: liveGraph },
    ])
  }

  function exportPng() {
    const dataUrl = graphInstance.current?.png({ full: true, scale: 2, bg: '#f5f6f7' })
    if (!dataUrl) return
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = 'tracegraph-record-lineage.png'
    anchor.click()
  }

  function zoomBy(factor: number) {
    const instance = graphInstance.current
    if (!instance) return
    instance.zoom({
      level: Math.min(2.5, Math.max(0.25, instance.zoom() * factor)),
      renderedPosition: { x: instance.width() / 2, y: instance.height() / 2 },
    })
  }

  function fitGraph() {
    graphInstance.current?.fit(undefined, 40)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="./" aria-label="TraceGraph home">TraceGraph</a>
        <span className="header-divider" />
        <span className="product-view">Record Lineage Explorer</span>
        <div className="header-state">
          <span><i className="state-indicator success" />{config.demoOnly ? 'Synthetic public demo' : `${catalog.dialect} · local database`}</span>
          <strong>READ ONLY</strong>
        </div>
      </header>

      <section className="workspace">
        <aside className="configuration-panel panel">
          <div className="panel-titlebar">
            <h2>Trace configuration</h2>
            <span>{catalog.dialect}</span>
          </div>
          <div className="source-tabs" role="group" aria-label="Visualization source">
            <button className={view === 'journey' ? 'active' : ''} onClick={() => { setView('journey'); setSelection(null) }}>Demo trace</button>
            <button className={view === 'live' ? 'active' : ''} disabled={config.demoOnly || !liveGraph} onClick={() => { setView('live'); setSelection(null) }}>Local trace</button>
          </div>
          <TraceControls
            catalog={catalog}
            request={traceRequest}
            disabled={config.demoOnly || loading}
            onChange={setTraceRequest}
            onSubmit={executeTrace}
          />
          {config.demoOnly && (
            <div className="inline-notice" role="note">
              <strong>Hosted demo</strong>
              <p>Synthetic data only. Run locally to inspect a read-only SQLite or PostgreSQL database.</p>
            </div>
          )}
          {error && <div className="error-message" role="alert">{error}</div>}
        </aside>

        <section className="graph-panel panel">
          <div className="graph-toolbar">
            <div className="trace-context">
              <span>Current trace</span>
              <code>{traceContext}</code>
            </div>
            <div className="toolbar-actions" aria-label="Graph actions">
              <button className="tool-button compact" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
              <button className="tool-button compact" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
              <button className="tool-button" onClick={fitGraph}>Fit</button>
              <span className="toolbar-divider" />
              <button className="tool-button" onClick={() => download('tracegraph.json', JSON.stringify(graph, null, 2), 'application/json')}>Export JSON</button>
              <button className="tool-button" onClick={exportPng}>Export PNG</button>
            </div>
          </div>
          <div className="graph-legend" aria-label="Relationship legend">
            <span><i className="legend-line declared" />Declared foreign key</span>
            <span><i className="legend-line inferred" />Inferred relationship</span>
            <span><i className="legend-box selected" />Selected</span>
            <span><i className="legend-box added" />New</span>
            <span><i className="legend-box changed" />Changed</span>
          </div>
          {loading ? (
            <div className="loading-state"><span /><p>Inspecting schema…</p></div>
          ) : (
            <GraphCanvas
              graph={graph}
              nodeChanges={changes.nodes}
              edgeChanges={changes.edges}
              selectedElementId={selectedElementId}
              onSelect={selectGraphElement}
              onReady={graphReady}
            />
          )}
          {graph.metadata.truncated && (
            <div className="warning-banner" role="status">Trace limits reached. Results are truncated to protect database performance.</div>
          )}
          <div className="graph-statusbar">
            <span><b>{graph.nodes.length}</b> records</span>
            <span><b>{graph.edges.length}</b> relationships</span>
            <span><b>{tableCount}</b> tables</span>
            <span>depth <b>{depth}</b></span>
            <span className="change-status"><i>+{changes.added}</i> <em>~{changes.changed}</em> −{changes.removed}</span>
            <span className={graph.metadata.truncated ? 'status-warning' : 'status-success'}>{graph.metadata.truncated ? 'TRUNCATED' : 'COMPLETE'}</span>
            <span className="status-duration">{executionMs === null || view === 'journey' ? 'demo dataset' : `${executionMs.toFixed(1)} ms`}</span>
          </div>
        </section>

        <Inspector selection={visibleSelection} graph={graph} />
      </section>

      {view === 'journey' ? (
        <Timeline
          stages={demoJourney}
          currentIndex={journeyIndex}
          playing={playing}
          onSelect={(index) => { setJourneyIndex(index); setPlaying(false); setSelection(null) }}
          onTogglePlay={() => setPlaying((value) => !value)}
        />
      ) : (
        <LiveSnapshots
          snapshots={snapshots}
          onCapture={capture}
          onSelect={(snapshot) => { setLiveGraph(snapshot.graph); setSelection(null) }}
        />
      )}

      <footer className="application-statusbar">
        <span><i className="state-indicator success" />Database access: read only</span>
        <span>Source: {config.demoOnly ? 'public synthetic dataset' : catalog.dialect}</span>
        <span>Relationship mode: {traceRequest.options.relationship_mode === 'declared' ? 'declared only' : 'declared + inferred'}</span>
        <span className="statusbar-spacer" />
        <span>{visibleSelection ? `${visibleSelection.kind} selected` : 'No selection'}</span>
      </footer>
    </main>
  )
}
