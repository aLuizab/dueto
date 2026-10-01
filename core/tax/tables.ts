/**
 * Tabelas fiscais versionadas por vigência.
 * Todas são editáveis pelo usuário na tela "Tabelas fiscais"; estes são os valores-semente.
 * ATENÇÃO: estimativas — confira sempre com seu contador e com as fontes oficiais.
 */
import type { ISODate } from "../domain/types";

export interface IrpfBracket {
  ate: number | null; // base de cálculo até (null = sem limite)
  aliquota: number; // 0.075
  deduzir: number; // parcela a deduzir
}

export interface IrpfTable {
  id: string;
  vigenciaInicio: ISODate;
  descricao: string;
  fonte?: string;
  faixas: IrpfBracket[];
  /** dedução por dependente (mensal) */
  dependente: number;
  /** desconto simplificado mensal opcional (Lei 14.848/2024 e seguintes); null = não existe */
  descontoSimplificado: number | null;
  /**
   * Redutor da Lei 15.270/2025 (vigência 2026): isenção total até `isencaoAte` de rendimentos
   * e redução parcial até `reducaoAte` calculada como `a - b * rendimento`.
   * null = sem redutor nesta vigência.
   */
  redutor: { isencaoAte: number; reducaoAte: number; a: number; b: number } | null;
  ativa: boolean;
  origem: "seed" | "usuario" | "importacao";
}

export interface InssTable {
  id: string;
  vigenciaInicio: ISODate;
  descricao: string;
  salarioMinimo: number;
  teto: number;
  /** contribuinte individual / pró-labore */
  aliquotaProLabore: number; // 0.11 retido do sócio (a CPP patronal 20% está no DAS no Anexo III)
  ativa: boolean;
  origem: "seed" | "usuario" | "importacao";
}

export type TributoSimples = "irpj" | "csll" | "cofins" | "pis" | "cpp" | "iss";

export interface SimplesFaixa {
  faixa: number;
  ate: number; // RBT12 até
  aliquotaNominal: number;
  deduzir: number;
  partilha: Record<TributoSimples, number>; // percentuais somam 1
}

export interface SimplesAnexoTable {
  id: string;
  anexo: "III" | "V";
  vigenciaInicio: ISODate;
  descricao: string;
  faixas: SimplesFaixa[];
  ativa: boolean;
  origem: "seed" | "usuario" | "importacao";
}

export interface SimplesParams {
  id: string;
  vigenciaInicio: ISODate;
  limiteAnual: number; // 4.800.000
  sublimiteIssIcms: number; // 3.600.000
  fatorRMinimo: number; // 0.28
  issTetoPercentual: number; // 0.05
  diaVencimentoDas: number; // 20
  ativa: boolean;
}

export interface MeiParams {
  id: string;
  vigenciaInicio: ISODate;
  limiteAnual: number;
  percentualInssSobreMinimo: number; // 0.05
  issFixo: number; // 5
  icmsFixo: number; // 1
  ativa: boolean;
}

export interface PresumidoParams {
  id: string;
  vigenciaInicio: ISODate;
  presuncaoServicos: number; // 0.32
  irpj: number; // 0.15
  irpjAdicional: number; // 0.10
  irpjAdicionalLimiteMensal: number; // 20000
  csll: number; // 0.09
  pis: number; // 0.0065
  cofins: number; // 0.03
  ativa: boolean;
}

export interface IssMunicipio {
  id: string;
  municipio: string;
  uf: string;
  vigenciaInicio: ISODate;
  aliquotaPadrao: number;
  /** por código de serviço (LC 116) → alíquota */
  porCodigo: Record<string, number>;
  tfeAnualPadrao: number;
  exigeComprovacaoExportacao: boolean;
  observacao?: string;
  ativa: boolean;
}

export interface DividendosParams {
  id: string;
  vigenciaInicio: ISODate;
  /** limite mensal por beneficiário acima do qual há retenção (Lei 15.270/2025) */
  limiteMensalIsento: number | null;
  aliquotaAcimaLimite: number; // 0.10
  ativa: boolean;
}

export interface TaxTables {
  irpf: IrpfTable[];
  inss: InssTable[];
  simplesAnexos: SimplesAnexoTable[];
  simplesParams: SimplesParams[];
  mei: MeiParams[];
  presumido: PresumidoParams[];
  iss: IssMunicipio[];
  dividendos: DividendosParams[];
}

// ------------------------------------------------------------------
// SEEDS
// ------------------------------------------------------------------

const IRPF_2025_FAIXAS: IrpfBracket[] = [
  { ate: 2428.8, aliquota: 0, deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deduzir: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 675.49 },
  { ate: null, aliquota: 0.275, deduzir: 908.73 },
];

export const SEED_IRPF: IrpfTable[] = [
  {
    id: "irpf-2024-02",
    vigenciaInicio: "2024-02-01",
    descricao: "IRPF mensal — a partir de fev/2024 (Lei 14.848/2024)",
    fonte: "Receita Federal",
    faixas: [
      { ate: 2259.2, aliquota: 0, deduzir: 0 },
      { ate: 2826.65, aliquota: 0.075, deduzir: 169.44 },
      { ate: 3751.05, aliquota: 0.15, deduzir: 381.44 },
      { ate: 4664.68, aliquota: 0.225, deduzir: 662.77 },
      { ate: null, aliquota: 0.275, deduzir: 896.0 },
    ],
    dependente: 189.59,
    descontoSimplificado: 564.8,
    redutor: null,
    ativa: true,
    origem: "seed",
  },
  {
    id: "irpf-2025-05",
    vigenciaInicio: "2025-05-01",
    descricao: "IRPF mensal — a partir de mai/2025 (Lei 15.191/2025)",
    fonte: "Receita Federal",
    faixas: IRPF_2025_FAIXAS,
    dependente: 189.59,
    descontoSimplificado: 607.2,
    redutor: null,
    ativa: true,
    origem: "seed",
  },
  {
    id: "irpf-2026-01",
    vigenciaInicio: "2026-01-01",
    descricao: "IRPF mensal 2026 — tabela de mai/2025 + redutor da Lei 15.270/2025 (isenção até R$ 5.000)",
    fonte: "Lei 15.270/2025 — confira a IN da RFB vigente",
    faixas: IRPF_2025_FAIXAS,
    dependente: 189.59,
    descontoSimplificado: 607.2,
    // redução = 978,62 − 13,3145% × rendimento, para rendimentos entre 5.000,01 e 7.350,00; até 5.000 isenção total
    redutor: { isencaoAte: 5000, reducaoAte: 7350, a: 978.62, b: 0.133145 },
    ativa: true,
    origem: "seed",
  },
];

export const SEED_INSS: InssTable[] = [
  {
    id: "inss-2025",
    vigenciaInicio: "2025-01-01",
    descricao: "INSS 2025 — salário mínimo R$ 1.518,00; teto R$ 8.157,41",
    salarioMinimo: 1518.0,
    teto: 8157.41,
    aliquotaProLabore: 0.11,
    ativa: true,
    origem: "seed",
  },
  {
    id: "inss-2026",
    vigenciaInicio: "2026-01-01",
    descricao: "INSS 2026 — salário mínimo R$ 1.621,00; teto R$ 8.475,55 (confira a Portaria MPS/MF)",
    salarioMinimo: 1621.0,
    teto: 8475.55,
    aliquotaProLabore: 0.11,
    ativa: true,
    origem: "seed",
  },
];

const p = (irpj: number, csll: number, cofins: number, pis: number, cpp: number, iss: number): Record<TributoSimples, number> => ({
  irpj: irpj / 100, csll: csll / 100, cofins: cofins / 100, pis: pis / 100, cpp: cpp / 100, iss: iss / 100,
});

export const SEED_SIMPLES_ANEXOS: SimplesAnexoTable[] = [
  {
    id: "simples-iii-2018",
    anexo: "III",
    vigenciaInicio: "2018-01-01",
    descricao: "Simples Nacional — Anexo III (LC 123/2006, redação da LC 155/2016)",
    faixas: [
      { faixa: 1, ate: 180000, aliquotaNominal: 0.06, deduzir: 0, partilha: p(4, 3.5, 12.74, 2.76, 43.4, 33.5) },
      { faixa: 2, ate: 360000, aliquotaNominal: 0.112, deduzir: 9360, partilha: p(4, 3.5, 14.05, 3.05, 43.4, 32) },
      { faixa: 3, ate: 720000, aliquotaNominal: 0.135, deduzir: 17640, partilha: p(4, 3.5, 13.64, 2.96, 43.4, 32.5) },
      { faixa: 4, ate: 1800000, aliquotaNominal: 0.16, deduzir: 35640, partilha: p(4, 3.5, 13.64, 2.96, 43.4, 32.5) },
      { faixa: 5, ate: 3600000, aliquotaNominal: 0.21, deduzir: 125640, partilha: p(4, 3.5, 12.82, 2.78, 43.4, 33.5) },
      { faixa: 6, ate: 4800000, aliquotaNominal: 0.33, deduzir: 648000, partilha: p(35, 15, 16.03, 3.47, 30.5, 0) },
    ],
    ativa: true,
    origem: "seed",
  },
  {
    id: "simples-v-2018",
    anexo: "V",
    vigenciaInicio: "2018-01-01",
    descricao: "Simples Nacional — Anexo V (LC 123/2006, redação da LC 155/2016)",
    faixas: [
      { faixa: 1, ate: 180000, aliquotaNominal: 0.155, deduzir: 0, partilha: p(25, 15, 14.1, 3.05, 28.85, 14) },
      { faixa: 2, ate: 360000, aliquotaNominal: 0.18, deduzir: 4500, partilha: p(23, 15, 14.1, 3.05, 27.85, 17) },
      { faixa: 3, ate: 720000, aliquotaNominal: 0.195, deduzir: 9900, partilha: p(24, 15, 14.92, 3.23, 23.85, 19) },
      { faixa: 4, ate: 1800000, aliquotaNominal: 0.205, deduzir: 17100, partilha: p(21, 15, 15.74, 3.41, 23.85, 21) },
      { faixa: 5, ate: 3600000, aliquotaNominal: 0.23, deduzir: 62100, partilha: p(23, 12.5, 14.1, 3.05, 23.85, 23.5) },
      { faixa: 6, ate: 4800000, aliquotaNominal: 0.305, deduzir: 540000, partilha: p(35, 15.5, 16.44, 3.56, 29.5, 0) },
    ],
    ativa: true,
    origem: "seed",
  },
];

export const SEED_SIMPLES_PARAMS: SimplesParams[] = [
  {
    id: "simples-params-2018",
    vigenciaInicio: "2018-01-01",
    limiteAnual: 4800000,
    sublimiteIssIcms: 3600000,
    fatorRMinimo: 0.28,
    issTetoPercentual: 0.05,
    diaVencimentoDas: 20,
    ativa: true,
  },
];

export const SEED_MEI: MeiParams[] = [
  { id: "mei-2025", vigenciaInicio: "2025-01-01", limiteAnual: 81000, percentualInssSobreMinimo: 0.05, issFixo: 5, icmsFixo: 1, ativa: true },
];

export const SEED_PRESUMIDO: PresumidoParams[] = [
  {
    id: "presumido-base",
    vigenciaInicio: "2015-01-01",
    presuncaoServicos: 0.32,
    irpj: 0.15,
    irpjAdicional: 0.1,
    irpjAdicionalLimiteMensal: 20000,
    csll: 0.09,
    pis: 0.0065,
    cofins: 0.03,
    ativa: true,
  },
];

export const SEED_ISS: IssMunicipio[] = [
  {
    id: "iss-sp-capital",
    municipio: "São Paulo",
    uf: "SP",
    vigenciaInicio: "2020-01-01",
    aliquotaPadrao: 0.05,
    porCodigo: {
      "1.01": 0.029, "1.02": 0.029, "1.03": 0.029, "1.04": 0.029, "1.05": 0.029, "1.06": 0.029, "1.07": 0.029, "1.08": 0.029, "1.09": 0.029,
      "4.01": 0.02, "4.02": 0.02, "4.03": 0.02, "4.10": 0.02, "4.16": 0.02,
      "8.01": 0.02, "8.02": 0.02,
    },
    tfeAnualPadrao: 0,
    exigeComprovacaoExportacao: true,
    observacao:
      "Informática (item 1) 2,9%; saúde (item 4) e educação (item 8) 2%; demais 5%. Confira o código de serviço na NFS-e. " +
      "A Prefeitura de SP exige comprovação de que o resultado do serviço se verificou no exterior para a não incidência do ISS na exportação.",
    ativa: true,
  },
];

export const SEED_DIVIDENDOS: DividendosParams[] = [
  { id: "div-ate-2025", vigenciaInicio: "1996-01-01", limiteMensalIsento: null, aliquotaAcimaLimite: 0, ativa: true },
  { id: "div-2026", vigenciaInicio: "2026-01-01", limiteMensalIsento: 50000, aliquotaAcimaLimite: 0.1, ativa: true },
];

export const SEED_TAX_TABLES: TaxTables = {
  irpf: SEED_IRPF,
  inss: SEED_INSS,
  simplesAnexos: SEED_SIMPLES_ANEXOS,
  simplesParams: SEED_SIMPLES_PARAMS,
  mei: SEED_MEI,
  presumido: SEED_PRESUMIDO,
  iss: SEED_ISS,
  dividendos: SEED_DIVIDENDOS,
};

// ------------------------------------------------------------------
// Seleção por vigência
// ------------------------------------------------------------------

/** Retorna o registro ativo com a maior vigência <= data (ou o mais antigo se nenhum couber). */
export function pickByVigencia<T extends { vigenciaInicio: ISODate; ativa?: boolean }>(list: T[], data: ISODate): T | null {
  const ativos = list.filter((t) => t.ativa !== false).sort((a, b) => a.vigenciaInicio.localeCompare(b.vigenciaInicio));
  if (ativos.length === 0) return null;
  let chosen: T | null = null;
  for (const t of ativos) {
    if (t.vigenciaInicio <= data) chosen = t;
  }
  return chosen ?? ativos[0];
}

/** Data de referência de um mês (dia 1) para escolher a vigência. */
export function refDate(monthKey: string): ISODate {
  return `${monthKey}-01`;
}

/** Alerta de tabela possivelmente desatualizada: vigência mais recente com mais de N meses de idade. */
export function tabelaDesatualizada(list: { vigenciaInicio: ISODate; ativa?: boolean }[], hoje: ISODate, mesesTolerancia = 14): boolean {
  const last = pickByVigencia(list, hoje);
  if (!last) return true;
  const [y, m] = last.vigenciaInicio.split("-").map(Number);
  const [hy, hm] = hoje.split("-").map(Number);
  return (hy - y) * 12 + (hm - m) > mesesTolerancia;
}
