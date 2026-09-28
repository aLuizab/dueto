/**
 * Módulo Casal: resumo mensal (restante do mês anterior, receitas por pessoa, despesas fixas/variáveis, saldo),
 * divisão "quem paga o quê" e metas por categoria.
 */
import type { Budget, Category, Entity, MonthKey, SplitRule, Transaction } from "./domain/types";
import { addMonths } from "./dates";
import { round2 } from "./money";

export interface ResumoMensalCasal {
  competencia: MonthKey;
  restanteAnterior: number;
  receitasPorPessoa: { pessoaId: string; nome: string; bruto: number; descontos: number; liquido: number }[];
  totalReceitas: number;
  despesasFixas: number;
  despesasVariaveis: number;
  totalDespesas: number;
  saldo: number;
  pendentes: number;
  vencidas: number;
}

export function resumoMensalCasal(opts: {
  competencia: MonthKey;
  transactions: Transaction[];
  categories: Category[];
  pessoas: Entity[];
  casalId: string;
  /** usar "restante do mês anterior" automático (saldo do mês anterior) */
  carregarRestante: boolean;
  hoje?: string;
}): ResumoMensalCasal {
  const cat = new Map(opts.categories.map((c) => [c.id, c]));
  const ids = new Set([opts.casalId, ...opts.pessoas.map((p) => p.id)]);
  const doMes = opts.transactions.filter((t) => t.competencia === opts.competencia && ids.has(t.entityId));

  const receitasPorPessoa = opts.pessoas.map((p) => {
    const rec = doMes.filter((t) => t.kind === "receita" && (t.entityId === p.id || t.pagoPor === p.id) && t.categoryId !== "rec-restante");
    const bruto = round2(rec.reduce((a, t) => a + (Number(t.meta?.bruto) || t.valorBrl), 0));
    const liquido = round2(rec.reduce((a, t) => a + t.valorBrl, 0));
    return { pessoaId: p.id, nome: p.nome, bruto, descontos: round2(bruto - liquido), liquido };
  });
  const receitasSemDono = round2(doMes.filter((t) => t.kind === "receita" && t.entityId === opts.casalId && !t.pagoPor && t.categoryId !== "rec-restante").reduce((a, t) => a + t.valorBrl, 0));

  let restante = round2(doMes.filter((t) => t.kind === "receita" && t.categoryId === "rec-restante").reduce((a, t) => a + t.valorBrl, 0));
  if (restante === 0 && opts.carregarRestante) {
    const anterior = resumoMensalCasal({ ...opts, competencia: addMonths(opts.competencia, -1), carregarRestante: false });
    const temAlgo = anterior.totalReceitas !== 0 || anterior.totalDespesas !== 0;
    restante = temAlgo ? Math.max(0, anterior.saldo) : 0;
  }

  const despesas = doMes.filter((t) => t.kind === "despesa");
  const fixas = round2(despesas.filter((t) => (t.categoryId && cat.get(t.categoryId)?.fixa) || false).reduce((a, t) => a + t.valorBrl, 0));
  const totalDespesas = round2(despesas.reduce((a, t) => a + t.valorBrl, 0));
  const variaveis = round2(totalDespesas - fixas);
  const totalReceitas = round2(restante + receitasSemDono + receitasPorPessoa.reduce((a, p) => a + p.liquido, 0));
  const hoje = opts.hoje ?? new Date().toISOString().slice(0, 10);
  const pendentes = round2(despesas.filter((t) => t.status === "pendente").reduce((a, t) => a + t.valorBrl, 0));
  const vencidas = round2(despesas.filter((t) => t.status === "pendente" && t.vencimento && t.vencimento < hoje).reduce((a, t) => a + t.valorBrl, 0));
  return {
    competencia: opts.competencia,
    restanteAnterior: restante,
    receitasPorPessoa,
    totalReceitas,
    despesasFixas: fixas,
    despesasVariaveis: variaveis,
    totalDespesas,
    saldo: round2(totalReceitas - totalDespesas),
    pendentes,
    vencidas,
  };
}

export interface QuemPagaResult {
  regra: SplitRule;
  totalComum: number;
  porPessoa: { pessoaId: string; nome: string; renda: number; percentual: number; deveriaPagar: number; pagou: number; transferir: number }[];
}

/** Divisão das despesas comuns proporcional à renda, 50/50 ou manual; "transferir" > 0 = ainda deve para o comum. */
export function quemPagaOQue(opts: { regra: SplitRule; pessoas: { id: string; nome: string; renda: number }[]; despesasComuns: Transaction[]; manual?: Record<string, number> }): QuemPagaResult {
  const total = round2(opts.despesasComuns.reduce((a, t) => a + t.valorBrl, 0));
  const rendaTotal = opts.pessoas.reduce((a, p) => a + Math.max(0, p.renda), 0);
  const n = opts.pessoas.length || 1;
  const porPessoa = opts.pessoas.map((p) => {
    let pct = 1 / n;
    if (opts.regra === "proporcional" && rendaTotal > 0) pct = Math.max(0, p.renda) / rendaTotal;
    if (opts.regra === "manual" && opts.manual) pct = (opts.manual[p.id] ?? 0) / 100;
    const deveria = round2(total * pct);
    const pagou = round2(opts.despesasComuns.filter((t) => t.pagoPor === p.id).reduce((a, t) => a + t.valorBrl, 0));
    return { pessoaId: p.id, nome: p.nome, renda: p.renda, percentual: pct, deveriaPagar: deveria, pagou, transferir: round2(deveria - pagou) };
  });
  return { regra: opts.regra, totalComum: total, porPessoa };
}

export interface MetaProgresso {
  categoryId: string;
  nome: string;
  meta: number;
  gasto: number;
  percentual: number;
  status: "ok" | "atencao" | "estourou";
}

export function progressoMetas(opts: { competencia: MonthKey; budgets: Budget[]; transactions: Transaction[]; categories: Category[] }): MetaProgresso[] {
  const cats = opts.categories;
  const filhos = (id: string) => cats.filter((c) => c.parentId === id).map((c) => c.id);
  return opts.budgets
    .filter((b) => b.competencia === "*" || b.competencia === opts.competencia)
    .map((b) => {
      const idsCat = new Set([b.categoryId, ...filhos(b.categoryId)]);
      const gasto = round2(opts.transactions.filter((t) => t.competencia === opts.competencia && t.kind === "despesa" && t.categoryId && idsCat.has(t.categoryId)).reduce((a, t) => a + t.valorBrl, 0));
      const pct = b.valorMeta > 0 ? gasto / b.valorMeta : 0;
      const c = cats.find((x) => x.id === b.categoryId);
      return { categoryId: b.categoryId, nome: c?.nome ?? b.categoryId, meta: b.valorMeta, gasto, percentual: pct, status: pct > 1 ? "estourou" : pct > 0.8 ? "atencao" : "ok" } as MetaProgresso;
    });
}

/** Aporte mensal sugerido para um objetivo: (alvo − atual) / meses restantes. */
export function aporteSugerido(valorAlvo: number, valorAtual: number, prazo: string | null | undefined, hoje: string): { mesesRestantes: number; aporte: number } {
  if (!prazo) return { mesesRestantes: 0, aporte: round2(Math.max(0, valorAlvo - valorAtual)) };
  const [y1, m1] = hoje.split("-").map(Number);
  const [y2, m2] = prazo.split("-").map(Number);
  const meses = Math.max(1, (y2 - y1) * 12 + (m2 - m1));
  return { mesesRestantes: meses, aporte: round2(Math.max(0, valorAlvo - valorAtual) / meses) };
}
