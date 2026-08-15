/**
 * dsh-github node half: the /plugins/dsh-github/api JSON routes (inbox
 * snapshot, thread detail, read/done/review/comment/merge actions), all
 * behind the same browser-trust fence semantics as the /api gateway
 * (loopback Host or the web runtime's trustedHosts; cross-site browser
 * markers refuse). The webServer/webRuntime services are injected
 * dynamically, so headless profiles without a webserver still load the
 * plugin (the routes simply never mount).
 *
 * The inbox is account-global: requests carry no session scope.
 */
import type { Context } from 'cordis'

import { resolveGithubConfig, type GithubConfig } from './config.ts'
import { GithubInboxService } from './github.ts'
import { apiMethod, buildGithubApi, type GithubRoutes } from './routes.ts'
import { isTrustedApiRequest } from './fence.ts'
import { GithubError, readJsonBody, writeError, writeJson, writeOk } from './wire.ts'

export type { GithubConfig }
export type {
  GithubCheck,
  GithubMergeMethod,
  GithubMergeStatus,
  GithubReviewEvent,
  GithubStateResult,
  GithubThread,
  GithubThreadDetail,
  GithubPluginSettings,
} from './shared.ts'

/** Plugin identity for cordis rows. */
export const name = 'dsh-github'

/** The route prefix the client half posts to. */
export const API_PREFIX = '/plugins/dsh-github/api'

/**
 * Plugin body.
 * @param ctx - the host cordis context (webServer/webRuntime injected dynamically).
 * @param config - deployment settings (validated + defaulted by the resolver).
 */
export function apply(ctx: Context, config?: GithubConfig): void {
  const resolved = resolveGithubConfig(config)
  const service = new GithubInboxService(resolved)
  const api: GithubRoutes = buildGithubApi(service)

  ctx.inject(['webServer', 'webRuntime'], (sctx) => {
    sctx.effect(() => sctx.webServer!.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        if (!isTrustedApiRequest(req, sctx.webRuntime!.trustedHosts)) {
          writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
          return
        }
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
          return
        }
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const method = pathname.startsWith(API_PREFIX + '/') ? pathname.slice(API_PREFIX.length + 1) : undefined
        if (method === undefined || method.includes('/')) {
          writeError(res, new GithubError('not-found', 'unknown dsh-github API method', 404))
          return
        }
        try {
          const payload = await readJsonBody(req)
          const handler = apiMethod(api, method)
          if (handler === undefined) {
            throw new GithubError('not-found', 'unknown dsh-github API method ' + JSON.stringify(method), 404)
          }
          writeOk(res, await handler(payload))
        } catch (error) {
          writeError(res, error)
        }
      },
    }), 'dsh-github: API routes')
  })
}
