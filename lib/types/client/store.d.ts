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
import type { BetterSidebarService } from 'dsh-better-sidebar/client/service';
import type { GithubPluginSettings, GithubStateResult } from '../shared.ts';
import type { api } from './api.ts';
/** The store's published state (stable object, replaced on changes). */
export interface GithubInboxStoreState {
    /** The last inbox snapshot; null before the first poll settles. */
    snapshot: GithubStateResult | null;
    /** The plugin's filter settings (synced from pluginSettings['github']). */
    settings: GithubPluginSettings;
}
/** The shared store of the GitHub tab (one per plugin activation). */
export interface GithubInboxStore {
    getState(): GithubInboxStoreState;
    subscribe(listener: () => void): () => void;
    /** Arm the polling timer (idempotent; the badge arms it on first render). */
    ensurePolling(): void;
    /** Force a fresh snapshot (the refresh button; bypasses host freshness). */
    refresh(): Promise<void>;
    /** Drop one thread locally after a successful markRead / markDone. */
    removeLocal(id: string): void;
    /** Drop every thread locally after a successful markAllRead. */
    clearLocal(): void;
    /** Merge one filter patch locally (the view persists it separately). */
    setSettings(patch: Partial<GithubPluginSettings>): void;
    /** The badge pill value: filtered unread count, 99+ capped, null = hidden. */
    badgeValue(): string | number | null;
    /** Stop the timer and detach the settings subscription (fiber disposal). */
    dispose(): void;
}
/** The plugin's settings blob key inside the sidebar prefs document. */
export declare const SETTINGS_KEY = "github";
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
export declare function createGithubInboxStore(apiFace: Pick<typeof api, 'githubState'>, service: BetterSidebarService): GithubInboxStore;
