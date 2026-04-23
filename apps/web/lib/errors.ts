import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function humanizeField(path: readonly PropertyKey[]): string {
  return path
    .map((p) => typeof p === 'string' ? p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : `[${String(p)}]`)
    .join(' → ')
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map((i) => ({
      field: i.path.join('.'),
      label: humanizeField(i.path),
      message: i.message,
    }))
    const summary = fieldErrors.length === 1
      ? `${fieldErrors[0].label}: ${fieldErrors[0].message}`
      : `${fieldErrors.length} invalid fields: ${fieldErrors.map((f) => f.label).join(', ')}`
    return Response.json(
      { error: summary, fields: fieldErrors },
      { status: 400 }
    )
  }
  console.error(error)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
