// Popovers the pickers open from their button, without ids (an id bound from data could clobber globals, SN503): the
// button toggles it and is its source, which anchors it there (temper's data-menu opens under its anchor) and gives
// the focus back to the button when it closes.

/** Opens `popover` from `source`, where the browser takes a source (Chromium 133+), else plainly. */
export function show(popover: HTMLElement, source: HTMLElement) {
  try { (popover.showPopover as (o?: { source?: HTMLElement }) => void)({ source }); } catch { popover.showPopover(); }
}

/** `source` toggles `popover`, which opens under `anchor` (the source itself unless given: the date field anchors it
 * to the whole field, so it starts under the text, not under the button at its end); `opened` hears every open and
 * close (for aria-expanded). */
export function openFrom(source: HTMLElement, popover: HTMLElement, signal: AbortSignal, opened: (open: boolean) => void, anchor = source) {
  source.addEventListener('click', () => (popover.matches(':popover-open') ? popover.hidePopover() : show(popover, anchor)), { signal });
  popover.addEventListener('toggle', (e) => opened((e as ToggleEvent).newState === 'open'), { signal });
}
