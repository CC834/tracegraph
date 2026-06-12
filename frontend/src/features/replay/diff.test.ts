import { describe, expect, it } from 'vitest'
import { demoJourney } from './demoJourney'
import { graphChanges } from './diff'

describe('graphChanges', () => {
  it('labels new and changed records between stages', () => {
    const changes = graphChanges(demoJourney[2].graph, demoJourney[3].graph)

    expect(changes.added).toBe(1)
    expect(changes.changed).toBe(2)
    expect(changes.nodes.get('event-5001')).toBe('added')
    expect(changes.nodes.get('shipment-4001')).toBe('changed')
    expect(changes.nodes.get('order-1001')).toBe('changed')
  })

  it('treats the first stage as a baseline', () => {
    const changes = graphChanges(null, demoJourney[0].graph)

    expect(changes.added).toBe(0)
    expect([...changes.nodes.values()].every((state) => state === 'unchanged')).toBe(true)
  })
})

