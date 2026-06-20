import type { Core } from 'cytoscape'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { config } from './config'
import { fetchSchema, runTrace } from './features/explorer/api'
import { GraphCanvas } from './features/explorer/GraphCanvas'
import { Inspector } from './features/explorer/Inspector'
import { TraceControls } from './features/explorer/TraceControls'
import type { GraphNode, SchemaCatalog, TraceGraph, TraceRequest } from './features/explorer/types'
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

export function App() {
  const [catalog, setCatalog] = useState<SchemaCatalog>(demoCatalog)
  const [traceRequest, setTraceRequest] = useState(initialRequest)
  const [view, setView] = useState<'journey' | 'live'>('journey')
  const [journeyIndex, setJourneyIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [liveGraph, setLiveGraph] = useState<TraceGraph | null>(null)
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
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

  const visibleSelectedNode = selectedNode && graph.nodes.some((node) => node.id === selectedNode.id)
    ? selectedNode
    : null

  const selectNode = useCallback((node: GraphNode | null) => setSelectedNode(node), [])
  const graphReady = useCallback((instance: Core) => {
    graphInstance.current = instance
  }, [])

  async function executeTrace() {
    setLoading(true)
    setError(null)
    try {
      const result = await runTrace(traceRequest)
      setLiveGraph(result)
      setView('live')
      setPlaying(false)
      setSelectedNode(null)
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
    const dataUrl = graphInstance.current?.png({ full: true, scale: 2, bg: '#081017' })
    if (!dataUrl) return
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = 'tracegraph-record-journey.png'
    anchor.click()
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="./" aria-label="TraceGraph home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>TRACE</strong>GRAPH</span>
        </a>
        <p>Data archaeology for undocumented relational systems</p>
        <div className="topbar-actions">
          <span className="mode-badge"><span className="status-dot" />{config.demoOnly ? 'Synthetic public demo' : `${catalog.dialect} · local only`}</span>
          <button onClick={() => download('tracegraph.json', JSON.stringify(graph, null, 2), 'application/json')}>JSON</button>
          <button onClick={exportPng}>PNG</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar panel">
          <div className="panel-heading"><span className="eyebrow">Investigation setup</span><span className="panel-index">01</span></div>
          <h1>Follow one record.<br /><em>Reveal the system.</em></h1>
          <p className="intro">Trace declared relationships, compare database states, and explain how operational records move through an unfamiliar schema.</p>
          <div className="view-switch" role="group" aria-label="Visualization source">
            <button className={view === 'journey' ? 'active' : ''} onClick={() => setView('journey')}>Guided journey</button>
            <button className={view === 'live' ? 'active' : ''} disabled={config.demoOnly || !liveGraph} onClick={() => setView('live')}>Local trace</button>
          </div>
          <TraceControls catalog={catalog} request={traceRequest} disabled={config.demoOnly || loading} onChange={setTraceRequest} onSubmit={executeTrace} />
          {config.demoOnly && <p className="demo-explanation">The hosted build is intentionally synthetic. Clone the project to connect a read-only SQLite or PostgreSQL database.</p>}
          {error && <div className="error-message" role="alert">{error}</div>}
        </aside>

        <section className="graph-panel panel">
          <div className="graph-toolbar">
            <div>
              <span className="eyebrow">Record lineage map</span>
              <strong>{view === 'journey' ? demoJourney[journeyIndex].title : traceRequest.seed.table.table_name}</strong>
            </div>
            <div className="legend"><span className="declared" />Declared FK <span className="inferred" />Inferred match</div>
          </div>
          {loading ? <div className="loading-state"><span /><p>Inspecting schema…</p></div> : <GraphCanvas graph={graph} changes={changes.nodes} selectedNodeId={visibleSelectedNode?.id || null} onSelectNode={selectNode} onReady={graphReady} />}
          <div className="metrics">
            <div><span>Records</span><strong>{graph.nodes.length}</strong></div>
            <div><span>Relationships</span><strong>{graph.edges.length}</strong></div>
            <div><span>Tables reached</span><strong>{tableCount}</strong></div>
            <div className="change-metric"><span>This snapshot</span><strong><i>+{changes.added}</i> <b>~{changes.changed}</b></strong></div>
          </div>
          {graph.metadata.truncated && <div className="warning-banner">Trace limits were reached. The visible graph is intentionally bounded.</div>}
        </section>

        <Inspector node={visibleSelectedNode} />
      </section>

      {view === 'journey' ? (
        <Timeline stages={demoJourney} currentIndex={journeyIndex} playing={playing} onSelect={(index) => { setJourneyIndex(index); setPlaying(false) }} onTogglePlay={() => setPlaying((value) => !value)} />
      ) : (
        <LiveSnapshots snapshots={snapshots} onCapture={capture} onSelect={(snapshot) => setLiveGraph(snapshot.graph)} />
      )}

      <footer>
        <span>TRACEGRAPH / PUBLIC SYNTHETIC DATA</span>
        <p>Built to make relational evidence visible—without sending your database anywhere.</p>
        <span>READ-ONLY BY DESIGN</span>
      </footer>
    </main>
  )
}
