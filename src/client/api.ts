/**
 * Typed fetch wrapper over the plugin's own JSON API (/plugins/dsh-github/api).
 * Envelope: {ok: true, value} | {ok: false, error: {code, message}}.
 */
import type {
  GithubMergeMethod,
  GithubMergeStatus,
  GithubReviewEvent,
  GithubStateResult,
  GithubThreadDetail,
} from '../shared.ts'

/** One wire failure of the plugin API. */
export class GithubClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    // See API_PREFIX in src/index.ts: the route prefix stays the legacy
    // /plugins/dsh-github/api so the rename works without a server restart.
    response = await fetch('/plugins/dsh-github/api/' + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    throw new GithubClientError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new GithubClientError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? 'HTTP ' + response.status,
    )
  }
  return parsed.value as T
}

/** The plugin API surface. */
export const api = {
  /** The inbox snapshot (force bypasses the host freshness window). */
  githubState: (force?: boolean, signal?: AbortSignal) =>
    call<GithubStateResult>('state', { force: force === true }, signal),
  /** One thread's detail plus its latest comment body. */
  githubThread: (id: string, signal?: AbortSignal) =>
    call<GithubThreadDetail>('thread', { id }, signal),
  /** Mark one thread read. */
  githubMarkRead: (id: string) =>
    call<{ ok: true }>('markRead', { id }),
  /** Mark one thread done (GitHub's archive). */
  githubMarkDone: (id: string) =>
    call<{ ok: true }>('markDone', { id }),
  /** Mark every unread thread read. */
  githubMarkAllRead: () =>
    call<{ ok: true }>('markAllRead', {}),
  /** Submit one PR review event (APPROVE / REQUEST_CHANGES / COMMENT). */
  githubReview: (repo: string, pr: number, event: GithubReviewEvent, body?: string) =>
    call<{ ok: true }>('review', { repo, pr, event, ...(body !== undefined && body !== '' ? { body } : {}) }),
  /** Post a general comment on an issue or PR. */
  githubComment: (repo: string, issue: number, body: string) =>
    call<{ ok: true }>('comment', { repo, issue, body }),
  /** Mergeability plus head check runs for the merge panel. */
  githubMergeStatus: (repo: string, pr: number, signal?: AbortSignal) =>
    call<GithubMergeStatus>('mergeStatus', { repo, pr }, signal),
  /** Merge one PR with the chosen method (merge / squash / rebase). */
  githubMerge: (repo: string, pr: number, method: GithubMergeMethod) =>
    call<{ ok: true }>('merge', { repo, pr, method }),
}

/**
 * Persist the plugin's own filter settings through the sidebar's settings
 * seam (pluginSettings['github'] — the same document the gear popup writes).
 * A runtime fetch to the sidebar's own fenced route: no cross-plugin value
 * import, so the client bundle stays pure.
 */
export async function callSidebarSettings(patch: Record<string, unknown>): Promise<{ value?: unknown; revision?: number }> {
  const response = await fetch('/sidebar/api/settings.update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patch }),
  })
  const parsed: { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
    = await response.json().catch(() => null)
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new GithubClientError(
      parsed?.error?.code ?? 'http',
      parsed?.error?.message ?? 'HTTP ' + response.status,
    )
  }
  return parsed.value as { value?: unknown; revision?: number }
}
