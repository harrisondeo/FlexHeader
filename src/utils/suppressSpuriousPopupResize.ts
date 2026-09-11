/**
 * Chrome extension popups can dispatch a genuine `resize` event on `window`
 * with no actual change in size at all - confirmed on an affected machine by
 * comparing inner/outerWidth/Height and document content dimensions
 * immediately before and after the event fired: identical every time,
 * including one landing right as a user starts dragging a header. Likely an
 * artifact of the popup's native auto-fit window sizing re-asserting itself
 * rather than a real resize; MDN and the extension APIs don't document this,
 * so this is inferred from observed behaviour rather than a cited cause.
 *
 * @hello-pangea/dnd's mouse sensor cancels any in-progress drag
 * unconditionally on `resize`, with no check for whether anything actually
 * changed (see getCaptureBindings in its source) - so a spurious resize
 * silently breaks header drag-and-drop, with no error, only on whichever
 * machines happen to get unlucky with the timing of that event landing
 * mid-gesture.
 *
 * Both this listener and @hello-pangea/dnd's own resize listener target
 * `window` directly, so invocation order is plain registration order (the
 * capture/bubble distinction only matters when an event propagates through
 * an element hierarchy, which doesn't apply when window is the target
 * itself). Calling this as early as possible - before React even mounts,
 * so long before any drag could begin and register the library's own
 * listener - guarantees we see the event first and can suppress it for
 * every listener registered after us. A genuine resize (the window's
 * dimensions actually differ from last observed) is left untouched, since
 * dnd's caution is correct in that case.
 */
export function suppressSpuriousPopupResizeEvents(): void {
  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;

  window.addEventListener("resize", (event) => {
    const { innerWidth, innerHeight } = window;
    if (innerWidth === lastWidth && innerHeight === lastHeight) {
      event.stopImmediatePropagation();
      return;
    }
    lastWidth = innerWidth;
    lastHeight = innerHeight;
  });
}
