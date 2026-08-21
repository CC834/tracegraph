import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { demoJourney } from '../replay/demoJourney'
import { Inspector } from './Inspector'

const graph = demoJourney.at(-1)!.graph

describe('Inspector', () => {
  it('shows record fields and marks redacted values', () => {
    const payment = graph.nodes.find((node) => node.table.table_name === 'payments')!

    render(<Inspector selection={{ kind: 'node', node: payment }} graph={graph} />)

    expect(screen.getByRole('heading', { name: 'payments' })).toBeVisible()
    expect(screen.getByText('provider_token')).toBeVisible()
    expect(screen.getByText('<redacted>')).toHaveClass('redacted')
  })

  it('shows relationship endpoints and evidence', () => {
    const relationship = graph.edges[0]

    render(<Inspector selection={{ kind: 'edge', edge: relationship }} graph={graph} />)

    expect(screen.getByText('Declared relationship')).toBeVisible()
    expect(screen.getByText('foreign_key')).toBeVisible()
    expect(screen.getByText('Source')).toBeVisible()
    expect(screen.getByText('Target')).toBeVisible()
  })
})
