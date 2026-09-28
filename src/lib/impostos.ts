/**
 * Impostos do mês da empresa: linhas com flag (ativo), estimativa do Dueto e valor informado pelo usuário.
 * O valor informado é um lançamento (despesa) com meta.imposto = tipo e meta.impostoDe = mês de referência.
 * O Dueto nunca sobrescreve um valor informado; a estimativa é só sugestão.
 */
import type { Entity, ISODate, MonthKey, Transaction } from "@core/domain/types";
import { addMonths, dateInMonth, nextBusinessDayOnOrAfter } from "@core/dates";
import { round2 } from "@core/money";
import { impostoDoMes, proLaboreDoMes, seriesPJ } from "@/lib/fiscal";
import { novoTx, type AppState } from "@/state/store";

export interface ImpostoCustom {
  id: string;
  nome: string;
  dia: number;
  /** mensal (aparece todo mês) ou só na competência informada */
  recorrente: boolean;
  competencia?: MonthKey;
  valorPadrao?: number;
}

export interface ImpostosConfig {
  ativos?: Record<string, boolean>;
  outros?: ImpostoCustom[];
}

export interface LinhaImposto {
  tipo: string; // das | darf | iss | tribfed | outro:<id>
  nome: string;
  descricao: string;
  categoryId: string;
  estimativa: number | null;
  vencimentoPadrao: ISODate;
  ativo: boolean;
  custom: ImpostoCustom | null;
  tx: Transaction | undefined;
  /** composição estimada por código (para pré-preencher a guia) */
  composicao: { codigo: string; nome: string; valor: number }[];
}

export interface GuiaInfo {
  numeroDocumento?: string;
  pagamento?: ISODate | null;
  composicao?: Record<string, number>; // código → valor informado
}

const PADRAO_ATIVO: Record<string, boolean> = { das: true, darf: true, iss: false, tribfed: true };

export function configImpostos(pj: Entity): ImpostosConfig {
  return ((pj.config as { impostos?: ImpostosConfig }).impostos ?? {}) as ImpostosConfig;
}

export function impostoInformado(s: Pick<AppState, "transactions">, pj: Entity, mk: MonthKey, tipo: string): Transaction | undefined {
  return s.transactions.find((t) => t.entityId === pj.id && t.meta?.imposto === tipo && t.meta?.impostoDe === mk);
}

export function linhasImposto(s: AppState, pj: Entity, mk: MonthKey): LinhaImposto[] {
  const cfg = configImpostos(pj);
  const ativo = (tipo: string) => cfg.ativos?.[tipo] ?? PADRAO_ATIVO[tipo] ?? true;
  const regime = pj.regime ?? "SIMPLES_III";
  const imp = impostoDoMes(s, pj, mk);
  const pl = proLaboreDoMes(s, pj, mk);
  const prox = addMonths(mk, 1);
  const venc20 = nextBusinessDayOnOrAfter(dateInMonth(prox, 20));
  const { receitas } = seriesPJ(s, pj);
  const rec = receitas.get(mk) ?? { total: 0, exportacao: 0 };
  const out: LinhaImposto[] = [];
  const push = (tipo: string, nome: string, descricao: string, categoryId: string, estimativa: number | null, venc: ISODate, custom: ImpostoCustom | null = null, composicao: LinhaImposto["composicao"] = []) =>
    out.push({ tipo, nome, descricao, categoryId, estimativa: estimativa == null ? null : round2(estimativa), vencimentoPadrao: venc, ativo: custom ? true : ativo(tipo), custom, tx: impostoInformado(s, pj, mk, tipo), composicao });
  const NOMES: Record<string, string> = { irpj: "IRPJ", csll: "CSLL", cofins: "COFINS", pis: "PIS/Pasep", cpp: "INSS (CPP)", iss: "ISS" };
  const compDas = imp.das ? imp.das.tributos.filter((t) => t.valor > 0).map((t) => ({ codigo: t.codigo, nome: NOMES[t.tributo], valor: t.valor })) : [];
  const compDarf = [{ codigo: "1200", nome: "INSS 11% (contribuinte individual)", valor: pl.inss }, { codigo: "0561", nome: "IRRF", valor: pl.irrf }];

  if (regime === "SIMPLES_III" || regime === "SIMPLES_V") {
    push("das", "DAS (Simples Nacional)", `Anexo ${imp.das?.anexo ?? "—"}, faixa ${imp.das?.faixa ?? "—"}, alíquota efetiva ${imp.das ? (imp.das.aliquotaEfetiva * 100).toFixed(2) : "—"}%`, "pj-das", imp.valorTributo, imp.das?.vencimento ?? venc20, null, compDas);
  } else if (regime === "MEI") {
    push("das", "DAS-MEI", "Valor fixo mensal", "pj-das", imp.valorTributo, venc20);
  } else {
    push("tribfed", "IRPJ, CSLL, PIS e COFINS (Lucro Presumido)", "Estimativa mensal; IRPJ/CSLL são apurados por trimestre", "pj-tributos-federais", imp.valorTributo, nextBusinessDayOnOrAfter(dateInMonth(prox, 25)));
  }
  push("darf", "DARF pró-labore (INSS + IRRF)", `Sobre o pró-labore bruto de ${pl.bruto.toFixed(2)}`, "pj-darf-prolabore", pl.darf, pl.darfVencimento, null, compDarf);
  const issAliq = pj.config.issAliquota ?? 0.05;
  const baseIss = round2(rec.total - (pj.config.fatura?.exportacao ? rec.exportacao : 0));
  push("iss", "ISS municipal (fora do Simples)", regime.startsWith("SIMPLES") ? "No Simples o ISS já está no DAS; ative só se recolhe à parte (sublimite ou exigência do município)" : `${(issAliq * 100).toFixed(2)}% sobre a receita nacional`, "pj-iss", round2(baseIss * issAliq), nextBusinessDayOnOrAfter(dateInMonth(prox, 10)));
  for (const c of cfg.outros ?? []) {
    if (!c.recorrente && c.competencia !== mk) continue;
    push(`outro:${c.id}`, c.nome, c.recorrente ? "Todo mês" : "Só neste mês", "pj-outros-impostos", c.valorPadrao ?? null, dateInMonth(prox, c.dia || 20), c);
  }
  return out;
}

/** Soma dos impostos do mês: informados quando existem, senão a estimativa das linhas ativas. */
export function totalImpostosMes(s: AppState, pj: Entity, mk: MonthKey): { informado: number; estimado: number; total: number; linhas: LinhaImposto[] } {
  const linhas = linhasImposto(s, pj, mk).filter((l) => l.ativo);
  const informado = round2(linhas.reduce((a, l) => a + (l.tx?.valorBrl ?? 0), 0));
  const estimado = round2(linhas.reduce((a, l) => a + (l.estimativa ?? 0), 0));
  const total = round2(linhas.reduce((a, l) => a + (l.tx?.valorBrl ?? l.estimativa ?? 0), 0));
  return { informado, estimado, total, linhas };
}

/** Grava (ou remove, se valor vazio) o valor informado de um imposto. */
export function salvarImposto(s: AppState, pj: Entity, mk: MonthKey, linha: LinhaImposto, valor: number | null, vencimento?: ISODate, pago?: boolean, guia?: GuiaInfo) {
  const existente = linha.tx;
  if (valor == null || valor <= 0) {
    if (existente) s.deleteTransaction(existente.id);
    return;
  }
  const venc = vencimento ?? existente?.vencimento ?? linha.vencimentoPadrao;
  const status = (pago ?? existente?.status === "pago") ? "pago" : "pendente";
  const pagamento = status === "pago" ? guia?.pagamento ?? existente?.pagamento ?? venc : null;
  const metaGuia = guia ? { numeroDocumento: guia.numeroDocumento ?? existente?.meta?.numeroDocumento, composicao: guia.composicao ?? existente?.meta?.composicao } : {};
  const tx: Transaction = existente
    ? { ...existente, valor, valorBrl: valor, vencimento: venc, status, pagamento, meta: { ...existente.meta, estimativa: linha.estimativa, ...metaGuia } }
    : { ...novoTx({ entityId: pj.id, kind: "despesa", competencia: mk, descricao: `${linha.nome} — ref. ${mk}`, valor, categoryId: linha.categoryId, vencimento: venc, valorBrl: valor, status, pagamento, tags: ["imposto"], meta: { imposto: linha.tipo, impostoDe: mk, estimativa: linha.estimativa, ...metaGuia } }) };
  s.upsertTransaction(tx);
}
