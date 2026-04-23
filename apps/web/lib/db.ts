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
