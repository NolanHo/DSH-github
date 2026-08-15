/** Pure category/filter/grouping/settings tests (node env). */
import { describe, expect, it } from 'vitest'

import {
  categorizeThread,
  countUnread,
  filterThreads,
  GITHUB_CATEGORY_SETTING_KEYS,
  groupThreads,
  parseGithubSettings,
  reviewVerdict,
  threadNumber,
} from '../src/client/categories.ts'
import type { GithubThread } from '../src/shared.ts'

function thread(id: string, reason: string, type: string, repo = 'o/r'): GithubThread {
  return {
    id,
    unread: true,
    reason,
    repo,
    title: 'title ' + id,
    url: 'https://api.example.test/repos/' + repo + '/pulls/' + id,
    htmlUrl: 'https://github.com/' + repo + '/pull/' + id,
    type,
    updatedAt: '2024-01-0' + id + 'T00:00:00Z',
  }
}

const defaults = parseGithubSettings(undefined)

describe('categories (pure)', () => {
  it('categorizes the five categories from reason + subject type', () => {
    expect(categorizeThread({ reason: 'review_requested', type: 'PullRequest' })).toBe('reviewRequested')
    expect(categorizeThread({ reason: 'ci_activity', type: 'PullRequest' })).toBe('ci')
    expect(categorizeThread({ reason: 'author', type: 'PullRequest' })).toBe('prActivity')
    expect(categorizeThread({ reason: 'author', type: 'Issue' })).toBe('comments')
    expect(categorizeThread({ reason: 'comment', type: 'Issue' })).toBe('comments')
    expect(categorizeThread({ reason: 'mention', type: 'PullRequest' })).toBe('comments')
    expect(categorizeThread({ reason: 'team_mention', type: 'Issue' })).toBe('comments')
    expect(categorizeThread({ reason: 'subscribed', type: 'Issue' })).toBe('other')
  })

  it('detects review verdicts from the subject title (display-level)', () => {
    expect(reviewVerdict('alice approved these changes')).toBe('approved')
    expect(reviewVerdict('bob requested changes on this pull request')).toBe('changesRequested')
    expect(reviewVerdict('merged pull request #1')).toBeUndefined()
  })

  it('filters by the settings checkboxes (CI hidden by default)', () => {
    const threads = [
      thread('1', 'review_requested', 'PullRequest'),
      thread('2', 'author', 'PullRequest'),
      thread('3', 'ci_activity', 'PullRequest'),
      thread('4', 'mention', 'Issue'),
    ]
    expect(filterThreads(threads, defaults).map(t => t.id)).toEqual(['1', '2', '4'])
    expect(filterThreads(threads, { ...defaults, showCi: true }).map(t => t.id)).toEqual(['1', '2', '3', '4'])
    expect(GITHUB_CATEGORY_SETTING_KEYS.ci).toBe('showCi')
  })

  it('counts unread threads', () => {
    const threads = [thread('1', 'review_requested', 'PullRequest'), { ...thread('2', 'author', 'PullRequest'), unread: false }, thread('3', 'mention', 'Issue')]
    expect(countUnread(threads)).toBe(2)
  })

  it('extracts the PR/issue number from thread URLs', () => {
    expect(threadNumber('https://api.github.com/repos/o/r/pulls/123')).toBe(123)
    expect(threadNumber('https://api.github.com/repos/o/r/issues/77')).toBe(77)
    expect(threadNumber('https://api.github.com/repos/o/r/commits/abc')).toBeUndefined()
  })

  it('groups threads by repo, newest group first', () => {
    const threads = [
      thread('2', 'review_requested', 'PullRequest', 'b/r'),
      thread('1', 'review_requested', 'PullRequest', 'a/r'),
      thread('3', 'mention', 'Issue', 'b/r'),
    ]
    const groups = groupThreads(threads)
    expect(groups.map(g => g.repo)).toEqual(['b/r', 'a/r'])
    expect(groups[0]?.threads.map(t => t.id)).toEqual(['2', '3'])
  })

  it('parses raw pluginSettings into validated settings (defaults + clamp)', () => {
    expect(defaults).toEqual({ showReviewRequested: true, showPrActivity: true, showComments: true, showCi: false, showOther: true, pollSeconds: 60 })
    const parsed = parseGithubSettings({ showCi: true, pollSeconds: 999 })
    expect(parsed.showCi).toBe(true)
    expect(parsed.pollSeconds).toBe(300)
    expect(parseGithubSettings({ pollSeconds: 1 }).pollSeconds).toBe(60)
    expect(parseGithubSettings('garbage')).toEqual(defaults)
  })
})
