/** Config resolver tests: defaults fill in, misconfiguration fails loud. */
import { describe, expect, it } from 'vitest'

import {
  GITHUB_API_BASE_DEFAULT,
  GITHUB_MAX_PAGES,
  GITHUB_PER_PAGE_MAX,
  GITHUB_POLL_FLOOR_MIN,
  resolveGithubConfig,
} from '../src/config.ts'

describe('config resolver', () => {
  it('fills every default', () => {
    const resolved = resolveGithubConfig(undefined)
    expect(resolved).toEqual({
      apiBase: GITHUB_API_BASE_DEFAULT,
      pollFloorSeconds: GITHUB_POLL_FLOOR_MIN,
      perPage: GITHUB_PER_PAGE_MAX,
      allowMerge: false,
    })
  })

  it('keeps explicit overrides (token and empty-string webBase dropped)', () => {
    const resolved = resolveGithubConfig({
      githubToken: 'tok',
      githubApiBase: 'https://ghe.example/api/v3',
      githubWebBase: 'https://ghe.example',
      githubPollFloorSeconds: 120,
      githubPerPage: 20,
      githubAllowMerge: true,
    })
    expect(resolved).toEqual({
      token: 'tok',
      apiBase: 'https://ghe.example/api/v3',
      webBase: 'https://ghe.example',
      pollFloorSeconds: 120,
      perPage: 20,
      allowMerge: true,
    })
  })

  it('fails loud on misconfiguration', () => {
    expect(() => resolveGithubConfig({ githubToken: 1 as never })).toThrow('githubToken')
    expect(() => resolveGithubConfig({ githubApiBase: 'not-a-url' })).toThrow('githubApiBase')
    expect(() => resolveGithubConfig({ githubPollFloorSeconds: 30 })).toThrow('githubPollFloorSeconds')
    expect(() => resolveGithubConfig({ githubPerPage: 51 })).toThrow('githubPerPage')
    expect(() => resolveGithubConfig({ githubAllowMerge: 'yes' as never })).toThrow('githubAllowMerge')
  })

  it('exports the page/floor caps the client honors', () => {
    expect(GITHUB_MAX_PAGES).toBe(5)
    expect(GITHUB_POLL_FLOOR_MIN).toBe(60)
  })
})
