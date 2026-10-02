/**
 * Monta o balanço projetado da empresa a partir do estado: meses passados com valores lançados,
 * meses futuros com receita prevista (configurável), impostos estimados, recorrências e pró-labore pela política.
 */
import type { Entity, MonthKey } from "@core/domain/types";
import { addMonths, monthRange } from "@core/dates";
import { desligadaNoMes, recorrenciaValeNoMes } from "@core/recorrencias";
import { mediaUltimos, projetarBalanco, type BalancoMesInput, type BalancoResult } from "@core/balanco";
import { round2 } from "@core/money";
import { calcularDas, proLaboreMinimoFatorR, type SerieFolha, type SerieReceitas } from "@core/tax/simples";
import { calcularProLabore, definirProLaboreBruto } from "@core/tax/prolabore";
import { calcularMei, calcularPresumidoMensal } from "@core/tax/outrosRegimes";
import { seriesPJ, tabelasPara } from "@/lib/fiscal";
import { configImpostos, totalImpostosMes } from "@/lib/impostos";
import type { AppState } from "@/state/store";

export interface PrevisaoConfig {
  receitaMensal?: number; // default: média dos últimos 3 meses realizados
  receitaPorMes?: Record<MonthKey, number>;
  retiradaPorMes?: Record<MonthKey, number>;
  retiradaPercentual?: number; // 0..1, usado pelo botão "preencher"
  despesasMensais?: number; // override; default: recorrências ativas
  caixaMinimo?: number;
  horizonte?: 6 | 12;
}

export function previsaoConfig(pj: Entity): PrevisaoConfig {
  return ((pj.config as { previsao?: PrevisaoConfig }).previsao ?? {}) as PrevisaoConfig;
}

const CATS_FORA_DESPESA = new Set(["pj-das", "pj-darf-prolabore", "pj-iss", "pj-tributos-federais", "pj-outros-impostos", "pj-prolabore", "pj-lucros", "pj-reserva"]);

export function montarBalanco(s: AppState, pj: Entity, mesAtual: MonthKey): { result: BalancoResult; receitaPrevistaPadrao: number; despesasPadrao: number; caixaInicial: number; meses: MonthKey[] } {
  const cfg = previsaoConfig(pj);
  const horizonte = cfg.horizonte ?? 12;
  const meses = monthRange(mesAtual, addMonths(mesAtual, horizonte - 1));
  const { receitas, folha } = seriesPJ(s, pj);
  const realizados = [...receitas.entries()].filter(([m]) => m < mesAtual).sort().map(([, r]) => r.total);
  const receitaPrevistaPadrao = cfg.receitaMensal ?? mediaUltimos(realizados, 3);
  const inicio = pj.config.inicioAtividade ?? null;
  const regime = pj.regime ?? "SIMPLES_III";

  // recorrências ativas da PJ (despesas fora de impostos/pró-labore)
  const recs = s.recurrences.filter((r) => r.entityId === pj.id && r.ativa && r.kind === "despesa" && !CATS_FORA_DESPESA.has(r.categoryId ?? ""));
  const despesasRec = (mk: MonthKey) => round2(recs.filter((r) => recorrenciaValeNoMes(r, mk) && !desligadaNoMes(r, mk)).reduce((a, r) => a + (r.moeda === "BRL" ? r.valorPadrao : 0), 0));
  const despesasPadrao = cfg.despesasMensais ?? despesasRec(mesAtual);

  // caixa inicial: tudo pago até o mês anterior
  const caixaInicial = round2(s.transactions.filter((t) => t.entityId === pj.id && t.competencia < mesAtual && t.status !== "pendente").reduce((a, t) => a + (t.kind === "receita" ? t.valorBrl : t.kind === "despesa" ? -t.valorBrl : t.categoryId === "pj-reserva" ? -t.valorBrl : 0), 0));

  // séries projetadas (mutáveis mês a mês)
  const recProj: SerieReceitas = new Map(receitas);
  const folhaProj: SerieFolha = new Map(folha);
  const outrosCustom = configImpostos(pj).outros ?? [];
  const inputs: BalancoMesInput[] = [];
  for (const mk of meses) {
    const realizado = mk < mesAtual;
    const tt = tabelasPara(s.taxTables, mk);
    const receitaReal = receitas.get(mk)?.total ?? 0;
    const receita = realizado || (mk === mesAtual && receitaReal > 0) ? receitaReal : cfg.receitaPorMes?.[mk] ?? receitaPrevistaPadrao;
    if (!realizado) recProj.set(mk, { total: receita, exportacao: pj.config.fatura?.exportacao ? receita : 0 });

    // pró-labore: salvo, senão política
    let bruto = s.payrolls.find((p) => p.entityId === pj.id && p.competencia === mk)?.bruto ?? 0;
    if (!bruto) {
      const pol = pj.config.proLabore ?? { modo: "minimoFatorR" as const };
      const min = proLaboreMinimoFatorR({ mes: mk, receitas: recProj, folha: folhaProj, params: tt.params, inicioAtividade: inicio, salarioMinimo: tt.inss.salarioMinimo, metodo: pj.config.fatorRMetodo ?? "anterior12" });
      bruto = definirProLaboreBruto({ modo: pol.modo, valor: pol.valor, percentual: pol.percentual, receitaMes: receita, minimoFatorR: min.proLaboreMinimo, salarioMinimo: tt.inss.salarioMinimo });
      folhaProj.set(mk, bruto);
    }

    // impostos
    let impostos: number;
    if (realizado || mk === mesAtual) {
      impostos = totalImpostosMes(s, pj, mk).total;
    } else {
      let principal = 0;
      if (regime === "MEI") principal = calcularMei({ receita12m: receita * 12, servicos: true }, tt.mei, tt.inss).dasMensal;
      else if (regime === "PRESUMIDO") principal = calcularPresumidoMensal({ receita, receitaExportacao: pj.config.fatura?.exportacao ? receita : 0, issAliquota: pj.config.issAliquota ?? 0.05 }, tt.presumido).total;
      else principal = calcularDas({ mes: mk, receitas: recProj, folha: folhaProj, anexoIII: tt.anexoIII, anexoV: tt.anexoV, params: tt.params, inicioAtividade: inicio, anexoForcado: pj.config.fatorRManual ? (regime === "SIMPLES_V" ? "V" : "III") : null, exportacaoIsenta: pj.config.fatura?.exportacao !== false, fatorRMetodo: pj.config.fatorRMetodo ?? "anterior12", fatorROpts: { arredondar: pj.config.fatorRArredondar !== false } }).das;
      const darf = calcularProLabore({ competencia: mk, bruto, inss: tt.inss, irpf: tt.irpf }).darf;
      const custom = outrosCustom.filter((c) => c.recorrente || c.competencia === mk).reduce((a, c) => a + (c.valorPadrao ?? 0), 0);
      impostos = round2(principal + darf + custom);
    }

    const despesas = realizado
      ? round2(s.transactions.filter((t) => t.entityId === pj.id && t.competencia === mk && t.kind === "despesa" && !CATS_FORA_DESPESA.has(t.categoryId ?? "") && !t.meta?.imposto).reduce((a, t) => a + t.valorBrl, 0))
      : (cfg.despesasMensais ?? despesasRec(mk));
    const reserva = realizado ? round2(s.transactions.filter((t) => t.entityId === pj.id && t.competencia === mk && t.categoryId === "pj-reserva").reduce((a, t) => a + t.valorBrl, 0)) : (pj.config.reservaCaixaMensal ?? 0);
    const retirada = realizado ? round2(s.transactions.filter((t) => t.entityId === pj.id && t.competencia === mk && t.categoryId === "pj-lucros").reduce((a, t) => a + t.valorBrl, 0)) : cfg.retiradaPorMes?.[mk] ?? 0;
    inputs.push({ mes: mk, realizado, receita: round2(receita), impostos, despesas, proLaboreBruto: round2(bruto), reserva, retirada });
  }
  return { result: projetarBalanco(caixaInicial, inputs, { caixaMinimo: cfg.caixaMinimo ?? 0 }), receitaPrevistaPadrao, despesasPadrao, caixaInicial, meses };
}
