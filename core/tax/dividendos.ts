/**
 * Distribuição de lucros: limite de isenção para empresas do Simples sem escrituração contábil
 * (LC 123 art. 14: presunção do Lucro Presumido − IRPJ do Simples) e a tributação de dividendos
 * acima do limite mensal (Lei 15.270/2025, a partir de 2026 — parametrizável por vigência).
 */
import { round2 } from "../money";
import type { DividendosParams } from "./tables";

export interface LimiteIsencaoInput {
  receitaBrutaPeriodo: number; // do período (mês ou ano)
  irpjPagoNoDas: number; // parcela de IRPJ dentro do DAS no período
  presuncao?: number; // 0.32 para serviços
  escrituracaoContabil: boolean;
  lucroContabil?: number | null;
}

export interface LimiteIsencaoResult {
  limiteIsento: number;
  metodo: "escrituracao" | "presuncao";
  memoria: string[];
}

export function limiteIsencaoLucros(i: LimiteIsencaoInput): LimiteIsencaoResult {
  if (i.escrituracaoContabil && i.lucroContabil != null) {
    return { limiteIsento: round2(Math.max(0, i.lucroContabil)), metodo: "escrituracao", memoria: [`Com escrituração contábil, o lucro apurado (${i.lucroContabil.toFixed(2)}) pode ser distribuído isento.`] };
  }
  const presuncao = i.presuncao ?? 0.32;
  const limite = round2(Math.max(0, i.receitaBrutaPeriodo * presuncao - i.irpjPagoNoDas));
  return {
    limiteIsento: limite,
    metodo: "presuncao",
    memoria: [`Sem escrituração: ${i.receitaBrutaPeriodo.toFixed(2)} × ${(presuncao * 100).toFixed(0)}% − IRPJ no DAS ${i.irpjPagoNoDas.toFixed(2)} = ${limite.toFixed(2)}`],
  };
}

export interface RetencaoDividendosResult {
  valor: number;
  isento: number;
  tributavel: number;
  retencao: number;
  alertas: string[];
}

export function retencaoDividendos(valorMes: number, params: DividendosParams): RetencaoDividendosResult {
  if (params.limiteMensalIsento == null || params.aliquotaAcimaLimite <= 0) return { valor: valorMes, isento: valorMes, tributavel: 0, retencao: 0, alertas: [] };
  // Lei 15.270/2025: retenção de 10% sobre o total pago quando exceder R$ 50 mil no mês por beneficiário
  if (valorMes > params.limiteMensalIsento) {
    const ret = round2(valorMes * params.aliquotaAcimaLimite);
    return { valor: valorMes, isento: 0, tributavel: valorMes, retencao: ret, alertas: [`Distribuição de ${valorMes.toFixed(2)} no mês excede ${params.limiteMensalIsento.toFixed(2)}: retenção de ${(params.aliquotaAcimaLimite * 100).toFixed(0)}% na fonte (Lei 15.270/2025). Confirme com seu contador.`] };
  }
  return { valor: valorMes, isento: valorMes, tributavel: 0, retencao: 0, alertas: [] };
}
