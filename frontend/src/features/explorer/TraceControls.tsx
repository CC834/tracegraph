import type { FormEvent } from 'react'
import type { SchemaCatalog, TraceRequest } from './types'

type TraceControlsProps = {
  catalog: SchemaCatalog
  request: TraceRequest
  disabled: boolean
  onChange: (request: TraceRequest) => void
  onSubmit: () => void
}

export function TraceControls({ catalog, request, disabled, onChange, onSubmit }: TraceControlsProps) {
  const selectedTable = catalog.tables.find(
    (table) => table.ref.table_name === request.seed.table.table_name,
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="trace-controls" onSubmit={submit}>
      <label>
        <span>Seed table</span>
        <select
          value={request.seed.table.table_name}
          disabled={disabled}
          onChange={(event) => {
            const table = catalog.tables.find((item) => item.ref.table_name === event.target.value)!
            onChange({
              ...request,
              seed: {
                ...request.seed,
                table: table.ref,
                column: table.primary_key[0] || table.columns[0]?.name || '',
              },
            })
          }}
        >
          {catalog.tables.map((table) => (
            <option key={`${table.ref.schema_name || ''}.${table.ref.table_name}`}>
              {table.ref.table_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Seed column</span>
        <select
          value={request.seed.column}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...request, seed: { ...request.seed, column: event.target.value } })
          }
        >
          {selectedTable?.columns.map((column) => (
            <option key={column.name}>{column.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Record value</span>
        <input
          value={request.seed.value}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...request, seed: { ...request.seed, value: event.target.value } })
          }
        />
      </label>
      <label>
        <span>Traversal depth · {request.options.max_depth}</span>
        <input
          type="range"
          min="1"
          max="6"
          value={request.options.max_depth}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...request,
              options: { ...request.options, max_depth: Number(event.target.value) },
            })
          }
        />
      </label>
      <button className="primary-button" type="submit" disabled={disabled || !request.seed.value}>
        Run record trace <span>→</span>
      </button>
    </form>
  )
}

