import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { demoCatalog } from '../replay/demoJourney'
import type { TraceRequest } from './types'
import { TraceControls } from './TraceControls'

const request: TraceRequest = {
  seed: { table: { table_name: 'orders' }, column: 'order_id', value: '1001' },
  options: {
    relationship_mode: 'declared',
    follow_columns: [],
    max_depth: 3,
    max_rows_per_table: 50,
    max_nodes: 500,
  },
}

describe('TraceControls', () => {
  it('exposes the complete trace request and enables inferred evidence explicitly', async () => {
    const onChange = vi.fn()
    render(
      <TraceControls
        catalog={demoCatalog}
        request={request}
        disabled={false}
        onChange={onChange}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByLabelText('Max depth')).toHaveValue(3)
    expect(screen.getByLabelText('Rows / table')).toHaveValue(50)
    expect(screen.getByLabelText('Max nodes')).toHaveValue(500)

    await userEvent.selectOptions(screen.getByLabelText('Mode'), 'declared_and_inferred')

    expect(onChange).toHaveBeenCalledWith({
      ...request,
      options: {
        ...request.options,
        relationship_mode: 'declared_and_inferred',
        follow_columns: ['order_id'],
      },
    })
  })
})
