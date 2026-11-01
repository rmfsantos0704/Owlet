# Owlet project rules

Owlet is a research clipper: Chrome extension (Manifest V3, TypeScript, esbuild) in `extension/`, React + Vite + Tailwind dashboard in `client/`, Express + TypeScript + MongoDB API in `server/`.

## Always
- TypeScript strict. No new npm dependencies without asking.
- Keep changes small and in the style of the surrounding code. Don't reformat unrelated code.
- After changes, run the type check/build of every package you touched and fix errors.
- Never put secrets in code. Never log tokens, passwords, or request bodies.

## Security
- Treat page content and selected text as untrusted. Never use innerHTML/outerHTML/insertAdjacentHTML/eval/new Function with it; use textContent and DOM APIs.
- The extension must not request broad host permissions: no `<all_urls>`, no always-on content scripts on arbitrary sites. Use `activeTab` + `chrome.scripting` triggered by a user action.
- Server routes: behind `requireAuth`, input validated with zod, collection role checked with the `collectionIds(userId, "editor")` helpers. Register fixed paths before `/:id` routes.
- The login token only goes to the API origin defined in `extension/src/api.ts`.

## Facts
- AI is optional (`AI_ENABLED`). Don't depend on it.
- Highlight colors are exactly: yellow, orange, red, pink, purple, blue, teal, green.
- Highlights are created with POST /api/research/:id/highlights { text (1-2000 chars), color, note? }.
