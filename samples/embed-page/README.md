# Embed page sample

A plain web page (no framework) that embeds the `simpleSalary` widget of the
[`salaxy-anon`](../salaxy-anon/) sample plugin in two ways:

1. **Script tag** — loads the plugin's `/widgets.js` and uses the `<qrtl-widget>` element, setting
   `args` as a property and listening to its events.
2. **npm** — `connectPlugin()` from `@quartal/plugin-embed` calls the tool over REST and mounts the
   widget with the result the page already has.

## Run

```bash
# Terminal 1: the plugin
cd samples/salaxy-anon && pnpm dev          # http://localhost:4321

# Terminal 2: this page
cd samples/embed-page && pnpm dev           # http://localhost:5180
```

Open <http://localhost:5180>. Use `?plugin=https://your-plugin.example` to embed from another
deployment of the plugin.
