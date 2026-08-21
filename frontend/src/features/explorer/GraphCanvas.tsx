import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { useEffect, useRef } from 'react'
import type { ChangeState, GraphSelection, TraceGraph } from './types'

type GraphCanvasProps = {
  graph: TraceGraph
  nodeChanges: Map<string, ChangeState>
  edgeChanges: Map<string, ChangeState>
  selectedElementId: string | null
  onSelect: (selection: GraphSelection) => void
  onReady: (instance: Core) => void
}

function recordLabel(table: string, identity: Record<string, unknown>): string {
  const [key, value] = Object.entries(identity)[0] || ['record', 'unknown']
  return `${table}\n${key} = ${String(value)}`
}

export function GraphCanvas({
  graph,
  nodeChanges,
  edgeChanges,
  selectedElementId,
  onSelect,
  onReady,
}: GraphCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const graphInstance = useRef<Core | null>(null)

  useEffect(() => {
    if (!container.current) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elements: ElementDefinition[] = [
      ...graph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: recordLabel(node.table.table_name, node.identity),
        },
        classes: nodeChanges.get(node.id) || 'unchanged',
      })),
      ...graph.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        },
        classes: `${edge.evidence.kind} ${edgeChanges.get(edge.id) || 'unchanged'}`,
      })),
    ]
    const instance = cytoscape({
      container: container.current,
      elements,
      minZoom: 0.25,
      maxZoom: 2.5,
      wheelSensitivity: 0.18,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'roundrectangle',
            width: 142,
            height: 48,
            'background-color': '#ffffff',
            'border-color': '#aeb4bc',
            'border-width': 1,
            color: '#26313a',
            label: 'data(label)',
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            'font-size': 10,
            'font-weight': 500,
            'line-height': 1.35,
            'text-wrap': 'wrap',
            'text-max-width': '124px',
            'text-halign': 'center',
            'text-valign': 'center',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#e4effd',
            'border-color': '#2f6fca',
            'border-width': 2,
            color: '#16273d',
          },
        },
        {
          selector: 'node.added',
          style: {
            'border-color': '#35844f',
            'border-width': 2,
          },
        },
        {
          selector: 'node.changed',
          style: {
            'border-color': '#a97018',
            'border-width': 2,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.25,
            'line-color': '#7c858f',
            'target-arrow-color': '#7c858f',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.72,
            opacity: 0.9,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 2.5,
            'line-color': '#2f6fca',
            'target-arrow-color': '#2f6fca',
          },
        },
        {
          selector: 'edge.column_match',
          style: {
            'line-style': 'dashed',
            'line-color': '#a97018',
            'target-arrow-color': '#a97018',
          },
        },
        {
          selector: 'edge.added',
          style: {
            width: 2,
            'line-color': '#35844f',
            'target-arrow-color': '#35844f',
          },
        },
      ],
      layout: {
        name: 'breadthfirst',
        animate: !reduceMotion,
        animationDuration: 180,
        roots: graph.nodes.filter((node) => node.depth === 0).map((node) => node.id),
        directed: false,
        circle: false,
        grid: true,
        spacingFactor: 1.2,
        fit: true,
        padding: 42,
      },
    })
    instance.on('tap', 'node', (event) => {
      const node = graph.nodes.find((item) => item.id === event.target.id())
      onSelect(node ? { kind: 'node', node } : null)
    })
    instance.on('tap', 'edge', (event) => {
      const edge = graph.edges.find((item) => item.id === event.target.id())
      onSelect(edge ? { kind: 'edge', edge } : null)
    })
    instance.on('tap', (event) => {
      if (event.target === instance) onSelect(null)
    })
    graphInstance.current = instance
    onReady(instance)
    return () => {
      graphInstance.current = null
      instance.destroy()
    }
  }, [edgeChanges, graph, nodeChanges, onReady, onSelect])

  useEffect(() => {
    const instance = graphInstance.current
    if (!instance) return
    instance.elements().unselect()
    if (selectedElementId) instance.getElementById(selectedElementId).select()
  }, [graph, selectedElementId])

  return <div className="graph-canvas" ref={container} aria-label="Record relationship graph" />
}
