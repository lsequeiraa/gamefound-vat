// Builds dist/chrome and dist/firefox from the same sources. They differ only
// in the manifest: Chrome gets no `browser_specific_settings`, which it flags
// as an unrecognised key.
import { cp, mkdir, rm } from "node:fs/promises";
import pkg from "../package.json";
import manifest from "../static/manifest.json";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}dist`;

await rm(dist, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [`${root}src/content.ts`, `${root}src/popup.ts`],
  outdir: `${dist}/firefox`,
  target: "browser",
  format: "iife",
  minify: false,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp(`${root}static`, `${dist}/firefox`, { recursive: true });
await mkdir(`${dist}/chrome`);
await cp(`${dist}/firefox`, `${dist}/chrome`, { recursive: true });

const firefox = { ...manifest, version: pkg.version };
const { browser_specific_settings: _, ...chrome } = firefox;
await Bun.write(`${dist}/firefox/manifest.json`, `${JSON.stringify(firefox, null, 2)}\n`);
await Bun.write(`${dist}/chrome/manifest.json`, `${JSON.stringify(chrome, null, 2)}\n`);

console.log(`Built ${pkg.name} ${pkg.version} into dist/chrome and dist/firefox`);
