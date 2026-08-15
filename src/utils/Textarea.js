/**
 * Grows a textarea to fit what is in it, up to its own CSS `max-height`.
 *
 * The height is cleared first so the measurement shrinks as well as grows —
 * without it `scrollHeight` never reports less than the height already set, and
 * the field would keep every line it ever reached. The ceiling is left to CSS:
 * the browser clamps the height it is given, so the cap lives with the rest of
 * the styling instead of being repeated here.
 *
 * Requires `box-sizing: border-box` on the element, which `index.css` sets
 * globally — `scrollHeight` includes the padding, so under `content-box` the
 * field would gain its own padding on every call.
 */
export function autoGrowTextarea(element) {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}
