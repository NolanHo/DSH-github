/**
 * Deployment configuration of dsh-github (every field optional; defaults
 * fill in). The Loader normally validates cordis config against exported
 * schemas; this standalone resolver applies the same defaults for direct
 * callers and fails loud on wrong-typed values.
 * @module dsh-github/config
 */

/** Default GitHub REST base (override for GHES deployments). */
export const GITHUB_API_BASE_DEFAULT = 'https://api.github.com'
/** Hard floor for the effective poll interval (GitHub's documented cadence). */
export const GITHUB_POLL_FLOOR_MIN = 60
/** GitHub's own per_page cap for the notifications endpoint. */
export const GITHUB_PER_PAGE_MAX = 50
/** Upper bound of inbox pages one poll walks. */
export const GITHUB_MAX_PAGES = 5

/** Deploy-tunable knobs, all optional (defaults below). */
export interface GithubConfig {
  /** Explicit PAT; prefer the gh CLI login or GH_TOKEN/GITHUB_TOKEN env. */
  githubToken?: string
  /** GitHub REST base URL (GitHub Enterprise Server override). */
  githubApiBase?: string
  /** Explicit web origin for thread links (GHES subpath deployments). */
  githubWebBase?: string
  /** Floor of the effective poll interval in seconds (min 60). */
  githubPollFloorSeconds?: number
  /** Inbox threads per API page (GitHub caps at 50). */
  githubPerPage?: number
  /** Whether the Merge action is available (OFF by default). */
  githubAllowMerge?: boolean
}

/** Fully defaulted configuration consumed by the node half. */
export interface ResolvedGithubConfig {
  token?: string
  apiBase: string
  webBase?: string
  pollFloorSeconds: number
  perPage: number
  allowMerge: boolean
}

/** Fail loud with a readable message for one misconfigured field. */
function fail(field: string, detail: string): never {
  throw new Error(`dsh-github: invalid config ${field}: ${detail}`)
}

/**
 * Apply defaults after (or without) Loader schema validation.
 * @param config - deployment-provided settings.
 * @returns complete settings consumed by the node half.
 */
export function resolveGithubConfig(config: GithubConfig | undefined): ResolvedGithubConfig {
  const token = config?.githubToken
  if (token !== undefined && typeof token !== 'string') fail('githubToken', 'must be a string')
  const apiBase = config?.githubApiBase ?? GITHUB_API_BASE_DEFAULT
  if (typeof apiBase !== 'string' || !/^https?:\/\//.test(apiBase)) fail('githubApiBase', 'must be an http(s) URL')
  const webBase = config?.githubWebBase
  if (webBase !== undefined && (typeof webBase !== 'string' || !/^https?:\/\//.test(webBase))) fail('githubWebBase', 'must be an http(s) URL')
  const pollFloorSeconds = config?.githubPollFloorSeconds ?? GITHUB_POLL_FLOOR_MIN
  if (typeof pollFloorSeconds !== 'number' || !Number.isInteger(pollFloorSeconds) || pollFloorSeconds < GITHUB_POLL_FLOOR_MIN) fail('githubPollFloorSeconds', `must be an integer ≥ ${GITHUB_POLL_FLOOR_MIN}`)
  const perPage = config?.githubPerPage ?? GITHUB_PER_PAGE_MAX
  if (typeof perPage !== 'number' || !Number.isInteger(perPage) || perPage < 1 || perPage > GITHUB_PER_PAGE_MAX) fail('githubPerPage', `must be an integer 1–${GITHUB_PER_PAGE_MAX}`)
  const allowMerge = config?.githubAllowMerge ?? false
  if (typeof allowMerge !== 'boolean') fail('githubAllowMerge', 'must be a boolean')
  return {
    ...(token !== undefined && token !== '' ? { token } : {}),
    apiBase,
    ...(webBase !== undefined && webBase !== '' ? { webBase } : {}),
    pollFloorSeconds,
    perPage,
    allowMerge,
  }
}
