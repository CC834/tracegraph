import type { FormEvent } from 'react'
import type { SchemaCatalog, TableRef, TraceRequest } from './types'

type TraceControlsProps = {
  catalog: SchemaCatalog
  request: TraceRequest
  disabled: boolean
  onChange: (request: TraceRequest) => void
  onSubmit: () => void
}

function tableKey(ref: TableRef): string {
  return ref.schema_name ? `${ref.schema_name}.${ref.table_name}` : ref.table_name
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function TraceControls({ catalog, request, disabled, onChange, onSubmit }: TraceControlsProps) {
  const selectedTable = catalog.tables.find(
    (table) => tableKey(table.ref) === tableKey(request.seed.table),
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="trace-controls" onSubmit={submit}>
      <section className="control-section" aria-labelledby="seed-heading">
        <h2 id="seed-heading">Seed record</h2>
        <label>
          <span>Table</span>
          <select
            value={tableKey(request.seed.table)}
            disabled={disabled}
            onChange={(event) => {
              const table = catalog.tables.find((item) => tableKey(item.ref) === event.target.value)
              if (!table) return
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
              <option key={tableKey(table.ref)} value={tableKey(table.ref)}>
                {tableKey(table.ref)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Column</span>
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
          <span>Value</span>
          <input
            className="technical-input"
            value={request.seed.value}
            disabled={disabled}
            spellCheck={false}
            onChange={(event) =>
              onChange({ ...request, seed: { ...request.seed, value: event.target.value } })
            }
          />
        </label>
      </section>

      <section className="control-section" aria-labelledby="relationship-heading">
        <h2 id="relationship-heading">Relationships</h2>
        <label>
          <span>Mode</span>
          <select
            value={request.options.relationship_mode}
            disabled={disabled}
            onChange={(event) => {
              const mode = event.target.value as TraceRequest['options']['relationship_mode']
              onChange({
                ...request,
                options: {
                  ...request.options,
                  relationship_mode: mode,
                  follow_columns:
                    mode === 'declared_and_inferred' && request.options.follow_columns.length === 0
                      ? [request.seed.column]
                      : request.options.follow_columns,
                },
              })
            }}
          >
            <option value="declared">Declared foreign keys</option>
            <option value="declared_and_inferred">Declared + inferred matches</option>
          </select>
        </label>
        <label>
          <span>Inference columns</span>
          <input
            className="technical-input"
            value={request.options.follow_columns.join(', ')}
            disabled={disabled || request.options.relationship_mode === 'declared'}
            placeholder="order_id, customer_id"
            spellCheck={false}
            onChange={(event) =>
              onChange({
                ...request,
                options: {
                  ...request.options,
                  follow_columns: event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                },
              })
            }
          />
          <small>Comma-separated, same-name columns only.</small>
        </label>
      </section>

      <details className="advanced-settings" open>
        <summary>Traversal limits</summary>
        <div className="limit-grid">
          <label>
            <span>Max depth</span>
            <input
              type="number"
              min="1"
              max="8"
              value={request.options.max_depth}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...request,
                  options: {
                    ...request.options,
                    max_depth: numericValue(event.target.value, request.options.max_depth),
                  },
                })
              }
            />
          </label>
          <label>
            <span>Rows / table</span>
            <input
              type="number"
              min="1"
              max="1000"
              value={request.options.max_rows_per_table}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...request,
                  options: {
                    ...request.options,
                    max_rows_per_table: numericValue(
                      event.target.value,
                      request.options.max_rows_per_table,
                    ),
                  },
                })
              }
            />
          </label>
          <label>
            <span>Max nodes</span>
            <input
              type="number"
              min="10"
              max="10000"
              step="10"
              value={request.options.max_nodes}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...request,
                  options: {
                    ...request.options,
                    max_nodes: numericValue(event.target.value, request.options.max_nodes),
                  },
                })
              }
            />
          </label>
        </div>
      </details>

      <button className="run-trace-button" type="submit" disabled={disabled || !request.seed.value}>
        Run Trace
      </button>
    </form>
  )
}

