/**
 * INSS — retenção sobre pró-labore.
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
