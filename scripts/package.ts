// Zips dist/chrome and dist/firefox, plus the source code Mozilla's reviewers
// rebuild from, into artifacts/. Run `bun run build` first.
import { mkdir, rm } from "node:fs/promises";
import pkg from "../package.json";

const root = new URL("..", import.meta.url).pathname;
const artifacts = `${root}artifacts`;
const base = `${pkg.name}-${pkg.version}`;

const run = (cmd: string[]) => {
  const proc = Bun.spawnSync(cmd, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`${cmd.join(" ")} exited with ${proc.exitCode}`);
};

await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts);
for (const browser of ["chrome", "firefox"]) {
  run(["bunx", "web-ext", "build", "--source-dir", `dist/${browser}`, "--artifacts-dir", "artifacts", "--filename", `${base}-${browser}.zip`]);
}
run(["git", "archive", "--format=zip", "--prefix", `${base}-source/`, "--output", `artifacts/${base}-source.zip`, "HEAD"]);

console.log(`Packaged ${base} into artifacts/`);
