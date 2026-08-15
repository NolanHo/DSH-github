/**
 * Wire helpers for the /plugins/dsh-github JSON API: bounded body reading,
 * response writing, and the shared error envelope. Every method returns
 * {ok: true, value} on success and {ok: false, error: {code, message}}
 * (HTTP 4xx/5xx matching the code) on failure.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { GithubWireErrorCode } from './shared.ts'

/** One API failure with its wire code and HTTP status. */
export class GithubError extends Error {
  constructor(
    readonly code: GithubWireErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20

/** Structural request face the routes read (node http IncomingMessage fits). */
export type GithubApiRequest = Pick<IncomingMessage, 'headers'> & AsyncIterable<string | Uint8Array>

/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export async function readJsonBody(req: GithubApiRequest): Promise<unknown> {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk
    total += buffer.byteLength
    if (total > MAX_BODY_BYTES) {
      throw new GithubError('bad-request', 'request body too large')
    }
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new GithubError('bad-request', 'request body is not valid JSON')
  }
}

/** Write a JSON response with the given status. */
export function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** Write the success envelope. */
export function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

/** Write the failure envelope for any thrown value (unknown → internal 500). */
export function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof GithubError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

/** Narrow an unknown payload value to a non-empty string, else throw bad-request. */
export function requireString(payload: unknown, key: string): string {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (typeof value !== 'string' || value === '') {
    throw new GithubError('bad-request', `missing or invalid "${key}"`)
  }
  return value
}
