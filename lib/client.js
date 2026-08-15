window.__ModuleLoader__.load({
	id: "dsh-github",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/api.ts
		/** One wire failure of the plugin API. */
		var GithubClientError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		async function call(method, payload, signal) {
			let response;
			try {
				response = await fetch("/plugins/dsh-github/api/" + method, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload),
					signal
				});
			} catch (error) {
				throw new GithubClientError("network", error instanceof Error ? error.message : String(error));
			}
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new GithubClientError(parsed?.error?.code ?? "http", parsed?.error?.message ?? "HTTP " + response.status);
			return parsed.value;
		}
		/** The plugin API surface. */
		const api = {
			/** The inbox snapshot (force bypasses the host freshness window). */
			githubState: (force, signal) => call("state", { force: force === true }, signal),
			/** One thread's detail plus its latest comment body. */
			githubThread: (id, signal) => call("thread", { id }, signal),
			/** Mark one thread read. */
			githubMarkRead: (id) => call("markRead", { id }),
			/** Mark one thread done (GitHub's archive). */
			githubMarkDone: (id) => call("markDone", { id }),
			/** Mark every unread thread read. */
			githubMarkAllRead: () => call("markAllRead", {}),
			/** Submit one PR review event (APPROVE / REQUEST_CHANGES / COMMENT). */
			githubReview: (repo, pr, event, body) => call("review", {
				repo,
				pr,
				event,
				...body !== void 0 && body !== "" ? { body } : {}
			}),
			/** Post a general comment on an issue or PR. */
			githubComment: (repo, issue, body) => call("comment", {
				repo,
				issue,
				body
			}),
			/** Mergeability plus head check runs for the merge panel. */
			githubMergeStatus: (repo, pr, signal) => call("mergeStatus", {
				repo,
				pr
			}, signal),
			/** Merge one PR with the chosen method (merge / squash / rebase). */
			githubMerge: (repo, pr, method) => call("merge", {
				repo,
				pr,
				method
			})
		};
		/**
		* Persist the plugin's own filter settings through the sidebar's settings
		* seam (pluginSettings['github'] — the same document the gear popup writes).
		* A runtime fetch to the sidebar's own fenced route: no cross-plugin value
		* import, so the client bundle stays pure.
		*/
		async function callSidebarSettings(patch) {
			const response = await fetch("/sidebar/api/settings.update", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ patch })
			});
			const parsed = await response.json().catch(() => null);
			if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === void 0) throw new GithubClientError(parsed?.error?.code ?? "http", parsed?.error?.message ?? "HTTP " + response.status);
			return parsed.value;
		}
		//#endregion
		//#region src/client/styles.ts
		/** The view's stylesheet, injected once at client activation (dgh- prefix). */
		const INBOX_CSS = `
.dgh-github { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dgh-header { flex: none; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 12px; }
.dgh-title { flex: 1; min-width: 0; font: var(--dsw-font-s-14); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-count { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-tertiary); }
.dgh-iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dgh-iconBtn:hover { background: var(--dsw-alias-bg-hover); }
.dgh-iconBtn:disabled { opacity: 0.4; cursor: default; }
.dgh-chips { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
.dgh-chipsLabel { font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); }
.dgh-chip { border: 1px solid var(--dsw-alias-border); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-s-12); padding: 2px 10px; cursor: pointer; }
.dgh-chipOn { border-color: var(--dsw-alias-accent); color: var(--dsw-alias-accent); }
.dgh-status { flex: none; padding: 8px 12px; font: var(--dsw-font-s-13); color: var(--dsw-alias-label-tertiary); }
.dgh-statusError { color: #e5484d; }
.dgh-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 12px; }
.dgh-group { margin-bottom: 4px; }
.dgh-groupHeader { padding: 6px 4px 4px; font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-thread { border-radius: 8px; overflow: hidden; }
.dgh-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 7px 8px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); text-align: left; cursor: pointer; }
.dgh-row:hover { background: var(--dsw-alias-bg-hover); }
.dgh-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: transparent; }
.dgh-dotUnread { background: var(--dsw-alias-accent); }
.dgh-rowTitle { flex: 1; min-width: 0; font: var(--dsw-font-s-13); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-rowMeta { flex: none; display: inline-flex; align-items: center; gap: 6px; }
.dgh-tag { font: var(--dsw-font-s-11); color: var(--dsw-alias-label-tertiary); border: 1px solid var(--dsw-alias-border); border-radius: 4px; padding: 1px 5px; }
.dgh-verdict { font: var(--dsw-font-s-11); }
.dgh-verdictOk { color: #30a46c; }
.dgh-verdictBad { color: #e5484d; }
.dgh-rowTime { font: var(--dsw-font-s-11); color: var(--dsw-alias-label-tertiary); }
.dgh-detail { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 10px; }
.dgh-detailBody { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-secondary); border-left: 2px solid var(--dsw-alias-border); padding-left: 10px; overflow-wrap: anywhere; }
.dgh-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.dgh-action { border: 1px solid var(--dsw-alias-border); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: var(--dsw-font-s-12); padding: 3px 9px; cursor: pointer; }
.dgh-action:hover { background: var(--dsw-alias-bg-hover); }
.dgh-action:disabled { opacity: 0.4; cursor: default; }
.dgh-actionApprove { color: #30a46c; border-color: currentColor; }
.dgh-actionChanges { color: #f76b15; border-color: currentColor; }
.dgh-actionMerge { color: var(--dsw-alias-accent); border-color: currentColor; }
.dgh-commentBox { display: flex; gap: 6px; }
.dgh-commentInput { flex: 1; min-height: 56px; resize: vertical; border: 1px solid var(--dsw-alias-border); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: var(--dsw-font-s-13); padding: 6px 8px; }
.dgh-mergePanel { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--dsw-alias-border); border-radius: 8px; padding: 8px 10px; }
.dgh-mergeTitle { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-secondary); }
.dgh-mergeRow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); }
.dgh-check { font: var(--dsw-font-s-11); border: 1px solid var(--dsw-alias-border); border-radius: 4px; padding: 1px 5px; }
.dgh-checkOk { color: #30a46c; border-color: currentColor; }
.dgh-checkBad { color: #e5484d; border-color: currentColor; }
.dgh-mergeMeta { color: var(--dsw-alias-label-tertiary); }
.dgh-method { border: 1px solid var(--dsw-alias-border); border-radius: 4px; background: transparent; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-s-11); padding: 1px 6px; cursor: pointer; }
.dgh-methodOn { border-color: var(--dsw-alias-accent); color: var(--dsw-alias-accent); }
.dgh-mergeConfirm { align-self: flex-start; border: 1px solid var(--dsw-alias-accent); border-radius: 6px; background: transparent; color: var(--dsw-alias-accent); font: var(--dsw-font-s-12); padding: 3px 9px; cursor: pointer; }
.dgh-mergeConfirm:hover { background: var(--dsw-alias-bg-hover); }
.dgh-mergeConfirm:disabled { opacity: 0.4; cursor: default; }
.dgh-errorLine { font: var(--dsw-font-s-12); color: #e5484d; overflow-wrap: anywhere; }
`;
		/** Inject the stylesheet once (idempotent across activations). */
		function injectStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-dsh-github]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.dshGithub = "";
			tag.textContent = INBOX_CSS;
			document.head.append(tag);
		}
		//#endregion
		//#region src/client/categories.ts
		/**
		* Pure classification / filter / grouping functions over the inbox wire
		* shapes (node-free, unit-testable).
		* @module dsh-github/client/categories
		*/
		/** The pluginSettings key each category's checkbox reads and writes. */
		const GITHUB_CATEGORY_SETTING_KEYS = {
			reviewRequested: "showReviewRequested",
			prActivity: "showPrActivity",
			comments: "showComments",
			ci: "showCi",
			other: "showOther"
		};
		/**
		* Classify one thread into its display category. GitHub's reason is
		* per-thread and drifts over the thread's life (official behavior: an
		* author thread keeps reporting 'author' even for later comments; an
		* @-mention upgrades it to 'mention'), so the mapping is display-level —
		* it never promises event-level precision.
		* @param thread - the thread's reason and subject type.
		* @returns the category driving the filter checkboxes.
		*/
		function categorizeThread(thread) {
			if (thread.reason === "review_requested") return "reviewRequested";
			if (thread.reason === "ci_activity") return "ci";
			if (thread.reason === "author") return thread.type === "PullRequest" ? "prActivity" : "comments";
			if (thread.reason === "comment" || thread.reason === "mention" || thread.reason === "team_mention") return "comments";
			return "other";
		}
		/**
		* Detect a review verdict from the thread title (GitHub writes 'X approved
		* these changes' / 'X requested changes on this pull request' into it).
		* Display-level only — no extra API call, and no promise of precision.
		* @param title - the subject.title of a PR thread.
		* @returns the verdict tag, or undefined when the title carries none.
		*/
		function reviewVerdict(title) {
			const lower = title.toLowerCase();
			if (lower.includes("approved these changes")) return "approved";
			if (lower.includes("requested changes") || lower.includes("changes requested")) return "changesRequested";
		}
		/**
		* Apply the category filters to a thread list (pure).
		* @param threads - the inbox snapshot's threads.
		* @param settings - the plugin's filter settings.
		* @returns only the threads whose category checkbox is on.
		*/
		function filterThreads(threads, settings) {
			return threads.filter((thread) => settings[GITHUB_CATEGORY_SETTING_KEYS[categorizeThread(thread)]] === true);
		}
		/** Count the unread threads of a list (pure; the badge uses the FILTERED list). */
		function countUnread(threads) {
			let count = 0;
			for (const thread of threads) if (thread.unread) count += 1;
			return count;
		}
		/**
		* The PR/issue number of a thread URL ('.../pulls/123' → 123). The inbox
		* subject.url is the REST URL of the subject, which carries the number.
		* @returns the number, or undefined when the URL carries none.
		*/
		function threadNumber(url) {
			const match = /\/(?:pulls?|issues?)\/(\d+)/.exec(url);
			return match === null ? void 0 : Number(match[1]);
		}
		/**
		* Group a thread list by repository. Threads keep their (newest-first)
		* order inside each group; groups are ordered by their newest thread.
		* @param threads - the filtered thread list.
		* @returns the groups in display order.
		*/
		function groupThreads(threads) {
			const byRepo = /* @__PURE__ */ new Map();
			for (const thread of threads) {
				const bucket = byRepo.get(thread.repo);
				if (bucket === void 0) byRepo.set(thread.repo, [thread]);
				else bucket.push(thread);
			}
			const groups = [...byRepo.entries()].map(([repo, bucket]) => ({
				repo,
				threads: bucket
			}));
			groups.sort((a, b) => (b.threads[0]?.updatedAt ?? "").localeCompare(a.threads[0]?.updatedAt ?? ""));
			return groups;
		}
		/** Normalize a raw pluginSettings blob into validated settings (defaults + clamp). */
		function parseGithubSettings(raw) {
			const record = raw === null || typeof raw !== "object" ? {} : raw;
			const booleanOf = (key, fallback) => typeof record[key] === "boolean" ? record[key] : fallback;
			const poll = typeof record.pollSeconds === "number" && Number.isFinite(record.pollSeconds) ? Math.min(300, Math.max(60, Math.round(record.pollSeconds))) : 60;
			return {
				showReviewRequested: booleanOf("showReviewRequested", true),
				showPrActivity: booleanOf("showPrActivity", true),
				showComments: booleanOf("showComments", true),
				showCi: booleanOf("showCi", false),
				showOther: booleanOf("showOther", true),
				pollSeconds: poll
			};
		}
		//#endregion
		//#region src/client/store.ts
		/** Poll cadence while the inbox is unconfigured (a slow configuration probe). */
		const UNCONFIGURED_RETRY_MS = 3e5;
		/** The plugin's settings blob key inside the sidebar prefs document. */
		const SETTINGS_KEY = "github";
		function settingsEqual(left, right) {
			return left.showReviewRequested === right.showReviewRequested && left.showPrActivity === right.showPrActivity && left.showComments === right.showComments && left.showCi === right.showCi && left.showOther === right.showOther && left.pollSeconds === right.pollSeconds;
		}
		/** The ids of every OPEN github tab across both panes (tolerant structural walk). */
		function githubTabIds(state) {
			if (state === void 0) return [];
			const ids = [];
			const walk = (node) => {
				const record = node;
				if (record === null || typeof record !== "object") return;
				if (record.kind === "leaf" && Array.isArray(record.tabs)) {
					for (const tab of record.tabs) {
						const candidate = tab;
						if (candidate?.type === "github" && typeof candidate.id === "string") ids.push(candidate.id);
					}
					return;
				}
				if (Array.isArray(record.children)) for (const child of record.children) walk(child);
			};
			walk(state.splits);
			walk(state.bottomSplits);
			return ids;
		}
		/**
		* Create the GitHub inbox store. The timer starts on the first
		* ensurePolling (badge render or view mount) and keeps the badge live
		* while the tab is open but inactive — a never-opened tab has no pill to
		* render, so it never polls. Overlapping polls are skipped, hidden
		* documents skip the fetch, a failed poll keeps the last snapshot, and a
		* poll that started before a local mutation (markRead/Done/AllRead) is
		* discarded on settle so removed threads cannot resurrect.
		* @param apiFace - the typed githubState call (dependency-injected for tests).
		* @param service - the betterSidebar service for settings sync and the badge bridge.
		* @returns the store bound to one plugin activation.
		*/
		function createGithubInboxStore(apiFace, service) {
			let state = {
				snapshot: null,
				settings: parseGithubSettings(service.getSnapshot().prefs.pluginSettings[SETTINGS_KEY])
			};
			const listeners = /* @__PURE__ */ new Set();
			let disposed = false;
			let timer = null;
			let inFlight = null;
			let version = 0;
			const emit = () => {
				for (const listener of listeners) listener();
			};
			const detachSettings = service.subscribeState(() => {
				const next = parseGithubSettings(service.getSnapshot().prefs.pluginSettings[SETTINGS_KEY]);
				if (!settingsEqual(next, state.settings)) {
					state = {
						...state,
						settings: next
					};
					emit();
				}
			});
			const badgeValue = () => {
				const { snapshot, settings } = state;
				if (snapshot === null || !snapshot.configured || snapshot.threads.length === 0) return null;
				const count = countUnread(filterThreads(snapshot.threads, settings));
				if (count === 0) return null;
				return count > 99 ? "99+" : count;
			};
			let lastBadge;
			const bumpBadge = () => {
				const value = badgeValue();
				if (value === lastBadge) return;
				lastBadge = value;
				for (const tabId of githubTabIds(service.getSnapshot().state)) service.updateTab(tabId, { meta: value });
			};
			const subscribe = (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			};
			subscribe(bumpBadge);
			const nextDelay = () => {
				const snapshot = state.snapshot;
				if (snapshot === null) return state.settings.pollSeconds * 1e3;
				if (!snapshot.configured) return UNCONFIGURED_RETRY_MS;
				return Math.max(state.settings.pollSeconds, snapshot.pollIntervalSec) * 1e3;
			};
			const adopt = (snapshot) => {
				if (!disposed) {
					state = {
						...state,
						snapshot
					};
					emit();
				}
			};
			const tick = () => {
				if (disposed) return;
				if (typeof document !== "undefined" && document.hidden) {
					timer = setTimeout(tick, nextDelay());
					return;
				}
				if (inFlight === null) {
					const startedAt = version;
					inFlight = apiFace.githubState(false).then((snapshot) => {
						if (version === startedAt) adopt(snapshot);
					}).catch(() => {}).finally(() => {
						inFlight = null;
					});
				}
				timer = setTimeout(tick, nextDelay());
			};
			return {
				getState: () => state,
				subscribe,
				ensurePolling: () => {
					if (!disposed && timer === null) timer = setTimeout(tick, 0);
				},
				refresh: async () => {
					if (inFlight !== null) await inFlight;
					const startedAt = version;
					const snapshot = await apiFace.githubState(true);
					if (version === startedAt) adopt(snapshot);
				},
				removeLocal: (id) => {
					const snapshot = state.snapshot;
					if (snapshot === null) return;
					version += 1;
					state = {
						...state,
						snapshot: {
							...snapshot,
							threads: snapshot.threads.filter((thread) => thread.id !== id)
						}
					};
					emit();
				},
				clearLocal: () => {
					const snapshot = state.snapshot;
					if (snapshot === null) return;
					version += 1;
					state = {
						...state,
						snapshot: {
							...snapshot,
							threads: []
						}
					};
					emit();
				},
				setSettings: (patch) => {
					state = {
						...state,
						settings: {
							...state.settings,
							...patch
						}
					};
					emit();
				},
				badgeValue,
				dispose: () => {
					disposed = true;
					if (timer !== null) {
						clearTimeout(timer);
						timer = null;
					}
					detachSettings();
					listeners.clear();
				}
			};
		}
		//#endregion
		//#region src/client/i18n.ts
		/**
		* Minimal zh/en copy for the plugin (browser-language fallback; the
		* dictionaries are key-set-equal, enforced by the en type annotation).
		*/
		const zh = {
			github: "GitHub 收件箱",
			githubUnread: "{count} 未读",
			githubEmpty: "收件箱是空的",
			githubLoading: "加载中…",
			githubRefresh: "刷新",
			githubMarkAllRead: "全部已读",
			githubUnconfiguredGh: "GitHub 未配置：本机已安装 gh，运行 gh auth login 登录后即可自动接入",
			githubUnconfiguredNoGh: "GitHub 未配置：在 cordis.patch.yml 中给 dsh-github 配置 githubToken，或设置 GH_TOKEN / GITHUB_TOKEN 环境变量",
			githubAuthError: "GitHub 认证失败（token 失效或权限不足），通知为只读状态",
			githubNetworkError: "拉取失败：{message}（展示上次快照）",
			githubFilterLabel: "过滤",
			githubChipReviewRequested: "Review 请求",
			githubChipPrActivity: "我的 PR 动态",
			githubChipComments: "评论 / 提及",
			githubChipCi: "CI 状态",
			githubChipOther: "其他",
			githubPollSecondsTitle: "轮询间隔",
			githubCategoryReviewRequested: "Review 请求",
			githubCategoryPrActivity: "PR 动态",
			githubCategoryComments: "评论",
			githubCategoryCi: "CI",
			githubCategoryOther: "其他",
			githubVerdictApproved: "✅ 已批准",
			githubVerdictChanges: "⛔️ 请求修改",
			githubOpenExternal: "在浏览器中打开",
			githubOpenInSidebar: "在侧边栏打开",
			githubMarkRead: "已读",
			githubMarkDone: "完成",
			githubApprove: "Approve",
			githubRequestChanges: "Request changes",
			githubCommentPlaceholder: "写下评论… (Ctrl+Enter 发送)",
			githubSend: "发送",
			githubDetailLoadFailed: "详情加载失败，请重试",
			githubActionFailed: "操作失败：{message}",
			githubMerge: "Merge",
			githubMergeTitle: "合并此 PR",
			githubMergeChecks: "CI 检查",
			githubMergeMethod: "合并方式",
			githubMergeMethodMerge: "merge commit",
			githubMergeMethodSquash: "squash",
			githubMergeMethodRebase: "rebase",
			githubMergeConfirm: "合并 {repo} 的 PR #{pr}",
			githubMergeDisabled: "Merge 未启用：部署未开启 githubAllowMerge 配置",
			githubMergeUnavailable: "当前不可合并",
			githubMergeState: "PR 状态",
			githubNoComment: "无评论正文",
			copy: "复制",
			copied: "已复制",
			timeJustNow: "刚刚",
			timeMinutesAgo: "{n} 分钟前",
			timeHoursAgo: "{n} 小时前",
			timeYesterday: "昨天",
			settingsSaveFailed: "设置保存失败"
		};
		const en = {
			github: "GitHub Inbox",
			githubUnread: "{count} unread",
			githubEmpty: "Inbox zero",
			githubLoading: "Loading…",
			githubRefresh: "Refresh",
			githubMarkAllRead: "Mark all read",
			githubUnconfiguredGh: "GitHub is not configured: gh is installed here — run gh auth login to connect automatically",
			githubUnconfiguredNoGh: "GitHub is not configured: set githubToken for dsh-github in cordis.patch.yml, or set GH_TOKEN / GITHUB_TOKEN",
			githubAuthError: "GitHub authentication failed (token expired or missing scopes) — inbox is read-only",
			githubNetworkError: "Fetch failed: {message} (showing the last snapshot)",
			githubFilterLabel: "Filters",
			githubChipReviewRequested: "Review requests",
			githubChipPrActivity: "My PR activity",
			githubChipComments: "Comments / mentions",
			githubChipCi: "CI status",
			githubChipOther: "Other",
			githubPollSecondsTitle: "Poll interval",
			githubCategoryReviewRequested: "Review request",
			githubCategoryPrActivity: "PR activity",
			githubCategoryComments: "Comment",
			githubCategoryCi: "CI",
			githubCategoryOther: "Other",
			githubVerdictApproved: "✅ approved",
			githubVerdictChanges: "⛔️ changes requested",
			githubOpenExternal: "Open in browser",
			githubOpenInSidebar: "Open in sidebar",
			githubMarkRead: "Mark read",
			githubMarkDone: "Done",
			githubApprove: "Approve",
			githubRequestChanges: "Request changes",
			githubCommentPlaceholder: "Write a comment… (Ctrl+Enter to send)",
			githubSend: "Send",
			githubDetailLoadFailed: "Failed to load details, retry",
			githubActionFailed: "Action failed: {message}",
			githubMerge: "Merge",
			githubMergeTitle: "Merge this PR",
			githubMergeChecks: "CI checks",
			githubMergeMethod: "Merge method",
			githubMergeMethodMerge: "merge commit",
			githubMergeMethodSquash: "squash",
			githubMergeMethodRebase: "rebase",
			githubMergeConfirm: "Merge PR #{pr} in {repo}",
			githubMergeDisabled: "Merge is unavailable: the deployment did not enable githubAllowMerge",
			githubMergeUnavailable: "Not mergeable right now",
			githubMergeState: "PR state",
			githubNoComment: "No comment body",
			copy: "Copy",
			copied: "Copied",
			timeJustNow: "just now",
			timeMinutesAgo: "{n} min ago",
			timeHoursAgo: "{n} h ago",
			timeYesterday: "yesterday",
			settingsSaveFailed: "Failed to save settings"
		};
		function activeDict() {
			return (typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "en").toLowerCase().startsWith("zh") ? zh : en;
		}
		/** Resolve one copy key in the active language ({} placeholders interpolated). */
		function t(key, params) {
			let text = activeDict()[key];
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll("{" + name + "}", String(value));
			return text;
		}
		/** Relative time label of an ISO timestamp (fallback: the raw string). */
		function relativeTime(iso) {
			const then = Date.parse(iso);
			if (Number.isNaN(then)) return iso;
			const seconds = Math.floor((Date.now() - then) / 1e3);
			if (seconds < 60) return t("timeJustNow");
			if (seconds < 3600) return t("timeMinutesAgo", { n: Math.floor(seconds / 60) });
			if (seconds < 86400) return t("timeHoursAgo", { n: Math.floor(seconds / 3600) });
			if (seconds < 172800) return t("timeYesterday");
			const date = new Date(then);
			const pad = (value) => String(value).padStart(2, "0");
			return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
		}
		//#endregion
		//#region src/client/view.tsx
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
		/** The category order of the filter chips. */
		const CATEGORY_ORDER = [
			"reviewRequested",
			"prActivity",
			"comments",
			"ci",
			"other"
		];
		/** The chip label key of one category. */
		const CHIP_LABELS = {
			reviewRequested: "githubChipReviewRequested",
			prActivity: "githubChipPrActivity",
			comments: "githubChipComments",
			ci: "githubChipCi",
			other: "githubChipOther"
		};
		/** The inline tag label key of one category. */
		const TAG_LABELS = {
			reviewRequested: "githubCategoryReviewRequested",
			prActivity: "githubCategoryPrActivity",
			comments: "githubCategoryComments",
			ci: "githubCategoryCi",
			other: "githubCategoryOther"
		};
		/** The merge-method button label key. */
		const METHOD_LABELS = {
			squash: "githubMergeMethodSquash",
			merge: "githubMergeMethodMerge",
			rebase: "githubMergeMethodRebase"
		};
		/** Join class candidates, dropping falsy ones. */
		function cx(...candidates) {
			return candidates.filter(Boolean).join(" ");
		}
		/** Fold an action failure into a displayable message. */
		function actionMessage(error) {
			if (error instanceof GithubClientError) return t("githubActionFailed", { message: error.message });
			return t("githubActionFailed", { message: error instanceof Error ? error.message : String(error) });
		}
		/** The merge panel's failure text: the gate reads differently from GitHub's rejections. */
		function mergeMessage(error) {
			if (error instanceof GithubClientError) {
				if (error.code === "github-forbidden") return t("githubMergeDisabled");
				return error.message;
			}
			return error instanceof Error ? error.message : String(error);
		}
		/** One thread row plus its expansion (detail, actions, merge panel). */
		function ThreadRow(props) {
			const { thread, busy } = props;
			const category = categorizeThread(thread);
			const verdict = thread.type === "PullRequest" ? reviewVerdict(thread.title) : void 0;
			const pr = threadNumber(thread.url);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dgh-thread",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: "dgh-row",
					onClick: props.onToggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: cx("dgh-dot", thread.unread && "dgh-dotUnread") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dgh-rowTitle",
							children: thread.title
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dgh-rowMeta",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dgh-tag",
									children: t(TAG_LABELS[category])
								}),
								verdict !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: cx("dgh-verdict", verdict === "approved" ? "dgh-verdictOk" : "dgh-verdictBad"),
									children: t(verdict === "approved" ? "githubVerdictApproved" : "githubVerdictChanges")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dgh-rowTime",
									children: relativeTime(thread.updatedAt)
								})
							]
						})
					]
				}), props.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dgh-detail",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dgh-detailBody",
							children: [
								props.detailLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("githubLoading") }),
								props.detailFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("githubDetailLoadFailed") }),
								!props.detailLoading && !props.detailFailed && (props.detail !== null && props.detail.commentBody !== void 0 && props.detail.commentBody !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
									text: props.detail.commentBody,
									codeLabels: {
										copyLabel: t("copy"),
										copiedLabel: t("copied")
									}
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("githubNoComment") }))
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dgh-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dgh-action",
									disabled: busy,
									onClick: props.onMarkRead,
									children: t("githubMarkRead")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dgh-action",
									disabled: busy,
									onClick: props.onMarkDone,
									children: t("githubMarkDone")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dgh-action",
									disabled: busy || thread.htmlUrl === "",
									onClick: props.onOpenSidebar,
									children: t("githubOpenInSidebar")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "dgh-action",
									disabled: busy || thread.htmlUrl === "",
									onClick: () => {
										window.open(thread.htmlUrl, "_blank", "noopener");
									},
									children: t("githubOpenExternal")
								}),
								thread.type === "PullRequest" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dgh-action dgh-actionApprove",
										disabled: busy,
										onClick: props.onApprove,
										children: t("githubApprove")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dgh-action dgh-actionChanges",
										disabled: busy,
										onClick: props.onRequestChanges,
										children: t("githubRequestChanges")
									}),
									props.mergeAllowed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dgh-action dgh-actionMerge",
										disabled: busy,
										onClick: props.onMergeOpen,
										children: t("githubMerge")
									})
								] })
							]
						}),
						pr !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dgh-commentBox",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "dgh-commentInput",
								value: props.commentDraft,
								placeholder: t("githubCommentPlaceholder"),
								onChange: (event) => {
									props.onCommentDraft(event.target.value);
								},
								onKeyDown: (event) => {
									if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
										event.preventDefault();
										props.onCommentSend();
									}
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dgh-action",
								disabled: busy || props.commentDraft.trim() === "",
								onClick: props.onCommentSend,
								children: t("githubSend")
							})]
						}),
						props.mergeOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dgh-mergePanel",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dgh-mergeTitle",
									children: t("githubMergeTitle")
								}),
								props.mergeLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("githubLoading") }),
								props.mergeError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dgh-errorLine",
									children: props.mergeError
								}),
								props.mergeStatus !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dgh-mergeRow",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("githubMergeState"),
											": ",
											props.mergeStatus.state
										] })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dgh-mergeRow",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("githubMergeChecks"), ":"] }),
											props.mergeStatus.checks.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dgh-mergeMeta",
												children: "—"
											}),
											props.mergeStatus.checks.map((check) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: cx("dgh-check", check.conclusion === "success" && "dgh-checkOk", check.conclusion !== null && check.conclusion !== "success" && check.conclusion !== "skipped" && check.conclusion !== "neutral" && "dgh-checkBad"),
												children: check.name
											}, check.name))
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dgh-mergeRow",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("githubMergeMethod"), ":"] }), Object.keys(METHOD_LABELS).map((method) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: cx("dgh-method", props.mergeMethod === method && "dgh-methodOn"),
											onClick: () => {
												props.onMergeMethod(method);
											},
											children: t(METHOD_LABELS[method])
										}, method))]
									}),
									props.mergeStatus.mergeable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dgh-errorLine",
										children: t("githubMergeUnavailable")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "dgh-mergeConfirm",
										disabled: props.mergeLoading,
										onClick: props.onMergeConfirm,
										children: t("githubMergeConfirm", {
											repo: thread.repo,
											pr: pr ?? 0
										})
									})
								] })
							]
						})
					]
				})]
			});
		}
		/** The GitHub inbox tab body. */
		function InboxView(props) {
			const { store, ctx, scope } = props;
			const state = (0, react.useSyncExternalStore)(store.subscribe, store.getState);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const [detailLoading, setDetailLoading] = (0, react.useState)(false);
			const [detailFailed, setDetailFailed] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(null);
			const [actionError, setActionError] = (0, react.useState)(null);
			const [commentDraft, setCommentDraft] = (0, react.useState)("");
			const [mergeFor, setMergeFor] = (0, react.useState)(null);
			const [mergeStatus, setMergeStatus] = (0, react.useState)(null);
			const [mergeLoading, setMergeLoading] = (0, react.useState)(false);
			const [mergeError, setMergeError] = (0, react.useState)(null);
			const [mergeMethod, setMergeMethod] = (0, react.useState)("squash");
			const expandedRef = (0, react.useRef)(null);
			const mergeForRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				store.ensurePolling();
			}, [store]);
			const snapshot = state.snapshot;
			const threads = snapshot === null ? [] : filterThreads(snapshot.threads, state.settings);
			const unread = countUnread(threads);
			const groups = groupThreads(threads);
			const collapse = () => {
				expandedRef.current = null;
				mergeForRef.current = null;
				setExpanded(null);
				setDetail(null);
				setDetailLoading(false);
				setDetailFailed(false);
				setMergeFor(null);
				setMergeStatus(null);
				setMergeError(null);
				setCommentDraft("");
			};
			const refresh = () => {
				store.refresh().catch((error) => {
					setActionError(actionMessage(error));
				});
			};
			const toggleThread = (thread) => {
				if (expanded === thread.id) {
					collapse();
					return;
				}
				expandedRef.current = thread.id;
				setExpanded(thread.id);
				setDetail(null);
				setDetailFailed(false);
				setDetailLoading(true);
				setMergeFor(null);
				setMergeStatus(null);
				setMergeError(null);
				api.githubThread(thread.id).then((result) => {
					if (expandedRef.current === thread.id) setDetail(result);
				}).catch(() => {
					if (expandedRef.current === thread.id) setDetailFailed(true);
				}).finally(() => {
					if (expandedRef.current === thread.id) setDetailLoading(false);
				});
			};
			const markRead = async (thread) => {
				setBusy("read:" + thread.id);
				setActionError(null);
				try {
					await api.githubMarkRead(thread.id);
					store.removeLocal(thread.id);
					collapse();
				} catch (error) {
					setActionError(actionMessage(error));
				} finally {
					setBusy(null);
				}
			};
			const markDone = async (thread) => {
				setBusy("done:" + thread.id);
				setActionError(null);
				try {
					await api.githubMarkDone(thread.id);
					store.removeLocal(thread.id);
					collapse();
				} catch (error) {
					setActionError(actionMessage(error));
				} finally {
					setBusy(null);
				}
			};
			const markAllRead = async () => {
				setBusy("all");
				setActionError(null);
				try {
					await api.githubMarkAllRead();
					store.clearLocal();
					collapse();
				} catch (error) {
					setActionError(actionMessage(error));
				} finally {
					setBusy(null);
				}
			};
			const submitReview = async (thread, event) => {
				const pr = threadNumber(thread.url);
				if (pr === void 0) return;
				setBusy("review:" + thread.id);
				setActionError(null);
				try {
					await api.githubReview(thread.repo, pr, event);
				} catch (error) {
					setActionError(actionMessage(error));
				} finally {
					setBusy(null);
				}
			};
			const submitComment = async (thread) => {
				const number = threadNumber(thread.url);
				const body = commentDraft.trim();
				if (number === void 0 || body === "") return;
				setBusy("comment:" + thread.id);
				setActionError(null);
				try {
					await api.githubComment(thread.repo, number, body);
					setCommentDraft("");
				} catch (error) {
					setActionError(actionMessage(error));
				} finally {
					setBusy(null);
				}
			};
			const openMerge = (thread) => {
				const pr = threadNumber(thread.url);
				if (pr === void 0) return;
				mergeForRef.current = thread.id;
				setMergeFor(thread.id);
				setMergeStatus(null);
				setMergeError(null);
				setMergeLoading(true);
				api.githubMergeStatus(thread.repo, pr).then((result) => {
					if (mergeForRef.current === thread.id) setMergeStatus(result);
				}).catch((error) => {
					if (mergeForRef.current === thread.id) setMergeError(mergeMessage(error));
				}).finally(() => {
					if (mergeForRef.current === thread.id) setMergeLoading(false);
				});
			};
			const confirmMerge = async (thread) => {
				const pr = threadNumber(thread.url);
				if (pr === void 0) return;
				setMergeLoading(true);
				setMergeError(null);
				try {
					await api.githubMerge(thread.repo, pr, mergeMethod);
					await api.githubMarkRead(thread.id).catch(() => {});
					store.removeLocal(thread.id);
					collapse();
				} catch (error) {
					setMergeError(mergeMessage(error));
				} finally {
					setMergeLoading(false);
				}
			};
			const toggleChip = (category) => {
				const key = GITHUB_CATEGORY_SETTING_KEYS[category];
				const next = state.settings[key] !== true;
				store.setSettings({ [key]: next });
				setActionError(null);
				callSidebarSettings({ pluginSettings: { [SETTINGS_KEY]: {
					...state.settings,
					[key]: next
				} } }).catch(() => {
					setActionError(t("settingsSaveFailed"));
				});
			};
			const openInSidebar = (thread) => {
				ctx.betterSidebar.openTab({
					type: "browser",
					title: thread.repo,
					url: thread.htmlUrl
				}, scope);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dgh-github",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dgh-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dgh-title",
								children: t("github")
							}),
							unread > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dgh-count",
								children: t("githubUnread", { count: unread })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dgh-iconBtn",
								disabled: busy === "all",
								title: t("githubRefresh"),
								onClick: refresh,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dgh-iconBtn",
								disabled: busy === "all",
								title: t("githubMarkAllRead"),
								onClick: () => {
									markAllRead();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline14, {})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dgh-chips",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dgh-chipsLabel",
							children: t("githubFilterLabel")
						}), CATEGORY_ORDER.map((category) => {
							const enabled = state.settings[GITHUB_CATEGORY_SETTING_KEYS[category]] === true;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: cx("dgh-chip", enabled && "dgh-chipOn"),
								onClick: () => {
									toggleChip(category);
								},
								children: t(CHIP_LABELS[category])
							}, category);
						})]
					}),
					snapshot === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-status",
						children: t("githubLoading")
					}),
					snapshot !== null && !snapshot.configured && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-status",
						children: snapshot.ghAvailable === false ? t("githubUnconfiguredNoGh") : t("githubUnconfiguredGh")
					}),
					snapshot?.configured === true && snapshot.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-status dgh-statusError",
						children: snapshot.error.code === "github-auth" ? t("githubAuthError") : t("githubNetworkError", { message: snapshot.error.message })
					}),
					actionError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-status dgh-statusError",
						children: actionError
					}),
					snapshot?.configured === true && snapshot.error === void 0 && groups.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-status",
						children: t("githubEmpty")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dgh-list",
						children: groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dgh-group",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dgh-groupHeader",
								children: group.repo
							}), group.threads.map((thread) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreadRow, {
								thread,
								expanded: expanded === thread.id,
								busy: busy !== null,
								detail,
								detailLoading,
								detailFailed,
								commentDraft,
								mergeAllowed: snapshot?.allowMerge === true,
								mergeOpen: mergeFor === thread.id,
								mergeStatus,
								mergeLoading,
								mergeError,
								mergeMethod,
								onToggle: () => {
									toggleThread(thread);
								},
								onMarkRead: () => {
									markRead(thread);
								},
								onMarkDone: () => {
									markDone(thread);
								},
								onOpenSidebar: () => {
									openInSidebar(thread);
								},
								onApprove: () => {
									submitReview(thread, "APPROVE");
								},
								onRequestChanges: () => {
									submitReview(thread, "REQUEST_CHANGES");
								},
								onMergeOpen: () => {
									openMerge(thread);
								},
								onMergeMethod: setMergeMethod,
								onMergeConfirm: () => {
									confirmMerge(thread);
								},
								onCommentDraft: setCommentDraft,
								onCommentSend: () => {
									submitComment(thread);
								}
							}, thread.id))]
						}, group.repo))
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/** Services required before activation (the sidebar publishes it on the client). */
		const inject = ["betterSidebar"];
		/** The inbox glyph, local to this plugin. */
		function IconInboxOutline16({ size = 16 }) {
			return (0, react.createElement)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg"
			}, (0, react.createElement)("rect", {
				x: "1.5",
				y: "2.5",
				width: "13",
				height: "11",
				rx: "2",
				stroke: "currentColor",
				strokeWidth: "1.5"
			}), (0, react.createElement)("path", {
				d: "M2.5 9.5h2.4c.55 0 1.05.3 1.32.78l.14.24c.26.45.76.73 1.29.73h.7c.53 0 1.03-.28 1.29-.73l.14-.24c.27-.48.77-.78 1.32-.78h2.4",
				stroke: "currentColor",
				strokeWidth: "1.5",
				strokeLinecap: "round"
			}));
		}
		/**
		* Client plugin body (runs once betterSidebar is provided).
		* @param ctx - the client cordis context.
		*/
		function apply(ctx) {
			const service = ctx.betterSidebar;
			if (service === void 0) return;
			injectStyles();
			const store = createGithubInboxStore(api, service);
			const features = service.features;
			const descriptor = {
				id: "github",
				title: () => t("github"),
				icon: (size) => (0, react.createElement)(IconInboxOutline16, { size }),
				order: 25,
				single: true,
				...features.includes("badge") ? { badge: () => {
					store.ensurePolling();
					return store.badgeValue();
				} } : {},
				settings: features.includes("pluginSettings") ? { pluginToggles: [
					{
						key: "showReviewRequested",
						title: () => t("githubChipReviewRequested")
					},
					{
						key: "showPrActivity",
						title: () => t("githubChipPrActivity")
					},
					{
						key: "showComments",
						title: () => t("githubChipComments")
					},
					{
						key: "showCi",
						title: () => t("githubChipCi")
					},
					{
						key: "showOther",
						title: () => t("githubChipOther")
					},
					{
						key: "pollSeconds",
						type: "number",
						min: 60,
						max: 300,
						unit: "s",
						title: () => t("githubPollSecondsTitle")
					}
				] } : void 0,
				component: ({ ctx, scope }) => (0, react.createElement)(InboxView, {
					store,
					ctx,
					scope
				})
			};
			ctx.effect(() => {
				const unregister = service.registerTab(descriptor);
				return () => {
					unregister();
					store.dispose();
				};
			}, "dsh-github: github tab");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map