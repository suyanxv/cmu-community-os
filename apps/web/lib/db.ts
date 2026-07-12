import { neon } from '@neondatabase/serverless'

let _client: ReturnType<typeof neon> | undefined

function getClient() {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    _client = neon(process.env.DATABASE_URL)
  }
  return _client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getClient()(strings, ...values) as Promise<any[]>
}

// Run several queries in ONE HTTP round trip, sequentially inside a single
// transaction — later queries see earlier queries' writes. Pass unawaited
// sql`` calls; Neon's queries are lazy until awaited, so handing them to
// transaction() executes them there instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sqlBatch(queries: Promise<any[]>[]): Promise<any[][]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getClient().transaction(queries as any) as Promise<any[][]>
}
