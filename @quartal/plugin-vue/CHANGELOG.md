# @quartal/plugin-vue

## 0.6.1

### Patch Changes

- Updated dependencies [671b588]
  - @quartal/plugin@0.10.1

## 0.6.0

### Minor Changes

- e7949c2: Widgets can call the plugin's own tools: `WidgetBridge.callTool(name, args)` in `@quartal/plugin/widget`
  and `callTool` on the `useExtApps` handle return the parsed tool result (and reject with the tool's error
  message), so a widget can drive `@visibility app` tools — selecting an item, paging — without the model.
- 1ca5f50: Widgets control their theme and display mode. `useExtApps` (and `connectWidget`) take `applyTheme` and
  `autoResize` options, so a widget with a fixed brand look can leave the host theme off. The bridge and the
  `useExtApps` handle report `displayMode` and `availableDisplayModes` and offer `requestDisplayMode(mode)`, for
  example to ask the host for `fullscreen` when a dialog does not fit the inline frame. A host-context change that
  carries no theme no longer resets the reported theme to light.
  
  `Helpers.getEnvVar(name, type)` reads typed environment variables (string, number, boolean; `?` makes one
  optional), and `astro dev` loads the project's `.env*` files into `process.env` for it.
  
  The default `quartal-hub` issuer is `https://iam2026.test.qrtl.com/auth/realms/quartal` (the realm path
  includes `/auth`).

### Patch Changes

- Updated dependencies [2593469]
- Updated dependencies [d6cb364]
- Updated dependencies [e7949c2]
- Updated dependencies [1ca5f50]
  - @quartal/plugin@0.10.0

## 0.5.8

### Patch Changes

- Updated dependencies [4c9905b]
  - @quartal/plugin@0.9.1

## 0.5.7

### Patch Changes

- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
- Updated dependencies [f9e9208]
  - @quartal/plugin@0.9.0

## 0.5.6

### Patch Changes

- Updated dependencies [8b460f9]
- Updated dependencies [9422615]
- Updated dependencies [8b460f9]
  - @quartal/plugin@0.8.0

## 0.5.5

### Patch Changes

- Updated dependencies [aed3d80]
- Updated dependencies [aed3d80]
  - @quartal/plugin@0.7.0

## 0.5.4

### Patch Changes

- 97dc6c5: Baseline release of every published package to verify the upgraded release pipeline
  (changesets/action v2) pushes git tags and creates GitHub Releases on publish.
- Updated dependencies [97dc6c5]
  - @quartal/plugin@0.6.1

## 0.5.3

### Patch Changes

- Updated dependencies [e4c8a90]
  - @quartal/plugin@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [844f6df]
  - @quartal/plugin@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [3922e86]
- Updated dependencies [3922e86]
  - @quartal/plugin@0.5.1
