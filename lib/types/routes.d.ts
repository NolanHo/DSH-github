/**
 * The GitHub routes of the plugin's JSON API ('github.state' /
 * 'github.thread' / 'github.markRead' / 'github.markDone' /
 * 'github.markAllRead' / 'github.review' / 'github.comment' /
 * 'github.mergeStatus' / 'github.merge'). Payload validation is strict
 * and SYNCHRONOUS (wrong values throw before any async work — the route
 * table's dispatch catches both paths); GitHub-side failures re-throw
 * through githubErrorToWire so the client gets the machine-readable codes.
 *
 * The inbox is account-global (not session-scoped): no payload here reads
 * any session identifier.
 */
import { type GithubInboxService } from './github.ts';
import type { GithubMergeStatus, GithubStateResult, GithubThread } from './shared.ts';
/**
 * Resolve one API method by name with an own-property check, so Object
 * prototype members (constructor / toString / __proto__ …) can never
 * bypass the unknown-method contract.
 * @param api - the route group.
 * @param method - the request's method name.
 * @returns the dispatchable handler, or undefined for unknown names.
 */
export declare function apiMethod(api: GithubRoutes, method: string): ((payload: unknown) => unknown) | undefined;
/** The GitHub routes of the plugin API. */
export interface GithubRoutes {
    /** The inbox snapshot (conditional fetch behind the freshness window; force bypasses it). */
    state(payload: unknown): Promise<GithubStateResult>;
    /** One thread's detail plus its latest comment body. */
    thread(payload: unknown): Promise<{
        thread: GithubThread;
        commentBody?: string;
    }>;
    markRead(payload: unknown): Promise<{
        ok: true;
    }>;
    markDone(payload: unknown): Promise<{
        ok: true;
    }>;
    markAllRead(payload: unknown): Promise<{
        ok: true;
    }>;
    review(payload: unknown): Promise<{
        ok: true;
    }>;
    comment(payload: unknown): Promise<{
        ok: true;
    }>;
    mergeStatus(payload: unknown): Promise<GithubMergeStatus>;
    merge(payload: unknown): Promise<{
        ok: true;
    }>;
}
/**
 * Build the GitHub route group over one inbox service.
 * @param service - the host's inbox service (token chain + cache + actions).
 */
export declare function buildGithubApi(service: GithubInboxService): GithubRoutes;
