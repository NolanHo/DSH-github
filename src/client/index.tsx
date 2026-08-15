/**
 * dsh-github browser half: registers the GitHub Inbox tab with the
 * betterSidebar service (badge hook + pluginToggles settings + the inbox
 * view). The store is created once per activation and shared by the badge
 * hook and the view; the disposer stops its timer on fiber disposal
 * (HMR-safe). All collaboration goes through the cordis service — the
 * client bundle value-imports nothing from dsh-better-sidebar (the purity
 * gate enforces it; type-only imports are erased).
 */
import type { Context } from 'cordis'
// Loads the betterSidebar Context augmentation + descriptor types (erased).
import type { TabDescriptor } from 'dsh-better-sidebar'
import { createElement } from 'react'
import { api } from './api.ts'
import { injectStyles } from './styles.ts'
import { createGithubInboxStore } from './store.ts'
import { InboxView } from './view.tsx'
import { t } from './i18n.ts'

/** Services required before activation (the sidebar publishes it on the client). */
export const inject = ['betterSidebar'] as const

/** The inbox glyph, local to this plugin. */
function IconInboxOutline16({ size = 16 }: { size?: number }): React.ReactNode {
  return createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
    createElement('rect', { x: '1.5', y: '2.5', width: '13', height: '11', rx: '2', stroke: 'currentColor', strokeWidth: '1.5' }),
    createElement('path', { d: 'M2.5 9.5h2.4c.55 0 1.05.3 1.32.78l.14.24c.26.45.76.73 1.29.73h.7c.53 0 1.03-.28 1.29-.73l.14-.24c.27-.48.77-.78 1.32-.78h2.4', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
  )
}

/**
 * Client plugin body (runs once betterSidebar is provided).
 * @param ctx - the client cordis context.
 */
export function apply(ctx: Context): void {
  const service = ctx.betterSidebar
  if (service === undefined) return // optional peer absent — stay inert
  injectStyles()
  const store = createGithubInboxStore(api, service)
  const features = service.features
  const descriptor: TabDescriptor = {
    id: 'github',
    title: () => t('github'),
    icon: (size: number) => createElement(IconInboxOutline16, { size }),
    order: 25,
    single: true,
    // The badge pill arms the store's polling on its first render, so the
    // unread count stays live while the tab is open but inactive (the
    // badge only renders on open tabs — a never-opened tab has no pill).
    ...(features.includes('badge') ? {
      badge: () => {
        store.ensurePolling()
        return store.badgeValue()
      },
    } : {}),
    // Declarative settings: the five category filters plus the poll
    // interval render under this card in the Side card settings page.
    // The same keys drive the tab's filter chips (pluginSettings['github']).
    settings: features.includes('pluginSettings') ? {
      pluginToggles: [
        { key: 'showReviewRequested', title: () => t('githubChipReviewRequested') },
        { key: 'showPrActivity', title: () => t('githubChipPrActivity') },
        { key: 'showComments', title: () => t('githubChipComments') },
        { key: 'showCi', title: () => t('githubChipCi') },
        { key: 'showOther', title: () => t('githubChipOther') },
        { key: 'pollSeconds', type: 'number', min: 60, max: 300, unit: 's', title: () => t('githubPollSecondsTitle') },
      ],
    } : undefined,
    component: ({ ctx, scope }) => createElement(InboxView, { store, ctx, scope }),
  }
  ctx.effect(() => {
    const unregister = service.registerTab(descriptor)
    return () => {
      unregister()
      store.dispose()
    }
  }, 'dsh-github: github tab')
}
