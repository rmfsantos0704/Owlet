# Owlet Chrome extension deployment

## Build a Chrome Web Store package

From the `extension` directory, run:

```sh
npm ci
npm run check
npm run build:prod
```

The production build is written to `dist/` and uses `manifest.prod.json`, which
contains only the deployed Owlet API and dashboard origins. Zip the **contents**
of `dist/` (so `manifest.json` is at the ZIP root), then upload that ZIP in the
Chrome Web Store Developer Dashboard.

The popup introduces clipping and Collection features with contextual callouts
on first use, has a replayable guide, and includes a saved light/dark theme
preference. When AI is available, its daily allowance appears in a compact
indicator beside the Collection picker, with a hover message showing remaining
uses or notifying when the daily allowance is exhausted.

Before publishing another update, increment `version` in both `manifest.json`
and `manifest.prod.json`. The Chrome Web Store version must be higher than the
previously published version.

## Local development

Use `npm run build` to package `manifest.json`, which includes localhost
origins for local development.
