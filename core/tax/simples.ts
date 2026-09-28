/**
 * Simples Nacional — Anexos III e V, RBT12, alíquota efetiva, partilha por tributo,
 * exclusão de PIS/COFINS/ISS na exportação, teto do ISS (5%), Fator R e simulador.
 *
 * Referências: LC 123/2006 (art. 18), Resolução CGSN 140/2018 (arts. 21 a 26).
 */
import { previousMonths, dateInMonth, addMonths, nextBusinessDayOnOrAfter, monthDiff } from "../dates";
import type { MonthKey } from "../domain/types";
import { round2, round4, round6 } from "../money";
import type { SimplesAnexoTable, SimplesFaixa, SimplesParams, TributoSimples } from "./tables";

export interface ReceitaMes {
  total: number;
  exportacao: number; // parcela marcada como exportação de serviço
}

export type SerieReceitas = Map<MonthKey, ReceitaMes>;
export type SerieFolha = Map<MonthKey, number>;

export const TRIBUTOS: TributoSimples[] = ["irpj", "csll", "cofins", "pis", "cpp", "iss"];

/**
 * RBT12 para o período de apuração `mes`, com proporcionalização em início de atividade
 * (Res. CGSN 140/2018, art. 21 §2º e §3º):
 *  - 12 meses completos: soma dos 12 meses anteriores;
 *  - menos de 12 meses de atividade: média dos meses anteriores × 12;
 *  - primeiro mês de atividade: receita do próprio mês × 12.
 */
export function calcularRbt12(mes: MonthKey, receitas: SerieReceitas, inicioAtividade?: MonthKey | null): { rbt12: number; metodo: "12meses" | "proporcional" | "primeiroMes"; mesesConsiderados: number } {
  const prev = previousMonths(mes, 12);
  const ativos = inicioAtividade ? prev.filter((m) => m >= inicioAtividade) : prev;
  if (inicioAtividade && ativos.length === 0) {
    const r = receitas.get(mes)?.total ?? 0;
    return { rbt12: round2(r * 12), metodo: "primeiroMes", mesesConsiderados: 0 };
  }
  const soma = ativos.reduce((a, m) => a + (receitas.get(m)?.total ?? 0), 0);
  if (inicioAtividade && ativos.length < 12) {
    return { rbt12: round2((soma / ativos.length) * 12), metodo: "proporcional", mesesConsiderados: ativos.length };
  }
  return { rbt12: round2(soma), metodo: "12meses", mesesConsiderados: 12 };
}

/** Folha dos 12 meses anteriores com a mesma proporcionalização do RBT12 (art. 26 §2º e §3º). */
export function calcularFolha12(mes: MonthKey, folha: SerieFolha, inicioAtividade?: MonthKey | null): number {
  const prev = previousMonths(mes, 12);
  const ativos = inicioAtividade ? prev.filter((m) => m >= inicioAtividade) : prev;
  if (inicioAtividade && ativos.length === 0) return round2((folha.get(mes) ?? 0) * 12);
  const soma = ativos.reduce((a, m) => a + (folha.get(m) ?? 0), 0);
  if (inicioAtividade && ativos.length < 12) return round2((soma / ativos.length) * 12);
  return round2(soma);
}

export type FatorRMetodo = "anterior12" | "corrente12" | "mensal";

export const FATOR_R_METODOS: { id: FatorRMetodo; nome: string; descricao: string }[] = [
  { id: "anterior12", nome: "12 meses anteriores (regra legal)", descricao: "Folha e receita dos 12 meses anteriores ao período de apuração, proporcionalizados no início de atividade (Res. CGSN 140/2018, art. 26). Define o anexo do DAS deste mês." },
  { id: "corrente12", nome: "12 meses incluindo o mês corrente", descricao: "Janela de 12 meses terminando no próprio mês de apuração. Útil para acompanhar o efeito do pró-labore deste mês imediatamente." },
  { id: "mensal", nome: "Só o mês (folha ÷ receita do mês)", descricao: "Aproximação usada em algumas planilhas: pró-labore + salários do mês dividido pela receita do mês. Não é a regra do PGDAS-D." },
];

export interface FatorRResult {
  folha12: number;
  rbt12: number;
  /** valor usado na comparação com 28% (arredondado a 2 casas quando `arredondar`, como o PGDAS-D exibe) */
  fatorR: number;
  /** razão exata folha ÷ receita (null nos casos-limite com valor fixo) */
  fatorRExato: number | null;
  anexo: "III" | "V";
  minimo: number;
  distanciaAoMinimo: number;
  metodo: FatorRMetodo;
  janela: { de: MonthKey; ate: MonthKey; meses: number };
  /** regra do art. 26 aplicada */
  regra: string;
}

export interface FatorROpts {
  /** arredondar a 2 casas antes de comparar com 28% (default true, como o PGDAS-D exibe) */
  arredondar?: boolean;
  /** Res. CGSN 190/2026: fator r = 0,28 nos 2 primeiros meses de atividade (default true) */
  regra190?: boolean;
}

function somaJanela(meses: MonthKey[], receitas: SerieReceitas, folha: SerieFolha, inicioAtividade?: MonthKey | null): { rec: number; fol: number; ativos: MonthKey[] } {
  const ativos = inicioAtividade ? meses.filter((m) => m >= inicioAtividade) : meses;
  return {
    rec: ativos.reduce((a, m) => a + (receitas.get(m)?.total ?? 0), 0),
    fol: ativos.reduce((a, m) => a + (folha.get(m) ?? 0), 0),
    ativos,
  };
}

/**
 * Fator R conforme o método escolhido:
 *  - anterior12: 12 meses anteriores ao PA, com proporcionalização (regra legal);
 *  - corrente12: 12 meses terminando no PA (inclui o mês corrente);
 *  - mensal: folha e receita do próprio mês.
 */
export function calcularFatorR(mes: MonthKey, receitas: SerieReceitas, folha: SerieFolha, params: SimplesParams, inicioAtividade?: MonthKey | null, metodo: FatorRMetodo = "anterior12", opts: FatorROpts = {}): FatorRResult {
  const arredondar = opts.arredondar !== false;
  const regra190 = opts.regra190 !== false;
  let folha12 = 0, rbt12 = 0;
  let janela: FatorRResult["janela"];
  if (metodo === "anterior12") {
    // Res. CGSN 140/2018, art. 26, § 5º: FS12 e RBT12r são as somas dos 12 meses anteriores ao PA (o PA não entra);
    // em início de atividade, só os meses desde a abertura (a razão das somas é a mesma da média × 12).
    const prev = previousMonths(mes, 12);
    const { rec, fol, ativos } = somaJanela(prev, receitas, folha, inicioAtividade);
    rbt12 = round2(rec);
    folha12 = round2(fol);
    janela = { de: ativos[0] ?? mes, ate: ativos[ativos.length - 1] ?? mes, meses: ativos.length };
  } else if (metodo === "corrente12") {
    const meses = previousMonths(addMonths(mes, 1), 12); // mes-11 .. mes
    const { rec, fol, ativos } = somaJanela(meses, receitas, folha, inicioAtividade);
    const n = ativos.length || 1;
    const fator = inicioAtividade && ativos.length < 12 ? 12 / n : 1;
    rbt12 = round2(rec * fator);
    folha12 = round2(fol * fator);
    janela = { de: ativos[0] ?? mes, ate: mes, meses: ativos.length };
  } else {
    rbt12 = round2(receitas.get(mes)?.total ?? 0);
    folha12 = round2(folha.get(mes) ?? 0);
    janela = { de: mes, ate: mes, meses: 1 };
  }
  // art. 26, §§ 6º e 7º (Res. CGSN 140/2018; § 6º na redação da Res. CGSN 190/2026)
  let fatorRExato: number | null = null;
  let fatorR: number;
  let regra: string;
  const mesesDesdeAbertura = inicioAtividade ? monthDiff(inicioAtividade, mes) : 99;
  if (regra190 && metodo === "anterior12" && mesesDesdeAbertura >= 0 && mesesDesdeAbertura < 2) {
    fatorR = params.fatorRMinimo;
    regra = "art. 26, § 6º (Res. 190/2026): 2 primeiros meses de atividade → 0,28";
  } else if (folha12 <= 0 && rbt12 > 0) {
    fatorR = 0.01;
    regra = "art. 26, § 7º: folha = 0 e receita > 0 → 0,01";
  } else if (folha12 > 0 && rbt12 <= 0) {
    fatorR = params.fatorRMinimo;
    regra = "art. 26, § 7º: folha > 0 e receita = 0 → 0,28";
  } else if (folha12 <= 0 && rbt12 <= 0) {
    fatorR = 0.01;
    regra = "art. 26, § 7º: folha = 0 e receita = 0 → 0,01";
  } else {
    fatorRExato = folha12 / rbt12;
    fatorR = arredondar ? round2(fatorRExato) : round6(fatorRExato);
    regra = arredondar ? "art. 26, § 7º: folha ÷ receita, arredondado a 2 casas" : "art. 26, § 7º: folha ÷ receita";
  }
  const anexo = fatorR >= params.fatorRMinimo - 1e-9 ? "III" : "V";
  return { folha12, rbt12, fatorR, fatorRExato: fatorRExato == null ? null : round6(fatorRExato), anexo, minimo: params.fatorRMinimo, distanciaAoMinimo: round4((fatorRExato ?? fatorR) - params.fatorRMinimo), metodo, janela, regra };
}

/** Códigos dos tributos como aparecem no DAS (composição do documento de arrecadação). */
export const CODIGO_DAS: Record<TributoSimples, string> = { irpj: "1001", csll: "1002", cofins: "1004", pis: "1005", cpp: "1006", iss: "1010" };

export function faixaPorRbt12(rbt12: number, anexo: SimplesAnexoTable): SimplesFaixa {
  for (const f of anexo.faixas) if (rbt12 <= f.ate + 1e-9) return f;
  return anexo.faixas[anexo.faixas.length - 1];
}

/** Alíquota efetiva = (RBT12 × nominal − PD) / RBT12. Para RBT12 = 0 usa a nominal da 1ª faixa. */
export function aliquotaEfetiva(rbt12: number, faixa: SimplesFaixa): number {
  if (rbt12 <= 0) return faixa.aliquotaNominal;
  return Math.max(0, round4((rbt12 * faixa.aliquotaNominal - faixa.deduzir) / rbt12));
}

export interface DasTributo {
  tributo: TributoSimples;
  codigo: string;
  percentualPartilha: number;
  aliquotaEfetivaTributo: number; // sobre a receita
  valorNacional: number;
  valorExportacao: number;
  valor: number;
}

export interface DasResult {
  mes: MonthKey;
  anexo: "III" | "V";
  faixa: number;
  rbt12: number;
  rbt12Metodo: string;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number;
  /** alíquota efetiva aplicada à receita de exportação (sem PIS/COFINS/ISS) */
  aliquotaEfetivaExportacao: number;
  receitaTotal: number;
  receitaNacional: number;
  receitaExportacao: number;
  tributos: DasTributo[];
  das: number;
  vencimento: string;
  issRedistribuido: number;
  alertas: string[];
  memoria: string[];
}

/**
 * Calcula o DAS do mês.
 * Exportação de serviços: sobre a receita de exportação desconsideram-se os percentuais de PIS, COFINS e ISS
 * da partilha (Res. CGSN 140/2018, art. 25, §4º; LC 123 art. 18 §14).
 * ISS: parcela limitada a 5% da receita; o excedente é redistribuído proporcionalmente aos tributos federais.
 */
export function calcularDas(opts: {
  mes: MonthKey;
  receitas: SerieReceitas;
  folha: SerieFolha;
  anexoIII: SimplesAnexoTable;
  anexoV: SimplesAnexoTable;
  params: SimplesParams;
  inicioAtividade?: MonthKey | null;
  /** forçar anexo (ignora Fator R) */
  anexoForcado?: "III" | "V" | null;
  /** aplicar exclusão de exportação (default true) */
  exportacaoIsenta?: boolean;
  /** método de cálculo do Fator R (default: 12 meses anteriores) */
  fatorRMetodo?: FatorRMetodo;
  fatorROpts?: FatorROpts;
}): DasResult {
  const rec = opts.receitas.get(opts.mes) ?? { total: 0, exportacao: 0 };
  const receitaTotal = round2(rec.total);
  const receitaExportacao = opts.exportacaoIsenta === false ? 0 : round2(Math.min(rec.exportacao, rec.total));
  const receitaNacional = round2(receitaTotal - receitaExportacao);
  const alertas: string[] = [];
  const memoria: string[] = [];

  const { rbt12, metodo } = calcularRbt12(opts.mes, opts.receitas, opts.inicioAtividade);
  const fr = calcularFatorR(opts.mes, opts.receitas, opts.folha, opts.params, opts.inicioAtividade, opts.fatorRMetodo ?? "anterior12", opts.fatorROpts);
  const anexoSel = opts.anexoForcado ?? fr.anexo;
  const anexo = anexoSel === "III" ? opts.anexoIII : opts.anexoV;
  const faixa = faixaPorRbt12(rbt12, anexo);
  const efetiva = aliquotaEfetiva(rbt12, faixa);

  memoria.push(`RBT12 (${metodo}): ${rbt12.toFixed(2)} → Anexo ${anexoSel}, faixa ${faixa.faixa} (nominal ${(faixa.aliquotaNominal * 100).toFixed(2)}%, PD ${faixa.deduzir.toFixed(2)})`);
  memoria.push(`Fator R (${fr.metodo}, ${fr.janela.de} a ${fr.janela.ate}): folha ${fr.folha12.toFixed(2)} / receita ${fr.rbt12.toFixed(2)}${fr.fatorRExato != null ? ` = ${(fr.fatorRExato * 100).toFixed(2)}%` : ""} → ${(fr.fatorR * 100).toFixed(0)}% (${fr.regra})${opts.anexoForcado ? " (anexo fixado manualmente)" : ""}`);
  memoria.push(`Alíquota efetiva = (${rbt12.toFixed(2)} × ${(faixa.aliquotaNominal * 100).toFixed(2)}% − ${faixa.deduzir.toFixed(2)}) / ${rbt12.toFixed(2)} = ${(efetiva * 100).toFixed(4)}%`);

  // partilha efetiva por tributo com teto de ISS
  const partilha: Record<TributoSimples, number> = { ...faixa.partilha };
  let issRedistribuido = 0;
  const issEfetivo = efetiva * partilha.iss;
  if (issEfetivo > opts.params.issTetoPercentual + 1e-12) {
    const issCap = opts.params.issTetoPercentual / efetiva; // percentual da partilha equivalente a 5%
    const excedente = partilha.iss - issCap;
    const federais: TributoSimples[] = ["irpj", "csll", "cofins", "pis", "cpp"];
    const somaFed = federais.reduce((a, t) => a + partilha[t], 0);
    for (const t of federais) partilha[t] = partilha[t] + excedente * (partilha[t] / somaFed);
    partilha.iss = issCap;
    issRedistribuido = round2(excedente * efetiva * receitaNacional);
    memoria.push(`ISS efetivo ${(issEfetivo * 100).toFixed(2)}% > 5%: excedente redistribuído aos tributos federais`);
  }

  const excluidosExport: TributoSimples[] = ["pis", "cofins", "iss"];
  // Observação: a partilha oficial da 1ª faixa do Anexo III soma 99,90% (texto da LC 155/2016);
  // o PGDAS-D aplica os percentuais como estão, por isso somamos as parcelas em vez de assumir 100%.
  const somaPartilha = TRIBUTOS.reduce((a, t) => a + partilha[t], 0);
  const shareExport = TRIBUTOS.filter((t) => !excluidosExport.includes(t)).reduce((a, t) => a + partilha[t], 0);
  const efetivaNacional = round6(efetiva * somaPartilha);
  const efetivaExport = round6(efetiva * shareExport);
  if (receitaExportacao > 0) {
    memoria.push(`Exportação: excluídos PIS (${(partilha.pis * 100).toFixed(2)}%), COFINS (${(partilha.cofins * 100).toFixed(2)}%) e ISS (${(partilha.iss * 100).toFixed(2)}%) da partilha → alíquota efetiva na exportação ${(efetivaExport * 100).toFixed(4)}%`);
  }

  // valores exatos por tributo; o DAS é arredondado uma vez e a diferença de centavos vai para o maior tributo
  const exatos = TRIBUTOS.map((t) => {
    const vNac = receitaNacional * efetiva * partilha[t];
    const vExp = excluidosExport.includes(t) ? 0 : receitaExportacao * efetiva * partilha[t];
    return { t, vNac, vExp };
  });
  const das = round2(exatos.reduce((a, e) => a + e.vNac + e.vExp, 0));
  const tributos: DasTributo[] = exatos.map((e) => ({
    tributo: e.t,
    codigo: CODIGO_DAS[e.t],
    percentualPartilha: round6(partilha[e.t]),
    aliquotaEfetivaTributo: round6(efetiva * partilha[e.t]),
    valorNacional: round2(e.vNac),
    valorExportacao: round2(e.vExp),
    valor: round2(e.vNac + e.vExp),
  }));
  const diff = round2(das - tributos.reduce((a, t) => a + t.valor, 0));
  if (diff !== 0) {
    const maior = tributos.reduce((m, t) => (t.valor > m.valor ? t : m), tributos[0]);
    maior.valor = round2(maior.valor + diff);
    if (maior.valorNacional > 0) maior.valorNacional = round2(maior.valorNacional + diff); else maior.valorExportacao = round2(maior.valorExportacao + diff);
  }
  memoria.push(`DAS = nacional ${receitaNacional.toFixed(2)} × ${(efetivaNacional * 100).toFixed(4)}% + exportação ${receitaExportacao.toFixed(2)} × ${(efetivaExport * 100).toFixed(4)}% = ${das.toFixed(2)}`);

  if (rbt12 > opts.params.limiteAnual) alertas.push(`RBT12 (${rbt12.toFixed(2)}) ultrapassa o limite do Simples (${opts.params.limiteAnual.toFixed(2)}): risco de exclusão.`);
  else if (rbt12 > opts.params.sublimiteIssIcms) alertas.push(`RBT12 acima do sublimite (${opts.params.sublimiteIssIcms.toFixed(2)}): ISS passa a ser recolhido fora do Simples.`);
  else if (rbt12 > opts.params.limiteAnual * 0.8) alertas.push("RBT12 acima de 80% do limite do Simples.");
  if (!opts.anexoForcado && fr.fatorR < opts.params.fatorRMinimo && fr.rbt12 > 0) alertas.push(`Fator R ${(fr.fatorR * 100).toFixed(2)}% < 28%: tributação pelo Anexo V.`);
  else if (!opts.anexoForcado && fr.fatorR < opts.params.fatorRMinimo + 0.02 && fr.rbt12 > 0) alertas.push(`Fator R ${(fr.fatorR * 100).toFixed(2)}% próximo do mínimo de 28%.`);

  const vencBase = dateInMonth(addMonths(opts.mes, 1), opts.params.diaVencimentoDas);
  return {
    mes: opts.mes,
    anexo: anexoSel,
    faixa: faixa.faixa,
    rbt12,
    rbt12Metodo: metodo,
    aliquotaNominal: faixa.aliquotaNominal,
    parcelaDeduzir: faixa.deduzir,
    aliquotaEfetiva: efetiva,
    aliquotaEfetivaExportacao: efetivaExport,
    receitaTotal,
    receitaNacional,
    receitaExportacao,
    tributos,
    das,
    vencimento: nextBusinessDayOnOrAfter(vencBase),
    issRedistribuido,
    alertas,
    memoria,
  };
}

/**
 * Simulador: pró-labore mínimo no mês `mes` para atingir Fator R ≥ 28%.
 *  - anterior12: afeta a apuração do mês seguinte (janela mes−11..mes);
 *  - corrente12: afeta a apuração deste mês (mesma janela);
 *  - mensal: 28% da receita do próprio mês.
 */
export function proLaboreMinimoFatorR(opts: {
  mes: MonthKey;
  receitas: SerieReceitas;
  folha: SerieFolha; // folha já registrada (o mês atual é ignorado e substituído pelo resultado)
  params: SimplesParams;
  inicioAtividade?: MonthKey | null;
  salarioMinimo?: number;
  metodo?: FatorRMetodo;
}): { proLaboreMinimo: number; folhaAnteriores: number; receitaBase: number; fatorRAtual: number; afeta: MonthKey; memoria: string[] } {
  const metodo = opts.metodo ?? "anterior12";
  const proximo = addMonths(opts.mes, 1);
  const janela = metodo === "mensal" ? [opts.mes] : previousMonths(proximo, 12); // mes-11 .. mes
  const ativos = opts.inicioAtividade ? janela.filter((m) => m >= opts.inicioAtividade!) : janela;
  const anteriores = ativos.filter((m) => m !== opts.mes);
  const folhaAnt = anteriores.reduce((a, m) => a + (opts.folha.get(m) ?? 0), 0);
  const recBase = ativos.reduce((a, m) => a + (opts.receitas.get(m)?.total ?? 0), 0);
  // proporcionalização cancela na razão (ambos × 12/n), então basta a razão das somas
  const alvo = opts.params.fatorRMinimo * recBase - folhaAnt;
  let min = Math.max(0, round2(alvo));
  if (opts.salarioMinimo && min > 0 && min < opts.salarioMinimo) min = opts.salarioMinimo;
  const folhaAtual = folhaAnt + (opts.folha.get(opts.mes) ?? 0);
  const fatorRAtual = recBase > 0 ? round4(folhaAtual / recBase) : 0;
  const afeta = metodo === "anterior12" ? proximo : opts.mes;
  return {
    proLaboreMinimo: min,
    folhaAnteriores: round2(folhaAnt),
    receitaBase: round2(recBase),
    fatorRAtual,
    afeta,
    memoria: [
      `Simulador (${metodo}) — janela ${ativos[0] ?? opts.mes} a ${opts.mes} (${ativos.length} meses), afeta a apuração de ${afeta}`,
      `Receita na janela: ${recBase.toFixed(2)} × 28% = ${(opts.params.fatorRMinimo * recBase).toFixed(2)}`,
      `Folha já registrada nos outros meses da janela: ${folhaAnt.toFixed(2)}`,
      `Pró-labore mínimo em ${opts.mes}: ${min.toFixed(2)}`,
    ],
  };
}

/** Série de DAS mês a mês (útil para gráficos/histórico). */
export function serieDas(meses: MonthKey[], base: Omit<Parameters<typeof calcularDas>[0], "mes">): DasResult[] {
  return meses.map((mes) => calcularDas({ ...base, mes }));
}
