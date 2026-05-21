export type TableRef = {
  schema_name?: string | null
  table_name: string
}

export type ColumnInfo = {
  name: string
  data_type: string
  nullable: boolean
  primary_key: boolean
}

export type ForeignKeyInfo = {
  name?: string | null
  local_columns: string[]
  referred_table: TableRef
  referred_columns: string[]
}

export type TableInfo = {
  ref: TableRef
  columns: ColumnInfo[]
  primary_key: string[]
  foreign_keys: ForeignKeyInfo[]
}

export type SchemaCatalog = {
  dialect: string
  tables: TableInfo[]
  truncated: boolean
}

export type EdgeEvidence = {
  kind: 'foreign_key' | 'column_match'
  direction: 'outgoing' | 'incoming' | 'inferred'
  local_columns: string[]
  remote_columns: string[]
  constraint_name?: string | null
}

export type GraphNode = {
  id: string
  table: TableRef
  depth: number
  identity: Record<string, unknown>
  attributes: Record<string, unknown>
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  evidence: EdgeEvidence
}

export type TraceGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: {
    dialect: string
    started_from: TableRef
    truncated: boolean
    warnings: string[]
  }
}

export type TraceRequest = {
  seed: {
    table: TableRef
    column: string
    value: string
  }
  options: {
    relationship_mode: 'declared' | 'declared_and_inferred'
    follow_columns: string[]
    max_depth: number
    max_rows_per_table: number
    max_nodes: number
  }
}

export type ChangeState = 'added' | 'removed' | 'changed' | 'unchanged'

