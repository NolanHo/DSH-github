/**
 * The GitHub inbox view. Interaction model:
 * - the TITLE opens the thread in the sidebar browser; the rest of the row
 *   expands/collapses the detail panel (chevron included);
 * - primary actions (Approve / Request changes / Comment / Merge) live in
 *   the expanded panel with inline confirm bars; read/done/open actions
 *   fold into a secondary "more" strip;
 * - multi-select + per-repo "mark all read" for bulk cleanup;
 * - incoming polls never reflow the list while a thread is expanded — a
 *   banner counts the fresh items and applies them on demand;
 * - actions disable while unconfigured or auth-failed (read-only).
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
