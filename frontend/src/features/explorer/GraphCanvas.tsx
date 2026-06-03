import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { useEffect, useRef } from 'react'
import type { ChangeState, GraphNode, TraceGraph } from './types'

type GraphCanvasProps = {
  graph: TraceGraph
  changes: Map<string, ChangeState>
  selectedNodeId: string | null
  onSelectNode: (node: GraphNode | null) => void
  onReady: (instance: Core) => void
}

const palette = ['#56d6c9', '#ffbe5c', '#7ca8ff', '#ca8cff', '#ff788a', '#8ed174', '#5fd0ff']

function tableColor(table: string): string {
  let hash = 0
  for (const character of table) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return palette[Math.abs(hash) % palette.length]
}

export function GraphCanvas({
  graph,
  changes,
  selectedNodeId,
  onSelectNode,
  onReady,
}: GraphCanvasProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const elements: ElementDefinition[] = [
      ...graph.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.table.table_name,
          identity: Object.values(node.identity).join(' · '),
          color: tableColor(node.table.table_name),
        },
        classes: changes.get(node.id) || 'unchanged',
      })),
      ...graph.edges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.evidence.kind === 'foreign_key' ? 'declared' : 'inferred',
        },
        classes: `${edge.evidence.kind} ${changes.get(edge.id) || 'unchanged'}`,
      })),
    ]
    const instance = cytoscape({
      container: container.current,
      elements,
      minZoom: 0.35,
      maxZoom: 2.2,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.14,
            'border-color': 'data(color)',
            'border-width': 1.5,
            color: '#e9f3f8',
            label: 'data(label)',
            'font-family': 'IBM Plex Mono, monospace',
            'font-size': 10,
            'font-weight': 600,
            'text-margin-y': -2,
            'text-valign': 'top',
            width: 54,
            height: 54,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'overlay-color': '#56d6c9',
            'overlay-opacity': 0.12,
            'overlay-padding': 8,
          },
        },
        {
          selector: 'node.added',
          style: {
            'border-color': '#62e6a7',
            'border-width': 4,
            'background-color': '#62e6a7',
            'background-opacity': 0.28,
          },
        },
        {
          selector: 'node.changed',
          style: {
            'border-color': '#ffbe5c',
            'border-width': 4,
            'background-color': '#ffbe5c',
            'background-opacity': 0.25,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.4,
            'line-color': '#456070',
            'target-arrow-color': '#456070',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.7,
            opacity: 0.8,
          },
        },
        {
          selector: 'edge.column_match',
          style: { 'line-style': 'dashed', 'line-color': '#ca8cff', 'target-arrow-color': '#ca8cff' },
        },
        {
          selector: 'edge.added',
          style: { width: 3, 'line-color': '#62e6a7', 'target-arrow-color': '#62e6a7' },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 650,
        fit: true,
        padding: 42,
        nodeRepulsion: () => 9000,
        idealEdgeLength: () => 120,
      },
    })
    instance.on('tap', 'node', (event) => {
      const selected = graph.nodes.find((node) => node.id === event.target.id()) || null
      onSelectNode(selected)
    })
    instance.on('tap', (event) => {
      if (event.target === instance) onSelectNode(null)
    })
    if (selectedNodeId) instance.getElementById(selectedNodeId).select()
    onReady(instance)
    return () => instance.destroy()
  }, [graph, changes, onReady, onSelectNode, selectedNodeId])

  return <div className="graph-canvas" ref={container} aria-label="Record relationship graph" />
}

