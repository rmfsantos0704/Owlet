import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

if (!existsSync("public/icons/icon128.png")) {
  throw new Error("Missing public/icons. Add icon16.png, icon32.png, icon48.png and icon128.png first.");
}

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/fonts", { recursive: true });

await build({
  entryPoints: { popup: "src/popup/popup.ts", content: "src/content.ts" },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("public/icons", "dist/icons", { recursive: true });
// the dashboard's typeface, bundled so the popup works offline and makes no font requests
cpSync("node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", "dist/fonts/dm-sans.woff2");

console.log("Built to dist/");