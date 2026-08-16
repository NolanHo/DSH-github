/**
 * Deployment configuration of dsh-github (every field optional; defaults
 * fill in). The Loader normally validates cordis config against exported
 * schemas; this standalone resolver applies the same defaults for direct
 * callers and fails loud on wrong-typed values.
 * @module dsh-github-inbox/config
 */
/** Default GitHub REST base (override for GHES deployments). */
export declare const GITHUB_API_BASE_DEFAULT = "https://api.github.com";
/** Hard floor for the effective poll interval (GitHub's documented cadence). */
export declare const GITHUB_POLL_FLOOR_MIN = 60;
/** GitHub's own per_page cap for the notifications endpoint. */
export declare const GITHUB_PER_PAGE_MAX = 50;
/** Upper bound of inbox pages one poll walks. */
export declare const GITHUB_MAX_PAGES = 5;
/** Deploy-tunable knobs, all optional (defaults below). */
export interface GithubConfig {
    /** Explicit PAT; prefer the gh CLI login or GH_TOKEN/GITHUB_TOKEN env. */
    githubToken?: string;
    /** GitHub REST base URL (GitHub Enterprise Server override). */
    githubApiBase?: string;
    /** Explicit web origin for thread links (GHES subpath deployments). */
    githubWebBase?: string;
    /** Floor of the effective poll interval in seconds (min 60). */
    githubPollFloorSeconds?: number;
    /** Inbox threads per API page (GitHub caps at 50). */
    githubPerPage?: number;
    /** Whether the Merge action is available (OFF by default). */
    githubAllowMerge?: boolean;
}
/** Fully defaulted configuration consumed by the node half. */
export interface ResolvedGithubConfig {
    token?: string;
    apiBase: string;
    webBase?: string;
    pollFloorSeconds: number;
    perPage: number;
    allowMerge: boolean;
}
/**
 * Apply defaults after (or without) Loader schema validation.
 * @param config - deployment-provided settings.
 * @returns complete settings consumed by the node half.
 */
export declare function resolveGithubConfig(config: GithubConfig | undefined): ResolvedGithubConfig;
