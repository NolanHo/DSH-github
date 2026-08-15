/**
 * Store tests (jsdom — the badge bridge drives the sidebar store): bridge
 * bumps via updateTab meta, poll/mutation interplay (stale poll discard),
 * settings sync from pluginSettings, and the 99+ badge cap.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { BetterSidebarService } from 'dsh-better-sidebar/client/service'
import type { GithubPluginSettings, GithubStateResult, GithubThread } from '../src/shared.ts'
import { createGithubInboxStore } from '../src/client/store.ts'

function thread(id: string): GithubThread {
  return {
    id,
    unread: true,
    reason: 'review_requested',
    repo: 'o/r',
    title: 'title ' + id,
    url: 'https://api.example.test/repos/o/r/pulls/' + id,
    htmlUrl: 'https://github.com/o/r/pull/' + id,
    type: 'PullRequest',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

function snapshotOf(threads: GithubThread[], allowMerge = false): GithubStateResult {
  return { configured: true, ghAvailable: true, allowMerge, threads, pollIntervalSec: 60 }
}

interface FakePrefs { pluginSettings: Record<string, unknown>; [key: string]: unknown }

/** A minimal structural fake of the betterSidebar service surface the store uses. */
function makeFakeService(options: {
  tabs?: Array<{ type: string; id: string }>
  settings?: GithubPluginSettings
} = {}): { service: BetterSidebarService; setPrefsBlob: (blob: unknown) => void } {
  const tabs = options.tabs ?? [{ type: 'github', id: 'github' }]
  let prefs: FakePrefs = { pluginSettings: options.settings === undefined ? {} : { github: options.settings } }
  const state = {
    splits: { kind: 'leaf', tabs },
    bottomSplits: { kind: 'leaf', tabs: [] },
  }
  const listeners = new Set<() => void>()
  const service = {
    getSnapshot: () => ({ prefs, state }),
    subscribeState: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    updateTab: vi.fn(),
  } as unknown as BetterSidebarService
  return {
    service,
    setPrefsBlob: (blob: unknown) => {
      prefs = { pluginSettings: blob === undefined ? {} : { github: blob } }
      for (const fn of [...listeners]) fn()
    },
  }
}

describe('GithubInboxStore badge bridge', () => {
  it('bumps open GitHub tabs through updateTab when the badge value changes', async () => {
    const { service } = makeFakeService()
    const apiState = vi.fn().mockResolvedValue(snapshotOf([thread('1')]))
    const store = createGithubInboxStore({ githubState: apiState }, service)
    await store.refresh()
    expect(service.updateTab).toHaveBeenCalledTimes(1)
    expect(service.updateTab).toHaveBeenCalledWith('github', { meta: 1 })
    // Same badge value — no second bump.
    await store.refresh()
    expect(service.updateTab).toHaveBeenCalledTimes(1)
    // Changed count — another bump.
    const apiState2 = vi.fn().mockResolvedValue(snapshotOf([thread('1'), thread('2')]))
    const store2 = createGithubInboxStore({ githubState: apiState2 }, service)
    await store2.refresh()
    expect(service.updateTab).toHaveBeenCalledTimes(2)
    expect(service.updateTab).toHaveBeenLastCalledWith('github', { meta: 2 })
    store.dispose()
    store2.dispose()
  })

  it('caps the badge at 99+', async () => {
    const { service } = makeFakeService()
    const many = Array.from({ length: 120 }, (_, index) => thread(String(index + 1)))
    const apiState = vi.fn().mockResolvedValue(snapshotOf(many))
    const store = createGithubInboxStore({ githubState: apiState }, service)
    await store.refresh()
    expect(store.badgeValue()).toBe('99+')
    store.dispose()
  })
})

describe('GithubInboxStore poll/mutation interplay', () => {
  it('discards a poll that started before a local mutation (no resurrected threads)', async () => {
    const { service } = makeFakeService()
    const one = snapshotOf([thread('1')])
    const resolvers: ((value: GithubStateResult) => void)[] = []
    const apiState = vi.fn(() => new Promise<GithubStateResult>(resolve => { resolvers.push(resolve) }))
    const store = createGithubInboxStore({ githubState: apiState }, service)
    // Seed the store with one thread (resolve AFTER starting the refresh).
    const first = store.refresh()
    resolvers.shift()?.(one)
    await first
    // Start a second refresh (in flight), then remove the thread locally.
    const second = store.refresh()
    store.removeLocal('1')
    // The stale in-flight result (still carrying t1) must be discarded.
    resolvers.shift()?.(one)
    await second
    expect(store.getState().snapshot?.threads).toEqual([])
    store.dispose()
  })
})

describe('GithubInboxStore settings sync', () => {
  it('re-reads pluginSettings when the sidebar prefs change (gear popup writes)', () => {
    const initial: GithubPluginSettings = { showReviewRequested: true, showPrActivity: true, showComments: true, showCi: false, showOther: true, pollSeconds: 60 }
    const { service, setPrefsBlob } = makeFakeService({ settings: initial })
    const apiState = vi.fn().mockResolvedValue(snapshotOf([]))
    const store = createGithubInboxStore({ githubState: apiState }, service)
    expect(store.getState().settings.showCi).toBe(false)
    setPrefsBlob({ ...initial, showCi: true })
    expect(store.getState().settings.showCi).toBe(true)
    store.dispose()
  })

  it('applies local settings patches optimistically', () => {
    const { service } = makeFakeService()
    const apiState = vi.fn().mockResolvedValue(snapshotOf([]))
    const store = createGithubInboxStore({ githubState: apiState }, service)
    store.setSettings({ showCi: true })
    expect(store.getState().settings.showCi).toBe(true)
    store.dispose()
  })
})
