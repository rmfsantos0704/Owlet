import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
await build({
  entryPoints: { popup: "src/popup/popup.ts", content: "src/content.ts" },
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
});
cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
console.log("Built to dist/");