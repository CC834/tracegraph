import { config } from '../../config'
import type { SchemaCatalog, TraceGraph, TraceRequest } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function fetchSchema(): Promise<SchemaCatalog> {
  return request('/api/v1/schema')
}

export function runTrace(payload: TraceRequest): Promise<TraceGraph> {
  return request('/api/v1/traces', { method: 'POST', body: JSON.stringify(payload) })
}

