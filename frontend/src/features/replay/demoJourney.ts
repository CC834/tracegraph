import type {
  GraphEdge,
  GraphNode,
  SchemaCatalog,
  TableRef,
  TraceGraph,
} from '../explorer/types'

export type JourneyStage = {
  id: string
  title: string
  time: string
  description: string
  graph: TraceGraph
}

const ref = (table_name: string): TableRef => ({ table_name })

const node = (
  id: string,
  table: string,
  depth: number,
  identity: Record<string, unknown>,
  attributes: Record<string, unknown>,
): GraphNode => ({ id, table: ref(table), depth, identity, attributes })

const edge = (id: string, source: string, target: string, column: string): GraphEdge => ({
  id,
  source,
  target,
  evidence: {
    kind: 'foreign_key',
    direction: 'incoming',
    local_columns: [column],
    remote_columns: [column],
    constraint_name: `fk_demo_${id}`,
  },
})

const customer = node(
  'customer-1',
  'customers',
  1,
  { customer_id: 1 },
  { customer_id: 1, display_name: 'Avery Stone', email: 'avery@example.test' },
)

const order = (status: string): GraphNode =>
  node(
    'order-1001',
    'orders',
    0,
    { order_id: 1001 },
    {
      order_id: 1001,
      customer_id: 1,
      status,
      total_amount: '149.50',
      created_at: '2026-01-15T09:00:00Z',
    },
  )

const auditCreated = node(
  'audit-7001',
  'audit_events',
  1,
  { audit_id: 7001 },
  { audit_id: 7001, entity_type: 'order', entity_id: 1001, action: 'created' },
)
const itemLamp = node(
  'item-2001',
  'order_items',
  1,
  { item_id: 2001 },
  { item_id: 2001, order_id: 1001, sku: 'SYNTH-LAMP', quantity: 1 },
)
const itemBulbs = node(
  'item-2002',
  'order_items',
  1,
  { item_id: 2002 },
  { item_id: 2002, order_id: 1001, sku: 'SYNTH-BULB', quantity: 2 },
)
const payment = node(
  'payment-3001',
  'payments',
  1,
  { payment_id: 3001 },
  { payment_id: 3001, order_id: 1001, status: 'captured', provider_token: '<redacted>' },
)
const shipment = (status: string): GraphNode =>
  node(
    'shipment-4001',
    'shipments',
    1,
    { shipment_id: 4001 },
    { shipment_id: 4001, order_id: 1001, status, tracking_code: 'DEMO-TRACK-001' },
  )
const trackingEvent = node(
  'event-5001',
  'tracking_events',
  2,
  { event_id: 5001 },
  {
    event_id: 5001,
    shipment_id: 4001,
    event_type: 'carrier_scan',
    occurred_at: '2026-01-15T12:30:00Z',
  },
)
const supportCase = node(
  'case-6001',
  'support_cases',
  1,
  { case_id: 6001 },
  { case_id: 6001, customer_id: 1, order_id: 1001, state: 'resolved' },
)

const customerOrder = edge('customer-order', 'order-1001', 'customer-1', 'customer_id')
const auditOrder = edge('audit-order', 'audit-7001', 'order-1001', 'entity_id')
const itemOneOrder = edge('item-one-order', 'item-2001', 'order-1001', 'order_id')
const itemTwoOrder = edge('item-two-order', 'item-2002', 'order-1001', 'order_id')
const paymentOrder = edge('payment-order', 'payment-3001', 'order-1001', 'order_id')
const shipmentOrder = edge('shipment-order', 'shipment-4001', 'order-1001', 'order_id')
const trackingShipment = edge('tracking-shipment', 'event-5001', 'shipment-4001', 'shipment_id')
const caseOrder = edge('case-order', 'case-6001', 'order-1001', 'order_id')

function graph(nodes: GraphNode[], edges: GraphEdge[]): TraceGraph {
  return {
    nodes,
    edges,
    metadata: {
      dialect: 'synthetic SQLite',
      started_from: ref('orders'),
      truncated: false,
      warnings: [],
    },
  }
}

export const demoJourney: JourneyStage[] = [
  {
    id: 'created',
    title: 'Order discovered',
    time: '09:00',
    description: 'A seed record reveals its customer and the first audit event.',
    graph: graph([order('created'), customer, auditCreated], [customerOrder, auditOrder]),
  },
  {
    id: 'paid',
    title: 'Payment captured',
    time: '09:04',
    description: 'Two item rows and a redacted payment record join the trace.',
    graph: graph(
      [order('paid'), customer, auditCreated, itemLamp, itemBulbs, payment],
      [customerOrder, auditOrder, itemOneOrder, itemTwoOrder, paymentOrder],
    ),
  },
  {
    id: 'packed',
    title: 'Shipment created',
    time: '11:52',
    description: 'A new relationship connects the order to fulfilment data.',
    graph: graph(
      [order('packed'), customer, auditCreated, itemLamp, itemBulbs, payment, shipment('label_created')],
      [customerOrder, auditOrder, itemOneOrder, itemTwoOrder, paymentOrder, shipmentOrder],
    ),
  },
  {
    id: 'moving',
    title: 'Carrier scan observed',
    time: '12:30',
    description: 'Snapshot comparison exposes a changed shipment and a new event.',
    graph: graph(
      [
        order('shipped'),
        customer,
        auditCreated,
        itemLamp,
        itemBulbs,
        payment,
        shipment('in_transit'),
        trackingEvent,
      ],
      [
        customerOrder,
        auditOrder,
        itemOneOrder,
        itemTwoOrder,
        paymentOrder,
        shipmentOrder,
        trackingShipment,
      ],
    ),
  },
  {
    id: 'explained',
    title: 'Journey explained',
    time: '14:10',
    description: 'A related support record completes the explainable record journey.',
    graph: graph(
      [
        order('shipped'),
        customer,
        auditCreated,
        itemLamp,
        itemBulbs,
        payment,
        shipment('in_transit'),
        trackingEvent,
        supportCase,
      ],
      [
        customerOrder,
        auditOrder,
        itemOneOrder,
        itemTwoOrder,
        paymentOrder,
        shipmentOrder,
        trackingShipment,
        caseOrder,
      ],
    ),
  },
]

const column = (name: string, data_type: string, primary_key = false) => ({
  name,
  data_type,
  nullable: !primary_key,
  primary_key,
})

export const demoCatalog: SchemaCatalog = {
  dialect: 'synthetic SQLite',
  truncated: false,
  tables: [
    ['customers', 'customer_id'],
    ['orders', 'order_id'],
    ['order_items', 'item_id'],
    ['payments', 'payment_id'],
    ['shipments', 'shipment_id'],
    ['tracking_events', 'event_id'],
    ['support_cases', 'case_id'],
    ['audit_events', 'audit_id'],
  ].map(([table_name, primaryKey]) => ({
    ref: ref(table_name),
    columns: [column(primaryKey, 'INTEGER', true), column('status', 'TEXT')],
    primary_key: [primaryKey],
    foreign_keys: [],
  })),
}

