/** ReDoc scroll offset for {@link Redoc.init} `scrollYOffset` option. */
export function redocScrollYOffset(): number {
  const nav = document.querySelector(".plugin-docs-app .navbar");
  const height = nav ? nav.getBoundingClientRect().height : 0;
  // ReDoc always applies scrollBy(0, -scrollYOffset + 1) after scrollIntoView.
  // When offset is 0 that becomes +1px per navigation click; use at least 1 to cancel it.
  return Math.max(1, Math.ceil(height));
}
