/**
 * Route group tests: strict synchronous payload validation (repo, numbers,
 * event/method whitelists, body caps, thread ids) and the async error
 * mapping (unconfigured → github-unavailable, 422 → github-rejected).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGithubApi } from '../src/routes.ts'
import { GithubInboxService, GhMissingError } from '../src/github.ts'
import { GithubError } from '../src/wire.ts'
import {
  GITHUB_API_BASE_DEFAULT,
  GITHUB_PER_PAGE_MAX,
  GITHUB_POLL_FLOOR_MIN,
} from '../src/config.ts'

function makeService(allowMerge = false): GithubInboxService {
  return new GithubInboxService({
    token: 'tok',
    apiBase: 'https://api.example.test',
    pollFloorSeconds: 60,
    perPage: 50,
    allowMerge,
  }, async () => { throw new Error('gh probe should not run') })
}

/** The wire error code a sync route call throws (undefined when it does not). */
function codeOf(run: () => unknown): string | undefined {
  try {
    run()
    return undefined
  } catch (error) {
    return (error as GithubError).code
  }
}

describe('github routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects malformed payloads loudly and synchronously', async () => {
    const routes = buildGithubApi(makeService())
    expect(codeOf(() => routes.review({ repo: 'o/r', pr: 1, event: 'BOOM' }))).toBe('bad-request')
    expect(codeOf(() => routes.review({ repo: 'norepo', pr: 1, event: 'APPROVE' }))).toBe('bad-request')
    expect(codeOf(() => routes.review({ repo: 'a//b', pr: 1, event: 'APPROVE' }))).toBe('bad-request')
    expect(codeOf(() => routes.review({ repo: 'a/b?x=1', pr: 1, event: 'APPROVE' }))).toBe('bad-request')
    expect(codeOf(() => routes.review({ repo: 'o/r', pr: 0, event: 'APPROVE' }))).toBe('bad-request')
    expect(codeOf(() => routes.merge({ repo: 'o/r', pr: 1, method: 'fast-forward' }))).toBe('bad-request')
    expect(codeOf(() => routes.comment({ repo: 'o/r', issue: 1, body: '' }))).toBe('bad-request')
    expect(codeOf(() => routes.comment({ repo: 'o/r', issue: 1, body: 'x'.repeat(64 * 1024 + 1) }))).toBe('bad-request')
    expect(codeOf(() => routes.markRead({ id: '../etc' }))).toBe('bad-request')
    expect(codeOf(() => routes.markRead({ id: 'abc' }))).toBe('bad-request')
    // A valid id passes validation and surfaces the (unstubbed) fetch
    // failure as the github-error wire code on the async path.
    await expect(routes.markRead({ id: '123456789' })).rejects.toMatchObject({ code: 'github-error' })
  })

  it('actions surface github-unavailable while no token resolves', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    vi.stubEnv('GH_TOKEN', '')
    const service = new GithubInboxService({
      apiBase: GITHUB_API_BASE_DEFAULT,
      pollFloorSeconds: GITHUB_POLL_FLOOR_MIN,
      perPage: GITHUB_PER_PAGE_MAX,
      allowMerge: true,
    }, async () => { throw new GhMissingError() })
    const routes = buildGithubApi(service)
    await expect(routes.markRead({ id: '1' })).rejects.toMatchObject({ code: 'github-unavailable' })
    await expect(routes.merge({ repo: 'o/r', pr: 1, method: 'squash' })).rejects.toMatchObject({ code: 'github-unavailable' })
  })

  it('maps a GitHub 422 rejection onto the github-rejected wire code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Branch protection rule requires a review' }), { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    const routes = buildGithubApi(makeService(true))
    await expect(routes.merge({ repo: 'o/r', pr: 1, method: 'squash' })).rejects.toMatchObject({ code: 'github-rejected', message: 'Branch protection rule requires a review' })
  })
})
