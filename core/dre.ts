/**
 * DRE (Demonstração do Resultado do Exercício) mensal/anual para entidades PJ,
 * a partir dos lançamentos e do mapeamento categoria → conta da DRE.
 */
import type { Category, DreConta, MonthKey, Transaction } from "./domain/types";
import { round2 } from "./money";

export interface DreLinha {
  chave: string;
  titulo: string;
  valor: number;
  nivel: 0 | 1 | 2;
  tipo: "receita" | "deducao" | "despesa" | "subtotal" | "resultado" | "info";
  transactionIds: string[];
}

export interface DreResult {
  periodo: { de: MonthKey; ate: MonthKey };
  linhas: DreLinha[];
  receitaBruta: number;
  receitaLiquida: number;
  custosOperacionais: number;
  ebitda: number;
  resultadoAntesIR: number;
  lucroLiquido: number;
  lucrosDistribuidos: number;
  lucroRetido: number;
  reservaCaixa: number;
  indicadores: {
    margemLiquida: number;
    cargaTributariaEfetiva: number; // (DAS + DARF pró-labore) / receita bruta
    custoTotalSocio: number; // pró-labore bruto + lucros distribuídos
    tributosTotais: number;
  };
}

const CONTAS_DESPESA: { conta: DreConta; titulo: string }[] = [
  { conta: "prolabore", titulo: "Pró-labore bruto (inclui INSS + IRRF retidos)" },
  { conta: "salarios_encargos", titulo: "Salários / estagiário + encargos" },
  { conta: "contabilidade_taxas", titulo: "Contabilidade, TFE, taxas" },
  { conta: "software_internet", titulo: "Software, internet, ferramentas" },
  { conta: "bancarias_cambio", titulo: "Despesas bancárias / câmbio (IOF, spread)" },
  { conta: "outras_despesas", titulo: "Outras despesas" },
];

export function calcularDre(opts: {
  transactions: Transaction[];
  categories: Category[];
  de: MonthKey;
  ate: MonthKey;
  /** parcela de IRPJ/CSLL dentro do DAS no período (informativo), se conhecida */
  irpjCsllNoDas?: number;
  /** considerar pendentes (previsto) além de pagos? default true */
  incluirPendentes?: boolean;
}): DreResult {
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));
  const porConta = new Map<DreConta, { valor: number; ids: string[] }>();
  const add = (conta: DreConta, v: number, id: string) => {
    const cur = porConta.get(conta) ?? { valor: 0, ids: [] };
    cur.valor += v;
    cur.ids.push(id);
    porConta.set(conta, cur);
  };

  for (const t of opts.transactions) {
    if (t.competencia < opts.de || t.competencia > opts.ate) continue;
    if (opts.incluirPendentes === false && t.status === "pendente") continue;
    const cat = t.categoryId ? catMap.get(t.categoryId) : undefined;
    let conta: DreConta | null | undefined = cat?.contaDre;
    if (!conta) {
      if (t.kind === "receita") conta = t.exportacao ? "receita_exportacao" : "receita_nacional";
      else if (t.kind === "despesa") conta = "outras_despesas";
      else continue;
    }
    add(conta, t.valorBrl, t.id);
  }
  const g = (c: DreConta) => round2(porConta.get(c)?.valor ?? 0);
  const ids = (c: DreConta) => porConta.get(c)?.ids ?? [];

  const recExp = g("receita_exportacao");
  const recNac = g("receita_nacional");
  const receitaBruta = round2(recExp + recNac);
  const das = g("deducao_das");
  const iss = g("deducao_iss");
  const receitaLiquida = round2(receitaBruta - das - iss);
  // o DARF do pró-labore já está contido no pró-labore bruto; se lançado separadamente, evita dupla contagem
  const custos = CONTAS_DESPESA.map((c) => ({ ...c, valor: g(c.conta), ids: ids(c.conta) }));
  const custosOperacionais = round2(custos.reduce((a, c) => a + c.valor, 0));
  const ebitda = round2(receitaLiquida - custosOperacionais);
  const depreciacao = g("depreciacao");
  const resultadoAntesIR = round2(ebitda - depreciacao);
  const irpjCsll = opts.irpjCsllNoDas ?? 0;
  const lucroLiquido = resultadoAntesIR; // no Simples, IRPJ/CSLL já estão no DAS (informativo)
  const lucrosDistribuidos = g("lucros_distribuidos");
  const reservaCaixa = g("reserva_caixa");
  const lucroRetido = round2(lucroLiquido - lucrosDistribuidos);
  const naoOperacional = g("nao_operacional");

  const linhas: DreLinha[] = [
    { chave: "receita_bruta", titulo: "Receita Bruta de Serviços (BRL)", valor: receitaBruta, nivel: 0, tipo: "receita", transactionIds: [...ids("receita_exportacao"), ...ids("receita_nacional")] },
    { chave: "receita_exportacao", titulo: "Receita de exportação", valor: recExp, nivel: 1, tipo: "receita", transactionIds: ids("receita_exportacao") },
    { chave: "receita_nacional", titulo: "Receita nacional", valor: recNac, nivel: 1, tipo: "receita", transactionIds: ids("receita_nacional") },
    { chave: "deducoes", titulo: "(−) Deduções da receita", valor: round2(das + iss), nivel: 0, tipo: "deducao", transactionIds: [...ids("deducao_das"), ...ids("deducao_iss")] },
    { chave: "deducao_das", titulo: "DAS (tributos sobre faturamento)", valor: das, nivel: 1, tipo: "deducao", transactionIds: ids("deducao_das") },
    { chave: "deducao_iss", titulo: "ISS (se houver, fora do Simples)", valor: iss, nivel: 1, tipo: "deducao", transactionIds: ids("deducao_iss") },
    { chave: "receita_liquida", titulo: "= Receita Líquida", valor: receitaLiquida, nivel: 0, tipo: "subtotal", transactionIds: [] },
    { chave: "custos", titulo: "(−) Custos e despesas operacionais", valor: custosOperacionais, nivel: 0, tipo: "despesa", transactionIds: custos.flatMap((c) => c.ids) },
    ...custos.map<DreLinha>((c) => ({ chave: c.conta, titulo: c.titulo, valor: c.valor, nivel: 1, tipo: "despesa", transactionIds: c.ids })),
    { chave: "ebitda", titulo: "= Resultado Operacional (EBITDA)", valor: ebitda, nivel: 0, tipo: "subtotal", transactionIds: [] },
    { chave: "depreciacao", titulo: "(−) Depreciação", valor: depreciacao, nivel: 1, tipo: "despesa", transactionIds: ids("depreciacao") },
    { chave: "resultado_antes_ir", titulo: "= Resultado antes do IR", valor: resultadoAntesIR, nivel: 0, tipo: "subtotal", transactionIds: [] },
    { chave: "irpj_csll", titulo: "(−) IRPJ/CSLL — já dentro do DAS no Simples (informativo)", valor: irpjCsll, nivel: 1, tipo: "info", transactionIds: [] },
    { chave: "lucro_liquido", titulo: "= Lucro Líquido", valor: lucroLiquido, nivel: 0, tipo: "resultado", transactionIds: [] },
    { chave: "lucros_distribuidos", titulo: "(−) Lucros distribuídos", valor: lucrosDistribuidos, nivel: 1, tipo: "despesa", transactionIds: ids("lucros_distribuidos") },
    { chave: "lucro_retido", titulo: "= Lucro retido / caixa acumulado", valor: lucroRetido, nivel: 0, tipo: "resultado", transactionIds: [] },
    { chave: "reserva_caixa", titulo: "Reserva de caixa da empresa (transferida)", valor: reservaCaixa, nivel: 1, tipo: "info", transactionIds: ids("reserva_caixa") },
  ];
  if (naoOperacional) linhas.push({ chave: "nao_operacional", titulo: "Receitas não operacionais (financeiras)", valor: naoOperacional, nivel: 1, tipo: "info", transactionIds: ids("nao_operacional") });

  const darfProLabore = opts.transactions
    .filter((t) => t.competencia >= opts.de && t.competencia <= opts.ate && t.categoryId === "pj-darf-prolabore")
    .reduce((a, t) => a + t.valorBrl, 0);
  const tributosTotais = round2(das + iss + darfProLabore);
  return {
    periodo: { de: opts.de, ate: opts.ate },
    linhas,
    receitaBruta,
    receitaLiquida,
    custosOperacionais,
    ebitda,
    resultadoAntesIR,
    lucroLiquido,
    lucrosDistribuidos,
    lucroRetido,
    reservaCaixa,
    indicadores: {
      margemLiquida: receitaBruta > 0 ? lucroLiquido / receitaBruta : 0,
      cargaTributariaEfetiva: receitaBruta > 0 ? tributosTotais / receitaBruta : 0,
      custoTotalSocio: round2(g("prolabore") + lucrosDistribuidos),
      tributosTotais,
    },
  };
}

/** Projeção de caixa simples: saldo atual + média dos últimos N meses de resultado × horizonte. */
export function projetarCaixa(opts: { saldoAtual: number; resultadosMensais: number[]; meses: 3 | 6 | 12 }): { horizonte: number; mediaMensal: number; saldoProjetado: number } {
  const ult = opts.resultadosMensais.slice(-6);
  const media = ult.length ? ult.reduce((a, b) => a + b, 0) / ult.length : 0;
  return { horizonte: opts.meses, mediaMensal: round2(media), saldoProjetado: round2(opts.saldoAtual + media * opts.meses) };
}
