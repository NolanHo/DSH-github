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
import type { Context } from 'cordis';
import { type GithubConfig } from './config.ts';
export type { GithubConfig };
export type { GithubCheck, GithubMergeMethod, GithubMergeStatus, GithubReviewEvent, GithubStateResult, GithubThread, GithubThreadDetail, GithubPluginSettings, } from './shared.ts';
/** Plugin identity for cordis rows. */
export declare const name = "dsh-github";
/** The route prefix the client half posts to. */
export declare const API_PREFIX = "/plugins/dsh-github/api";
/**
 * Plugin body.
 * @param ctx - the host cordis context (webServer/webRuntime injected dynamically).
 * @param config - deployment settings (validated + defaulted by the resolver).
 */
export declare function apply(ctx: Context, config?: GithubConfig): void;
