// Builds dist/lascaux2-player.min.js (window.Lascaux2Player) from
// ../src/twodraw/player.ts, and dist/gate.js (the replay gate's page script,
// test/gate.html). The engine sources in ../src resolve their packages from
// this directory's node_modules (the app's own toolchain isn't needed).
//
//   npm ci && npm run build
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
let sha = "unknown";
try {
  sha = execSync("git rev-parse --short=8 HEAD", { cwd: here }).toString().trim();
} catch {}

const common = {
  bundle: true,
  platform: "browser",
  conditions: ["production"],
  format: "iife",
  target: "es2017",
  nodePaths: [join(here, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: [join(here, "../src/twodraw/player.ts")],
  outfile: join(here, "dist/lascaux2-player.min.js"),
  minify: true,
  sourcemap: true,
  banner: { js: `/* Lascaux Sketch 2 player for 2draw.net, lascaux-sketch 2draw@${sha} (zlib license) */` },
});

await build({
  ...common,
  entryPoints: [join(here, "test/gate.ts")],
  outfile: join(here, "dist/gate.js"),
  sourcemap: true,
});
