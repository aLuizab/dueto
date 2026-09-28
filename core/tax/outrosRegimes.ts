/**
 * Regimes alternativos, implementados de forma simplificada (ESTIMATIVA):
 *  - MEI: DAS fixo mensal (5% do salário mínimo + ISS R$ 5 para serviços [+ ICMS R$ 1 comércio]).
 *  - Lucro Presumido (serviços): presunção 32%, IRPJ 15% + adicional 10%, CSLL 9%, PIS 0,65%, COFINS 3%, ISS municipal.
 *    Na exportação de serviços: PIS/COFINS isentos; ISS não incide.
 */
import { round2 } from "../money";
import type { InssTable, MeiParams, PresumidoParams } from "./tables";

export interface MeiResult {
  dasMensal: number;
  inss: number;
  iss: number;
  icms: number;
  limiteAnual: number;
  receitaAnualEstimada: number;
  excedeuLimite: boolean;
  alertas: string[];
}

export function calcularMei(opts: { receita12m: number; comercio?: boolean; servicos?: boolean }, mei: MeiParams, inss: InssTable): MeiResult {
  const inssV = round2(inss.salarioMinimo * mei.percentualInssSobreMinimo);
  const iss = opts.servicos === false ? 0 : mei.issFixo;
  const icms = opts.comercio ? mei.icmsFixo : 0;
  const das = round2(inssV + iss + icms);
  const alertas: string[] = ["Estimativa: MEI não permite profissões regulamentadas (nutrição, psicologia, engenharia etc.) nem sócios."];
  const excedeu = opts.receita12m > mei.limiteAnual;
  if (excedeu) alertas.push(`Receita acumulada (${opts.receita12m.toFixed(2)}) excede o limite anual do MEI (${mei.limiteAnual.toFixed(2)}).`);
  else if (opts.receita12m > mei.limiteAnual * 0.8) alertas.push("Receita acima de 80% do limite anual do MEI.");
  return { dasMensal: das, inss: inssV, iss, icms, limiteAnual: mei.limiteAnual, receitaAnualEstimada: round2(opts.receita12m), excedeuLimite: excedeu, alertas };
}

export interface PresumidoResult {
  receita: number;
  receitaExportacao: number;
  basePresumida: number;
  irpj: number;
  irpjAdicional: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  total: number;
  cargaEfetiva: number;
  memoria: string[];
  alertas: string[];
}

/** Estimativa mensal (IRPJ/CSLL são trimestrais — aqui distribuídos mensalmente com adicional sobre 20 mil/mês). */
export function calcularPresumidoMensal(opts: { receita: number; receitaExportacao: number; issAliquota: number }, p: PresumidoParams): PresumidoResult {
  const receita = round2(opts.receita);
  const exp = round2(Math.min(opts.receitaExportacao, receita));
  const nac = round2(receita - exp);
  const base = round2(receita * p.presuncaoServicos);
  const irpj = round2(base * p.irpj);
  const irpjAd = round2(Math.max(0, base - p.irpjAdicionalLimiteMensal) * p.irpjAdicional);
  const csll = round2(base * p.csll);
  const pis = round2(nac * p.pis);
  const cofins = round2(nac * p.cofins);
  const iss = round2(nac * opts.issAliquota);
  const total = round2(irpj + irpjAd + csll + pis + cofins + iss);
  return {
    receita, receitaExportacao: exp, basePresumida: base, irpj, irpjAdicional: irpjAd, csll, pis, cofins, iss, total,
    cargaEfetiva: receita > 0 ? total / receita : 0,
    memoria: [
      `Base presumida = ${receita.toFixed(2)} × 32% = ${base.toFixed(2)}`,
      `IRPJ 15% = ${irpj.toFixed(2)}; adicional 10% sobre o que excede 20.000/mês = ${irpjAd.toFixed(2)}`,
      `CSLL 9% = ${csll.toFixed(2)}`,
      `PIS 0,65% e COFINS 3% só sobre receita nacional (${nac.toFixed(2)}): ${pis.toFixed(2)} + ${cofins.toFixed(2)}`,
      `ISS ${(opts.issAliquota * 100).toFixed(2)}% sobre receita nacional = ${iss.toFixed(2)} (exportação: não incide)`,
    ],
    alertas: ["Estimativa simplificada do Lucro Presumido: IRPJ/CSLL são apurados por trimestre; confirme com seu contador."],
  };
}
