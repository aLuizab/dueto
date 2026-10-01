// Imprime a seção do CHANGELOG.md de uma versão (ex.: `node scripts/notas-da-versao.mjs v0.2.1`), para as notas da Release.
import { readFileSync } from "node:fs";

const versao = (process.argv[2] ?? "").replace(/^v/, "");
if (!versao) {
  console.error("uso: node scripts/notas-da-versao.mjs vX.Y.Z");
  process.exit(1);
}
const linhas = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").split(/\r?\n/);
const ini = linhas.findIndex((l) => l.startsWith(`## [${versao}]`));
if (ini < 0) {
  console.error(`versão ${versao} não encontrada no CHANGELOG.md`);
  process.exit(1);
}
const fim = linhas.findIndex((l, i) => i > ini && l.startsWith("## ["));
const corpo = linhas.slice(ini + 1, fim < 0 ? undefined : fim).join("\n").trim();
console.log(`${corpo}

---
> Valores de impostos são estimativas; confirme com seu contador.`);
