/**
 * Minimal zh/en copy for the plugin (browser-language fallback; the
 * dictionaries are key-set-equal, enforced by the en type annotation).
 */

const zh = {
  github: 'GitHub 收件箱',
  githubUnread: '{count} 未读',
  githubEmpty: '收件箱是空的',
  githubLoading: '加载中…',
  githubRefresh: '刷新',
  githubMarkAllRead: '全部已读',
  githubUnconfiguredGh: 'GitHub 未配置：本机已安装 gh，运行 gh auth login 登录后即可自动接入',
  githubUnconfiguredNoGh: 'GitHub 未配置：在 cordis.patch.yml 中给 dsh-github 配置 githubToken，或设置 GH_TOKEN / GITHUB_TOKEN 环境变量',
  githubAuthError: 'GitHub 认证失败（token 失效或权限不足），通知为只读状态',
  githubNetworkError: '拉取失败：{message}（展示上次快照）',
  githubFilterLabel: '过滤',
  githubChipReviewRequested: 'Review 请求',
  githubChipPrActivity: '我的 PR 动态',
  githubChipComments: '评论 / 提及',
  githubChipCi: 'CI 状态',
  githubChipOther: '其他',
  githubPollSecondsTitle: '轮询间隔',
  githubCategoryReviewRequested: 'Review 请求',
  githubCategoryPrActivity: 'PR 动态',
  githubCategoryComments: '评论',
  githubCategoryCi: 'CI',
  githubCategoryOther: '其他',
  githubVerdictApproved: '✅ 已批准',
  githubVerdictChanges: '⛔️ 请求修改',
  githubOpenExternal: '在浏览器中打开',
  githubOpenInSidebar: '在侧边栏打开',
  githubMarkRead: '已读',
  githubMarkDone: '完成',
  githubApprove: 'Approve',
  githubRequestChanges: 'Request changes',
  githubCommentPlaceholder: '写下评论… (Ctrl+Enter 发送)',
  githubSend: '发送',
  githubDetailLoadFailed: '详情加载失败，请重试',
  githubActionFailed: '操作失败：{message}',
  githubMerge: 'Merge',
  githubMergeTitle: '合并此 PR',
  githubMergeChecks: 'CI 检查',
  githubMergeMethod: '合并方式',
  githubMergeMethodMerge: 'merge commit',
  githubMergeMethodSquash: 'squash',
  githubMergeMethodRebase: 'rebase',
  githubMergeConfirm: '合并 {repo} 的 PR #{pr}',
  githubMergeDisabled: 'Merge 未启用：部署未开启 githubAllowMerge 配置',
  githubMergeUnavailable: '当前不可合并',
  githubMergePending: '合并状态未计算',
  githubMergeRunning: 'CI 进行中…',
  githubMergeState: 'PR 状态',
  githubNoComment: '无评论正文',
  githubCancel: '取消',
  githubMore: '更多',
  githubApproveConfirm: '确认批准此 PR？可附一条评论。',
  githubChangesConfirm: '请求修改需要说明原因：',
  githubDoneConfirm: '归档该通知？归档后将从收件箱移除。',
  githubReadToast: '已标记为已读',
  githubDoneToast: '已归档',
  githubAllReadToast: '已全部标记为已读',
  githubBulkReadToast: '已标记 {count} 条为已读',
  githubApprovedToast: '已批准',
  githubChangesToast: '已请求修改',
  githubCommentToast: '评论已发布',
  githubMergedToast: '已合并',
  githubSelectMode: '多选',
  githubBulkSelected: '已选 {count} 项',
  githubClearSelection: '取消选择',
  githubNewNotifications: '{count} 条新通知 — 点击查看',
  githubRepoMarkRead: '此仓库全部已读',
  githubAllReadConfirm: '将全部通知标记为已读？',
  copy: '复制',
  copied: '已复制',
  timeJustNow: '刚刚',
  timeMinutesAgo: '{n} 分钟前',
  timeHoursAgo: '{n} 小时前',
  timeYesterday: '昨天',
  settingsSaveFailed: '设置保存失败',
}

const en: Record<keyof typeof zh, string> = {
  github: 'GitHub Inbox',
  githubUnread: '{count} unread',
  githubEmpty: 'Inbox zero',
  githubLoading: 'Loading…',
  githubRefresh: 'Refresh',
  githubMarkAllRead: 'Mark all read',
  githubUnconfiguredGh: 'GitHub is not configured: gh is installed here — run gh auth login to connect automatically',
  githubUnconfiguredNoGh: 'GitHub is not configured: set githubToken for dsh-github in cordis.patch.yml, or set GH_TOKEN / GITHUB_TOKEN',
  githubAuthError: 'GitHub authentication failed (token expired or missing scopes) — inbox is read-only',
  githubNetworkError: 'Fetch failed: {message} (showing the last snapshot)',
  githubFilterLabel: 'Filters',
  githubChipReviewRequested: 'Review requests',
  githubChipPrActivity: 'My PR activity',
  githubChipComments: 'Comments / mentions',
  githubChipCi: 'CI status',
  githubChipOther: 'Other',
  githubPollSecondsTitle: 'Poll interval',
  githubCategoryReviewRequested: 'Review request',
  githubCategoryPrActivity: 'PR activity',
  githubCategoryComments: 'Comment',
  githubCategoryCi: 'CI',
  githubCategoryOther: 'Other',
  githubVerdictApproved: '✅ approved',
  githubVerdictChanges: '⛔️ changes requested',
  githubOpenExternal: 'Open in browser',
  githubOpenInSidebar: 'Open in sidebar',
  githubMarkRead: 'Mark read',
  githubMarkDone: 'Done',
  githubApprove: 'Approve',
  githubRequestChanges: 'Request changes',
  githubCommentPlaceholder: 'Write a comment… (Ctrl+Enter to send)',
  githubSend: 'Send',
  githubDetailLoadFailed: 'Failed to load details, retry',
  githubActionFailed: 'Action failed: {message}',
  githubMerge: 'Merge',
  githubMergeTitle: 'Merge this PR',
  githubMergeChecks: 'CI checks',
  githubMergeMethod: 'Merge method',
  githubMergeMethodMerge: 'merge commit',
  githubMergeMethodSquash: 'squash',
  githubMergeMethodRebase: 'rebase',
  githubMergeConfirm: 'Merge PR #{pr} in {repo}',
  githubMergeDisabled: 'Merge is unavailable: the deployment did not enable githubAllowMerge',
  githubMergeUnavailable: 'Not mergeable right now',
  githubMergePending: 'mergeability not computed yet',
  githubMergeRunning: 'CI running…',
  githubMergeState: 'PR state',
  githubNoComment: 'No comment body',
  githubCancel: 'Cancel',
  githubMore: 'More',
  githubApproveConfirm: 'Approve this PR? You may attach a comment.',
  githubChangesConfirm: 'Requesting changes needs a reason:',
  githubDoneConfirm: 'Archive this notification? It leaves the inbox.',
  githubReadToast: 'Marked as read',
  githubDoneToast: 'Archived',
  githubAllReadToast: 'All marked as read',
  githubBulkReadToast: 'Marked {count} as read',
  githubApprovedToast: 'Approved',
  githubChangesToast: 'Changes requested',
  githubCommentToast: 'Comment posted',
  githubMergedToast: 'Merged',
  githubSelectMode: 'Multi-select',
  githubBulkSelected: '{count} selected',
  githubClearSelection: 'Clear selection',
  githubNewNotifications: '{count} new notification(s) — click to show',
  githubRepoMarkRead: 'Mark this repo as read',
  githubAllReadConfirm: 'Mark every notification as read?',
  copy: 'Copy',
  copied: 'Copied',
  timeJustNow: 'just now',
  timeMinutesAgo: '{n} min ago',
  timeHoursAgo: '{n} h ago',
  timeYesterday: 'yesterday',
  settingsSaveFailed: 'Failed to save settings',
}

/** The copy key union (zh/en stay key-set-equal by the en annotation). */
export type CopyKey = keyof typeof zh

function activeDict(): Record<CopyKey, string> {
  const language = typeof navigator !== 'undefined' && typeof navigator.language === 'string'
    ? navigator.language
    : 'en'
  return language.toLowerCase().startsWith('zh') ? zh : en
}

/** Resolve one copy key in the active language ({} placeholders interpolated). */
export function t(key: CopyKey, params?: Record<string, string | number>): string {
  let text = activeDict()[key]
  if (params !== undefined) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll('{' + name + '}', String(value))
    }
  }
  return text
}

/** Relative time label of an ISO timestamp (fallback: the raw string). */
export function relativeTime(iso: string): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 60) return t('timeJustNow')
  if (seconds < 3600) return t('timeMinutesAgo', { n: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('timeHoursAgo', { n: Math.floor(seconds / 3600) })
  if (seconds < 172800) return t('timeYesterday')
  const date = new Date(then)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}
