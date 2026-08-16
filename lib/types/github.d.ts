/**
 * Node half of dsh-github: the GitHub REST client, the token resolution
 * chain, and the request-driven inbox cache. No autonomous polling lives
 * here — every client poll triggers a conditional GET (If-Modified-Since;
 * a 304 reuses the cached threads and costs no rate limit), and mutations
 * update the cache optimistically.
 *
 * The token never crosses to the browser: it resolves from the plugin
 * configuration, the local gh CLI login, or the GITHUB_TOKEN / GH_TOKEN
 * environment, in that order. The feature degrades to an unconfigured
 * guide when no source yields a token.
 * @module dsh-github-inbox/github
 */
import { type ResolvedGithubConfig } from './config.ts';
import type { GithubMergeStatus, GithubStateResult, GithubThread } from './shared.ts';
import { GithubError } from './wire.ts';
export type { GithubCheck, GithubMergeStatus, GithubStateResult, GithubThread, } from './shared.ts';
export { GITHUB_API_BASE_DEFAULT, GITHUB_PER_PAGE_MAX, GITHUB_POLL_FLOOR_MIN, GITHUB_MAX_PAGES } from './config.ts';
export type { ResolvedGithubConfig } from './config.ts';
/** Cap of one review/comment body (chars) accepted by the action routes. */
export declare const GITHUB_BODY_MAX: number;
/** A non-2xx GitHub API response. */
export declare class GithubApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/**
 * The typed failure of the gh probe when the binary is NOT installed
 * (cached for the process lifetime — no repeated spawns). Exported because
 * it is part of the injectable probe contract: tests and alternative
 * probes throw it to report a missing binary.
 */
export declare class GhMissingError extends Error {
}
/** Raw shape of one GET /notifications row (the fields this module reads). */
interface RawNotification {
    id: string;
    unread: boolean;
    reason: string;
    updated_at: string;
    subject?: {
        title: string;
        url: string | null;
        latest_comment_url: string | null;
        type: string | null;
    } | null;
    repository?: {
        full_name: string;
    } | null;
}
/**
 * The web origin thread links derive from: the explicit deployment
 * override, or the api base minus a trailing /api/v3 (the public
 * api.github.com base maps to github.com). GHES deployments whose web UI
 * lives on a different origin/path set githubWebBase explicitly.
 */
export declare function webOriginOf(apiBase: string, webBase: string | undefined): string;
/**
 * Derive the human web URL from a subject's REST URL. The inbox subject.url
 * is the API endpoint (api.github.com/repos/o/r/pulls/1) — opening it raw
 * serves JSON. The web URL is the same path on the web origin with the
 * type segment singularized ('/repos/o/r/pulls/1' → '/o/r/pull/1').
 * Falls back to the API URL when the path cannot be mapped.
 */
export declare function htmlUrlOf(apiUrl: string, repo: string, type: string, webOrigin: string): string;
/**
 * Fold one raw notification row into the client-visible thread shape.
 * Tolerates null subject/repository fields (a single malformed row must
 * not fail the whole inbox).
 */
export declare function mapThread(raw: RawNotification, webOrigin: string): GithubThread;
/** Run gh auth token and return the trimmed token, or a typed failure. */
export declare function execGhToken(): Promise<string>;
/**
 * The token the deployment environment provides: GITHUB_TOKEN first, then
 * GH_TOKEN. Empty strings count as absent — an empty GITHUB_TOKEN must not
 * shadow a valid GH_TOKEN.
 */
export declare function envToken(): string | undefined;
/** Probes the gh CLI login; injectable for tests. */
export type GhTokenProbe = () => Promise<string>;
/** The URL a Link header's rel="next" names, or null when there is none. */
export declare function nextPageUrl(headers: Headers): string | null;
/** Map a thrown GitHub failure onto the plugin's wire error vocabulary. */
export declare function githubErrorToWire(error: unknown): GithubError;
/** GitHub REST client bound to one token. */
export declare class GithubClient {
    private readonly base;
    private readonly token;
    private readonly perPage;
    private readonly webOrigin;
    constructor(base: string, token: string, perPage: number, webBase?: string);
    private headers;
    /**
     * One authed GET. A relative path is joined onto the API base; an
     * absolute http(s) URL (the thread's latest_comment_url) is used as-is
     * (keeps GHES deployments with an /api/v3 base path from double-prefixing
     * the comment endpoint) — and only when it shares the API base's origin,
     * so the bearer token never leaves the trusted host.
     */
    private get;
    /** One authed mutation (PATCH/POST/PUT/DELETE); returns the parsed body. */
    private send;
    /** Poll interval from a response's X-Poll-Interval (GitHub's documented cadence). */
    private pollIntervalOf;
    /**
     * List unread inbox threads, walking up to GITHUB_MAX_PAGES pages via
     * the Link header. The FIRST page is conditional on lastModified (a 304
     * returns notModified with no body cost, and the cached full list stays
     * valid); the follow-up pages are only fetched when the first page
     * changed, so an unchanged inbox costs one conditional request per poll
     * regardless of inbox size.
     * @returns the folded threads (empty on 304) plus the cache headers.
     */
    fetchInbox(lastModified?: string): Promise<{
        notModified: boolean;
        threads: GithubThread[];
        lastModified?: string;
        pollIntervalSec: number;
    }>;
    /** One thread's detail plus its latest comment body (both fail soft). */
    fetchThreadDetail(id: string): Promise<{
        thread: GithubThread;
        commentBody?: string;
    }>;
    /** Mark one thread read (PATCH, 204). */
    markThreadRead(id: string): Promise<void>;
    /** Mark one thread done — GitHub's archive (DELETE, 204). */
    markThreadDone(id: string): Promise<void>;
    /** Mark every unread thread read (PUT, 205). */
    markAllRead(): Promise<void>;
    /** Submit one PR review event (APPROVE / REQUEST_CHANGES / COMMENT). */
    submitReview(repo: string, pr: number, event: string, body?: string): Promise<void>;
    /** Post a general comment on an issue or PR (the shared comments endpoint). */
    addComment(repo: string, issue: number, body: string): Promise<void>;
    /** Mergeability of one PR plus its head-sha check runs, normalized. */
    fetchMergeStatus(repo: string, pr: number): Promise<GithubMergeStatus>;
    /** Merge one PR with the chosen method (merge / squash / rebase). */
    merge(repo: string, pr: number, method: string): Promise<void>;
}
/**
 * The plugin's host service: token resolution with caching, the
 * request-driven inbox cache (conditional GETs), and the mutation surface
 * with optimistic cache updates. One instance per node half.
 */
export declare class GithubInboxService {
    private readonly config;
    private readonly probeGh;
    private tokenCache?;
    private ghMissing;
    private cache?;
    constructor(config: ResolvedGithubConfig, probeGh?: GhTokenProbe);
    private ghAvailable;
    /** Resolve a token through config → gh CLI → environment (with caching). */
    private resolveToken;
    private snapshot;
    /**
     * The inbox snapshot. Fetches (conditionally) only when the cache is
     * staler than the effective poll interval; force bypasses freshness for
     * the refresh button. Failures keep the last threads and surface the
     * error code — the view keeps rendering stale data with a warning.
     */
    state(force: boolean): Promise<GithubStateResult>;
    /** One thread's detail plus its latest comment body. */
    thread(id: string): Promise<{
        thread: GithubThread;
        commentBody?: string;
    }>;
    /** Mark one thread read and drop it from the cached inbox (it is no longer unread). */
    markRead(id: string): Promise<void>;
    /** Mark one thread done (archived) and drop it from the cached inbox. */
    markDone(id: string): Promise<void>;
    /** Mark every thread read and clear the cached inbox. */
    markAllRead(): Promise<void>;
    /** Submit one PR review event. */
    review(repo: string, pr: number, event: string, body?: string): Promise<void>;
    /** Post a general comment on an issue or PR. */
    comment(repo: string, issue: number, body: string): Promise<void>;
    /** Mergeability plus head checks for the merge panel. */
    mergeStatus(repo: string, pr: number): Promise<GithubMergeStatus>;
    /** Merge one PR (gated by the deployment's githubAllowMerge). */
    merge(repo: string, pr: number, method: string): Promise<void>;
    private requireClient;
    private removeCached;
}
