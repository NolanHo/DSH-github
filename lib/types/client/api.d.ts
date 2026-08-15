/**
 * Typed fetch wrapper over the plugin's own JSON API (/plugins/dsh-github/api).
 * Envelope: {ok: true, value} | {ok: false, error: {code, message}}.
 */
import type { GithubMergeMethod, GithubMergeStatus, GithubReviewEvent, GithubStateResult, GithubThreadDetail } from '../shared.ts';
/** One wire failure of the plugin API. */
export declare class GithubClientError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** The plugin API surface. */
export declare const api: {
    /** The inbox snapshot (force bypasses the host freshness window). */
    githubState: (force?: boolean, signal?: AbortSignal) => Promise<GithubStateResult>;
    /** One thread's detail plus its latest comment body. */
    githubThread: (id: string, signal?: AbortSignal) => Promise<GithubThreadDetail>;
    /** Mark one thread read. */
    githubMarkRead: (id: string) => Promise<{
        ok: true;
    }>;
    /** Mark one thread done (GitHub's archive). */
    githubMarkDone: (id: string) => Promise<{
        ok: true;
    }>;
    /** Mark every unread thread read. */
    githubMarkAllRead: () => Promise<{
        ok: true;
    }>;
    /** Submit one PR review event (APPROVE / REQUEST_CHANGES / COMMENT). */
    githubReview: (repo: string, pr: number, event: GithubReviewEvent, body?: string) => Promise<{
        ok: true;
    }>;
    /** Post a general comment on an issue or PR. */
    githubComment: (repo: string, issue: number, body: string) => Promise<{
        ok: true;
    }>;
    /** Mergeability plus head check runs for the merge panel. */
    githubMergeStatus: (repo: string, pr: number, signal?: AbortSignal) => Promise<GithubMergeStatus>;
    /** Merge one PR with the chosen method (merge / squash / rebase). */
    githubMerge: (repo: string, pr: number, method: GithubMergeMethod) => Promise<{
        ok: true;
    }>;
};
/**
 * Persist the plugin's own filter settings through the sidebar's settings
 * seam (pluginSettings['github'] — the same document the gear popup writes).
 * A runtime fetch to the sidebar's own fenced route: no cross-plugin value
 * import, so the client bundle stays pure.
 */
export declare function callSidebarSettings(patch: Record<string, unknown>): Promise<{
    value?: unknown;
    revision?: number;
}>;
