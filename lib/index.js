import { execFile } from "node:child_process";
/** Fail loud with a readable message for one misconfigured field. */
function fail(field, detail) {
	throw new Error(`dsh-github: invalid config ${field}: ${detail}`);
}
/**
* Apply defaults after (or without) Loader schema validation.
* @param config - deployment-provided settings.
* @returns complete settings consumed by the node half.
*/
function resolveGithubConfig(config) {
	const token = config?.githubToken;
	if (token !== void 0 && typeof token !== "string") fail("githubToken", "must be a string");
	const apiBase = config?.githubApiBase ?? "https://api.github.com";
	if (typeof apiBase !== "string" || !/^https?:\/\//.test(apiBase)) fail("githubApiBase", "must be an http(s) URL");
	const webBase = config?.githubWebBase;
	if (webBase !== void 0 && (typeof webBase !== "string" || !/^https?:\/\//.test(webBase))) fail("githubWebBase", "must be an http(s) URL");
	const pollFloorSeconds = config?.githubPollFloorSeconds ?? 60;
	if (typeof pollFloorSeconds !== "number" || !Number.isInteger(pollFloorSeconds) || pollFloorSeconds < 60) fail("githubPollFloorSeconds", `must be an integer ≥ 60`);
	const perPage = config?.githubPerPage ?? 50;
	if (typeof perPage !== "number" || !Number.isInteger(perPage) || perPage < 1 || perPage > 50) fail("githubPerPage", `must be an integer 1–50`);
	const allowMerge = config?.githubAllowMerge ?? false;
	if (typeof allowMerge !== "boolean") fail("githubAllowMerge", "must be a boolean");
	return {
		...token !== void 0 && token !== "" ? { token } : {},
		apiBase,
		...webBase !== void 0 && webBase !== "" ? { webBase } : {},
		pollFloorSeconds,
		perPage,
		allowMerge
	};
}
//#endregion
//#region src/wire.ts
/** One API failure with its wire code and HTTP status. */
var GithubError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 1 << 20;
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
		total += buffer.byteLength;
		if (total > MAX_BODY_BYTES) throw new GithubError("bad-request", "request body too large");
		chunks.push(buffer);
	}
	if (chunks.length === 0) return {};
	const text = Buffer.concat(chunks).toString("utf8");
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new GithubError("bad-request", "request body is not valid JSON");
	}
}
/** Write a JSON response with the given status. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(payload);
}
/** Write the success envelope. */
function writeOk(res, value) {
	writeJson(res, 200, {
		ok: true,
		value
	});
}
/** Write the failure envelope for any thrown value (unknown → internal 500). */
function writeError(res, error) {
	if (error instanceof GithubError) {
		writeJson(res, error.status, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	writeJson(res, 500, {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error)
		}
	});
}
/** Narrow an unknown payload value to a non-empty string, else throw bad-request. */
function requireString(payload, key) {
	const value = payload?.[key];
	if (typeof value !== "string" || value === "") throw new GithubError("bad-request", `missing or invalid "${key}"`);
	return value;
}
//#endregion
//#region src/github.ts
/**
* Node half of dsh-github: the GitHub REST client, the token resolution
* chain, and the request-driven inbox cache. No autonomous polling lives
* here — every client poll triggers a conditional GET (If-Modified-Since;
* a 304 reuses the cached threads and costs no rate limit), and mutations
* update the cache optimistically.
*
* The token never crosses to the browser: it resolves from the plugin
* configuration, the local gh CLI login, or the GITHUB_TOKEN / GH_TOKEN
* environment, in that order. The feature degrades to an unconfigured
* guide when no source yields a token.
* @module dsh-github/github
*/
/** A successful token resolution stays cached this long (ms). */
const TOKEN_SUCCESS_TTL_MS = 3e5;
/** A failed resolution (gh logged out, no env) is retried after this long (ms). */
const TOKEN_FAILURE_TTL_MS = 3e4;
/** Hard cap of the gh auth-token probe (ms). */
const GH_PROBE_TIMEOUT_MS = 1e4;
/** GitHub API version pinned by the client (REST notifications surface). */
const GITHUB_API_VERSION = "2022-11-28";
/** Cap of one review/comment body (chars) accepted by the action routes. */
const GITHUB_BODY_MAX = 65536;
/** A non-2xx GitHub API response. */
var GithubApiError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
/**
* The typed failure of the gh probe when the binary is NOT installed
* (cached for the process lifetime — no repeated spawns). Exported because
* it is part of the injectable probe contract: tests and alternative
* probes throw it to report a missing binary.
*/
var GhMissingError = class extends Error {};
/** The web-page path a subject type maps to ('PullRequest' → 'pull', …). */
const HTML_TYPE_SEGMENT = {
	PullRequest: "pull",
	Issue: "issue",
	Discussion: "discussions",
	Commit: "commit",
	Release: "releases"
};
/**
* The web origin thread links derive from: the explicit deployment
* override, or the api base minus a trailing /api/v3 (the public
* api.github.com base maps to github.com). GHES deployments whose web UI
* lives on a different origin/path set githubWebBase explicitly.
*/
function webOriginOf(apiBase, webBase) {
	if (webBase !== void 0 && webBase !== "") return webBase;
	return apiBase.replace(/\/api\/v3$/, "").replace("api.github.com", "github.com");
}
/**
* Derive the human web URL from a subject's REST URL. The inbox subject.url
* is the API endpoint (api.github.com/repos/o/r/pulls/1) — opening it raw
* serves JSON. The web URL is the same path on the web origin with the
* type segment singularized ('/repos/o/r/pulls/1' → '/o/r/pull/1').
* Falls back to the API URL when the path cannot be mapped.
*/
function htmlUrlOf(apiUrl, repo, type, webOrigin) {
	try {
		const parsed = new URL(apiUrl);
		const segment = HTML_TYPE_SEGMENT[type];
		if (segment === void 0) return apiUrl;
		const match = /\/repos\/[^/]+\/[^/]+\/(?:pulls?|issues?|discussions|commits|releases)\/([^/]+)/.exec(parsed.pathname);
		if (match === null) return apiUrl;
		const webPath = `/${repo}/${segment}/${match[1]}`;
		return new URL(webPath, webOrigin).toString();
	} catch {
		return apiUrl;
	}
}
/**
* Fold one raw notification row into the client-visible thread shape.
* Tolerates null subject/repository fields (a single malformed row must
* not fail the whole inbox).
*/
function mapThread(raw, webOrigin) {
	const subject = raw.subject;
	const repo = raw.repository?.full_name ?? "";
	const url = subject?.url ?? "";
	return {
		id: raw.id,
		unread: raw.unread,
		reason: raw.reason,
		repo,
		title: subject?.title ?? "",
		url,
		htmlUrl: htmlUrlOf(url, repo, subject?.type ?? "", webOrigin),
		type: subject?.type ?? "",
		updatedAt: raw.updated_at,
		...subject?.latest_comment_url !== null && subject?.latest_comment_url !== void 0 ? { latestCommentUrl: subject.latest_comment_url } : {}
	};
}
/** Run gh auth token and return the trimmed token, or a typed failure. */
function execGhToken() {
	return new Promise((resolve, reject) => {
		execFile("gh", ["auth", "token"], {
			timeout: GH_PROBE_TIMEOUT_MS,
			encoding: "utf8"
		}, (error, stdout) => {
			if (error !== null) {
				if (error.code === "ENOENT") reject(new GhMissingError());
				else reject(error);
				return;
			}
			const token = stdout.trim();
			if (token === "") reject(/* @__PURE__ */ new Error("gh auth token returned an empty value"));
			else resolve(token);
		});
	});
}
/**
* The token the deployment environment provides: GITHUB_TOKEN first, then
* GH_TOKEN. Empty strings count as absent — an empty GITHUB_TOKEN must not
* shadow a valid GH_TOKEN.
*/
function envToken() {
	const github = process.env.GITHUB_TOKEN;
	if (github !== void 0 && github !== "") return github;
	const gh = process.env.GH_TOKEN;
	if (gh !== void 0 && gh !== "") return gh;
}
/** The URL a Link header's rel="next" names, or null when there is none. */
function nextPageUrl(headers) {
	const link = headers.get("link");
	if (link === null) return null;
	for (const part of link.split(",")) {
		if (!part.includes("rel=\"next\"")) continue;
		const match = /<([^>]+)>/.exec(part);
		if (match !== null) return match[1] ?? null;
	}
	return null;
}
/** The failing operation's kind — decides the error code the client shows. */
function stateErrorOf(error) {
	if (error instanceof GithubApiError) {
		if (error.status === 401 || error.status === 403) return {
			code: "github-auth",
			message: error.message
		};
		return {
			code: "github-error",
			message: error.message
		};
	}
	return {
		code: "github-network",
		message: error instanceof Error ? error.message : String(error)
	};
}
/** Map a thrown GitHub failure onto the plugin's wire error vocabulary. */
function githubErrorToWire(error) {
	if (error instanceof GithubError) return error;
	if (error instanceof GithubApiError) {
		if (error.status === 401 || error.status === 403) return new GithubError("github-auth", error.message, 403);
		if (error.status === 404) return new GithubError("github-not-found", error.message, 404);
		if (error.status === 422) return new GithubError("github-rejected", error.message, 400);
		return new GithubError("github-error", error.message, 502);
	}
	return new GithubError("github-error", error instanceof Error ? error.message : String(error), 502);
}
/** GitHub REST client bound to one token. */
var GithubClient = class {
	base;
	token;
	perPage;
	webOrigin;
	constructor(base, token, perPage, webBase) {
		this.base = base;
		this.token = token;
		this.perPage = perPage;
		this.webOrigin = webOriginOf(base, webBase);
	}
	headers(extra) {
		return {
			accept: "application/vnd.github+json",
			"x-github-api-version": GITHUB_API_VERSION,
			"user-agent": "dsh-github",
			authorization: `Bearer ${this.token}`,
			"content-type": "application/json",
			...extra
		};
	}
	/**
	* One authed GET. A relative path is joined onto the API base; an
	* absolute http(s) URL (the thread's latest_comment_url) is used as-is
	* (keeps GHES deployments with an /api/v3 base path from double-prefixing
	* the comment endpoint) — and only when it shares the API base's origin,
	* so the bearer token never leaves the trusted host.
	*/
	async get(path, headers) {
		let target = `${this.base}${path}`;
		if (/^https?:\/\//.test(path)) {
			if (new URL(path).origin !== new URL(this.base).origin) throw new GithubApiError(403, "refusing cross-origin GitHub GET");
			target = path;
		}
		const response = await fetch(target, { headers: this.headers(headers) });
		const text = await response.text().catch(() => "");
		let body = void 0;
		if (text !== "") try {
			body = JSON.parse(text);
		} catch {}
		if (!response.ok) {
			const record = body;
			throw new GithubApiError(response.status, typeof record?.message === "string" && record.message !== "" ? record.message : `GitHub API ${response.status}`);
		}
		return {
			status: response.status,
			headers: response.headers,
			body
		};
	}
	/** One authed mutation (PATCH/POST/PUT/DELETE); returns the parsed body. */
	async send(method, path, json) {
		const response = await fetch(`${this.base}${path}`, {
			method,
			headers: this.headers(),
			...json !== void 0 ? { body: JSON.stringify(json) } : {}
		});
		const text = await response.text().catch(() => "");
		let body = void 0;
		if (text !== "") try {
			body = JSON.parse(text);
		} catch {}
		if (!response.ok) {
			const record = body;
			throw new GithubApiError(response.status, typeof record?.message === "string" && record.message !== "" ? record.message : `GitHub API ${response.status}`);
		}
		return body;
	}
	/** Poll interval from a response's X-Poll-Interval (GitHub's documented cadence). */
	pollIntervalOf(headers) {
		const value = Number(headers.get("x-poll-interval"));
		return Number.isFinite(value) && value > 0 ? Math.round(value) : 60;
	}
	/**
	* List unread inbox threads, walking up to GITHUB_MAX_PAGES pages via
	* the Link header. The FIRST page is conditional on lastModified (a 304
	* returns notModified with no body cost, and the cached full list stays
	* valid); the follow-up pages are only fetched when the first page
	* changed, so an unchanged inbox costs one conditional request per poll
	* regardless of inbox size.
	* @returns the folded threads (empty on 304) plus the cache headers.
	*/
	async fetchInbox(lastModified) {
		const headers = {};
		if (lastModified !== void 0) headers["if-modified-since"] = lastModified;
		const first = await fetch(`${this.base}/notifications?per_page=${this.perPage}&all=false`, { headers: this.headers(headers) });
		const pollIntervalSec = this.pollIntervalOf(first.headers);
		const responseLastModified = first.headers.get("last-modified") ?? lastModified;
		if (first.status === 304) return {
			notModified: true,
			threads: [],
			lastModified: responseLastModified,
			pollIntervalSec
		};
		const raw = [];
		/**
		* Follow one rel="next" target only when it shares the API base's
		* origin — the paginated requests carry the bearer token, and a
		* mismatched origin (misconfigured proxy, compromised intermediary)
		* must never receive it (mirrors get()'s absolute-URL guard).
		*/
		const followNext = (url) => {
			if (new URL(url).origin !== new URL(this.base).origin) throw new GithubApiError(502, "refusing cross-origin GitHub pagination link");
			return url;
		};
		const adoptPage = async (response) => {
			const text = await response.text().catch(() => "");
			if (!response.ok) {
				let message = `GitHub API ${response.status}`;
				try {
					const parsed = JSON.parse(text);
					if (typeof parsed.message === "string" && parsed.message !== "") message = parsed.message;
				} catch {}
				throw new GithubApiError(response.status, message);
			}
			let pageRaw = [];
			try {
				pageRaw = JSON.parse(text);
			} catch {}
			raw.push(...pageRaw);
		};
		await adoptPage(first);
		let next = nextPageUrl(first.headers);
		let pages = 1;
		while (next !== null && pages < 5) {
			const response = await fetch(followNext(next), { headers: this.headers() });
			await adoptPage(response);
			next = nextPageUrl(response.headers);
			pages += 1;
		}
		raw.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
		return {
			notModified: false,
			threads: raw.map((item) => mapThread(item, this.webOrigin)),
			lastModified: responseLastModified,
			pollIntervalSec
		};
	}
	/** One thread's detail plus its latest comment body (both fail soft). */
	async fetchThreadDetail(id) {
		const thread = mapThread((await this.get(`/notifications/threads/${id}`)).body, this.webOrigin);
		const url = thread.latestCommentUrl;
		if (url === void 0) return { thread };
		try {
			const comment = (await this.get(url)).body;
			if (typeof comment?.body === "string") return {
				thread,
				commentBody: comment.body
			};
		} catch {}
		return { thread };
	}
	/** Mark one thread read (PATCH, 204). */
	async markThreadRead(id) {
		await this.send("PATCH", `/notifications/threads/${id}`);
	}
	/** Mark one thread done — GitHub's archive (DELETE, 204). */
	async markThreadDone(id) {
		await this.send("DELETE", `/notifications/threads/${id}`);
	}
	/** Mark every unread thread read (PUT, 205). */
	async markAllRead() {
		await this.send("PUT", "/notifications", {});
	}
	/** Submit one PR review event (APPROVE / REQUEST_CHANGES / COMMENT). */
	async submitReview(repo, pr, event, body) {
		await this.send("POST", `/repos/${repo}/pulls/${pr}/reviews`, {
			event,
			...body !== void 0 && body !== "" ? { body } : {}
		});
	}
	/** Post a general comment on an issue or PR (the shared comments endpoint). */
	async addComment(repo, issue, body) {
		await this.send("POST", `/repos/${repo}/issues/${issue}/comments`, { body });
	}
	/** Mergeability of one PR plus its head-sha check runs, normalized. */
	async fetchMergeStatus(repo, pr) {
		const pull = (await this.get(`/repos/${repo}/pulls/${pr}`)).body;
		const sha = typeof pull?.head?.sha === "string" ? pull.head.sha : void 0;
		const checks = [];
		if (sha !== void 0) try {
			const runs = (await this.get(`/repos/${repo}/commits/${sha}/check-runs`)).body;
			for (const run of runs?.check_runs ?? []) checks.push({
				name: typeof run.name === "string" ? run.name : "check",
				status: typeof run.status === "string" ? run.status : "unknown",
				conclusion: typeof run.conclusion === "string" ? run.conclusion : null
			});
		} catch {}
		return {
			checks,
			mergeable: typeof pull?.mergeable === "boolean" ? pull.mergeable : null,
			state: typeof pull?.state === "string" ? pull.state : "unknown"
		};
	}
	/** Merge one PR with the chosen method (merge / squash / rebase). */
	async merge(repo, pr, method) {
		await this.send("PUT", `/repos/${repo}/pulls/${pr}/merge`, { merge_method: method });
	}
};
/**
* The plugin's host service: token resolution with caching, the
* request-driven inbox cache (conditional GETs), and the mutation surface
* with optimistic cache updates. One instance per node half.
*/
var GithubInboxService = class {
	config;
	probeGh;
	tokenCache;
	ghMissing = false;
	cache;
	constructor(config, probeGh = execGhToken) {
		this.config = config;
		this.probeGh = probeGh;
	}
	ghAvailable() {
		return !this.ghMissing;
	}
	/** Resolve a token through config → gh CLI → environment (with caching). */
	async resolveToken() {
		if (this.config.token !== void 0 && this.config.token !== "") return {
			token: this.config.token,
			ghAvailable: this.ghAvailable()
		};
		const now = Date.now();
		const cached = this.tokenCache;
		if (cached !== void 0 && now - cached.at < (cached.token !== void 0 ? TOKEN_SUCCESS_TTL_MS : TOKEN_FAILURE_TTL_MS)) {
			if (cached.token !== void 0) return {
				token: cached.token,
				ghAvailable: this.ghAvailable()
			};
			const env = envToken();
			if (env !== void 0) {
				this.tokenCache = {
					token: env,
					at: now
				};
				return {
					token: env,
					ghAvailable: this.ghAvailable()
				};
			}
			return {
				token: void 0,
				ghAvailable: this.ghAvailable()
			};
		}
		let ghToken;
		if (!this.ghMissing) try {
			ghToken = await this.probeGh();
		} catch (error) {
			if (error instanceof GhMissingError) this.ghMissing = true;
			ghToken = void 0;
		}
		const env = envToken();
		const token = ghToken !== void 0 ? ghToken : env;
		this.tokenCache = {
			token,
			at: now
		};
		return {
			token,
			ghAvailable: this.ghAvailable()
		};
	}
	snapshot() {
		return {
			configured: true,
			ghAvailable: this.ghAvailable(),
			allowMerge: this.config.allowMerge,
			threads: this.cache?.threads ?? [],
			fetchedAt: this.cache !== void 0 ? new Date(this.cache.fetchedAt).toISOString() : void 0,
			pollIntervalSec: Math.max(this.config.pollFloorSeconds, this.cache?.pollIntervalSec ?? this.config.pollFloorSeconds)
		};
	}
	/**
	* The inbox snapshot. Fetches (conditionally) only when the cache is
	* staler than the effective poll interval; force bypasses freshness for
	* the refresh button. Failures keep the last threads and surface the
	* error code — the view keeps rendering stale data with a warning.
	*/
	async state(force) {
		const resolved = await this.resolveToken();
		if (resolved.token === void 0) return {
			configured: false,
			ghAvailable: resolved.ghAvailable,
			allowMerge: this.config.allowMerge,
			threads: [],
			pollIntervalSec: this.config.pollFloorSeconds
		};
		const client = new GithubClient(this.config.apiBase, resolved.token, this.config.perPage, this.config.webBase);
		const freshMs = Math.max(this.config.pollFloorSeconds, this.cache?.pollIntervalSec ?? this.config.pollFloorSeconds) * 1e3;
		const now = Date.now();
		if (!force && this.cache !== void 0 && now - this.cache.fetchedAt < freshMs) return this.snapshot();
		try {
			const inbox = await client.fetchInbox(this.cache?.lastModified);
			if (inbox.notModified && this.cache !== void 0) {
				this.cache = {
					...this.cache,
					fetchedAt: now,
					pollIntervalSec: Math.max(this.config.pollFloorSeconds, inbox.pollIntervalSec)
				};
				return this.snapshot();
			}
			this.cache = {
				threads: inbox.threads,
				lastModified: inbox.lastModified,
				fetchedAt: now,
				pollIntervalSec: Math.max(this.config.pollFloorSeconds, inbox.pollIntervalSec)
			};
			return this.snapshot();
		} catch (error) {
			return {
				configured: true,
				ghAvailable: this.ghAvailable(),
				allowMerge: this.config.allowMerge,
				error: stateErrorOf(error),
				threads: this.cache?.threads ?? [],
				fetchedAt: this.cache !== void 0 ? new Date(this.cache.fetchedAt).toISOString() : void 0,
				pollIntervalSec: Math.max(this.config.pollFloorSeconds, this.cache?.pollIntervalSec ?? this.config.pollFloorSeconds)
			};
		}
	}
	/** One thread's detail plus its latest comment body. */
	async thread(id) {
		return (await this.requireClient()).fetchThreadDetail(id);
	}
	/** Mark one thread read and drop it from the cached inbox (it is no longer unread). */
	async markRead(id) {
		await (await this.requireClient()).markThreadRead(id);
		this.removeCached(id);
	}
	/** Mark one thread done (archived) and drop it from the cached inbox. */
	async markDone(id) {
		await (await this.requireClient()).markThreadDone(id);
		this.removeCached(id);
	}
	/** Mark every thread read and clear the cached inbox. */
	async markAllRead() {
		await (await this.requireClient()).markAllRead();
		this.cache = this.cache === void 0 ? void 0 : {
			...this.cache,
			threads: [],
			fetchedAt: Date.now()
		};
	}
	/** Submit one PR review event. */
	async review(repo, pr, event, body) {
		await (await this.requireClient()).submitReview(repo, pr, event, body);
	}
	/** Post a general comment on an issue or PR. */
	async comment(repo, issue, body) {
		await (await this.requireClient()).addComment(repo, issue, body);
	}
	/** Mergeability plus head checks for the merge panel. */
	async mergeStatus(repo, pr) {
		return (await this.requireClient()).fetchMergeStatus(repo, pr);
	}
	/** Merge one PR (gated by the deployment's githubAllowMerge). */
	async merge(repo, pr, method) {
		if (!this.config.allowMerge) throw new GithubError("github-forbidden", "merge is disabled by configuration (githubAllowMerge)", 403);
		await (await this.requireClient()).merge(repo, pr, method);
	}
	async requireClient() {
		const resolved = await this.resolveToken();
		if (resolved.token === void 0) throw new GithubError("github-unavailable", "GitHub is not configured (no token resolved)", 503);
		return new GithubClient(this.config.apiBase, resolved.token, this.config.perPage, this.config.webBase);
	}
	removeCached(id) {
		if (this.cache === void 0) return;
		this.cache = {
			...this.cache,
			threads: this.cache.threads.filter((thread) => thread.id !== id)
		};
	}
};
//#endregion
//#region src/routes.ts
/**
* The GitHub routes of the plugin's JSON API ('github.state' /
* 'github.thread' / 'github.markRead' / 'github.markDone' /
* 'github.markAllRead' / 'github.review' / 'github.comment' /
* 'github.mergeStatus' / 'github.merge'). Payload validation is strict
* and SYNCHRONOUS (wrong values throw before any async work — the route
* table's dispatch catches both paths); GitHub-side failures re-throw
* through githubErrorToWire so the client gets the machine-readable codes.
*
* The inbox is account-global (not session-scoped): no payload here reads
* any session identifier.
*/
/** Review events the GitHub reviews endpoint accepts. */
const REVIEW_EVENTS = /* @__PURE__ */ new Set([
	"APPROVE",
	"REQUEST_CHANGES",
	"COMMENT"
]);
/** Merge methods the GitHub merge endpoint accepts. */
const MERGE_METHODS = /* @__PURE__ */ new Set([
	"merge",
	"squash",
	"rebase"
]);
/**
* Resolve one API method by name with an own-property check, so Object
* prototype members (constructor / toString / __proto__ …) can never
* bypass the unknown-method contract.
* @param api - the route group.
* @param method - the request's method name.
* @returns the dispatchable handler, or undefined for unknown names.
*/
function apiMethod(api, method) {
	return Object.prototype.hasOwnProperty.call(api, method) ? api[method] : void 0;
}
/**
* Build the GitHub route group over one inbox service.
* @param service - the host's inbox service (token chain + cache + actions).
*/
function buildGithubApi(service) {
	/** Optional bounded string field of a payload (undefined when absent). */
	const optionalBody = (payload) => {
		const record = payload;
		if (record?.body === void 0) return void 0;
		if (typeof record.body !== "string") throw new GithubError("bad-request", "\"body\" must be a string");
		if (record.body.length > 65536) throw new GithubError("bad-request", `"body" is too long (max ${GITHUB_BODY_MAX} chars)`);
		return record.body === "" ? void 0 : record.body;
	};
	/** Parse the 'owner/name' repo plus a positive integer number field. */
	const repoAndNumber = (payload, numberKey) => {
		const repo = requireString(payload, "repo");
		if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new GithubError("bad-request", "\"repo\" must be an owner/name pair");
		const value = payload[numberKey];
		if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new GithubError("bad-request", `"${numberKey}" must be a positive integer`);
		return {
			repo,
			number: value
		};
	};
	/**
	* Validate a thread id: GitHub thread ids are numeric strings — the
	* strict contract rejects anything else before it reaches the REST path.
	*/
	const requireThreadId = (payload) => {
		const id = requireString(payload, "id");
		if (!/^\d{1,20}$/.test(id)) throw new GithubError("bad-request", "\"id\" must be a numeric thread id");
		return id;
	};
	/** Wrap a service call so GitHub failures surface as wire errors. */
	const guard = async (run) => {
		try {
			return await run();
		} catch (error) {
			throw githubErrorToWire(error);
		}
	};
	return {
		state: (payload) => {
			const record = payload;
			return service.state(record?.force === true);
		},
		thread: (payload) => {
			const id = requireThreadId(payload);
			return guard(() => service.thread(id));
		},
		markRead: (payload) => {
			const id = requireThreadId(payload);
			return guard(async () => {
				await service.markRead(id);
				return { ok: true };
			});
		},
		markDone: (payload) => {
			const id = requireThreadId(payload);
			return guard(async () => {
				await service.markDone(id);
				return { ok: true };
			});
		},
		markAllRead: () => guard(async () => {
			await service.markAllRead();
			return { ok: true };
		}),
		review: (payload) => {
			const { repo, number } = repoAndNumber(payload, "pr");
			const event = requireString(payload, "event");
			if (!REVIEW_EVENTS.has(event)) throw new GithubError("bad-request", "event must be APPROVE, REQUEST_CHANGES, or COMMENT");
			const body = optionalBody(payload);
			return guard(async () => {
				await service.review(repo, number, event, body);
				return { ok: true };
			});
		},
		comment: (payload) => {
			const { repo, number } = repoAndNumber(payload, "issue");
			const body = requireString(payload, "body");
			if (body === "" || body.length > 65536) throw new GithubError("bad-request", `"body" must be 1–${GITHUB_BODY_MAX} chars`);
			return guard(async () => {
				await service.comment(repo, number, body);
				return { ok: true };
			});
		},
		mergeStatus: (payload) => {
			const { repo, number } = repoAndNumber(payload, "pr");
			return guard(() => service.mergeStatus(repo, number));
		},
		merge: (payload) => {
			const { repo, number } = repoAndNumber(payload, "pr");
			const method = requireString(payload, "method");
			if (!MERGE_METHODS.has(method)) throw new GithubError("bad-request", "method must be merge, squash, or rebase");
			return guard(async () => {
				await service.merge(repo, number, method);
				return { ok: true };
			});
		}
	};
}
//#endregion
//#region src/fence.ts
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/** Whether a normalized URL hostname names the local loopback authority. */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Canonical authority form: hostname, or hostname:port when a port was written. */
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
/** Whether the request authority matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* Decide whether one request may reach the plugin routes.
* @param request - node HTTP request facts (headers).
* @param trustedHosts - non-loopback authorities this deployment serves.
* @returns true when the Host is ours (loopback or trusted) and browser markers are same-origin.
*/
function isTrustedApiRequest(request, trustedHosts) {
	const host = header(request.headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(request.headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
//#endregion
//#region src/index.ts
/** Plugin identity for cordis rows. */
const name = "dsh-github";
/** The route prefix the client half posts to. */
const API_PREFIX = "/plugins/dsh-github/api";
/**
* Plugin body.
* @param ctx - the host cordis context (webServer/webRuntime injected dynamically).
* @param config - deployment settings (validated + defaulted by the resolver).
*/
function apply(ctx, config) {
	const api = buildGithubApi(new GithubInboxService(resolveGithubConfig(config)));
	ctx.inject(["webServer", "webRuntime"], (sctx) => {
		sctx.effect(() => sctx.webServer.register({
			kind: "prefix",
			path: API_PREFIX,
			handler: async (req, res) => {
				if (!isTrustedApiRequest(req, sctx.webRuntime.trustedHosts)) {
					writeJson(res, 403, {
						ok: false,
						error: {
							code: "forbidden",
							message: "forbidden"
						}
					});
					return;
				}
				if (req.method !== "POST") {
					writeJson(res, 405, {
						ok: false,
						error: {
							code: "method-error",
							message: "method not allowed"
						}
					});
					return;
				}
				const pathname = new URL(req.url ?? "/", "http://dsh.internal").pathname;
				const method = pathname.startsWith("/plugins/dsh-github/api/") ? pathname.slice(24) : void 0;
				if (method === void 0 || method.includes("/")) {
					writeError(res, new GithubError("not-found", "unknown dsh-github API method", 404));
					return;
				}
				try {
					const payload = await readJsonBody(req);
					const handler = apiMethod(api, method);
					if (handler === void 0) throw new GithubError("not-found", "unknown dsh-github API method " + JSON.stringify(method), 404);
					writeOk(res, await handler(payload));
				} catch (error) {
					writeError(res, error);
				}
			}
		}), "dsh-github: API routes");
	});
}
//#endregion
export { API_PREFIX, apply, name };

//# sourceMappingURL=index.js.map