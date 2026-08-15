# dsh-github

DSH 侧边栏 GitHub 插件：在 dsh-better-sidebar（≥ 0.12.0）中注册一个 **GitHub Inbox** tab——收件箱未读通知 + 角标、类别过滤（CI 默认隐藏）、已读/Done、Approve / Request changes / Comment、门控 Merge（`githubAllowMerge`）。

## 安装（两种通道）

### npm（官方 bundle 通道）

    dsh plugin --profile <name> add dsh-github@<version>

### git 源安装（pin 到 tag）

    dsh plugin --profile <name> add "github:NolanHo/DSH-github#v0.1.0"

## 配置（profile 的 cordis.patch.yml）

    - id: github
      name: 'dsh-github'
      config:
        githubAllowMerge: true   # 可选：开启 Merge（默认关）
        # githubToken: '...'     # 可选：显式 PAT（默认走 gh auth token → GH_TOKEN/GITHUB_TOKEN）
        # githubApiBase: 'https://ghe.example/api/v3'  # GHES
        # githubWebBase: 'https://ghe.example'         # GHES 子路径显式覆盖

## 设计

见 [docs/plans/2026-08-14-dsh-github-plugin-design.md](docs/plans/2026-08-14-dsh-github-plugin-design.md)。

## 开发

    pnpm install
    pnpm run typecheck
    pnpm run test
    pnpm run build
