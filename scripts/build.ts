// Builds one dist/ folder that loads unchanged in Chrome and Firefox.
import { cp, rm } from "node:fs/promises";
import pkg from "../package.json";
import manifest from "../static/manifest.json";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}dist`;

await rm(dist, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [`${root}src/content.ts`, `${root}src/popup.ts`],
  outdir: dist,
  target: "browser",
  format: "iife",
  minify: false,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp(`${root}static`, dist, { recursive: true });
await Bun.write(`${dist}/manifest.json`, `${JSON.stringify({ ...manifest, version: pkg.version }, null, 2)}\n`);

console.log(`Built ${pkg.name} ${pkg.version} into dist/`);
