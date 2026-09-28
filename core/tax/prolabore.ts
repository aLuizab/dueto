/**
 * Pró-labore do sócio: INSS 11% (teto), IRRF pela tabela vigente, líquido e DARF (INSS + IRRF).
 */
import { addMonths, dateInMonth, nextBusinessDayOnOrAfter } from "../dates";
import type { MonthKey } from "../domain/types";
import { round2 } from "../money";
import { inssProLabore } from "./inss";
import { calcularIrpfMensal } from "./irpf";
import type { InssTable, IrpfTable } from "./tables";

export interface ProLaboreResult {
  competencia: MonthKey;
  bruto: number;
  inss: number;
  inssBase: number;
  irrf: number;
  irrfBase: number;
  liquido: number;
  darf: number;
  darfVencimento: string;
  memoria: string[];
  avisos: string[];
}

export function calcularProLabore(opts: {
  competencia: MonthKey;
  bruto: number;
  dependentes?: number;
  inss: InssTable;
  irpf: IrpfTable;
  /** dia de vencimento do DARF (default 20 do mês seguinte) */
  diaVencimentoDarf?: number;
  permitirDescontoSimplificado?: boolean;
}): ProLaboreResult {
  const bruto = round2(Math.max(0, opts.bruto));
  const avisos: string[] = [];
  const i = inssProLabore(bruto, opts.inss);
  const ir = calcularIrpfMensal(
    { rendimentoBruto: bruto, deducoes: i.inss, dependentes: opts.dependentes ?? 0, permitirDescontoSimplificado: opts.permitirDescontoSimplificado ?? true },
    opts.irpf,
  );
  const liquido = round2(bruto - i.inss - ir.imposto);
  const darf = round2(i.inss + ir.imposto);
  if (bruto > 0 && bruto < opts.inss.salarioMinimo) avisos.push(`Pró-labore abaixo do salário mínimo (${opts.inss.salarioMinimo.toFixed(2)}): a Receita/INSS exigem ao menos um salário mínimo.`);
  if (i.atingiuTeto) avisos.push("INSS limitado ao teto.");
  const venc = nextBusinessDayOnOrAfter(dateInMonth(addMonths(opts.competencia, 1), opts.diaVencimentoDarf ?? 20));
  return {
    competencia: opts.competencia,
    bruto,
    inss: i.inss,
    inssBase: i.baseContribuicao,
    irrf: ir.imposto,
    irrfBase: ir.baseCalculo,
    liquido,
    darf,
    darfVencimento: venc,
    memoria: [...i.memoria, ...ir.memoria, `Líquido = ${bruto.toFixed(2)} − ${i.inss.toFixed(2)} − ${ir.imposto.toFixed(2)} = ${liquido.toFixed(2)}`, `DARF (INSS 11% cód. 1200 + IRRF cód. 0561) = ${darf.toFixed(2)} até ${venc}`],
    avisos,
  };
}

/** Define o bruto conforme a política da empresa. */
export function definirProLaboreBruto(opts: {
  modo: "fixo" | "percentual" | "minimoFatorR";
  valor?: number | null;
  percentual?: number | null;
  receitaMes: number;
  minimoFatorR?: number | null;
  salarioMinimo: number;
}): number {
  let bruto = 0;
  switch (opts.modo) {
    case "fixo": bruto = opts.valor ?? 0; break;
    case "percentual": bruto = (opts.percentual ?? 0) * opts.receitaMes; break;
    case "minimoFatorR": bruto = opts.minimoFatorR ?? 0; break;
  }
  if (bruto > 0 && bruto < opts.salarioMinimo) bruto = opts.salarioMinimo;
  return round2(bruto);
}
