// npm test: bundles test/unit.test.ts for node and runs it.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, "../dist/unit.test.cjs");
await build({
  entryPoints: [join(here, "unit.test.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  nodePaths: [join(here, "../node_modules")],
  logLevel: "warning",
});
const r = spawnSync(process.execPath, ["--test", outfile], { stdio: "inherit" });
process.exit(r.status ?? 1);
