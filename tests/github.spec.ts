/**
 * Host service tests: the request-driven cache (freshness window, 304 +
 * X-Poll-Interval adoption, Link-header pagination, explicit newest-first
 * sort), error handling, optimistic removal, the merge gate, the token
 * chain (gh missing vs logged-out), htmlUrl derivation (github.com and
 * GHES subpath), and the same-origin guard on absolute comment GETs.
 * The GitHub API surface is mocked at the fetch level; the gh probe is
 * injected, so no real credential or network is touched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildGithubApi } from '../src/routes.ts'
import {
  GhMissingError,
  GithubInboxService,
  webOriginOf,
  htmlUrlOf,
  nextPageUrl,
  type ResolvedGithubConfig,
} from '../src/github.ts'
import {
  GITHUB_API_BASE_DEFAULT,
  GITHUB_PER_PAGE_MAX,
  GITHUB_POLL_FLOOR_MIN,
} from '../src/config.ts'

interface RawThread {
  id: string
  unread: boolean
  reason: string
  updated_at: string
  subject: { title: string; url: string | null; latest_comment_url: string | null; type: string | null }
  repository: { full_name: string }
}

function rawThread(id: string, reason: string, type: string, repo = 'o/r', title = 'title ' + id): RawThread {
  return {
    id,
    unread: true,
    reason,
    updated_at: '2024-01-0' + id + 'T00:00:00Z',
    subject: { title, url: 'https://api.example.test/repos/' + repo + '/pulls/' + id, latest_comment_url: null, type },
    repository: { full_name: repo },
  }
}

const LAST_MODIFIED = 'Mon, 01 Jan 2024 00:00:00 GMT'

function inboxResponse(threads: RawThread[], extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(threads), {
    status: 200,
    headers: { 'last-modified': LAST_MODIFIED, 'x-poll-interval': '60', ...extra },
  })
}

/** A default-configured service whose gh probe must never run (config token short-circuits it). */
function makeService(config: Partial<ResolvedGithubConfig> = {}): GithubInboxService {
  return new GithubInboxService({
    token: 'tok',
    apiBase: 'https://api.example.test',
    pollFloorSeconds: 60,
    perPage: 50,
    allowMerge: false,
    ...config,
  }, async () => { throw new Error('gh probe should not run') })
}

describe('htmlUrl derivation', () => {
  it('maps the public API origin to github.com and singularizes the type segment', () => {
    expect(webOriginOf('https://api.github.com', undefined)).toBe('https://github.com')
    expect(htmlUrlOf('https://api.github.com/repos/o/r/pulls/1', 'o/r', 'PullRequest', 'https://github.com')).toBe('https://github.com/o/r/pull/1')
    expect(htmlUrlOf('https://api.github.com/repos/o/r/issues/77', 'o/r', 'Issue', 'https://github.com')).toBe('https://github.com/o/r/issue/77')
  })
  it('honors the explicit web base for GHES subpath deployments', () => {
    expect(webOriginOf('https://ghe.example/enterprise/api/v3', 'https://ghe.example')).toBe('https://ghe.example')
    expect(htmlUrlOf('https://ghe.example/enterprise/api/v3/repos/o/r/pulls/1', 'o/r', 'PullRequest', 'https://ghe.example')).toBe('https://ghe.example/o/r/pull/1')
  })
  it('falls back to the API URL for unmappable inputs', () => {
    expect(htmlUrlOf('', 'o/r', 'PullRequest', 'https://github.com')).toBe('')
    expect(htmlUrlOf('https://api.github.com/repos/o/r/pulls/1', 'o/r', 'CheckSuite', 'https://github.com')).toBe('https://api.github.com/repos/o/r/pulls/1')
  })
  it('parses the Link header rel=next target', () => {
    const headers = new Headers({ link: '<https://api.example.test/notifications?page=2>; rel="next", <https://api.example.test/notifications?page=1>; rel="prev"' })
    expect(nextPageUrl(headers)).toBe('https://api.example.test/notifications?page=2')
    expect(nextPageUrl(new Headers())).toBeNull()
  })
})

describe('GithubInboxService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches the inbox once, then serves the freshness window from cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(inboxResponse([rawThread('1', 'review_requested', 'PullRequest')]))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    const first = await service.state(false)
    expect(first.configured).toBe(true)
    expect(first.allowMerge).toBe(false)
    expect(first.threads).toHaveLength(1)
    expect(first.threads[0]).toMatchObject({ id: '1', repo: 'o/r', type: 'PullRequest', url: 'https://api.example.test/repos/o/r/pulls/1' })
    expect(first.pollIntervalSec).toBe(60)
    const second = await service.state(false)
    expect(second.threads[0]?.id).toBe('1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('orders fetched threads newest-first regardless of the API order', async () => {
    const older = rawThread('1', 'review_requested', 'PullRequest')
    const newer = { ...rawThread('2', 'mention', 'Issue'), updated_at: '2024-02-01T00:00:00Z' }
    const fetchMock = vi.fn().mockResolvedValue(inboxResponse([older, newer]))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    const state = await service.state(false)
    expect(state.threads.map(thread => thread.id)).toEqual(['2', '1'])
  })

  it('reuses the cache on a 304, adopts a raised X-Poll-Interval, and sends If-Modified-Since on forced refetches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(inboxResponse([rawThread('1', 'review_requested', 'PullRequest')]))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { 'last-modified': LAST_MODIFIED, 'x-poll-interval': '120' } }))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    await service.state(false)
    const state = await service.state(true)
    expect(state.threads).toHaveLength(1)
    expect(state.pollIntervalSec).toBe(120)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondCall = fetchMock.mock.calls[1] as unknown[]
    expect((secondCall[1] as { headers: Record<string, string> }).headers['if-modified-since']).toBe(LAST_MODIFIED)
  })

  it('refuses a cross-origin pagination link (token never leaves the API origin)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([rawThread('1', 'review_requested', 'PullRequest')]), {
        status: 200,
        headers: { 'last-modified': LAST_MODIFIED, 'x-poll-interval': '60', link: '<https://attacker.example/collect>; rel="next"' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    // state() surfaces failures in the result (keeping the last snapshot
    // contract) rather than rejecting — assert the error code there.
    const state = await service.state(false)
    expect(state.error?.code).toBe('github-error')
    expect(state.threads).toEqual([])
    // The attacker URL must never be fetched.
    expect(fetchMock.mock.calls.every(call => !String(call[0]).includes('attacker.example'))).toBe(true)
  })

  it('walks inbox pages via the Link header and merges them newest-first', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([rawThread('1', 'review_requested', 'PullRequest')]), {
        status: 200,
        headers: { 'last-modified': LAST_MODIFIED, 'x-poll-interval': '60', link: '<https://api.example.test/notifications?page=2>; rel="next"' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([rawThread('2', 'mention', 'Issue')]), {
        status: 200,
        headers: { 'x-poll-interval': '60' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    const state = await service.state(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(state.threads.map(thread => thread.id)).toEqual(['2', '1'])
  })

  it('keeps the last snapshot and reports github-auth on 401', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(inboxResponse([rawThread('1', 'review_requested', 'PullRequest')]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    await service.state(false)
    const state = await service.state(true)
    expect(state.error?.code).toBe('github-auth')
    expect(state.threads).toHaveLength(1)
  })

  it('markRead drops the thread from the cached inbox optimistically', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(inboxResponse([rawThread('1', 'review_requested', 'PullRequest'), rawThread('2', 'mention', 'Issue')]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService()
    await service.state(false)
    await service.markRead('1')
    const state = await service.state(false)
    expect(state.threads.map(thread => thread.id)).toEqual(['2'])
  })

  it('gates merge behind githubAllowMerge before any token/API work', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const gated = makeService({ allowMerge: false })
    await expect(gated.merge('o/r', 1, 'squash')).rejects.toMatchObject({ code: 'github-forbidden' })
    expect(fetchMock).not.toHaveBeenCalled()
    const open = makeService({ allowMerge: true })
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ merged: true }), { status: 200 }))
    await open.merge('o/r', 1, 'squash')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/repos/o/r/pulls/1/merge',
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('reports unconfigured with ghAvailable=false when the binary is missing', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    vi.stubEnv('GH_TOKEN', '')
    const service = new GithubInboxService({
      apiBase: GITHUB_API_BASE_DEFAULT,
      pollFloorSeconds: GITHUB_POLL_FLOOR_MIN,
      perPage: GITHUB_PER_PAGE_MAX,
      allowMerge: false,
    }, async () => { throw new GhMissingError() })
    const state = await service.state(false)
    expect(state.configured).toBe(false)
    expect(state.ghAvailable).toBe(false)
    expect(state.threads).toEqual([])
  })

  it('picks up a token set in the environment during a cached failure window', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    vi.stubEnv('GH_TOKEN', '')
    const fetchMock = vi.fn().mockResolvedValue(inboxResponse([rawThread('1', 'review_requested', 'PullRequest')]))
    vi.stubGlobal('fetch', fetchMock)
    const service = new GithubInboxService({
      apiBase: GITHUB_API_BASE_DEFAULT,
      pollFloorSeconds: GITHUB_POLL_FLOOR_MIN,
      perPage: GITHUB_PER_PAGE_MAX,
      allowMerge: false,
    }, async () => { throw new Error('not logged into any hosts') })
    const first = await service.state(false)
    expect(first.configured).toBe(false)
    // Set the env token within the 30s failure cache — the next resolve
    // must adopt it immediately instead of waiting out the TTL.
    vi.stubEnv('GH_TOKEN', 'env-tok')
    const second = await service.state(false)
    expect(second.configured).toBe(true)
    expect(second.threads).toHaveLength(1)
  })

  it('reports unconfigured with ghAvailable=true when gh is installed but logged out', async () => {
    vi.stubEnv('GITHUB_TOKEN', '')
    vi.stubEnv('GH_TOKEN', '')
    const service = new GithubInboxService({
      apiBase: GITHUB_API_BASE_DEFAULT,
      pollFloorSeconds: GITHUB_POLL_FLOOR_MIN,
      perPage: GITHUB_PER_PAGE_MAX,
      allowMerge: false,
    }, async () => { throw new Error('not logged into any hosts') })
    const state = await service.state(false)
    expect(state.configured).toBe(false)
    expect(state.ghAvailable).toBe(true)
  })

  it('derives the human web URL for a GHES subpath deployment from the explicit web base', async () => {
    const fetchMock = vi.fn().mockResolvedValue(inboxResponse([rawThread('1', 'review_requested', 'PullRequest')]))
    vi.stubGlobal('fetch', fetchMock)
    const service = makeService({ apiBase: 'https://ghe.example/enterprise/api/v3', webBase: 'https://ghe.example' })
    const state = await service.state(false)
    expect(state.threads[0]?.htmlUrl).toBe('https://ghe.example/o/r/pull/1')
  })

  it('surfaces 422s on the merge action (the route boundary maps them to github-rejected)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Branch protection rule requires a review' }), { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    const routes = buildGithubApi(makeService({ allowMerge: true }))
    await expect(routes.merge({ repo: 'o/r', pr: 1, method: 'squash' })).rejects.toMatchObject({ code: 'github-rejected', message: 'Branch protection rule requires a review' })
  })
})
