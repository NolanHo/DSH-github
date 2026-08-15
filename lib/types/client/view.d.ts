/**
 * The GitHub inbox view: status line (setup guide / auth warning /
 * stale-snapshot warning), filter chips, a repo-grouped thread list, and
 * the per-thread action surface — mark read / done, open in the sidebar
 * browser or externally, PR review verdicts (approve / request changes),
 * general comments, and the gated merge panel (CI status + method +
 * explicit confirm).
 *
 * The store owns polling; this component only renders its snapshot. Chips
 * write the same pluginSettings['github'] keys the gear popup binds: local
 * optimistic state through the store, persisted through the sidebar's
 * settings route.
 */
import { type ReactNode } from 'react';
import type { Context } from 'cordis';
import type { SessionScope } from 'dsh-better-sidebar/client/service';
import { type GithubInboxStore } from './store.ts';
/** The GitHub inbox tab body. */
export declare function InboxView(props: {
    store: GithubInboxStore;
    ctx: Context;
    scope: SessionScope;
}): ReactNode;
