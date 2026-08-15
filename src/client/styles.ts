/** The view's stylesheet, injected once at client activation (dgh- prefix). */
export const INBOX_CSS = `
.dgh-github { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dgh-header { flex: none; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px 0 12px; }
.dgh-title { flex: 1; min-width: 0; font: var(--dsw-font-s-14); color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-count { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-tertiary); }
.dgh-iconBtn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: none; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dgh-iconBtn:hover { background: var(--dsw-alias-bg-hover); }
.dgh-iconBtn:disabled { opacity: 0.4; cursor: default; }
.dgh-chips { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 0 12px 8px; }
.dgh-chipsLabel { font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); }
.dgh-chip { border: 1px solid var(--dsw-alias-border); border-radius: 999px; background: transparent; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-s-12); padding: 2px 10px; cursor: pointer; }
.dgh-chipOn { border-color: var(--dsw-alias-accent); color: var(--dsw-alias-accent); }
.dgh-status { flex: none; padding: 8px 12px; font: var(--dsw-font-s-13); color: var(--dsw-alias-label-tertiary); }
.dgh-statusError { color: #e5484d; }
.dgh-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 12px; }
.dgh-group { margin-bottom: 4px; }
.dgh-groupHeader { padding: 6px 4px 4px; font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-thread { border-radius: 8px; overflow: hidden; }
.dgh-row { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 7px 8px; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); text-align: left; cursor: pointer; }
.dgh-row:hover { background: var(--dsw-alias-bg-hover); }
.dgh-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: transparent; }
.dgh-dotUnread { background: var(--dsw-alias-accent); }
.dgh-rowTitle { flex: 1; min-width: 0; font: var(--dsw-font-s-13); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgh-rowMeta { flex: none; display: inline-flex; align-items: center; gap: 6px; }
.dgh-tag { font: var(--dsw-font-s-11); color: var(--dsw-alias-label-tertiary); border: 1px solid var(--dsw-alias-border); border-radius: 4px; padding: 1px 5px; }
.dgh-verdict { font: var(--dsw-font-s-11); }
.dgh-verdictOk { color: #30a46c; }
.dgh-verdictBad { color: #e5484d; }
.dgh-rowTime { font: var(--dsw-font-s-11); color: var(--dsw-alias-label-tertiary); }
.dgh-detail { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 10px; }
.dgh-detailBody { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-secondary); border-left: 2px solid var(--dsw-alias-border); padding-left: 10px; overflow-wrap: anywhere; }
.dgh-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.dgh-action { border: 1px solid var(--dsw-alias-border); border-radius: 6px; background: transparent; color: var(--dsw-alias-label-secondary); font: var(--dsw-font-s-12); padding: 3px 9px; cursor: pointer; }
.dgh-action:hover { background: var(--dsw-alias-bg-hover); }
.dgh-action:disabled { opacity: 0.4; cursor: default; }
.dgh-actionApprove { color: #30a46c; border-color: currentColor; }
.dgh-actionChanges { color: #f76b15; border-color: currentColor; }
.dgh-actionMerge { color: var(--dsw-alias-accent); border-color: currentColor; }
.dgh-commentBox { display: flex; gap: 6px; }
.dgh-commentInput { flex: 1; min-height: 56px; resize: vertical; border: 1px solid var(--dsw-alias-border); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: var(--dsw-font-s-13); padding: 6px 8px; }
.dgh-mergePanel { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--dsw-alias-border); border-radius: 8px; padding: 8px 10px; }
.dgh-mergeTitle { font: var(--dsw-font-s-13); color: var(--dsw-alias-label-secondary); }
.dgh-mergeRow { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font: var(--dsw-font-s-12); color: var(--dsw-alias-label-tertiary); }
.dgh-check { font: var(--dsw-font-s-11); border: 1px solid var(--dsw-alias-border); border-radius: 4px; padding: 1px 5px; }
.dgh-checkOk { color: #30a46c; border-color: currentColor; }
.dgh-checkBad { color: #e5484d; border-color: currentColor; }
.dgh-mergeMeta { color: var(--dsw-alias-label-tertiary); }
.dgh-method { border: 1px solid var(--dsw-alias-border); border-radius: 4px; background: transparent; color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-s-11); padding: 1px 6px; cursor: pointer; }
.dgh-methodOn { border-color: var(--dsw-alias-accent); color: var(--dsw-alias-accent); }
.dgh-mergeConfirm { align-self: flex-start; border: 1px solid var(--dsw-alias-accent); border-radius: 6px; background: transparent; color: var(--dsw-alias-accent); font: var(--dsw-font-s-12); padding: 3px 9px; cursor: pointer; }
.dgh-mergeConfirm:hover { background: var(--dsw-alias-bg-hover); }
.dgh-mergeConfirm:disabled { opacity: 0.4; cursor: default; }
.dgh-errorLine { font: var(--dsw-font-s-12); color: #e5484d; overflow-wrap: anywhere; }
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
