/**
 * tsdown build for dsh-github:
 * - lib/index.js — the node half (ESM); cordis and every @deepseek-ai/
 *   package stay external (resolved by the profile's module graph).
 * - lib/client.js — the browser half: a CJS closure registered with
 *   window.__ModuleLoader__.load({ id: 'dsh-github', factory }), whose
 *   require resolves only platform module-table entries (react, cordis,
 *   the client primitives) — everything else inlines. The purity gate
 *   rejects any @deepseek-ai value import outside that table and any
 *   value import of dsh-better-sidebar (cross-plugin collaboration goes
 *   through cordis services; type-only imports are erased).
 */
import type { UserConfig } from 'tsdown'
import { builtinModules } from 'node:module'

const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

/** Platform module-table entries the client factory resolves at runtime. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** Client-bundle purity gate: cross-plugin value imports are forbidden. */
const purityGate = {
  name: 'dsh-github-client-purity',
  resolveId(source: string) {
    if (NODE_BUILTINS.has(source)) {
      throw new Error(
        `client bundle purity: Node builtin "${source}" cannot run in the browser module table`,
      )
    }
    if (source === 'dsh-better-sidebar' || source.startsWith('dsh-better-sidebar/')) {
      throw new Error(
        'client bundle purity: dsh-better-sidebar is a runtime peer — use type-only imports (erased) and ctx.betterSidebar service calls',
      )
    }
    if (!source.startsWith('@deepseek-ai/')) return null
    if (CLIENT_EXTERNALS.includes(source)) return null
    throw new Error(
      `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) — value imports are forbidden; collaborate through cordis services`,
    )
  },
}

const define = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  'import.meta.resolve': 'undefined',
}

const client: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [...CLIENT_EXTERNALS],
  define,
  inputOptions: {
    resolve: { conditionNames: ['browser', 'import', 'require', 'default'] },
  },
  noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
  plugins: [purityGate],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-github", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

// The ./shared subpath exports runtime constants (poll bounds) — it must
// ship as a real ESM artifact, not just its declaration file.
const shared: UserConfig = {
  entry: { shared: 'src/shared.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: false,
  clean: false,
  external: [/^node:/],
  define,
  outputOptions: {
    entryFileNames: 'shared.js',
    codeSplitting: false,
  },
}

const host: UserConfig = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [/^node:/, 'cordis', /^@deepseek-ai\//],
  define,
  outputOptions: {
    entryFileNames: 'index.js',
    codeSplitting: false,
  },
}

export default [host, shared, client]
