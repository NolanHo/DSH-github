/**
 * The GitHub inbox view: status line (setup guide / auth warning /
 * stale-snapshot warning), filter chips, a repo-grouped thread list, and
 * the per-thread action surface — mark read / done, open in the sidebar
 * browser or externally, PR review verdicts (approve / request changes),
 * general comments, and the gated merge panel (CI status + method +
 * explicit confirm).
 *
 * The store owns polling; this component only renders its snapshot. Chips
 * write the same pluginSettings['github'] keys the gear popup binds: local
 * optimistic state through the store, persisted through the sidebar's
 * settings route.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { IconCheckOutline14, IconRefreshOutline14, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context } from 'cordis'
import type { SessionScope } from 'dsh-better-sidebar/client/service'
import type {
  GithubMergeMethod,
  GithubMergeStatus,
  GithubReviewEvent,
  GithubStateResult,
  GithubThread,
  GithubThreadDetail,
} from '../shared.ts'
import {
  categorizeThread,
  countUnread,
  filterThreads,
  GITHUB_CATEGORY_SETTING_KEYS,
  groupThreads,
  reviewVerdict,
  threadNumber,
  type GithubCategory,
} from './categories.ts'
import { api, callSidebarSettings, GithubClientError, type api as apiFace } from './api.ts'
import { relativeTime, t, type CopyKey } from './i18n.ts'
import { SETTINGS_KEY, type GithubInboxStore } from './store.ts'

/** The category order of the filter chips. */
const CATEGORY_ORDER: readonly GithubCategory[] = ['reviewRequested', 'prActivity', 'comments', 'ci', 'other']

/** The chip label key of one category. */
const CHIP_LABELS: Record<GithubCategory, CopyKey> = {
  reviewRequested: 'githubChipReviewRequested',
  prActivity: 'githubChipPrActivity',
  comments: 'githubChipComments',
  ci: 'githubChipCi',
  other: 'githubChipOther',
}

/** The inline tag label key of one category. */
const TAG_LABELS: Record<GithubCategory, CopyKey> = {
  reviewRequested: 'githubCategoryReviewRequested',
  prActivity: 'githubCategoryPrActivity',
  comments: 'githubCategoryComments',
  ci: 'githubCategoryCi',
  other: 'githubCategoryOther',
}

/** The merge-method button label key. */
const METHOD_LABELS: Record<GithubMergeMethod, CopyKey> = {
  squash: 'githubMergeMethodSquash',
  merge: 'githubMergeMethodMerge',
  rebase: 'githubMergeMethodRebase',
}

/** Join class candidates, dropping falsy ones. */
function cx(...candidates: Array<string | false | undefined>): string {
  return candidates.filter(Boolean).join(' ')
}

/** Fold an action failure into a displayable message. */
function actionMessage(error: unknown): string {
  if (error instanceof GithubClientError) return t('githubActionFailed', { message: error.message })
  const message = error instanceof Error ? error.message : String(error)
  return t('githubActionFailed', { message })
}

/** The merge panel's failure text: the gate reads differently from GitHub's rejections. */
function mergeMessage(error: unknown): string {
  if (error instanceof GithubClientError) {
    if (error.code === 'github-forbidden') return t('githubMergeDisabled')
    return error.message
  }
  return error instanceof Error ? error.message : String(error)
}

/** The inbox glyph (outline tray), local to this plugin. */
function IconInboxOutline16({ size = 16 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 9.5h2.4c.55 0 1.05.3 1.32.78l.14.24c.26.45.76.73 1.29.73h.7c.53 0 1.03-.28 1.29-.73l.14-.24c.27-.48.77-.78 1.32-.78h2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** One thread row plus its expansion (detail, actions, merge panel). */
function ThreadRow(props: {
  thread: GithubThread
  expanded: boolean
  busy: boolean
  detail: GithubThreadDetail | null
  detailLoading: boolean
  detailFailed: boolean
  commentDraft: string
  mergeAllowed: boolean
  mergeOpen: boolean
  mergeStatus: GithubMergeStatus | null
  mergeLoading: boolean
  mergeError: string | null
  mergeMethod: GithubMergeMethod
  onToggle: () => void
  onMarkRead: () => void
  onMarkDone: () => void
  onOpenSidebar: () => void
  onApprove: () => void
  onRequestChanges: () => void
  onMergeOpen: () => void
  onMergeMethod: (method: GithubMergeMethod) => void
  onMergeConfirm: () => void
  onCommentDraft: (value: string) => void
  onCommentSend: () => void
}): ReactNode {
  const { thread, busy } = props
  const category = categorizeThread(thread)
  const verdict = thread.type === 'PullRequest' ? reviewVerdict(thread.title) : undefined
  const pr = threadNumber(thread.url)
  return (
    <div className={cx('dgh-thread', 'dgh-cat-' + category)}>
      <button className="dgh-row" onClick={props.onToggle}>
        <span className={cx('dgh-dot', thread.unread && 'dgh-dotUnread')} />
        <span className="dgh-rowTitle">{thread.title}</span>
        <span className="dgh-rowMeta">
          <span className={cx('dgh-tag', 'dgh-tag-' + category)}>{t(TAG_LABELS[category])}</span>
          {verdict !== undefined && (
            <span className={cx('dgh-verdict', verdict === 'approved' ? 'dgh-verdictOk' : 'dgh-verdictBad')}>
              {t(verdict === 'approved' ? 'githubVerdictApproved' : 'githubVerdictChanges')}
            </span>
          )}
          <span className="dgh-rowTime">{relativeTime(thread.updatedAt)}</span>
        </span>
      </button>
      {props.expanded && (
        <div className="dgh-detail">
          <div className="dgh-detailBody">
            {props.detailLoading && <span>{t('githubLoading')}</span>}
            {props.detailFailed && <span>{t('githubDetailLoadFailed')}</span>}
            {!props.detailLoading && !props.detailFailed && (
              props.detail !== null && props.detail.commentBody !== undefined && props.detail.commentBody !== ''
                ? <MarkdownText text={props.detail.commentBody} codeLabels={{ copyLabel: t('copy'), copiedLabel: t('copied') }} />
                : <span>{t('githubNoComment')}</span>
            )}
          </div>
          <div className="dgh-actions">
            <button className="dgh-action" disabled={busy} onClick={props.onMarkRead}>{t('githubMarkRead')}</button>
            <button className="dgh-action" disabled={busy} onClick={props.onMarkDone}>{t('githubMarkDone')}</button>
            {/* CheckSuite threads carry no subject URL — nothing to open. */}
            <button className="dgh-action" disabled={busy || thread.htmlUrl === ''} onClick={props.onOpenSidebar}>{t('githubOpenInSidebar')}</button>
            <button className="dgh-action" disabled={busy || thread.htmlUrl === ''} onClick={() => { window.open(thread.htmlUrl, '_blank', 'noopener') }}>{t('githubOpenExternal')}</button>
            {thread.type === 'PullRequest' && (
              <>
                <button className="dgh-action dgh-actionApprove" disabled={busy} onClick={props.onApprove}>{t('githubApprove')}</button>
                <button className="dgh-action dgh-actionChanges" disabled={busy} onClick={props.onRequestChanges}>{t('githubRequestChanges')}</button>
                {props.mergeAllowed && <button className="dgh-action dgh-actionMerge" disabled={busy} onClick={props.onMergeOpen}>{t('githubMerge')}</button>}
              </>
            )}
          </div>
          {/* Only issue/PR threads can take a comment (the number is the endpoint key). */}
          {pr !== undefined && <div className="dgh-commentBox">
            <textarea
              className="dgh-commentInput"
              value={props.commentDraft}
              placeholder={t('githubCommentPlaceholder')}
              onChange={(event) => { props.onCommentDraft(event.target.value) }}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault()
                  props.onCommentSend()
                }
              }}
            />
            <button className="dgh-action" disabled={busy || props.commentDraft.trim() === ''} onClick={props.onCommentSend}>{t('githubSend')}</button>
          </div>}
          {props.mergeOpen && (
            <div className="dgh-mergePanel">
              <div className="dgh-mergeTitle">{t('githubMergeTitle')}</div>
              {props.mergeLoading && <div>{t('githubLoading')}</div>}
              {props.mergeError !== null && <div className="dgh-errorLine">{props.mergeError}</div>}
              {props.mergeStatus !== null && (
                <>
                  <div className="dgh-mergeRow">
                    <span>{t('githubMergeState')}: {props.mergeStatus.state}</span>
                  </div>
                  <div className="dgh-mergeRow">
                    <span>{t('githubMergeChecks')}:</span>
                    {props.mergeStatus.checks.length === 0 && <span className="dgh-mergeMeta">—</span>}
                    {props.mergeStatus.checks.map(check => (
                      <span
                        key={check.name}
                        className={cx('dgh-check', check.conclusion === 'success' && 'dgh-checkOk', check.conclusion !== null && check.conclusion !== 'success' && check.conclusion !== 'skipped' && check.conclusion !== 'neutral' && 'dgh-checkBad')}
                      >
                        {check.name}
                      </span>
                    ))}
                  </div>
                  <div className="dgh-mergeRow">
                    <span>{t('githubMergeMethod')}:</span>
                    {(Object.keys(METHOD_LABELS) as GithubMergeMethod[]).map(method => (
                      <button
                        key={method}
                        className={cx('dgh-method', props.mergeMethod === method && 'dgh-methodOn')}
                        onClick={() => { props.onMergeMethod(method) }}
                      >
                        {t(METHOD_LABELS[method])}
                      </button>
                    ))}
                  </div>
                  {props.mergeStatus.mergeable === true && props.mergeStatus.state === 'open'
                    ? (
                      <button className="dgh-mergeConfirm" disabled={props.mergeLoading} onClick={props.onMergeConfirm}>
                        {t('githubMergeConfirm', { repo: thread.repo, pr: pr ?? 0 })}
                      </button>
                    )
                    : <div className="dgh-errorLine">{t('githubMergeUnavailable')}</div>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** The GitHub inbox tab body. */
export function InboxView(props: {
  store: GithubInboxStore
  ctx: Context
  scope: SessionScope
}): ReactNode {
  const { store, ctx, scope } = props
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<GithubThreadDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailFailed, setDetailFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [mergeFor, setMergeFor] = useState<string | null>(null)
  const [mergeStatus, setMergeStatus] = useState<GithubMergeStatus | null>(null)
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeMethod, setMergeMethod] = useState<GithubMergeMethod>('squash')
  // The id of the CURRENTLY expanded thread, kept in a ref so the async
  // detail fetch can discard its result when the user already switched
  // threads (or collapsed) before the response settled.
  const expandedRef = useRef<string | null>(null)
  // Same guard for the merge panel: a slow mergeStatus fetch must not
  // overwrite another thread's panel when the user switched mid-flight.
  const mergeForRef = useRef<string | null>(null)

  useEffect(() => { store.ensurePolling() }, [store])

  const snapshot: GithubStateResult | null = state.snapshot
  const threads = snapshot === null ? [] : filterThreads(snapshot.threads, state.settings)
  const unread = countUnread(threads)
  const groups = groupThreads(threads)

  const collapse = (): void => {
    expandedRef.current = null
    mergeForRef.current = null
    setExpanded(null)
    setDetail(null)
    setDetailLoading(false)
    setDetailFailed(false)
    setMergeFor(null)
    setMergeStatus(null)
    setMergeError(null)
    setCommentDraft('')
  }

  const refresh = (): void => {
    void store.refresh().catch(error => { setActionError(actionMessage(error)) })
  }

  const toggleThread = (thread: GithubThread): void => {
    if (expanded === thread.id) {
      collapse()
      return
    }
    expandedRef.current = thread.id
    setExpanded(thread.id)
    setDetail(null)
    setDetailFailed(false)
    setDetailLoading(true)
    mergeForRef.current = null
    setMergeFor(null)
    setMergeStatus(null)
    setMergeError(null)
    void api.githubThread(thread.id)
      .then(result => {
        // A settle for a thread the user already left must not overwrite
        // the current thread's detail (the fetch has no abort handle).
        if (expandedRef.current === thread.id) setDetail(result)
      })
      .catch(() => {
        if (expandedRef.current === thread.id) setDetailFailed(true)
      })
      .finally(() => {
        if (expandedRef.current === thread.id) setDetailLoading(false)
      })
  }

  const markRead = async (thread: GithubThread): Promise<void> => {
    setBusy('read:' + thread.id)
    setActionError(null)
    try {
      await api.githubMarkRead(thread.id)
      store.removeLocal(thread.id)
      collapse()
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const markDone = async (thread: GithubThread): Promise<void> => {
    setBusy('done:' + thread.id)
    setActionError(null)
    try {
      await api.githubMarkDone(thread.id)
      store.removeLocal(thread.id)
      collapse()
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const markAllRead = async (): Promise<void> => {
    setBusy('all')
    setActionError(null)
    try {
      await api.githubMarkAllRead()
      store.clearLocal()
      collapse()
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const submitReview = async (thread: GithubThread, event: GithubReviewEvent): Promise<void> => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    setBusy('review:' + thread.id)
    setActionError(null)
    try {
      await api.githubReview(thread.repo, pr, event)
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const submitComment = async (thread: GithubThread): Promise<void> => {
    const number = threadNumber(thread.url)
    const body = commentDraft.trim()
    if (number === undefined || body === '') return
    setBusy('comment:' + thread.id)
    setActionError(null)
    try {
      await api.githubComment(thread.repo, number, body)
      setCommentDraft('')
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const openMerge = (thread: GithubThread): void => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    mergeForRef.current = thread.id
    setMergeFor(thread.id)
    setMergeStatus(null)
    setMergeError(null)
    setMergeLoading(true)
    void api.githubMergeStatus(thread.repo, pr)
      .then(result => {
        // A settle for a panel the user already left must not overwrite
        // the current thread's merge gate info.
        if (mergeForRef.current === thread.id) setMergeStatus(result)
      })
      .catch(error => {
        if (mergeForRef.current === thread.id) setMergeError(mergeMessage(error))
      })
      .finally(() => {
        if (mergeForRef.current === thread.id) setMergeLoading(false)
      })
  }

  const confirmMerge = async (thread: GithubThread): Promise<void> => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    setMergeLoading(true)
    setMergeError(null)
    try {
      await api.githubMerge(thread.repo, pr, mergeMethod)
      await api.githubMarkRead(thread.id).catch(() => { /* the merge already succeeded — read marking is best-effort */ })
      store.removeLocal(thread.id)
      collapse()
    } catch (error) {
      setMergeError(mergeMessage(error))
    } finally {
      setMergeLoading(false)
    }
  }

  const toggleChip = (category: GithubCategory): void => {
    const key = GITHUB_CATEGORY_SETTING_KEYS[category]
    const next = state.settings[key] !== true
    store.setSettings({ [key]: next })
    setActionError(null)
    // Persist ONLY the changed key: a full-blob write from a possibly
    // stale render closure could revert a concurrent gear-popup write on
    // the next settings resync. The sidebar settings seam deep-merges the
    // nested patch into the pluginSettings document.
    void callSidebarSettings({ pluginSettings: { [SETTINGS_KEY]: { [key]: next } } }).catch(() => {
      setActionError(t('settingsSaveFailed'))
    })
  }

  const openInSidebar = (thread: GithubThread): void => {
    ctx.betterSidebar.openTab({ type: 'browser', title: thread.repo, url: thread.htmlUrl }, scope)
  }

  return (
    <div className="dgh-github">
      <div className="dgh-header">
        <span className="dgh-title">{t('github')}</span>
        {unread > 0 && <span className="dgh-count">{t('githubUnread', { count: unread })}</span>}
        <button className="dgh-iconBtn" disabled={busy === 'all'} title={t('githubRefresh')} onClick={refresh}><IconRefreshOutline14 /></button>
        <button className="dgh-iconBtn" disabled={busy === 'all'} title={t('githubMarkAllRead')} onClick={() => { void markAllRead() }}><IconCheckOutline14 /></button>
      </div>
      <div className="dgh-chips">
        <span className="dgh-chipsLabel">{t('githubFilterLabel')}</span>
        {CATEGORY_ORDER.map(category => {
          const enabled = state.settings[GITHUB_CATEGORY_SETTING_KEYS[category]] === true
          return (
            <button
              key={category}
              className={cx('dgh-chip', enabled && 'dgh-chipOn')}
              onClick={() => { toggleChip(category) }}
            >
              {t(CHIP_LABELS[category])}
            </button>
          )
        })}
      </div>
      {snapshot === null && <div className="dgh-status">{t('githubLoading')}</div>}
      {snapshot !== null && !snapshot.configured && (
        <div className="dgh-status">
          {snapshot.ghAvailable === false ? t('githubUnconfiguredNoGh') : t('githubUnconfiguredGh')}
        </div>
      )}
      {snapshot?.configured === true && snapshot.error !== undefined && (
        <div className="dgh-status dgh-statusError">
          {snapshot.error.code === 'github-auth'
            ? t('githubAuthError')
            : t('githubNetworkError', { message: snapshot.error.message })}
        </div>
      )}
      {actionError !== null && <div className="dgh-status dgh-statusError">{actionError}</div>}
      {snapshot?.configured === true && snapshot.error === undefined && groups.length === 0 && <div className="dgh-status">{t('githubEmpty')}</div>}
      <div className="dgh-list">
        {groups.map(group => (
          <div key={group.repo} className="dgh-group">
            <div className="dgh-groupHeader">{group.repo}</div>
            {group.threads.map(thread => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                expanded={expanded === thread.id}
                busy={busy !== null}
                detail={detail}
                detailLoading={detailLoading}
                detailFailed={detailFailed}
                commentDraft={commentDraft}
                mergeAllowed={snapshot?.allowMerge === true}
                mergeOpen={mergeFor === thread.id}
                mergeStatus={mergeStatus}
                mergeLoading={mergeLoading}
                mergeError={mergeError}
                mergeMethod={mergeMethod}
                onToggle={() => { toggleThread(thread) }}
                onMarkRead={() => { void markRead(thread) }}
                onMarkDone={() => { void markDone(thread) }}
                onOpenSidebar={() => { openInSidebar(thread) }}
                onApprove={() => { void submitReview(thread, 'APPROVE') }}
                onRequestChanges={() => { void submitReview(thread, 'REQUEST_CHANGES') }}
                onMergeOpen={() => { openMerge(thread) }}
                onMergeMethod={setMergeMethod}
                onMergeConfirm={() => { void confirmMerge(thread) }}
                onCommentDraft={setCommentDraft}
                onCommentSend={() => { void submitComment(thread) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
