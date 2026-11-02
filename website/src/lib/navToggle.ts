/**
 * Opens and closes the site's collapsible navigation without Bootstrap's JavaScript bundle (the
 * site only loads the Bootstrap skin CSS). A toggler is any element with `data-qp-toggle="<id>"`;
 * pressing it flips the `show` class of the element with that id (a `.collapse` or an
 * `.offcanvas-*`), shows or hides the backdrops marked `data-qp-backdrop="<id>"` and keeps every
 * toggler's `aria-expanded` in sync. Escape closes whatever is open.
 */
export function initNavToggles(): void {
  const togglers = Array.from(document.querySelectorAll<HTMLElement>("[data-qp-toggle]"));
  const ids = new Set(togglers.map((t) => t.dataset.qpToggle ?? ""));

  function setOpen(id: string, open: boolean) {
    const target = document.getElementById(id);
    if (!target) return;
    target.classList.toggle("show", open);
    document.querySelectorAll<HTMLElement>(`[data-qp-backdrop="${id}"]`).forEach((backdrop) => {
      backdrop.hidden = !open;
      backdrop.classList.toggle("show", open);
    });
    togglers
      .filter((t) => t.dataset.qpToggle === id && t.hasAttribute("aria-controls"))
      .forEach((t) => t.setAttribute("aria-expanded", String(open)));
  }

  togglers.forEach((toggler) => {
    toggler.addEventListener("click", () => {
      const id = toggler.dataset.qpToggle ?? "";
      setOpen(id, !document.getElementById(id)?.classList.contains("show"));
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    ids.forEach((id) => setOpen(id, false));
  });
}
