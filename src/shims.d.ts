/**
 * Cordis context augmentation for the DSH services this plugin injects
 * dynamically. A third-party plugin resolves outside the DSH monorepo's
 * single cordis instance, so the upstream augmentations do not reach this
 * Context — the members below mirror the actual runtime shapes. Node-free
 * by contract (structural request/response faces; the host casts to real
 * node types only at the few boundaries that need them).
 */
import type { Context } from 'cordis'

/** The request face route handlers see (structural subset of IncomingMessage). */
export interface ApiRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

/** The response face route handlers write (structural subset of ServerResponse). */
export interface ApiResponse {
  writeHead(status: number, headers?: Record<string, string>): unknown
  end(chunk?: string): unknown
}

/** One webserver prefix-route registration. */
export interface WebServerService {
  register(entry: {
    kind: 'prefix'
    path: string
    handler: (req: ApiRequest, res: ApiResponse) => void | Promise<void>
  }): () => void
}

declare module 'cordis' {
  interface Context {
    /** The DSH-vendored lifecycle helper (auto-disposes the returned disposer). */
    effect(execute: () => (() => void) | void, label?: string): void
    /** Scoped service injection (the vendored Context member). */
    inject(deps: string[], callback: (ctx: Context) => void): void
    webServer?: WebServerService
    webRuntime?: { trustedHosts: string[] }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    effect(execute: () => (() => void) | void, label?: string): void
    inject(deps: string[], callback: (ctx: Context) => void): void
    webServer?: WebServerService
    webRuntime?: { trustedHosts: string[] }
  }
}
