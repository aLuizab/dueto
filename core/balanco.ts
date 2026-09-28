/**
 * Balanço projetado da empresa: para cada mês, receita − impostos − despesas − pró-labore − reserva = lucro;
 * caixa = caixa anterior + lucro − retirada. Serve para prever retiradas e impostos com folga de caixa.
 */
import type { MonthKey } from "./domain/types";
import { round2 } from "./money";

export interface BalancoMesInput {
  mes: MonthKey;
  /** true = mês já realizado (valores lançados); false = previsão */
  realizado: boolean;
  receita: number;
  impostos: number;
  despesas: number;
  proLaboreBruto: number;
  reserva: number;
  retirada: number;
}

export interface BalancoLinha extends BalancoMesInput {
  lucro: number;
  caixaInicial: number;
  caixaFinal: number;
  /** quanto ainda daria para retirar sem deixar o caixa abaixo do mínimo */
  retiradaMaxima: number;
  alerta: string | null;
}

export interface BalancoResult {
  linhas: BalancoLinha[];
  totais: { receita: number; impostos: number; despesas: number; proLaboreBruto: number; reserva: number; lucro: number; retirada: number };
  caixaFinal: number;
  menorCaixa: number;
}

export function projetarBalanco(caixaInicial: number, meses: BalancoMesInput[], opts?: { caixaMinimo?: number }): BalancoResult {
  const min = opts?.caixaMinimo ?? 0;
  let caixa = round2(caixaInicial);
  let menor = caixa;
  const linhas: BalancoLinha[] = [];
  const tot = { receita: 0, impostos: 0, despesas: 0, proLaboreBruto: 0, reserva: 0, lucro: 0, retirada: 0 };
  for (const m of meses) {
    const lucro = round2(m.receita - m.impostos - m.despesas - m.proLaboreBruto - m.reserva);
    const ini = caixa;
    caixa = round2(caixa + lucro - m.retirada);
    menor = Math.min(menor, caixa);
    const retiradaMaxima = round2(Math.max(0, ini + lucro - min));
    let alerta: string | null = null;
    if (caixa < min) alerta = `Caixa abaixo do mínimo (${min.toFixed(2)}) em ${m.mes}: reduza a retirada ou os gastos.`;
    else if (m.retirada > retiradaMaxima) alerta = `Retirada acima do disponível em ${m.mes}.`;
    linhas.push({ ...m, lucro, caixaInicial: ini, caixaFinal: caixa, retiradaMaxima, alerta });
    tot.receita += m.receita; tot.impostos += m.impostos; tot.despesas += m.despesas; tot.proLaboreBruto += m.proLaboreBruto; tot.reserva += m.reserva; tot.lucro += lucro; tot.retirada += m.retirada;
  }
  for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] = round2(tot[k]);
  return { linhas, totais: tot, caixaFinal: caixa, menorCaixa: round2(menor) };
}

/** Média dos últimos N valores positivos (para prever receita). */
export function mediaUltimos(valores: number[], n: number): number {
  const v = valores.filter((x) => x > 0).slice(-n);
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}
