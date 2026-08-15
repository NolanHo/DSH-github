/**
 * dsh-github browser half: registers the GitHub Inbox tab with the
 * betterSidebar service (badge hook + pluginToggles settings + the inbox
 * view). The store is created once per activation and shared by the badge
 * hook and the view; the disposer stops its timer on fiber disposal
 * (HMR-safe). All collaboration goes through the cordis service — the
 * client bundle value-imports nothing from dsh-better-sidebar (the purity
 * gate enforces it; type-only imports are erased).
 */
import type { Context } from 'cordis';
/** Services required before activation (the sidebar publishes it on the client). */
export declare const inject: readonly ["betterSidebar"];
/**
 * Client plugin body (runs once betterSidebar is provided).
 * @param ctx - the client cordis context.
 */
export declare function apply(ctx: Context): void;
