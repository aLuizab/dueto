/**
 * IRRF / IRPF mensal pela tabela progressiva, com dedução de dependentes,
 * desconto simplificado opcional e o redutor de 2026 (Lei 15.270/2025).
 */
import { round2 } from "../money";
import type { IrpfTable } from "./tables";

export interface IrpfInput {
  /** rendimento bruto tributável do mês (ex.: pró-labore bruto, receitas do carnê-leão) */
  rendimentoBruto: number;
  /** deduções legais: INSS, livro-caixa, pensão etc. */
  deducoes: number;
  dependentes?: number;
  /** usar o desconto simplificado quando for mais vantajoso (aplicável ao IRRF sobre trabalho) */
  permitirDescontoSimplificado?: boolean;
  /** aplicar o redutor de 2026 quando a tabela o tiver (default true) */
  aplicarRedutor?: boolean;
}

export interface IrpfResult {
  baseCalculo: number;
  faixaIndex: number;
  aliquota: number;
  deduzir: number;
  impostoTabela: number;
  usouDescontoSimplificado: boolean;
  redutor: number;
  imposto: number;
  aliquotaEfetiva: number;
  memoria: string[];
}

export function impostoPelaTabela(base: number, table: IrpfTable): { imposto: number; faixaIndex: number; aliquota: number; deduzir: number } {
  const b = Math.max(0, base);
  for (let i = 0; i < table.faixas.length; i++) {
    const f = table.faixas[i];
    if (f.ate == null || b <= f.ate + 1e-9) {
      const imposto = Math.max(0, round2(b * f.aliquota - f.deduzir));
      return { imposto, faixaIndex: i, aliquota: f.aliquota, deduzir: f.deduzir };
    }
  }
  const last = table.faixas[table.faixas.length - 1];
  return { imposto: Math.max(0, round2(b * last.aliquota - last.deduzir)), faixaIndex: table.faixas.length - 1, aliquota: last.aliquota, deduzir: last.deduzir };
}

/** Redutor Lei 15.270/2025: isenção até 5.000; parcial até 7.350 (a − b × rendimento), limitado ao imposto. */
export function calcularRedutor(rendimentoBruto: number, impostoTabela: number, table: IrpfTable): number {
  const r = table.redutor;
  if (!r || impostoTabela <= 0) return 0;
  if (rendimentoBruto <= r.isencaoAte + 1e-9) return impostoTabela;
  if (rendimentoBruto <= r.reducaoAte + 1e-9) {
    const red = round2(r.a - r.b * rendimentoBruto);
    return Math.max(0, Math.min(impostoTabela, red));
  }
  return 0;
}

export function calcularIrpfMensal(input: IrpfInput, table: IrpfTable): IrpfResult {
  const memoria: string[] = [];
  const dep = (input.dependentes ?? 0) * table.dependente;
  const deducoesLegais = round2(Math.max(0, input.deducoes) + dep);
  let base = round2(Math.max(0, input.rendimentoBruto - deducoesLegais));
  let usouSimplificado = false;
  memoria.push(`Rendimento bruto: ${input.rendimentoBruto.toFixed(2)}`);
  memoria.push(`Deduções legais (INSS/livro-caixa/dependentes): ${deducoesLegais.toFixed(2)} → base ${base.toFixed(2)}`);

  if (input.permitirDescontoSimplificado && table.descontoSimplificado != null) {
    const baseSimpl = round2(Math.max(0, input.rendimentoBruto - table.descontoSimplificado));
    if (baseSimpl < base) {
      base = baseSimpl;
      usouSimplificado = true;
      memoria.push(`Desconto simplificado (${table.descontoSimplificado.toFixed(2)}) mais vantajoso → base ${base.toFixed(2)}`);
    }
  }

  const t = impostoPelaTabela(base, table);
  memoria.push(`Faixa ${t.faixaIndex + 1}: ${(t.aliquota * 100).toFixed(1)}% − ${t.deduzir.toFixed(2)} = ${t.imposto.toFixed(2)}`);
  const redutor = input.aplicarRedutor === false ? 0 : calcularRedutor(input.rendimentoBruto, t.imposto, table);
  if (redutor > 0) memoria.push(`Redutor Lei 15.270/2025: −${redutor.toFixed(2)}`);
  const imposto = round2(Math.max(0, t.imposto - redutor));
  memoria.push(`Imposto: ${imposto.toFixed(2)}`);
  return {
    baseCalculo: base,
    faixaIndex: t.faixaIndex,
    aliquota: t.aliquota,
    deduzir: t.deduzir,
    impostoTabela: t.imposto,
    usouDescontoSimplificado: usouSimplificado,
    redutor,
    imposto,
    aliquotaEfetiva: input.rendimentoBruto > 0 ? imposto / input.rendimentoBruto : 0,
    memoria,
  };
}
