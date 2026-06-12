import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { demoJourney } from './demoJourney'
import { Timeline } from './Timeline'

describe('Timeline', () => {
  it('exposes replay stages and selection', async () => {
    const select = vi.fn()
    render(
      <Timeline
        stages={demoJourney}
        currentIndex={0}
        playing={false}
        onSelect={select}
        onTogglePlay={() => undefined}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Show Carrier scan observed' }))
    expect(select).toHaveBeenCalledWith(3)
    expect(screen.getByRole('button', { name: 'Play replay' })).toBeVisible()
  })
})

