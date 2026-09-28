// Compila o processo principal e o preload do Electron com esbuild.
// Saída: dist-electron/main.cjs e dist-electron/preload.cjs
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist-electron", { recursive: true });

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  external: ["electron"],
  logLevel: "info",
};

await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" });
