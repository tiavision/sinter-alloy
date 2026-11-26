// Pointer capture for the drags: the moves of a pointer go to the element it started on, wherever the pointer goes.

/**
 * Captures `pointerId` on `el`, where the browser can: a pointer it no longer tracks (a touch already lifted, an event
 * a script made) throws, and the drag still works from the moves that reach the element.
 */
export function capture(el: Element | null | undefined, pointerId: number) {
  try { el?.setPointerCapture?.(pointerId); } catch { /* not an active pointer */ }
}
