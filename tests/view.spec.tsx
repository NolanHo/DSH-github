/**
 * View render smoke (jsdom): the mounted card renders the unconfigured
 * guide and the thread list from the shared store, chips write the same
 * pluginSettings keys the gear popup binds, expanding a thread renders its
 * comment body, a stale detail fetch is ignored after switching threads,
 * the comment box hides on threads without an issue/PR number, and the
 * Merge button follows state.allowMerge. Locale falls back to the browser
 * language (en) — assertions use the English copy.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import type { BetterSidebarService } from 'dsh-better-sidebar/client/service'
import type { GithubStateResult, GithubThread } from '../src/shared.ts'
import { createGithubInboxStore } from '../src/client/store.ts'
import { InboxView } from '../src/client/view.tsx'
import type { Context } from 'cordis'

function thread(id: string, type = 'PullRequest', url?: string, htmlUrl?: string): GithubThread {
  return {
    id,
    unread: true,
    reason: 'review_requested',
    repo: 'o/r',
    title: 'PR title needs review',
    url: url ?? 'https://api.example.test/repos/o/r/pulls/' + id,
    htmlUrl: htmlUrl ?? 'https://github.com/o/r/pull/' + id,
    type,
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

interface FakePrefs { pluginSettings: Record<string, unknown>; [key: string]: unknown }

function makeFakeService(): { service: BetterSidebarService; ctx: Context } {
  let prefs: FakePrefs = { pluginSettings: {} }
  const state = { splits: { kind: 'leaf', tabs: [{ type: 'github', id: 'github' }] }, bottomSplits: { kind: 'leaf', tabs: [] } }
  const listeners = new Set<() => void>()
  const service = {
    getSnapshot: () => ({ prefs, state }),
    subscribeState: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    updateTab: () => {},
  } as unknown as BetterSidebarService
  const ctx = { betterSidebar: { openTab: vi.fn() } } as unknown as Context
  return { service, ctx }
}

function mount(node: ReactNode): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  act(() => { root.render(node) })
  return {
    container,
    unmount: () => {
      act(() => { root.unmount() })
      container.remove()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InboxView render smoke', () => {
  it('renders the setup guide while unconfigured (gh available variant)', async () => {
    const { service, ctx } = makeFakeService()
    const unconfigured: GithubStateResult = { configured: false, ghAvailable: true, allowMerge: false, threads: [], pollIntervalSec: 60 }
    const store = createGithubInboxStore({ githubState: vi.fn().mockResolvedValue(unconfigured) }, service)
    await store.refresh()
    const mounted = mount(createElement(InboxView, { store, ctx, scope: { sessionId: 's1' } }))
    expect(mounted.container.textContent).toContain('GitHub is not configured')
    expect(mounted.container.textContent).toContain('gh auth login')
    mounted.unmount()
    store.dispose()
  })

  it('renders the thread list, toggles a filter chip, and expands a thread', async () => {
    const { service, ctx } = makeFakeService()
    const configured: GithubStateResult = {
      configured: true,
      ghAvailable: true,
      allowMerge: true,
      threads: [thread('1')],
      fetchedAt: '2024-01-01T00:00:00Z',
      pollIntervalSec: 60,
    }
    const store = createGithubInboxStore({ githubState: vi.fn().mockResolvedValue(configured) }, service)
    await store.refresh()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/plugins/dsh-github/api/thread')) {
        return new Response(JSON.stringify({ ok: true, value: { thread: configured.threads[0], commentBody: '# hello from comment' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true, value: { value: {}, revision: 0 } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const mounted = mount(createElement(InboxView, { store, ctx, scope: { sessionId: 's1' } }))
    expect(mounted.container.textContent).toContain('GitHub Inbox')
    expect(mounted.container.textContent).toContain('1 unread')
    expect(mounted.container.textContent).toContain('PR title needs review')
    // Toggle the CI chip (default off → on) through the shared settings.
    const buttons = [...mounted.container.querySelectorAll('button')]
    const ciChip = buttons.find(button => button.textContent === 'CI status')
    expect(ciChip).toBeDefined()
    act(() => { ciChip!.click() })
    expect(store.getState().settings.showCi).toBe(true)
    // Expanding the row fetches the thread detail (stubbed at fetch level).
    const row = buttons.find(button => button.textContent?.includes('PR title needs review'))
    expect(row).toBeDefined()
    await act(async () => { row!.click() })
    await act(async () => {})
    expect(mounted.container.textContent).toContain('hello from comment')
    expect(mounted.container.textContent).toContain('Approve')
    expect(mounted.container.textContent).toContain('Merge')
    mounted.unmount()
    store.dispose()
  })
})

describe('InboxView detail race and gating', () => {
  it('ignores a stale detail fetch that settles after switching threads', async () => {
    const { service, ctx } = makeFakeService()
    const configured: GithubStateResult = {
      configured: true,
      ghAvailable: true,
      allowMerge: true,
      threads: [thread('1'), thread('2')],
      pollIntervalSec: 60,
    }
    const store = createGithubInboxStore({ githubState: vi.fn().mockResolvedValue(configured) }, service)
    await store.refresh()
    const pending: ((value: Response) => void)[] = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { pending.push(resolve) })))
    const mounted = mount(createElement(InboxView, { store, ctx, scope: { sessionId: 's1' } }))
    const rows = [...mounted.container.querySelectorAll('button')].filter(button => button.textContent?.includes('PR title needs review'))
    expect(rows).toHaveLength(2)
    // Expand t1, then t2; both detail fetches are pending.
    await act(async () => { rows[0]!.click() })
    await act(async () => { rows[1]!.click() })
    expect(pending).toHaveLength(2)
    // t2's fetch settles first with ITS body; then t1's stale settle arrives.
    await act(async () => {
      pending[1]!(new Response(JSON.stringify({ ok: true, value: { thread: configured.threads[1], commentBody: 'body of t2' } }), { status: 200 }))
    })
    await act(async () => {
      pending[0]!(new Response(JSON.stringify({ ok: true, value: { thread: configured.threads[0], commentBody: 'body of t1 (stale)' } }), { status: 200 }))
    })
    expect(mounted.container.textContent).toContain('body of t2')
    expect(mounted.container.textContent).not.toContain('body of t1')
    mounted.unmount()
    store.dispose()
  })

  it('hides the comment box on threads without an issue/PR number and Merge when gated', async () => {
    const { service, ctx } = makeFakeService()
    const commitThread = thread('c1', 'Commit', 'https://api.example.test/repos/o/r/commits/abc123', '')
    const configured: GithubStateResult = {
      configured: true,
      ghAvailable: true,
      allowMerge: false,
      threads: [commitThread],
      pollIntervalSec: 60,
    }
    const store = createGithubInboxStore({ githubState: vi.fn().mockResolvedValue(configured) }, service)
    await store.refresh()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, value: { thread: commitThread } }), { status: 200 })))
    const mounted = mount(createElement(InboxView, { store, ctx, scope: { sessionId: 's1' } }))
    const row = [...mounted.container.querySelectorAll('button')].find(button => button.textContent?.includes('PR title needs review'))
    await act(async () => { row!.click() })
    await act(async () => {})
    expect(mounted.container.textContent).not.toContain('Write a comment')
    expect(mounted.container.textContent).not.toContain('Send')
    // Merge is gated off (allowMerge: false) — the button must not render
    // (the Commit thread has no review buttons either).
    expect(mounted.container.textContent).not.toContain('Merge')
    mounted.unmount()
    store.dispose()
  })
})
