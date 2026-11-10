# @quartal/website

The public marketing + documentation web site for Quartal Plugins (Astro + Vue, static output).

- `src/pages/index.astro` — marketing front page (dynamic pieces are Vue components, e.g.
  `src/components/CodeCompare.vue`).
- `src/content/docs/**/*.md` — the documentation content (an Astro content collection; frontmatter
  `section` + `order` drive the sidebar, see `src/content.config.ts` and `src/lib/sections.ts`).
- `src/pages/docs/` — the docs routes (index cards + one page per collection entry).

Audience split: everything under `section: start|tools|widgets|skills|more` is for **plugin
creators**; `section: framework` is for developers of this repository and links to the in-repo
docs (`docs/*.md`, `AGENTS.md`, `CONTRIBUTING.md`).

```bash
pnpm --filter @quartal/website dev       # http://localhost:4321
pnpm --filter @quartal/website build     # static site in dist/
```

## Styling

The site uses the **Quartal skin**, `src/styles/quartal.scss`: stock Bootstrap 5.3 and Bootstrap
Icons with the Quartal visual guidelines mapped onto Bootstrap variables (warm gray ramp, cobalt
primary buttons, Special Gothic headings over Funnel Sans from Google Fonts, pill buttons, flat
cards, `data-bs-theme="dark"` for black sections). It is the same skin as www.quartal.com; keep the
two in step. `BaseLayout.astro` imports it and Vite compiles it with the site. The site's own rules
(`src/styles/site.css`) use only Bootstrap CSS variables:

- **Chrome:** one-line navbar (logo, menu centred, GitHub right) and the footer, in `BaseLayout.astro`.
- **Front page:** the split layout — `page-section` rows with the heading and numbered
  `page-eyebrow` on the left (`col-lg-5`) and the text on the right (`col-lg-7`), `page-hero-media`
  for the overview picture, `ruled-cols` for feature columns (a 2px rule above each, no boxes) and
  `page-cta`, the closing black section.
- **Docs:** `DocsNav.astro` is a ruled list per section (`side-navi`), the current page in ink with
  an arrow; `DocsLayout.astro` adds the page path (breadcrumb) above the heading.

`public/img/plugins-overview.svg` is rendered from the Quartal Plugins overview drawing in the
Quartal design colours, with a transparent background for the gray-100 hero frame.

`/plugin-index` (the docs shell served by every plugin) is not styled by the site skin: it links
the plugin skin that each plugin injects at run time.

## Deployment

Deployed to **GitHub Pages** at https://plugin.quartal.com by
[`.github/workflows/deploy-website.yml`](../.github/workflows/deploy-website.yml) on every push to
`main` that touches `website/`. The custom domain is pinned by `public/CNAME` (copied into
`dist/`), and `site` in `astro.config.mjs` must match it. DNS: a CNAME record for
`plugin.quartal.com` pointing at `quartal-hub.github.io`.

