/**
 * Pure classification / filter / grouping functions over the inbox wire
 * shapes (node-free, unit-testable).
 * @module dsh-github-inbox/client/categories
 */
import { type GithubPluginSettings, type GithubThread } from '../shared.ts';
/** The five inbox categories the user can filter with checkboxes. */
export type GithubCategory = 'reviewRequested' | 'prActivity' | 'comments' | 'ci' | 'other';
/** The pluginSettings key each category's checkbox reads and writes. */
export declare const GITHUB_CATEGORY_SETTING_KEYS: Record<GithubCategory, keyof GithubPluginSettings>;
/**
 * Classify one thread into its display category. GitHub's reason is
 * per-thread and drifts over the thread's life (official behavior: an
 * author thread keeps reporting 'author' even for later comments; an
 * @-mention upgrades it to 'mention'), so the mapping is display-level —
 * it never promises event-level precision.
 * @param thread - the thread's reason and subject type.
 * @returns the category driving the filter checkboxes.
 */
export declare function categorizeThread(thread: Pick<GithubThread, 'reason' | 'type'>): GithubCategory;
/** The review verdicts the thread title can carry. */
export type GithubVerdict = 'approved' | 'changesRequested';
/**
 * Detect a review verdict from the thread title (GitHub writes 'X approved
 * these changes' / 'X requested changes on this pull request' into it).
 * Display-level only — no extra API call, and no promise of precision.
 * @param title - the subject.title of a PR thread.
 * @returns the verdict tag, or undefined when the title carries none.
 */
export declare function reviewVerdict(title: string): GithubVerdict | undefined;
/**
 * Apply the category filters to a thread list (pure).
 * @param threads - the inbox snapshot's threads.
 * @param settings - the plugin's filter settings.
 * @returns only the threads whose category checkbox is on.
 */
export declare function filterThreads(threads: readonly GithubThread[], settings: GithubPluginSettings): GithubThread[];
/** Count the unread threads of a list (pure; the badge uses the FILTERED list). */
export declare function countUnread(threads: readonly GithubThread[]): number;
/**
 * The PR/issue number of a thread URL ('.../pulls/123' → 123). The inbox
 * subject.url is the REST URL of the subject, which carries the number.
 * @returns the number, or undefined when the URL carries none.
 */
export declare function threadNumber(url: string): number | undefined;
/** One repository's threads, grouped for the list. */
export interface GithubThreadGroup {
    repo: string;
    threads: GithubThread[];
}
/**
 * Group a thread list by repository. Threads keep their (newest-first)
 * order inside each group; groups are ordered by their newest thread.
 * @param threads - the filtered thread list.
 * @returns the groups in display order.
 */
export declare function groupThreads(threads: readonly GithubThread[]): GithubThreadGroup[];
/** Normalize a raw pluginSettings blob into validated settings (defaults + clamp). */
export declare function parseGithubSettings(raw: unknown): GithubPluginSettings;
