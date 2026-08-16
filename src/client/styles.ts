/** The view's stylesheet, injected once at client activation (dgh- prefix).
 * Follows the app's design tokens (--dsw-*) with literal fallbacks;
 * category accents use 8-digit hex tints for wide compatibility. */
export const INBOX_CSS = `
.dgh-github { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }

.dgh-header { flex: none; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 10px 0 14px; }
.dgh-title { flex: 1; min-width: 0; font: var(--dsw-font-s-14); font-weight: 600; color: var(--dsw-alias-label-primary, #ececec); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-count { flex: none; font: var(--dsw-font-s-12, 12px/1 sans-serif); font-weight: 600; color: #ffffff; background: var(--dsw-alias-accent, #4c6fff); border-radius: 999px; padding: 1px 8px; }
.dgh-iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary, #b8b8c0); cursor: pointer; transition: background 0.12s ease, color 0.12s ease; }
.dgh-iconBtn:hover { background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.06)); color: var(--dsw-alias-label-primary, #ececec); }
.dgh-iconBtn:disabled { opacity: 0.35; cursor: default; }

.dgh-chips { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 0 12px 10px; }
.dgh-chipsLabel { font: var(--dsw-font-s-12, 12px/1 sans-serif); color: var(--dsw-alias-label-tertiary, #8b8d98); margin-right: 2px; }
.dgh-chip { border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-tertiary, #8b8d98); font: var(--dsw-font-s-12, 12px/1 sans-serif); padding: 3px 11px; cursor: pointer; transition: all 0.12s ease; }
.dgh-chip:hover { border-color: var(--dsw-alias-label-secondary, #b8b8c0); color: var(--dsw-alias-label-secondary, #b8b8c0); }
.dgh-chipOn { border-color: var(--dsw-alias-accent, #4c6fff); background: var(--dsw-alias-accent, #4c6fff); color: #ffffff; }
.dgh-chipOn:hover { border-color: var(--dsw-alias-accent, #4c6fff); color: #ffffff; }

.dgh-status { flex: none; margin: 0 12px 8px; padding: 8px 12px; border-radius: 8px; font: var(--dsw-font-s-13, 13px/1.4 sans-serif); color: var(--dsw-alias-label-secondary, #b8b8c0); background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.05)); border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.08)); }
.dgh-statusError { color: #ff8a8a; background: #e5484d14; border-color: #e5484d3d; }

.dgh-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 12px; }
.dgh-list::-webkit-scrollbar { width: 8px; }
.dgh-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

.dgh-group { margin-bottom: 10px; }
.dgh-groupHeader { display: flex; align-items: center; gap: 6px; padding: 6px 6px 5px; font: var(--dsw-font-s-12, 12px/1 sans-serif); font-weight: 600; letter-spacing: 0.02em; color: var(--dsw-alias-label-tertiary, #8b8d98); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-groupHeader::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-tertiary, #8b8d98); opacity: 0.7; }

.dgh-thread { border-radius: 8px; margin-bottom: 2px; }
.dgh-row { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 44px; padding: 7px 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary, #ececec); text-align: left; cursor: pointer; transition: background 0.12s ease, border-color 0.12s ease; }
.dgh-row:hover { background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.05)); border-color: var(--dsw-alias-border, rgba(255,255,255,0.06)); }
.dgh-rowOpen { background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.04)); border-color: var(--dsw-alias-border, rgba(255,255,255,0.1)); }
.dgh-check { flex: none; width: 14px; height: 14px; accent-color: var(--dsw-alias-accent, #4c6fff); cursor: pointer; }
.dgh-titleCol { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dgh-titleLink { font: var(--dsw-font-s-13, 13px/1.4 sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; border-radius: 4px; }
.dgh-titleLink:hover { color: var(--dsw-alias-accent, #7caeff); text-decoration: underline; }
.dgh-num { font: var(--dsw-font-s-11, 11px/1 sans-serif); font-weight: 600; color: var(--dsw-alias-label-secondary, #b8b8c0); background: rgba(139,141,152,0.12); border-radius: 5px; padding: 1px 6px; }
.dgh-chevron { flex: none; font: 11px/1 sans-serif; color: var(--dsw-alias-label-tertiary, #8b8d98); transition: transform 0.12s ease; }
.dgh-chevronOpen { transform: rotate(90deg); }
.dgh-cat-reviewRequested { --dgh-cat-color: #7c5cff; }
.dgh-cat-prActivity { --dgh-cat-color: #3b82f6; }
.dgh-cat-comments { --dgh-cat-color: #30a46c; }
.dgh-cat-ci { --dgh-cat-color: #f76b15; }
.dgh-cat-other { --dgh-cat-color: #8b8d98; }
.dgh-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: transparent; }
.dgh-dotUnread { box-shadow: 0 0 0 3px var(--dgh-cat-color, var(--dsw-alias-accent, #4c6fff)); opacity: 0.9; }
.dgh-rowTitle { flex: 1; min-width: 0; font: var(--dsw-font-s-13, 13px/1.4 sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-groupName { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-groupCount { flex: none; background: rgba(139,141,152,0.14); border-radius: 999px; padding: 0 7px; font-weight: 600; }
.dgh-groupRead { flex: none; margin-left: auto; border: none; background: transparent; color: var(--dsw-alias-label-tertiary, #8b8d98); font-size: 12px; cursor: pointer; border-radius: 5px; padding: 1px 6px; }
.dgh-groupRead:hover:not(:disabled) { color: #7fd8a4; background: #30a46c1a; }
.dgh-groupRead:disabled { opacity: 0.35; cursor: default; }
.dgh-iconBtnOn { border-color: var(--dsw-alias-accent, #4c6fff); color: var(--dsw-alias-accent, #4c6fff); background: var(--dsw-alias-accent, #4c6fff)1a; }
.dgh-confirm { display: flex; flex-direction: column; gap: 7px; border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.1)); border-radius: 8px; background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.04)); padding: 8px 10px; }
.dgh-confirmMsg { font: var(--dsw-font-s-12, 12px/1.4 sans-serif); color: var(--dsw-alias-label-secondary, #b8b8c0); }
.dgh-bulkbar { flex: none; display: flex; align-items: center; gap: 8px; margin: 0 12px 8px; padding: 6px 10px; border: 1px solid var(--dsw-alias-accent, #4c6fff)3d; border-radius: 8px; background: var(--dsw-alias-accent, #4c6fff)14; font: var(--dsw-font-s-12, 12px/1 sans-serif); color: var(--dsw-alias-label-secondary, #b8b8c0); }
.dgh-newbar { flex: none; display: block; width: auto; margin: 0 12px 8px; border: 1px solid var(--dsw-alias-accent, #4c6fff)4d; border-radius: 999px; background: var(--dsw-alias-accent, #4c6fff)1f; color: #ffffff; font: var(--dsw-font-s-12, 12px/1 sans-serif); font-weight: 600; padding: 4px 14px; cursor: pointer; text-align: center; }
.dgh-newbar:hover { filter: brightness(1.1); }
.dgh-toast { position: absolute; right: 14px; bottom: 14px; z-index: 5; background: var(--dsw-alias-bg-toast, #232326); border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 8px; padding: 6px 12px; font: var(--dsw-font-s-12, 12px/1 sans-serif); color: var(--dsw-alias-label-primary, #ececec); box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
.dgh-dotUnread ~ .dgh-rowTitle { font-weight: 600; }
.dgh-rowMeta { flex: none; display: inline-flex; align-items: center; gap: 6px; }
.dgh-tag { font: var(--dsw-font-s-11, 11px/1 sans-serif); font-weight: 600; border-radius: 5px; padding: 2px 7px; }
.dgh-tag-reviewRequested { color: #a58cff; background: #7c5cff1a; border: 1px solid #7c5cff3d; }
.dgh-tag-prActivity { color: #7cb3ff; background: #3b82f61a; border: 1px solid #3b82f63d; }
.dgh-tag-comments { color: #7fd8a4; background: #30a46c1a; border: 1px solid #30a46c3d; }
.dgh-tag-ci { color: #ffb27c; background: #f76b151a; border: 1px solid #f76b153d; }
.dgh-tag-other { color: var(--dsw-alias-label-tertiary, #8b8d98); background: rgba(139,141,152,0.12); border: 1px solid rgba(139,141,152,0.25); }
.dgh-verdict { font: var(--dsw-font-s-11, 11px/1 sans-serif); font-weight: 600; border-radius: 5px; padding: 2px 7px; }
.dgh-verdictOk { color: #7fd8a4; background: #30a46c1a; border: 1px solid #30a46c3d; }
.dgh-verdictBad { color: #ffb27c; background: #f76b151a; border: 1px solid #f76b153d; }
.dgh-rowTime { font: var(--dsw-font-s-11, 11px/1 sans-serif); color: var(--dsw-alias-label-tertiary, #8b8d98); }

.dgh-detail { display: flex; flex-direction: column; gap: 9px; padding: 4px 12px 12px; }
.dgh-detailBody { font: var(--dsw-font-s-13, 13px/1.5 sans-serif); color: var(--dsw-alias-label-secondary, #b8b8c0); background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.04)); border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.06)); border-radius: 8px; padding: 9px 11px; overflow-wrap: anywhere; }
.dgh-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.dgh-action { border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 7px; background: transparent; color: var(--dsw-alias-label-secondary, #b8b8c0); font: var(--dsw-font-s-12, 12px/1 sans-serif); padding: 4px 11px; cursor: pointer; transition: all 0.12s ease; }
.dgh-action:hover { background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.06)); color: var(--dsw-alias-label-primary, #ececec); }
.dgh-action:disabled { opacity: 0.35; cursor: default; }
.dgh-actionApprove { color: #7fd8a4; background: #30a46c14; border-color: #30a46c4d; }
.dgh-actionApprove:hover { background: #30a46c24; color: #9decc0; }
.dgh-actionChanges { color: #ffb27c; background: #f76b1514; border-color: #f76b154d; }
.dgh-actionChanges:hover { background: #f76b1524; color: #ffc79c; }
.dgh-actionMerge { color: #ffffff; background: var(--dsw-alias-accent, #4c6fff); border-color: transparent; }
.dgh-actionMerge:hover { background: var(--dsw-alias-accent, #4c6fff); filter: brightness(1.1); }
.dgh-commentBox { display: flex; gap: 6px; }
.dgh-commentInput { flex: 1; min-height: 60px; resize: vertical; border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 8px; background: var(--dsw-alias-bg-input, rgba(0,0,0,0.2)); color: var(--dsw-alias-label-primary, #ececec); font: var(--dsw-font-s-13, 13px/1.5 sans-serif); padding: 7px 10px; outline: none; transition: border-color 0.12s ease; }
.dgh-commentInput:focus { border-color: var(--dsw-alias-accent, #4c6fff); }

.dgh-mergePanel { display: flex; flex-direction: column; gap: 7px; border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.1)); border-radius: 10px; background: var(--dsw-alias-bg-hover, rgba(255,255,255,0.04)); padding: 10px 12px; }
.dgh-mergeTitle { font: var(--dsw-font-s-13, 13px/1.4 sans-serif); font-weight: 600; color: var(--dsw-alias-label-primary, #ececec); }
.dgh-mergeRow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font: var(--dsw-font-s-12, 12px/1 sans-serif); color: var(--dsw-alias-label-tertiary, #8b8d98); }
.dgh-check { font: var(--dsw-font-s-11, 11px/1 sans-serif); font-weight: 600; border-radius: 5px; padding: 2px 7px; background: rgba(139,141,152,0.12); border: 1px solid rgba(139,141,152,0.25); color: var(--dsw-alias-label-tertiary, #8b8d98); }
.dgh-checkOk { color: #7fd8a4; background: #30a46c1a; border-color: #30a46c3d; }
.dgh-checkBad { color: #ff8a8a; background: #e5484d1a; border-color: #e5484d3d; }
.dgh-mergeMeta { color: var(--dsw-alias-label-tertiary, #8b8d98); }
.dgh-method { border: 1px solid var(--dsw-alias-border, rgba(255,255,255,0.12)); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-tertiary, #8b8d98); font: var(--dsw-font-s-11, 11px/1 sans-serif); padding: 3px 9px; cursor: pointer; transition: all 0.12s ease; }
.dgh-method:hover { border-color: var(--dsw-alias-label-secondary, #b8b8c0); color: var(--dsw-alias-label-secondary, #b8b8c0); }
.dgh-methodOn { border-color: var(--dsw-alias-accent, #4c6fff); color: #ffffff; background: var(--dsw-alias-accent, #4c6fff); }
.dgh-mergeConfirm { align-self: flex-start; border: none; border-radius: 7px; background: var(--dsw-alias-accent, #4c6fff); color: #ffffff; font: var(--dsw-font-s-12, 12px/1 sans-serif); font-weight: 600; padding: 5px 14px; cursor: pointer; transition: filter 0.12s ease; }
.dgh-mergeConfirm:hover { filter: brightness(1.12); }
.dgh-mergeConfirm:disabled { opacity: 0.4; cursor: default; }
.dgh-errorLine { font: var(--dsw-font-s-12, 12px/1.4 sans-serif); color: #ff8a8a; overflow-wrap: anywhere; }
`

/** Inject the stylesheet once (idempotent across activations). */
export function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-dsh-github]') !== null) return
  const tag = document.createElement('style')
  tag.dataset.dshGithub = ''
  tag.textContent = INBOX_CSS
  document.head.append(tag)
}
