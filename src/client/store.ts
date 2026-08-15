/**
 * The plugin's client store: owns the polling timer, the filter settings,
 * and the badge value. Created once per plugin activation and shared by
 * the tab descriptor's badge hook and the inbox view. Polling is lazy —
 * the first badge render (or view mount) arms the timer, so a disabled or
 * never-opened GitHub tab never polls. The timer tracks the plugin
 * settings' pollSeconds floored by the host's effective poll interval,
 * skips while the document is hidden, and slows to a 5-minute probe
 * while the inbox is unconfigured.
 * @module dsh-github/client/store
 */
import type { BetterSidebarService, SidebarState } from 'dsh-better-sidebar/client/service'
import type { GithubPluginSettings, GithubStateResult } from '../shared.ts'
import { countUnread, filterThreads, parseGithubSettings } from './categories.ts'
import type { api } from './api.ts'

/** The store's published state (stable object, replaced on changes). */
export interface GithubInboxStoreState {
  /** The last inbox snapshot; null before the first poll settles. */
  snapshot: GithubStateResult | null
  /** The plugin's filter settings (synced from pluginSettings['github']). */
  settings: GithubPluginSettings
}

/** The shared store of the GitHub tab (one per plugin activation). */
export interface GithubInboxStore {
  getState(): GithubInboxStoreState
  subscribe(listener: () => void): () => void
  /** Arm the polling timer (idempotent; the badge arms it on first render). */
  ensurePolling(): void
  /** Force a fresh snapshot (the refresh button; bypasses host freshness). */
  refresh(): Promise<void>
  /** Drop one thread locally after a successful markRead / markDone. */
  removeLocal(id: string): void
  /** Drop every thread locally after a successful markAllRead. */
  clearLocal(): void
  /** Merge one filter patch locally (the view persists it separately). */
  setSettings(patch: Partial<GithubPluginSettings>): void
  /** The badge pill value: filtered unread count, 99+ capped, null = hidden. */
  badgeValue(): string | number | null
  /** Stop the timer and detach the settings subscription (fiber disposal). */
  dispose(): void
}

/** Poll cadence while the inbox is unconfigured (a slow configuration probe). */
const UNCONFIGURED_RETRY_MS = 5 * 60_000

/** The plugin's settings blob key inside the sidebar prefs document. */
export const SETTINGS_KEY = 'github'

function settingsEqual(left: GithubPluginSettings, right: GithubPluginSettings): boolean {
  return left.showReviewRequested === right.showReviewRequested
    && left.showPrActivity === right.showPrActivity
    && left.showComments === right.showComments
    && left.showCi === right.showCi
    && left.showOther === right.showOther
    && left.pollSeconds === right.pollSeconds
}

/** The ids of every OPEN github tab across both panes (tolerant structural walk). */
function githubTabIds(state: SidebarState | undefined): string[] {
  if (state === undefined) return []
  const ids: string[] = []
  const walk = (node: unknown): void => {
    const record = node as { kind?: unknown; tabs?: unknown; children?: unknown } | null
    if (record === null || typeof record !== 'object') return
    if (record.kind === 'leaf' && Array.isArray(record.tabs)) {
      for (const tab of record.tabs) {
        const candidate = tab as { type?: unknown; id?: unknown } | null
        if (candidate?.type === 'github' && typeof candidate.id === 'string') ids.push(candidate.id)
      }
      return
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) walk(child)
    }
  }
  walk((state as { splits?: unknown }).splits)
  walk((state as { bottomSplits?: unknown }).bottomSplits)
  return ids
}

/**
 * Create the GitHub inbox store. The timer starts on the first
 * ensurePolling (badge render or view mount) and keeps the badge live
 * while the tab is open but inactive — a never-opened tab has no pill to
 * render, so it never polls. Overlapping polls are skipped, hidden
 * documents skip the fetch, a failed poll keeps the last snapshot, and a
 * poll that started before a local mutation (markRead/Done/AllRead) is
 * discarded on settle so removed threads cannot resurrect.
 * @param apiFace - the typed githubState call (dependency-injected for tests).
 * @param service - the betterSidebar service for settings sync and the badge bridge.
 * @returns the store bound to one plugin activation.
 */
export function createGithubInboxStore(
  apiFace: Pick<typeof api, 'githubState'>,
  service: BetterSidebarService,
): GithubInboxStore {
  const initialSettings = parseGithubSettings(service.getSnapshot().prefs.pluginSettings[SETTINGS_KEY])
  let state: GithubInboxStoreState = { snapshot: null, settings: initialSettings }
  const listeners = new Set<() => void>()
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  // Local mutations bump this counter; a poll that STARTED before a
  // mutation carries the pre-mutation list and is discarded on settle.
  let version = 0

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  // The gear popup writes pluginSettings['github'] through the sidebar's
  // settings seam — re-sync our settings when the sidebar prefs change.
  const detachSettings = service.subscribeState(() => {
    const next = parseGithubSettings(service.getSnapshot().prefs.pluginSettings[SETTINGS_KEY])
    if (!settingsEqual(next, state.settings)) {
      state = { ...state, settings: next }
      emit()
    }
  })

  const badgeValue = (): string | number | null => {
    const { snapshot, settings } = state
    if (snapshot === null || !snapshot.configured || snapshot.threads.length === 0) return null
    const count = countUnread(filterThreads(snapshot.threads, settings))
    if (count === 0) return null
    return count > 99 ? '99+' : count
  }

  // The tab strip renders the badge from the descriptor hook, but the
  // strip itself only re-renders on SIDEBAR state changes — it has no
  // dependency on this store. Bridge: whenever the store changes, bump
  // every open GitHub tab's meta to the fresh badge value, which notifies
  // the sidebar store and re-renders the strip. The value guard skips the
  // bump when the badge did not change.
  let lastBadge: string | number | null | undefined
  const bumpBadge = (): void => {
    const value = badgeValue()
    if (value === lastBadge) return
    lastBadge = value
    for (const tabId of githubTabIds(service.getSnapshot().state)) {
      service.updateTab(tabId, { meta: value })
    }
  }

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  subscribe(bumpBadge)

  const nextDelay = (): number => {
    const snapshot = state.snapshot
    if (snapshot === null || !snapshot.configured) return UNCONFIGURED_RETRY_MS
    return Math.max(state.settings.pollSeconds, snapshot.pollIntervalSec) * 1000
  }

  const adopt = (snapshot: GithubStateResult): void => {
    if (!disposed) {
      state = { ...state, snapshot }
      emit()
    }
  }

  const tick = (): void => {
    if (disposed) return
    if (typeof document !== 'undefined' && document.hidden) {
      timer = setTimeout(tick, nextDelay())
      return
    }
    if (inFlight === null) {
      const startedAt = version
      inFlight = apiFace.githubState(false)
        .then(snapshot => {
          if (version === startedAt) adopt(snapshot)
        })
        .catch(() => { /* the host is the plugin server itself — keep the last snapshot */ })
        .finally(() => { inFlight = null })
    }
    timer = setTimeout(tick, nextDelay())
  }

  return {
    getState: () => state,
    subscribe,
    ensurePolling: () => {
      if (!disposed && timer === null) timer = setTimeout(tick, 0)
    },
    refresh: async () => {
      // Respect the overlap guard like the timer does: wait out an
      // in-flight poll, then force past the host freshness window. A
      // mutation during the wait discards this fetch's stale result.
      if (inFlight !== null) await inFlight
      const startedAt = version
      const snapshot = await apiFace.githubState(true)
      if (version === startedAt) adopt(snapshot)
    },
    removeLocal: (id) => {
      const snapshot = state.snapshot
      if (snapshot === null) return
      version += 1
      state = { ...state, snapshot: { ...snapshot, threads: snapshot.threads.filter(thread => thread.id !== id) } }
      emit()
    },
    clearLocal: () => {
      const snapshot = state.snapshot
      if (snapshot === null) return
      version += 1
      state = { ...state, snapshot: { ...snapshot, threads: [] } }
      emit()
    },
    setSettings: (patch) => {
      state = { ...state, settings: { ...state.settings, ...patch } }
      emit()
    },
    badgeValue,
    dispose: () => {
      disposed = true
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      detachSettings()
      listeners.clear()
    },
  }
}
