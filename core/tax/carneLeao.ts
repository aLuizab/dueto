/**
 * Carnê-leão mensal do autônomo PF com livro-caixa.
 * Base = receitas de pessoas físicas − despesas escrituradas no livro-caixa (limitadas às receitas do mês;
 * o excedente é transportado para os meses seguintes do mesmo ano) − INSS pago − dependentes.
 * IR pela tabela progressiva mensal. DARF código 0190 até o último dia útil do mês seguinte.
 */
import { addMonths, lastBusinessDayOfMonth, splitMonthKey } from "../dates";
import type { MonthKey } from "../domain/types";
import { round2 } from "../money";
import { calcularIrpfMensal } from "./irpf";
import type { IrpfTable } from "./tables";

export interface CarneLeaoMesInput {
  competencia: MonthKey;
  receitasPF: number; // recebido de pessoas físicas (tributável no carnê-leão)
  receitasPJ?: number; // recebido de PJ (retido na fonte; informativo)
  despesasLivroCaixa: number;
  inssPago: number;
  dependentes?: number;
}

export interface CarneLeaoMesResult {
  competencia: MonthKey;
  receitasPF: number;
  despesasLivroCaixa: number;
  despesasUtilizadas: number;
  excedenteTransportado: number;
  inssPago: number;
  baseCalculo: number;
  imposto: number;
  redutor: number;
  darfCodigo: "0190";
  darfVencimento: string;
  memoria: string[];
}

/**
 * Calcula uma sequência de meses (do mesmo ano) transportando o excedente do livro-caixa.
 * `tabelaPara(mes)` permite trocar de vigência dentro do ano.
 */
export function calcularCarneLeao(meses: CarneLeaoMesInput[], tabelaPara: (mes: MonthKey) => IrpfTable, opts?: { aplicarRedutor?: boolean }): CarneLeaoMesResult[] {
  const ordenados = [...meses].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const out: CarneLeaoMesResult[] = [];
  let excedente = 0;
  let anoAtual: number | null = null;
  for (const m of ordenados) {
    const { year } = splitMonthKey(m.competencia);
    if (anoAtual !== null && year !== anoAtual) excedente = 0; // excedente não passa de ano
    anoAtual = year;
    const disponiveis = round2(m.despesasLivroCaixa + excedente);
    const utilizadas = round2(Math.min(disponiveis, Math.max(0, m.receitasPF)));
    excedente = round2(disponiveis - utilizadas);
    const table = tabelaPara(m.competencia);
    const ir = calcularIrpfMensal(
      { rendimentoBruto: m.receitasPF, deducoes: utilizadas + m.inssPago, dependentes: m.dependentes ?? 0, permitirDescontoSimplificado: false, aplicarRedutor: opts?.aplicarRedutor ?? true },
      table,
    );
    const venc = lastBusinessDayOfMonth(addMonths(m.competencia, 1));
    out.push({
      competencia: m.competencia,
      receitasPF: round2(m.receitasPF),
      despesasLivroCaixa: round2(m.despesasLivroCaixa),
      despesasUtilizadas: utilizadas,
      excedenteTransportado: excedente,
      inssPago: round2(m.inssPago),
      baseCalculo: ir.baseCalculo,
      imposto: ir.imposto,
      redutor: ir.redutor,
      darfCodigo: "0190",
      darfVencimento: venc,
      memoria: [
        `Receitas PF: ${m.receitasPF.toFixed(2)}`,
        `Livro-caixa: ${m.despesasLivroCaixa.toFixed(2)} + excedente anterior → utilizadas ${utilizadas.toFixed(2)} (transporta ${excedente.toFixed(2)})`,
        `INSS pago: ${m.inssPago.toFixed(2)}`,
        ...ir.memoria,
        `DARF 0190 até ${venc}`,
      ],
    });
  }
  return out;
}

export interface ResumoAnualCarneLeao {
  ano: number;
  receitasPF: number;
  despesasLivroCaixa: number;
  inssPago: number;
  impostoPago: number;
}

export function resumoAnualCarneLeao(resultados: CarneLeaoMesResult[], ano: number): ResumoAnualCarneLeao {
  const doAno = resultados.filter((r) => r.competencia.startsWith(`${ano}-`));
  return {
    ano,
    receitasPF: round2(doAno.reduce((a, r) => a + r.receitasPF, 0)),
    despesasLivroCaixa: round2(doAno.reduce((a, r) => a + r.despesasUtilizadas, 0)),
    inssPago: round2(doAno.reduce((a, r) => a + r.inssPago, 0)),
    impostoPago: round2(doAno.reduce((a, r) => a + r.imposto, 0)),
  };
}
