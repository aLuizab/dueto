/**
 * Calendário de obrigações (PJ, autônomo PF) gerado por mês.
 */
import { addMonths, dateInMonth, lastBusinessDayOfMonth, nextBusinessDayOnOrAfter, splitMonthKey } from "../dates";
import type { MonthKey, RegimeTributario } from "../domain/types";

export interface Obrigacao {
  id: string;
  entityId: string;
  competencia: MonthKey;
  titulo: string;
  descricao: string;
  vencimento: string;
  tipo: "pagamento" | "declaracao" | "informativo";
  valorPrevisto?: number | null;
  concluida: boolean;
}

export function gerarObrigacoesPJ(opts: {
  entityId: string;
  competencia: MonthKey;
  regime: RegimeTributario;
  dasPrevisto?: number | null;
  darfPrevisto?: number | null;
  tfeAnual?: number | null;
  mesTfe?: number | null; // mês de vencimento da TFE (SP: geralmente julho)
  honorariosContabilidade?: number | null;
  parcelamentos?: { nome: string; parcela: number; total: number; valor: number; dia: number }[];
}): Obrigacao[] {
  const next = addMonths(opts.competencia, 1);
  const { month } = splitMonthKey(opts.competencia);
  const out: Obrigacao[] = [];
  const push = (o: Omit<Obrigacao, "entityId" | "competencia" | "concluida">) => out.push({ ...o, entityId: opts.entityId, competencia: opts.competencia, concluida: false });

  if (opts.regime === "SIMPLES_III" || opts.regime === "SIMPLES_V") {
    push({ id: `pgdas-${opts.competencia}`, titulo: "PGDAS-D", descricao: "Declarar a receita do mês no PGDAS-D antes de emitir o DAS.", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 20)), tipo: "declaracao" });
    push({ id: `das-${opts.competencia}`, titulo: "DAS", descricao: "Documento de Arrecadação do Simples Nacional.", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 20)), tipo: "pagamento", valorPrevisto: opts.dasPrevisto ?? null });
    if (month === 3) push({ id: `defis-${opts.competencia}`, titulo: "DEFIS", descricao: "Declaração anual do Simples Nacional (ano anterior).", vencimento: `${splitMonthKey(opts.competencia).year}-03-31`, tipo: "declaracao" });
  }
  if (opts.regime === "MEI") {
    push({ id: `dasmei-${opts.competencia}`, titulo: "DAS-MEI", descricao: "DAS mensal fixo do MEI.", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 20)), tipo: "pagamento", valorPrevisto: opts.dasPrevisto ?? null });
    if (month === 5) push({ id: `dasn-${opts.competencia}`, titulo: "DASN-SIMEI", descricao: "Declaração anual do MEI.", vencimento: `${splitMonthKey(opts.competencia).year}-05-31`, tipo: "declaracao" });
  }
  if (opts.regime === "PRESUMIDO") {
    push({ id: `darf-fed-${opts.competencia}`, titulo: "DARF PIS/COFINS", descricao: "PIS e COFINS do mês (estimativa).", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 25)), tipo: "pagamento" });
    if ([3, 6, 9, 12].includes(month)) push({ id: `irpj-csll-${opts.competencia}`, titulo: "IRPJ/CSLL trimestral", descricao: "Apuração trimestral do Lucro Presumido.", vencimento: lastBusinessDayOfMonth(next), tipo: "pagamento" });
  }
  push({ id: `darf-pl-${opts.competencia}`, titulo: "DARF pró-labore (INSS + IRRF)", descricao: "INSS 11% (cód. 1200 via DCTFWeb/eSocial) e IRRF (cód. 0561) sobre o pró-labore.", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 20)), tipo: "pagamento", valorPrevisto: opts.darfPrevisto ?? null });
  push({ id: `esocial-${opts.competencia}`, titulo: "eSocial / DCTFWeb", descricao: "Fechamento da folha (pró-labore) no eSocial e transmissão da DCTFWeb — normalmente feito pela contabilidade.", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 15)), tipo: "informativo" });
  if (opts.honorariosContabilidade) push({ id: `contab-${opts.competencia}`, titulo: "Honorários de contabilidade", descricao: "Mensalidade do contador.", vencimento: dateInMonth(next, 5), tipo: "pagamento", valorPrevisto: opts.honorariosContabilidade });
  if (opts.tfeAnual && (opts.mesTfe ?? 7) === month) push({ id: `tfe-${opts.competencia}`, titulo: "TFE (DAMSP)", descricao: "Taxa de Fiscalização de Estabelecimentos — anual, municipal.", vencimento: dateInMonth(opts.competencia, 10), tipo: "pagamento", valorPrevisto: opts.tfeAnual });
  for (const p of opts.parcelamentos ?? []) {
    if (p.parcela <= p.total) push({ id: `parc-${p.nome}-${opts.competencia}`, titulo: `${p.nome} (${p.parcela}/${p.total})`, descricao: "Parcelamento em andamento.", vencimento: dateInMonth(opts.competencia, p.dia), tipo: "pagamento", valorPrevisto: p.valor });
  }
  return out;
}

export function gerarObrigacoesAutonomo(opts: { entityId: string; competencia: MonthKey; carneLeaoPrevisto?: number | null; inssPrevisto?: number | null; conselhoAnual?: { valor: number; mes: number } | null }): Obrigacao[] {
  const next = addMonths(opts.competencia, 1);
  const { month, year } = splitMonthKey(opts.competencia);
  const out: Obrigacao[] = [];
  out.push({ id: `cl-${opts.competencia}`, entityId: opts.entityId, competencia: opts.competencia, titulo: "DARF carnê-leão (0190)", descricao: "IR mensal sobre receitas de pessoas físicas.", vencimento: lastBusinessDayOfMonth(next), tipo: "pagamento", valorPrevisto: opts.carneLeaoPrevisto ?? null, concluida: false });
  out.push({ id: `gps-${opts.competencia}`, entityId: opts.entityId, competencia: opts.competencia, titulo: "GPS contribuinte individual", descricao: "INSS do autônomo (cód. 1007 ou 1163).", vencimento: nextBusinessDayOnOrAfter(dateInMonth(next, 15)), tipo: "pagamento", valorPrevisto: opts.inssPrevisto ?? null, concluida: false });
  if (month === 4) out.push({ id: `dirpf-${year}`, entityId: opts.entityId, competencia: opts.competencia, titulo: "Declaração IRPF", descricao: "Entrega da DIRPF (ano anterior).", vencimento: `${year}-05-31`, tipo: "declaracao", concluida: false });
  if (opts.conselhoAnual && opts.conselhoAnual.mes === month) out.push({ id: `conselho-${year}`, entityId: opts.entityId, competencia: opts.competencia, titulo: "Anuidade do conselho profissional", descricao: "CRN/CRP/CREA etc.", vencimento: dateInMonth(opts.competencia, 31), tipo: "pagamento", valorPrevisto: opts.conselhoAnual.valor, concluida: false });
  return out;
}
