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

## Deployment

Deployed to **GitHub Pages** at https://plugins.quartal.com by
[`.github/workflows/deploy-website.yml`](../.github/workflows/deploy-website.yml) on every push to
`main` that touches `website/`. The custom domain is pinned by `public/CNAME` (copied into
`dist/`), and `site` in `astro.config.mjs` must match it. DNS: a CNAME record for
`plugins.quartal.com` pointing at `quartal-hub.github.io`.

