/**
 * Seletores que ligam o estado do app aos cálculos do core (Simples, Fator R, pró-labore, carnê-leão, DRE, obrigações).
 */
import type { Entity, MonthKey, Transaction } from "@core/domain/types";
import { addMonths, monthRange, previousMonths } from "@core/dates";
import { refDate, SEED_TAX_TABLES } from "@core/tax/tables";
import { calcularDre, type DreResult } from "@core/dre";
import { round2 } from "@core/money";
import { calcularCarneLeao, type CarneLeaoMesResult } from "@core/tax/carneLeao";
import { gerarObrigacoesAutonomo, gerarObrigacoesPJ, type Obrigacao } from "@core/tax/calendario";
import { calcularMei, calcularPresumidoMensal } from "@core/tax/outrosRegimes";
import { calcularProLabore, definirProLaboreBruto, type ProLaboreResult } from "@core/tax/prolabore";
import { calcularDas, calcularFatorR, proLaboreMinimoFatorR, type DasResult, type FatorRResult, type SerieFolha, type SerieReceitas } from "@core/tax/simples";
import { pickByVigencia, type TaxTables } from "@core/tax/tables";
import type { AppState } from "@/state/store";

export function seriesPJ(s: Pick<AppState, "transactions" | "payrolls">, pj: Entity): { receitas: SerieReceitas; folha: SerieFolha } {
  const receitas: SerieReceitas = new Map();
  for (const t of s.transactions) {
    if (t.entityId !== pj.id || t.kind !== "receita") continue;
    const cur = receitas.get(t.competencia) ?? { total: 0, exportacao: 0 };
    cur.total = round2(cur.total + t.valorBrl);
    if (t.exportacao) cur.exportacao = round2(cur.exportacao + t.valorBrl);
    receitas.set(t.competencia, cur);
  }
  const folha: SerieFolha = new Map();
  for (const p of s.payrolls) if (p.entityId === pj.id) folha.set(p.competencia, round2((folha.get(p.competencia) ?? 0) + p.bruto));
  // salários/estagiário lançados como despesa também compõem a folha
  for (const t of s.transactions) if (t.entityId === pj.id && t.categoryId === "pj-salarios") folha.set(t.competencia, round2((folha.get(t.competencia) ?? 0) + t.valorBrl));
  return { receitas, folha };
}

const NOMES_TABELA: Record<string, string> = {
  irpf: "IRPF", inss: "INSS", anexoIII: "Simples Anexo III", anexoV: "Simples Anexo V", params: "Simples (limites/Fator R)", mei: "MEI", presumido: "Lucro Presumido", dividendos: "Dividendos",
};

/**
 * Tabelas vigentes no mês. Se o usuário desativou todas as vigências de um tipo,
 * usa a tabela padrão do app (semente) e registra um aviso em `semVigenciaAtiva`.
 */
export function tabelasPara(tt: TaxTables, mk: MonthKey) {
  const d = refDate(mk);
  const semVigenciaAtiva: string[] = [];
  function pick<T extends { vigenciaInicio: string; ativa?: boolean }>(chave: string, lista: T[], seed: T[]): T {
    const t = pickByVigencia(lista, d);
    if (t) return t;
    semVigenciaAtiva.push(NOMES_TABELA[chave] ?? chave);
    return pickByVigencia(seed.map((x) => ({ ...x, ativa: true })), d)!;
  }
  const S = SEED_TAX_TABLES;
  return {
    irpf: pick("irpf", tt.irpf, S.irpf),
    inss: pick("inss", tt.inss, S.inss),
    anexoIII: pick("anexoIII", tt.simplesAnexos.filter((a) => a.anexo === "III"), S.simplesAnexos.filter((a) => a.anexo === "III")),
    anexoV: pick("anexoV", tt.simplesAnexos.filter((a) => a.anexo === "V"), S.simplesAnexos.filter((a) => a.anexo === "V")),
    params: pick("params", tt.simplesParams, S.simplesParams),
    mei: pick("mei", tt.mei, S.mei),
    presumido: pick("presumido", tt.presumido, S.presumido),
    dividendos: pick("dividendos", tt.dividendos, S.dividendos),
    semVigenciaAtiva,
  };
}

export interface ImpostoMes {
  mes: MonthKey;
  regime: Entity["regime"];
  das: DasResult | null;
  fatorR: FatorRResult | null;
  proLaboreMinimo: number | null;
  meiDas: number | null;
  presumidoTotal: number | null;
  valorTributo: number;
  memoria: string[];
  alertas: string[];
}

export function impostoDoMes(s: Pick<AppState, "transactions" | "payrolls" | "taxTables">, pj: Entity, mk: MonthKey): ImpostoMes {
  const { receitas, folha } = seriesPJ(s, pj);
  const tt = tabelasPara(s.taxTables, mk);
  const regime = pj.regime ?? "SIMPLES_III";
  const inicio = pj.config.inicioAtividade ?? null;
  const rec = receitas.get(mk) ?? { total: 0, exportacao: 0 };
  if (regime === "MEI") {
    const soma12 = previousMonths(addMonths(mk, 1), 12).reduce((a, m) => a + (receitas.get(m)?.total ?? 0), 0);
    const r = calcularMei({ receita12m: soma12, servicos: true }, tt.mei, tt.inss);
    return { mes: mk, regime, das: null, fatorR: null, proLaboreMinimo: null, meiDas: r.dasMensal, presumidoTotal: null, valorTributo: r.dasMensal, memoria: [`DAS-MEI fixo: INSS ${r.inss} + ISS ${r.iss}`], alertas: r.alertas };
  }
  if (regime === "PRESUMIDO") {
    const r = calcularPresumidoMensal({ receita: rec.total, receitaExportacao: rec.exportacao, issAliquota: pj.config.issAliquota ?? 0.05 }, tt.presumido);
    return { mes: mk, regime, das: null, fatorR: null, proLaboreMinimo: null, meiDas: null, presumidoTotal: r.total, valorTributo: r.total, memoria: r.memoria, alertas: r.alertas };
  }
  const metodo = pj.config.fatorRMetodo ?? "anterior12";
  const anexoForcado = pj.config.fatorRManual ? (regime === "SIMPLES_V" ? "V" : "III") : null;
  const fatorROpts = { arredondar: pj.config.fatorRArredondar !== false };
  const das = calcularDas({ mes: mk, receitas, folha, anexoIII: tt.anexoIII, anexoV: tt.anexoV, params: tt.params, inicioAtividade: inicio, anexoForcado, exportacaoIsenta: pj.config.fatura?.exportacao !== false, fatorRMetodo: metodo, fatorROpts });
  const fatorR = calcularFatorR(mk, receitas, folha, tt.params, inicio, metodo, fatorROpts);
  const min = proLaboreMinimoFatorR({ mes: mk, receitas, folha, params: tt.params, inicioAtividade: inicio, salarioMinimo: tt.inss.salarioMinimo, metodo });
  return { mes: mk, regime, das, fatorR, proLaboreMinimo: min.proLaboreMinimo, meiDas: null, presumidoTotal: null, valorTributo: das.das, memoria: [...das.memoria, ...min.memoria], alertas: das.alertas };
}

export function proLaboreDoMes(s: Pick<AppState, "transactions" | "payrolls" | "taxTables">, pj: Entity, mk: MonthKey, brutoOverride?: number): ProLaboreResult & { sugerido: number } {
  const tt = tabelasPara(s.taxTables, mk);
  const { receitas, folha } = seriesPJ(s, pj);
  const min = proLaboreMinimoFatorR({ mes: mk, receitas, folha, params: tt.params, inicioAtividade: pj.config.inicioAtividade ?? null, salarioMinimo: tt.inss.salarioMinimo, metodo: pj.config.fatorRMetodo ?? "anterior12" });
  const cfg = pj.config.proLabore ?? { modo: "minimoFatorR" };
  const sugerido = definirProLaboreBruto({ modo: cfg.modo, valor: cfg.valor, percentual: cfg.percentual, receitaMes: receitas.get(mk)?.total ?? 0, minimoFatorR: min.proLaboreMinimo, salarioMinimo: tt.inss.salarioMinimo });
  const bruto = brutoOverride ?? s.payrolls.find((p) => p.entityId === pj.id && p.competencia === mk)?.bruto ?? sugerido;
  const r = calcularProLabore({ competencia: mk, bruto, inss: tt.inss, irpf: tt.irpf, diaVencimentoDarf: 20 });
  return { ...r, sugerido };
}

export function dreDoPeriodo(s: Pick<AppState, "transactions" | "categories" | "payrolls" | "taxTables">, pj: Entity, de: MonthKey, ate: MonthKey): DreResult {
  // IRPJ/CSLL dentro do DAS (informativo)
  let irpjCsll = 0;
  for (const mk of monthRange(de, ate)) {
    const imp = impostoDoMes(s, pj, mk);
    if (imp.das) irpjCsll += imp.das.tributos.filter((t) => t.tributo === "irpj" || t.tributo === "csll").reduce((a, t) => a + t.valor, 0);
  }
  return calcularDre({ transactions: s.transactions.filter((t) => t.entityId === pj.id), categories: s.categories, de, ate, irpjCsllNoDas: round2(irpjCsll) });
}

export function carneLeaoSerie(s: Pick<AppState, "transactions" | "categories" | "taxTables">, ent: Entity, ano: number): CarneLeaoMesResult[] {
  const cats = new Map(s.categories.map((c) => [c.id, c]));
  const meses = monthRange(`${ano}-01`, `${ano}-12`).map((mk) => {
    const doMes = s.transactions.filter((t) => t.entityId === ent.id && t.competencia === mk);
    const receitasPF = round2(doMes.filter((t) => t.kind === "receita" && t.status !== "pendente").reduce((a, t) => a + t.valorBrl, 0));
    const livro = round2(doMes.filter((t) => t.kind === "despesa" && t.categoryId && cats.get(t.categoryId)?.dedutivelLivroCaixa && t.categoryId !== "pf-inss" && t.status !== "pendente").reduce((a, t) => a + t.valorBrl, 0));
    const inss = round2(doMes.filter((t) => t.kind === "despesa" && t.categoryId === "pf-inss" && t.status !== "pendente").reduce((a, t) => a + t.valorBrl, 0));
    return { competencia: mk, receitasPF, despesasLivroCaixa: livro, inssPago: inss, dependentes: 0 };
  });
  return calcularCarneLeao(meses, (mk) => tabelasPara(s.taxTables, mk).irpf, { aplicarRedutor: ent.config.aplicarRedutorCarneLeao !== false });
}

export function obrigacoesDoMes(s: Pick<AppState, "transactions" | "payrolls" | "taxTables" | "categories" | "recurrences" | "obligationsDone">, ents: Entity[], mk: MonthKey): Obrigacao[] {
  const out: Obrigacao[] = [];
  for (const e of ents) {
    if (e.tipo === "PJ") {
      const imp = impostoDoMes(s, e, mk);
      const pl = proLaboreDoMes(s, e, mk);
      const contab = s.recurrences.find((r) => r.entityId === e.id && r.ativa && r.categoryId === "pj-contabilidade");
      const inf = (tipo: string) => s.transactions.find((t) => t.entityId === e.id && t.meta?.imposto === tipo && t.meta?.impostoDe === mk)?.valorBrl;
      out.push(...gerarObrigacoesPJ({ entityId: e.id, competencia: mk, regime: e.regime ?? "SIMPLES_III", dasPrevisto: inf("das") ?? inf("tribfed") ?? imp.valorTributo, darfPrevisto: inf("darf") ?? pl.darf, tfeAnual: e.config.tfeAnual ?? null, mesTfe: e.config.mesTfe ?? 7, honorariosContabilidade: contab?.valorPadrao ?? null }));
    }
    if (e.tipo === "AUTONOMO_PF") {
      const serie = carneLeaoSerie(s, e, Number(mk.slice(0, 4)));
      const m = serie.find((x) => x.competencia === mk);
      out.push(...gerarObrigacoesAutonomo({ entityId: e.id, competencia: mk, carneLeaoPrevisto: m?.imposto ?? null, inssPrevisto: e.config.inssValorMensal ?? null }));
    }
  }
  return out.map((o) => ({ ...o, concluida: s.obligationsDone.has(o.id) }));
}

export function txDoMes(s: Pick<AppState, "transactions">, entityIds: string[], mk: MonthKey): Transaction[] {
  const set = new Set(entityIds);
  return s.transactions.filter((t) => set.has(t.entityId) && t.competencia === mk);
}
