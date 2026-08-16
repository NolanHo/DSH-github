/**
 * Minimal zh/en copy for the plugin (browser-language fallback; the
 * dictionaries are key-set-equal, enforced by the en type annotation).
 */
declare const zh: {
    github: string;
    githubUnread: string;
    githubEmpty: string;
    githubLoading: string;
    githubRefresh: string;
    githubMarkAllRead: string;
    githubUnconfiguredGh: string;
    githubUnconfiguredNoGh: string;
    githubAuthError: string;
    githubNetworkError: string;
    githubFilterLabel: string;
    githubChipReviewRequested: string;
    githubChipPrActivity: string;
    githubChipComments: string;
    githubChipCi: string;
    githubChipOther: string;
    githubPollSecondsTitle: string;
    githubCategoryReviewRequested: string;
    githubCategoryPrActivity: string;
    githubCategoryComments: string;
    githubCategoryCi: string;
    githubCategoryOther: string;
    githubVerdictApproved: string;
    githubVerdictChanges: string;
    githubOpenExternal: string;
    githubOpenInSidebar: string;
    githubMarkRead: string;
    githubMarkDone: string;
    githubApprove: string;
    githubRequestChanges: string;
    githubCommentPlaceholder: string;
    githubSend: string;
    githubDetailLoadFailed: string;
    githubActionFailed: string;
    githubMerge: string;
    githubMergeTitle: string;
    githubMergeChecks: string;
    githubMergeMethod: string;
    githubMergeMethodMerge: string;
    githubMergeMethodSquash: string;
    githubMergeMethodRebase: string;
    githubMergeConfirm: string;
    githubMergeDisabled: string;
    githubMergeUnavailable: string;
    githubMergePending: string;
    githubMergeRunning: string;
    githubMergeState: string;
    githubNoComment: string;
    githubCancel: string;
    githubMore: string;
    githubApproveConfirm: string;
    githubChangesConfirm: string;
    githubDoneConfirm: string;
    githubReadToast: string;
    githubDoneToast: string;
    githubAllReadToast: string;
    githubBulkReadToast: string;
    githubApprovedToast: string;
    githubChangesToast: string;
    githubCommentToast: string;
    githubMergedToast: string;
    githubSelectMode: string;
    githubBulkSelected: string;
    githubClearSelection: string;
    githubNewNotifications: string;
    githubRepoMarkRead: string;
    githubAllReadConfirm: string;
    copy: string;
    copied: string;
    timeJustNow: string;
    timeMinutesAgo: string;
    timeHoursAgo: string;
    timeYesterday: string;
    settingsSaveFailed: string;
};
/** The copy key union (zh/en stay key-set-equal by the en annotation). */
export type CopyKey = keyof typeof zh;
/** Resolve one copy key in the active language ({} placeholders interpolated). */
export declare function t(key: CopyKey, params?: Record<string, string | number>): string;
/** Relative time label of an ISO timestamp (fallback: the raw string). */
export declare function relativeTime(iso: string): string;
export {};
