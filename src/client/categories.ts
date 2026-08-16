/**
 * Pure classification / filter / grouping functions over the inbox wire
 * shapes (node-free, unit-testable).
 * @module dsh-github-inbox/client/categories
 */
import { GITHUB_POLL_SECONDS_DEFAULT, GITHUB_POLL_SECONDS_MAX, GITHUB_POLL_SECONDS_MIN, type GithubPluginSettings, type GithubThread } from '../shared.ts'

/** The five inbox categories the user can filter with checkboxes. */
export type GithubCategory = 'reviewRequested' | 'prActivity' | 'comments' | 'ci' | 'other'

/** The pluginSettings key each category's checkbox reads and writes. */
export const GITHUB_CATEGORY_SETTING_KEYS: Record<GithubCategory, keyof GithubPluginSettings> = {
  reviewRequested: 'showReviewRequested',
  prActivity: 'showPrActivity',
  comments: 'showComments',
  ci: 'showCi',
  other: 'showOther',
}

/**
 * Classify one thread into its display category. GitHub's reason is
 * per-thread and drifts over the thread's life (official behavior: an
 * author thread keeps reporting 'author' even for later comments; an
 * @-mention upgrades it to 'mention'), so the mapping is display-level —
 * it never promises event-level precision.
 * @param thread - the thread's reason and subject type.
 * @returns the category driving the filter checkboxes.
 */
export function categorizeThread(thread: Pick<GithubThread, 'reason' | 'type'>): GithubCategory {
  if (thread.reason === 'review_requested') return 'reviewRequested'
  if (thread.reason === 'ci_activity') return 'ci'
  if (thread.reason === 'author') return thread.type === 'PullRequest' ? 'prActivity' : 'comments'
  if (thread.reason === 'comment' || thread.reason === 'mention' || thread.reason === 'team_mention') return 'comments'
  return 'other'
}

/** The review verdicts the thread title can carry. */
export type GithubVerdict = 'approved' | 'changesRequested'

/**
 * Detect a review verdict from the thread title (GitHub writes 'X approved
 * these changes' / 'X requested changes on this pull request' into it).
 * Display-level only — no extra API call, and no promise of precision.
 * @param title - the subject.title of a PR thread.
 * @returns the verdict tag, or undefined when the title carries none.
 */
export function reviewVerdict(title: string): GithubVerdict | undefined {
  const lower = title.toLowerCase()
  if (lower.includes('approved these changes')) return 'approved'
  if (lower.includes('requested changes') || lower.includes('changes requested')) return 'changesRequested'
  return undefined
}

/**
 * Apply the category filters to a thread list (pure).
 * @param threads - the inbox snapshot's threads.
 * @param settings - the plugin's filter settings.
 * @returns only the threads whose category checkbox is on.
 */
export function filterThreads(threads: readonly GithubThread[], settings: GithubPluginSettings): GithubThread[] {
  return threads.filter(thread => settings[GITHUB_CATEGORY_SETTING_KEYS[categorizeThread(thread)]] === true)
}

/** Count the unread threads of a list (pure; the badge uses the FILTERED list). */
export function countUnread(threads: readonly GithubThread[]): number {
  let count = 0
  for (const thread of threads) {
    if (thread.unread) count += 1
  }
  return count
}

/**
 * The PR/issue number of a thread URL ('.../pulls/123' → 123). The inbox
 * subject.url is the REST URL of the subject, which carries the number.
 * @returns the number, or undefined when the URL carries none.
 */
export function threadNumber(url: string): number | undefined {
  const match = /\/(?:pulls?|issues?)\/(\d+)/.exec(url)
  return match === null ? undefined : Number(match[1])
}

/** One repository's threads, grouped for the list. */
export interface GithubThreadGroup {
  repo: string
  threads: GithubThread[]
}

/**
 * Group a thread list by repository. Threads keep their (newest-first)
 * order inside each group; groups are ordered by their newest thread.
 * @param threads - the filtered thread list.
 * @returns the groups in display order.
 */
export function groupThreads(threads: readonly GithubThread[]): GithubThreadGroup[] {
  const byRepo = new Map<string, GithubThread[]>()
  for (const thread of threads) {
    const bucket = byRepo.get(thread.repo)
    if (bucket === undefined) byRepo.set(thread.repo, [thread])
    else bucket.push(thread)
  }
  const groups = [...byRepo.entries()].map(([repo, bucket]) => ({ repo, threads: bucket }))
  groups.sort((a, b) => (b.threads[0]?.updatedAt ?? '').localeCompare(a.threads[0]?.updatedAt ?? ''))
  return groups
}

/** Normalize a raw pluginSettings blob into validated settings (defaults + clamp). */
export function parseGithubSettings(raw: unknown): GithubPluginSettings {
  const record = raw === null || typeof raw !== 'object' ? {} : raw as Record<string, unknown>
  const booleanOf = (key: string, fallback: boolean): boolean =>
    typeof record[key] === 'boolean' ? record[key] as boolean : fallback
  const poll = typeof record.pollSeconds === 'number' && Number.isFinite(record.pollSeconds as number)
    ? Math.min(GITHUB_POLL_SECONDS_MAX, Math.max(GITHUB_POLL_SECONDS_MIN, Math.round(record.pollSeconds as number)))
    : GITHUB_POLL_SECONDS_DEFAULT
  return {
    showReviewRequested: booleanOf('showReviewRequested', true),
    showPrActivity: booleanOf('showPrActivity', true),
    showComments: booleanOf('showComments', true),
    showCi: booleanOf('showCi', false),
    showOther: booleanOf('showOther', true),
    pollSeconds: poll,
  }
}
