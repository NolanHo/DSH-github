# dsh-github-inbox 插件仓库约束

## 硬约束

- **独立插件，不改 DSH 与 dsh-better-sidebar 源码**：一切经公开扩展点（ctx.betterSidebar 服务、settings.pluginToggles 开放 seam、自有 /plugins/dsh-github/* 路由）。
- **client bundle 纯度**：client 侧禁止 value-import 其他插件（dsh-better-sidebar 等）；类型用 import type {}（构建期擦除）。tsdown 纯度门守护。
- **token 永不进浏览器**：解析链在 node 半（config → gh CLI → env），状态响应不含 token。
- **发布走 profile bundle patch**（cordis.patch.yml），与 DSH 的 dsh.profile.bundles 机制协作。

## 约定

- 代码/注释/commit message 用英文；README/设计文档双语由维护者决定。
- 双半共享类型放 src/shared.ts（node-free，api-surface 测试守护）。
- 配置可部署字段全走 GithubConfig（cordis 可覆盖），无硬编码魔法值。
- 行为契约见 docs/plans/2026-08-14-dsh-github-plugin-design.md §7 invariants——任何改动不得破坏清单条目，除非同步更新设计文档与测试。
- 测试描述行为；每修复一条审查 finding 必须附回归测试。
