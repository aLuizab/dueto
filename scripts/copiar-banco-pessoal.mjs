// Copia o seu banco atual (%APPDATA%/Dueto/dueto.db) para private/seed/dueto.db, usado só pelo build pessoal.
// Uso: node scripts/copiar-banco-pessoal.mjs [caminho-do-banco]
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const appData = process.env.APPDATA ?? join(process.env.HOME ?? "", ".config");
const origem = process.argv[2] ?? join(appData, "Dueto", "dueto.db");
if (!existsSync(origem)) {
  console.error(`Banco não encontrado em ${origem}. Informe o caminho: node scripts/copiar-banco-pessoal.mjs <arquivo.db>`);
  process.exit(1);
}
mkdirSync("private/seed", { recursive: true });
copyFileSync(origem, "private/seed/dueto.db");
console.log(`Copiado ${origem} → private/seed/dueto.db`);
