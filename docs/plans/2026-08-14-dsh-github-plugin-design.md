# dsh-github-inbox 独立插件设计（从零重写版，原名 dsh-github 因 npm 撞名改）

**日期**：2026-08-14
**状态**：已批准，待实施
**作者**：用户 + AI agent
**仓库**：https://github.com/NolanHo/DSH-github
**目标版本**：v0.1.0
**依赖**：dsh-better-sidebar ≥ 0.12.0（peer，optional）

## 1. 目标

做一个**完全独立的 DSH 插件** `dsh-github`，不修改 dsh-better-sidebar 与 DSH 源码：

1. 内置 tab `github`（经 `ctx.betterSidebar.registerTab` 注册）：GitHub 收件箱未读通知 + tab 角标；
2. 按类别勾选过滤（CI 默认隐藏），chips 与 Side card 齿轮设置同源；
3. 快捷操作：已读 / Done / 全部已读、Approve / Request changes / Comment、Merge（`githubAllowMerge` 门控）；
4. 包名 `dsh-github` 预留更广范围：本版只实现收件箱，模块边界允许后续扩展（issues/actions 等）。

## 2. 非目标

- 不改 better-sidebar / DSH 源码（设置走 `settings.pluginToggles` 开放 seam，无需宿主 schema 字段）。
- 不做多账户、不做实时推送（webhook/SSE）、不引入 GraphQL。
- 不做 agent 侧 GitHub 工具。
- 本期不发布 npm（先本地 link 验证，发布形态后定）。

## 3. 架构

照 dsh-sentinel 的成熟形态：node 半 + client 半一个包，profile 挂载。

```
src/index.ts            node 半：Config + GitHubClient + InboxService + /plugins/dsh-github/api/* 路由
src/client/index.tsx    client 半：inject ['betterSidebar']，注册 tab（badge + pluginToggles + 视图）
src/shared.ts           双半共享的 node-free 类型（GithubThread / GithubStateResult / …）
```

- **node 半** `inject = []`（headless 可加载运行时），`ctx.inject(['webServer'], …)` 动态挂路由：prefix `/plugins/dsh-github/api`，POST-only，自带信任栅栏（loopback Host + `webRuntime.trustedHosts`，逻辑照 sidebar 的 trust-fence 语义，独立实现，不 value-import 别的插件）。
- **client 半** `inject = ['betterSidebar']`，`peerDependencies.dsh-better-sidebar` optional；按 `service.features.includes('badge')` 能力门控（sidebar < 0.12.0 时角标降级为卡片内计数）。
- 卸载安全：`ctx.effect(() => registerTab(...))` 返回 disposer，fiber dispose 时撤销注册 + store.dispose。

## 4. 数据模型（src/shared.ts，node-free）

```ts
interface GithubThread {
  id: string; unread: boolean; reason: string; repo: string; title: string;
  url: string          // subject.url —— REST API 地址（编号解析/详情来源）
  htmlUrl: string      // 人类网页地址（web origin 推导，打开动作用它）
  type: string; updatedAt: string; latestCommentUrl?: string
}
interface GithubStateResult {
  configured: boolean; ghAvailable?: boolean; allowMerge: boolean;
  error?: { code: string; message: string }; threads: GithubThread[];
  fetchedAt?: string; pollIntervalSec: number
}
```

## 5. host 半

### 5.1 token 解析链（永不进浏览器）

config.githubToken → `gh auth token` 子进程（ENOENT 按进程生命周期缓存；成功 5min / 可恢复失败 30s）→ `GH_TOKEN`/`GITHUB_TOKEN` env → 未配置（`configured:false` + `ghAvailable` 驱动引导文案）。

### 5.2 GitHubClient（注入 apiBase/webBase/token/perPage）

- `fetchInbox(lastModified?)`：首页条件 GET（`If-Modified-Since` → 304 免费）；200 时按 Link 头 `rel="next"` 走后续页（**≤5 页**），合并后按 `updatedAt` 显式降序；304 采纳新 `X-Poll-Interval`。
- `fetchThreadDetail(id)`：线程详情 + `latest_comment_url` 正文；评论 URL 为**绝对 URL 原样 GET**（GHES `/api/v3` 基路径不双拼），且**只允许 apiBase 同 origin**（bearer token 不外泄）。
- 动作：markRead/markDone/markAllRead、submitReview（APPROVE/REQUEST_CHANGES/COMMENT）、addComment、fetchMergeStatus（PR + head check-runs）、merge。
- 错误归一化 `GithubApiError{status,message}` → wire 码：401/403 `github-auth`、404 `github-not-found`、422 `github-rejected`（文案透传）、其余 `github-error`；未配置动作 `github-unavailable`；门控拒绝 `github-forbidden`。

### 5.3 InboxService（请求驱动缓存）

客户端每次轮询 = 一次 state 请求：缓存新鲜（≥ max(pollFloorSeconds, X-Poll-Interval)）直接返回；否则条件 GET；304 刷新 fetchedAt 并采纳轮询间隔；失败保留上次快照 + error。`force`（刷新按钮）绕过新鲜度。动作成功后乐观更新缓存（移除/清空）。Merge 在 host 先查 `githubAllowMerge`（默认关）再碰 token。

### 5.4 路由（/plugins/dsh-github/api/<method>）

`state / thread / markRead / markDone / markAllRead / review / comment / mergeStatus / merge` 九方法；信封 `{ok,value|error}`；body 上限 1MB；评论/审查正文 ≤64KiB；**校验严格且同步抛错**（repo `^[\w.-]+/[\w.-]+$`、pr/issue 正整数、event/method 白名单、线程 id `^\d{1,20}$`）。

### 5.5 配置（cordis Config）

`githubToken?` / `githubApiBase`（默认 api.github.com）/ `githubWebBase?`（GHES 子路径显式覆盖）/ `githubPollFloorSeconds`（min 60）/ `githubPerPage`（≤50）/ `githubAllowMerge`（默认 false）。

## 6. client 半

### 6.1 tab 注册（settings.pluginToggles）

```ts
ctx.effect(() => ctx.betterSidebar.registerTab({
  id: 'github', order: 25, single: true,
  badge: () => { store.ensurePolling(); return store.badgeValue() },
  settings: { pluginToggles: [
    { key: 'showReviewRequested', … }, { key: 'showPrActivity', … }, { key: 'showComments', … },
    { key: 'showCi', … }, { key: 'showOther', … },
    { key: 'pollSeconds', type: 'number', min: 60, max: 300, unit: 's' },
  ] },
  component: ({ ctx, store, scope }) => <InboxView …/>,
}))
```

过滤/轮询持久化在 `pluginSettings['github']`（宿主零 schema 改动）；chips 点击经 sidebar store `setPrefs` 乐观应用 + 设置路由写回（同内置版机制）。

### 6.2 store（单实例，注册时创建）

- 惰性武装轮询（badge 首帧/视图挂载），`document.hidden` 跳过，未配置 5min 探测，dispose 清理；轮询间隔 `max(pluginSettings.pollSeconds, snapshot.pollIntervalSec)`。
- **badge→tab 栏桥**：store 每次变更用 `service.updateTab(tabId, {meta: badge})` 触发 tab 栏重渲染（值不变短路；覆盖 splits+bottomSplits 的 github tab）。
- **变更版本号**：markRead/Done/AllRead 本地变更 bump version；变更前发出的轮询/refresh 结果丢弃（防已读线程被旧快照复活）。
- **overlap 守卫**：tick 与 refresh 共享 inFlight（refresh 先 await）。

### 6.3 视图

顶栏（未读计数/刷新/全部已读）+ 过滤 chips + 状态行（未配置引导按 ghAvailable 区分 / github-auth 只读提示 / 网络错误保留旧数据）+ repo 分组列表 + 展开详情（Markdown 正文，`MarkdownText` 带 `codeLabels`）+ 动作（已读/Done/侧边栏打开/外开/Approve/Request changes/Comment/Merge 面板：check-runs + 方式 + 确认）。

## 7. 从内置版沉淀的 invariants（重写必须满足）

1. `subject.url` 是 REST 地址——打开动作用 `htmlUrl`；web origin = `githubWebBase` 显式覆盖，否则 apiBase 去尾 `/api/v3`（api.github.com→github.com）。
2. Merge 按钮显隐跟随 `state.allowMerge`（host 门控），确认时 `github-forbidden` 兜底。
3. 详情请求竞态：expanded 线程 id 守卫（ref），过期响应丢弃；collapse 同步清理 loading。
4. 本地变更（已读/Done/全部已读）与在途轮询竞态：版本号守卫，旧快照整包丢弃。
5. 线程 id 校验 `^\d{1,20}$`，同步抛错（guard 之前）。
6. 分页：Link 头遍历 ≤5 页；首页条件 304 时后续页不拉。
7. 绝对 URL GET 仅限 apiBase 同 origin（token 不外泄）。
8. 304 采纳新 `X-Poll-Interval`；轮询下限 60s；pluginSettings.pollSeconds 60–300。
9. 显式按 `updatedAt` 降序（API 顺序不是契约）。
10. CheckSuite（url 为空）禁用打开按钮；非 issue/PR 线程不渲染评论框。
11. 网络错误且无缓存时不显示「收件箱为空」（区分 error 与 empty）。
12. 过滤分类：review_requested / author+PR / comment·mention·team_mention·author+issue / ci_activity（**默认关**）/ 其余；badge = 过滤后未读数（99+ 封顶）。
13. reason 语义会漂移（官方行为）——分类是展示级，verdict 由标题关键词识别。
14. token 永不进浏览器；state 响应不含 token；错误文案不透传请求头。
15. i18n zh/en 平价（类型强制）；`MarkdownText` 传 `codeLabels`。
16. 动作失败就地显示错误行；settings 写失败提示且本地乐观态保留。
17. ENOENT（gh 未安装）进程级缓存；引导文案按 `ghAvailable` 选路。
18. 双半共享类型 node-free；client bundle 不 value-import 其他插件（纯度门）。

## 8. 测试计划

- 纯函数：分类/verdict/过滤/计数/分组/编号（含 reason 漂移样本）。
- host（mock fetch）：条件请求/304/分页合并排序/X-Poll-Interval 采纳/错误映射/乐观缓存/merge 门控顺序/unconfigured（gh 缺失与未登录两态）/绝对 URL 同源守卫/GHES webBase 推导。
- 路由：严格校验（含线程 id）、同步抛错契约、wire 码映射。
- client（jsdom）：视图渲染（未配置/列表/chips 写穿）、详情竞态、评论框门控、badge 桥 bump、轮询-变更版本守卫。
- 集成：真实隔离实例（本地 link + 隔离 DSH_HOME）真账号读路径验收。

## 9. 实施阶段

| 阶段 | 内容 | 验证 |
|---|---|---|
| P1 骨架 | 仓库初始化（package.json/tsconfig/vitest/tsdown）、shared 类型、Config、测试基架 | typecheck + test |
| P2 host | GitHubClient + token 链 + InboxService + 路由 + 栅栏 | mock 测试全绿 |
| P3 client | store + 视图 + tab 注册 + i18n + CSS | jsdom 测试全绿 |
| P4 集成 | 本地 link 到隔离 profile，启动 dsh 实例，真账号验收（读/过滤/角标） | 浏览器 + curl |
| P5 收尾 | README、设计文档状态、发布形态决策 | — |

## 10. 风险与权衡

- 重写丢失内置版细节 → §7 invariants 清单即防重蹈清单，且保留内置版 worktree 作行为对照（完成后删除）。
- 独立插件需自带栅栏/信封实现 → 各 ~60 行，sentinel 先例。
- `dsh-github` 名字预留范围 → 模块边界：收件箱为独立子模块，后续能力并列扩展。
