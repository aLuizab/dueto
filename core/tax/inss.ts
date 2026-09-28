/**
 * INSS — contribuinte individual (autônomo PF) e retenção sobre pró-labore.
 */
import { round2 } from "../money";
import type { InssTable } from "./tables";

export interface InssProLaboreResult {
  baseContribuicao: number; // limitada ao teto
  aliquota: number;
  inss: number;
  atingiuTeto: boolean;
  memoria: string[];
}

/** INSS retido do sócio: 11% sobre o pró-labore, base limitada ao teto. */
export function inssProLabore(bruto: number, table: InssTable): InssProLaboreResult {
  const base = Math.min(Math.max(0, bruto), table.teto);
  const inss = round2(base * table.aliquotaProLabore);
  return {
    baseContribuicao: round2(base),
    aliquota: table.aliquotaProLabore,
    inss,
    atingiuTeto: bruto > table.teto,
    memoria: [
      `Base = min(pró-labore ${bruto.toFixed(2)}, teto ${table.teto.toFixed(2)}) = ${base.toFixed(2)}`,
      `INSS = ${base.toFixed(2)} × ${(table.aliquotaProLabore * 100).toFixed(0)}% = ${inss.toFixed(2)}`,
    ],
  };
}

export type PlanoInss = "normal20" | "simplificado11";

export interface InssIndividualResult {
  plano: PlanoInss;
  baseContribuicao: number;
  aliquota: number;
  contribuicao: number;
  codigoGps: string;
  memoria: string[];
  avisos: string[];
}

/**
 * Contribuinte individual (autônomo sem vínculo):
 *  - plano normal: 20% sobre salário de contribuição escolhido entre o mínimo e o teto (GPS 1007);
 *  - plano simplificado: 11% somente sobre o salário mínimo (GPS 1163) — não conta para aposentadoria por tempo de contribuição.
 */
export function inssContribuinteIndividual(opts: { plano: PlanoInss; baseDesejada?: number | null }, table: InssTable): InssIndividualResult {
  const avisos: string[] = [];
  if (opts.plano === "simplificado11") {
    const c = round2(table.salarioMinimo * table.aliquotaPlanoSimplificado);
    return {
      plano: opts.plano,
      baseContribuicao: table.salarioMinimo,
      aliquota: table.aliquotaPlanoSimplificado,
      contribuicao: c,
      codigoGps: "1163",
      memoria: [`Plano simplificado: ${table.salarioMinimo.toFixed(2)} × 11% = ${c.toFixed(2)}`],
      avisos: ["Plano simplificado (11% do mínimo) não dá direito à aposentadoria por tempo de contribuição, só por idade."],
    };
  }
  let base = opts.baseDesejada ?? table.salarioMinimo;
  if (base < table.salarioMinimo) { base = table.salarioMinimo; avisos.push("Base ajustada para o salário mínimo."); }
  if (base > table.teto) { base = table.teto; avisos.push("Base limitada ao teto do INSS."); }
  base = round2(base);
  const c = round2(base * table.aliquotaContribuinteIndividual);
  return {
    plano: opts.plano,
    baseContribuicao: base,
    aliquota: table.aliquotaContribuinteIndividual,
    contribuicao: c,
    codigoGps: "1007",
    memoria: [`Plano normal: ${base.toFixed(2)} × 20% = ${c.toFixed(2)}`],
    avisos,
  };
}

/** Sugestão de plano com base na renda mensal do autônomo. */
export function sugerirPlanoInss(rendaMensal: number, table: InssTable): { plano: PlanoInss; base: number; justificativa: string } {
  if (rendaMensal <= table.salarioMinimo * 1.5) {
    return { plano: "simplificado11", base: table.salarioMinimo, justificativa: "Renda próxima do mínimo: o plano simplificado (11% do mínimo) custa menos." };
  }
  const base = Math.min(rendaMensal, table.teto);
  return { plano: "normal20", base: round2(base), justificativa: "Renda acima de 1,5 salário mínimo: o plano normal (20%) preserva benefícios proporcionais à renda; a base pode ser qualquer valor entre o mínimo e o teto." };
}
