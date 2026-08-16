/**
 * The GitHub inbox view. Interaction model:
 * - the TITLE opens the thread in the sidebar browser; the rest of the row
 *   expands/collapses the detail panel (chevron included);
 * - primary actions (Approve / Request changes / Comment / Merge) live in
 *   the expanded panel with inline confirm bars; read/done/open actions
 *   fold into a secondary "more" strip;
 * - multi-select + per-repo "mark all read" for bulk cleanup;
 * - incoming polls never reflow the list while a thread is expanded — a
 *   banner counts the fresh items and applies them on demand;
 * - actions disable while unconfigured or auth-failed (read-only).
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
import { api, callSidebarSettings, GithubClientError } from './api.ts'
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

/** The inline confirm strip for destructive/committal actions. */
function ConfirmBar(props: {
  message: string
  confirmLabel: string
  busy: boolean
  draft?: boolean
  draftRequired?: boolean
  draftValue: string
  onDraft: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}): ReactNode {
  return (
    <div className="dgh-confirm">
      <span className="dgh-confirmMsg">{props.message}</span>
      {props.draft === true && (
        <textarea
          className="dgh-commentInput"
          value={props.draftValue}
          placeholder={t('githubCommentPlaceholder')}
          onChange={(event) => { props.onDraft(event.target.value) }}
        />
      )}
      <div className="dgh-actions">
        <button
          className="dgh-action dgh-actionApprove"
          disabled={props.busy || (props.draftRequired === true && props.draftValue.trim() === '')}
          onClick={props.onConfirm}
        >
          {props.confirmLabel}
        </button>
        <button className="dgh-action" disabled={props.busy} onClick={props.onCancel}>{t('githubCancel')}</button>
      </div>
    </div>
  )
}

/** One thread row plus its expansion (detail, confirm bars, merge panel). */
function ThreadRow(props: {
  thread: GithubThread
  expanded: boolean
  readonly: boolean
  busy: boolean
  selectMode: boolean
  selected: boolean
  detail: GithubThreadDetail | null
  detailLoading: boolean
  detailFailed: boolean
  commentDraft: string
  secondaryOpen: boolean
  mergeAllowed: boolean
  mergeOpen: boolean
  mergeStatus: GithubMergeStatus | null
  mergeLoading: boolean
  mergeError: string | null
  mergeMethod: GithubMergeMethod
  confirmKind: 'approve' | 'changes' | 'done' | null
  confirmDraft: string
  onToggle: () => void
  onToggleSelect: () => void
  onTitleOpen: () => void
  onMarkRead: () => void
  onMarkDone: () => void
  onOpenSidebar: () => void
  onOpenExternal: () => void
  onSecondaryToggle: () => void
  onApprove: () => void
  onRequestChanges: () => void
  onConfirmCancel: () => void
  onConfirmSubmit: () => void
  onMergeOpen: () => void
  onMergeRefresh: () => void
  onMergeMethod: (method: GithubMergeMethod) => void
  onMergeConfirm: () => void
  onCommentDraft: (value: string) => void
  onConfirmDraft: (value: string) => void
  onCommentSend: () => void
}): ReactNode {
  const { thread, readonly, busy } = props
  const category = categorizeThread(thread)
  const verdict = thread.type === 'PullRequest' ? reviewVerdict(thread.title) : undefined
  const pr = threadNumber(thread.url)
  const isPullRequest = thread.type === 'PullRequest'
  const confirmMessage = props.confirmKind === 'approve'
    ? t('githubApproveConfirm')
    : props.confirmKind === 'changes'
      ? t('githubChangesConfirm')
      : t('githubDoneConfirm')
  const confirmLabel = props.confirmKind === 'approve'
    ? t('githubApprove')
    : props.confirmKind === 'changes'
      ? t('githubRequestChanges')
      : t('githubMarkDone')
  return (
    <div className={cx('dgh-thread', 'dgh-cat-' + category)}>
      <div
        className={cx('dgh-row', props.expanded && 'dgh-rowOpen')}
        role="button"
        tabIndex={0}
        onClick={props.onToggle}
        onKeyDown={(event) => { if (event.key === 'Enter') props.onToggle() }}
      >
        {props.selectMode && (
          <input
            type="checkbox"
            className="dgh-check"
            checked={props.selected}
            onClick={(event) => { event.stopPropagation() }}
            onChange={(event) => { event.stopPropagation(); props.onToggleSelect() }}
          />
        )}
        <span className={cx('dgh-dot', thread.unread && 'dgh-dotUnread')} />
        <span className="dgh-titleCol">
          <span
            className="dgh-titleLink"
            role="link"
            tabIndex={0}
            title={t('githubOpenInSidebar')}
            onClick={(event) => { event.stopPropagation(); props.onTitleOpen() }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); props.onTitleOpen() } }}
          >
            {thread.title}
          </span>
          <span className="dgh-rowMeta">
            {pr !== undefined && <span className="dgh-num">#{pr}</span>}
            <span className={cx('dgh-tag', 'dgh-tag-' + category)}>{t(TAG_LABELS[category])}</span>
            {verdict !== undefined && (
              <span className={cx('dgh-verdict', verdict === 'approved' ? 'dgh-verdictOk' : 'dgh-verdictBad')}>
                {t(verdict === 'approved' ? 'githubVerdictApproved' : 'githubVerdictChanges')}
              </span>
            )}
            <span className="dgh-rowTime">{relativeTime(thread.updatedAt)}</span>
          </span>
        </span>
        <span className={cx('dgh-chevron', props.expanded && 'dgh-chevronOpen')}>▸</span>
      </div>
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
            {isPullRequest && (
              <>
                <button className="dgh-action dgh-actionApprove" disabled={busy || readonly} onClick={props.onApprove}>{t('githubApprove')}</button>
                <button className="dgh-action dgh-actionChanges" disabled={busy || readonly} onClick={props.onRequestChanges}>{t('githubRequestChanges')}</button>
                {props.mergeAllowed && <button className="dgh-action dgh-actionMerge" disabled={busy || readonly} onClick={props.onMergeOpen}>{t('githubMerge')}</button>}
              </>
            )}
            <button className="dgh-action" disabled={busy || readonly} onClick={props.onSecondaryToggle}>
              {t('githubMore')} {props.secondaryOpen ? '▴' : '▾'}
            </button>
          </div>
          {props.secondaryOpen && (
            <div className="dgh-actions">
              <button className="dgh-action" disabled={busy || readonly} onClick={props.onMarkRead}>{t('githubMarkRead')}</button>
              <button className="dgh-action" disabled={busy || readonly} onClick={props.onMarkDone}>{t('githubMarkDone')}</button>
              <button className="dgh-action" disabled={busy || thread.htmlUrl === ''} onClick={props.onOpenSidebar}>{t('githubOpenInSidebar')}</button>
              <button className="dgh-action" disabled={busy || thread.htmlUrl === ''} onClick={props.onOpenExternal}>{t('githubOpenExternal')}</button>
            </div>
          )}
          {props.confirmKind !== null && (
            <ConfirmBar
              message={confirmMessage}
              confirmLabel={confirmLabel}
              busy={busy}
              draft={props.confirmKind !== 'done'}
              draftRequired={props.confirmKind === 'changes'}
              draftValue={props.confirmDraft}
              onDraft={props.onConfirmDraft}
              onConfirm={props.onConfirmSubmit}
              onCancel={props.onConfirmCancel}
            />
          )}
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
            <button className="dgh-action" disabled={busy || readonly || props.commentDraft.trim() === ''} onClick={props.onCommentSend}>{t('githubSend')}</button>
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
                    {props.mergeStatus.mergeable === null && <span className="dgh-mergeMeta">{t('githubMergePending')}</span>}
                    {props.mergeStatus.checks.some(check => check.status === 'in_progress') && <span className="dgh-mergeMeta">{t('githubMergeRunning')}</span>}
                    <button className="dgh-action" disabled={props.mergeLoading || readonly} onClick={props.onMergeRefresh}>{t('githubRefresh')}</button>
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
                      <button className="dgh-mergeConfirm" disabled={props.mergeLoading || readonly} onClick={props.onMergeConfirm}>
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
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'approve' | 'changes' | 'done' | 'allRead' | null>(null)
  const [confirmDraft, setConfirmDraft] = useState('')
  const [mergeFor, setMergeFor] = useState<string | null>(null)
  const [mergeStatus, setMergeStatus] = useState<GithubMergeStatus | null>(null)
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [mergeMethod, setMergeMethod] = useState<GithubMergeMethod>('squash')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingNew, setPendingNew] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  // The id of the CURRENTLY expanded thread — async detail/merge fetches
  // discard their results when the user already switched threads.
  const expandedRef = useRef<string | null>(null)
  const mergeForRef = useRef<string | null>(null)
  // The rendered thread list: frozen while a thread is expanded so an
  // incoming poll cannot reflow what the user is reading (the banner
  // counts the fresh items instead).
  const [visibleThreads, setVisibleThreads] = useState<GithubThread[]>([])
  const visibleRef = useRef<GithubThread[]>([])
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { store.ensurePolling() }, [store])
  // Clear the toast timer when the view unmounts.
  useEffect(() => () => { if (toastTimer.current !== null) clearTimeout(toastTimer.current) }, [])

  const snapshot: GithubStateResult | null = state.snapshot
  const readonly = snapshot === null || !snapshot.configured || snapshot?.error?.code === 'github-auth'
  const threads = filterThreads(visibleThreads, state.settings)
  const unread = countUnread(threads)
  const groups = groupThreads(threads)

  const showToast = (message: string): void => {
    setToast(message)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => { setToast(null) }, 3200)
  }

  // Adopt the store snapshot into the visible list: immediate when nothing
  // is expanded, deferred (counted) while the user is reading a thread.
  useEffect(() => {
    const next = state.snapshot
    if (next === null) {
      visibleRef.current = []
      setVisibleThreads([])
      setSelected(new Set())
      return
    }
    if (expandedRef.current !== null) {
      const known = new Set(visibleRef.current.map(thread => thread.id))
      const fresh = next.threads.filter(thread => !known.has(thread.id))
      if (fresh.length > 0) {
        setPendingNew(count => count + fresh.length)
        return
      }
    }
    visibleRef.current = next.threads
    setVisibleThreads(next.threads)
    setPendingNew(0)
    setSelected(new Set())
  }, [state.snapshot])

  const applyPending = (): void => {
    if (state.snapshot !== null) {
      visibleRef.current = state.snapshot.threads
      setVisibleThreads(state.snapshot.threads)
    }
    setPendingNew(0)
  }

  const collapse = (): void => {
    expandedRef.current = null
    mergeForRef.current = null
    setExpanded(null)
    setDetail(null)
    setDetailLoading(false)
    setDetailFailed(false)
    setSecondaryOpen(false)
    setConfirmKind(null)
    setConfirmDraft('')
    setMergeFor(null)
    setMergeStatus(null)
    setMergeError(null)
    setCommentDraft('')
    // Releasing the expansion applies any deferred fresh threads.
    applyPending()
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
    setSecondaryOpen(false)
    setConfirmKind(null)
    setConfirmDraft('')
    mergeForRef.current = null
    setMergeFor(null)
    setMergeStatus(null)
    setMergeError(null)
    void api.githubThread(thread.id)
      .then(result => {
        if (expandedRef.current === thread.id) setDetail(result)
      })
      .catch(() => {
        if (expandedRef.current === thread.id) setDetailFailed(true)
      })
      .finally(() => {
        if (expandedRef.current === thread.id) setDetailLoading(false)
      })
  }

  const openInSidebar = (thread: GithubThread): void => {
    ctx.betterSidebar.openTab({ type: 'browser', title: thread.repo, url: thread.htmlUrl }, scope)
  }

  const markRead = async (thread: GithubThread): Promise<void> => {
    setBusy('read:' + thread.id)
    setActionError(null)
    try {
      await api.githubMarkRead(thread.id)
      collapse()
      store.removeLocal(thread.id)
      showToast(t('githubReadToast'))
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
      collapse()
      store.removeLocal(thread.id)
      showToast(t('githubDoneToast'))
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
      collapse()
      store.clearLocal()
      showToast(t('githubAllReadToast'))
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const markManyRead = async (items: GithubThread[]): Promise<void> => {
    if (items.length === 0) return
    setBusy('bulk')
    setActionError(null)
    try {
      for (const item of items) {
        await api.githubMarkRead(item.id)
        store.removeLocal(item.id)
      }
      setSelected(new Set())
      showToast(t('githubBulkReadToast', { count: items.length }))
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const submitReview = async (thread: GithubThread, event: GithubReviewEvent, body?: string): Promise<void> => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    setBusy('review:' + thread.id)
    setActionError(null)
    try {
      await api.githubReview(thread.repo, pr, event, body)
      setConfirmKind(null)
      setConfirmDraft('')
      showToast(event === 'APPROVE' ? t('githubApprovedToast') : t('githubChangesToast'))
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
      showToast(t('githubCommentToast'))
    } catch (error) {
      setActionError(actionMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const confirmSubmit = (thread: GithubThread): void => {
    if (confirmKind === 'done') { void markDone(thread) }
    else if (confirmKind === 'approve') { void submitReview(thread, 'APPROVE', confirmDraft.trim() === '' ? undefined : confirmDraft.trim()) }
    else if (confirmKind === 'changes') { void submitReview(thread, 'REQUEST_CHANGES', confirmDraft.trim()) }
  }

  const openMerge = (thread: GithubThread): void => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    mergeForRef.current = thread.id
    setMergeFor(thread.id)
    setMergeStatus(null)
    setMergeError(null)
    setMergeLoading(true)
    void fetchMergeStatus(thread, pr)
  }

  const fetchMergeStatus = async (thread: GithubThread, pr: number): Promise<void> => {
    try {
      const result = await api.githubMergeStatus(thread.repo, pr)
      if (mergeForRef.current === thread.id) setMergeStatus(result)
    } catch (error) {
      if (mergeForRef.current === thread.id) setMergeError(mergeMessage(error))
    } finally {
      if (mergeForRef.current === thread.id) setMergeLoading(false)
    }
  }

  const refreshMerge = (thread: GithubThread): void => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    setMergeLoading(true)
    setMergeError(null)
    void fetchMergeStatus(thread, pr)
  }

  const confirmMerge = async (thread: GithubThread): Promise<void> => {
    const pr = threadNumber(thread.url)
    if (pr === undefined) return
    setMergeLoading(true)
    setMergeError(null)
    try {
      await api.githubMerge(thread.repo, pr, mergeMethod)
      await api.githubMarkRead(thread.id).catch(() => { /* best-effort */ })
      collapse()
      store.removeLocal(thread.id)
      showToast(t('githubMergedToast'))
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

  const toggleSelect = (id: string): void => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="dgh-github">
      <div className="dgh-header">
        <span className="dgh-title">{t('github')}</span>
        {unread > 0 && <span className="dgh-count">{t('githubUnread', { count: unread })}</span>}
        <button className="dgh-iconBtn" disabled={busy === 'all'} title={t('githubRefresh')} onClick={refresh}><IconRefreshOutline14 /></button>
        <button className="dgh-iconBtn" disabled={busy === 'all'} title={t('githubMarkAllRead')} onClick={() => { setConfirmKind('allRead'); setActionError(null) }}><IconCheckOutline14 /></button>
        <button className={cx('dgh-iconBtn', selectMode && 'dgh-iconBtnOn')} disabled={threads.length === 0} title={t('githubSelectMode')} onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}>☑</button>
      </div>
      {confirmKind === 'allRead' && (
        <ConfirmBar
          message={t('githubAllReadConfirm')}
          confirmLabel={t('githubMarkAllRead')}
          busy={busy === 'all'}
          draftValue=""
          onDraft={() => {}}
          onConfirm={() => { void markAllRead() }}
          onCancel={() => { setConfirmKind(null) }}
        />
      )}
      {selectMode && selected.size > 0 && (
        <div className="dgh-bulkbar">
          <span>{t('githubBulkSelected', { count: selected.size })}</span>
          <button className="dgh-action" disabled={busy !== null || readonly} onClick={() => { void markManyRead(threads.filter(thread => selected.has(thread.id))) }}>{t('githubMarkRead')}</button>
          <button className="dgh-action" onClick={() => { setSelected(new Set()) }}>{t('githubClearSelection')}</button>
        </div>
      )}
      {pendingNew > 0 && (
        <button className="dgh-newbar" onClick={applyPending}>
          {t('githubNewNotifications', { count: pendingNew })}
        </button>
      )}
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
            <div className="dgh-groupHeader">
              <span className="dgh-groupName">{group.repo}</span>
              <span className="dgh-groupCount">{countUnread(group.threads)}</span>
              <button className="dgh-groupRead" disabled={busy !== null || readonly || group.threads.length === 0} title={t('githubRepoMarkRead')} onClick={() => { void markManyRead(group.threads) }}>✓</button>
            </div>
            {group.threads.map(thread => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                expanded={expanded === thread.id}
                readonly={readonly}
                busy={busy !== null}
                selectMode={selectMode}
                selected={selected.has(thread.id)}
                detail={detail}
                detailLoading={detailLoading}
                detailFailed={detailFailed}
                commentDraft={commentDraft}
                secondaryOpen={secondaryOpen}
                mergeAllowed={snapshot?.allowMerge === true}
                mergeOpen={mergeFor === thread.id}
                mergeStatus={mergeStatus}
                mergeLoading={mergeLoading}
                mergeError={mergeError}
                mergeMethod={mergeMethod}
                confirmKind={confirmKind === 'approve' || confirmKind === 'changes' || confirmKind === 'done' ? confirmKind : null}
                confirmDraft={confirmDraft}
                onToggle={() => { toggleThread(thread) }}
                onToggleSelect={() => { toggleSelect(thread.id) }}
                onTitleOpen={() => { openInSidebar(thread) }}
                onMarkRead={() => { void markRead(thread) }}
                onMarkDone={() => { setConfirmKind('done'); setConfirmDraft(''); setActionError(null) }}
                onOpenSidebar={() => { openInSidebar(thread) }}
                onOpenExternal={() => { window.open(thread.htmlUrl, '_blank', 'noopener') }}
                onSecondaryToggle={() => { setSecondaryOpen(v => !v) }}
                onApprove={() => { setConfirmKind('approve'); setConfirmDraft(''); setActionError(null) }}
                onRequestChanges={() => { setConfirmKind('changes'); setConfirmDraft(''); setActionError(null) }}
                onConfirmCancel={() => { setConfirmKind(null); setConfirmDraft('') }}
                onConfirmSubmit={() => { confirmSubmit(thread) }}
                onMergeOpen={() => { openMerge(thread) }}
                onMergeRefresh={() => { refreshMerge(thread) }}
                onMergeMethod={setMergeMethod}
                onMergeConfirm={() => { void confirmMerge(thread) }}
                onCommentDraft={setCommentDraft}
                onConfirmDraft={setConfirmDraft}
                onCommentSend={() => { void submitComment(thread) }}
              />
            ))}
          </div>
        ))}
      </div>
      {toast !== null && <div className="dgh-toast">{toast}</div>}
    </div>
  )
}
