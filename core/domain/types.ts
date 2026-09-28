/**
 * Tipos de domínio do Dueto.
 * Tudo aqui é independente de UI e de banco: o core opera sobre estes objetos.
 */

export type EntityType = "PESSOA" | "AUTONOMO_PF" | "PJ" | "CASAL";
export type Currency = "BRL" | "USD" | "EUR";
export type TxStatus = "pendente" | "pago" | "conciliado";
export type TxKind = "receita" | "despesa" | "transferencia";
export type RegimeTributario = "SIMPLES_III" | "SIMPLES_V" | "MEI" | "PRESUMIDO";
export type SplitRule = "proporcional" | "igual" | "manual";

/** Chave de mês no formato YYYY-MM */
export type MonthKey = string;
/** Data ISO YYYY-MM-DD */
export type ISODate = string;

export interface Entity {
  id: string;
  tipo: EntityType;
  nome: string;
  documento?: string; // CPF/CNPJ opcional
  municipio?: string;
  uf?: string;
  regime?: RegimeTributario;
  config: EntityConfig;
  ativa: boolean;
}

export interface EntityConfig {
  /** PESSOA: renda estimada mensal, cor, etc. */
  rendaEstimada?: number;
  cor?: string;
  /** PJ */
  inicioAtividade?: MonthKey;
  fatura?: { moeda: Currency; exportacao: boolean };
  proLabore?: { modo: "fixo" | "percentual" | "minimoFatorR"; valor?: number; percentual?: number };
  issAliquota?: number;
  issCodigoServico?: string;
  tfeAnual?: number;
  mesTfe?: number;
  escrituracaoContabil?: boolean;
  reservaCaixaMensal?: number;
  /** true = ignorar o Fator R e fixar o anexo do regime configurado */
  fatorRManual?: boolean;
  /** método de cálculo do Fator R (default "anterior12" = regra legal) */
  fatorRMetodo?: "anterior12" | "corrente12" | "mensal";
  /** comparar com 28% após arredondar a 2 casas (default true, como o PGDAS-D) */
  fatorRArredondar?: boolean;
  /** AUTONOMO_PF */
  percentualInvestimento?: number; // ex.: 0.5
  inssPlano?: "normal20" | "simplificado11";
  inssBase?: number;
  inssValorMensal?: number;
  profissaoRegulamentada?: boolean;
  profissao?: string;
  aplicarRedutorCarneLeao?: boolean;
  /** CASAL: zerar o "restante do mês anterior" em vez de carregar */
  zerarRestante?: boolean;
  /** CASAL */
  splitRule?: SplitRule;
  splitManual?: Record<string, number>;
  /** dono (PESSOA) de uma entidade AUTONOMO_PF ou PJ */
  donoPessoaId?: string;
}

export interface Account {
  id: string;
  entityId: string;
  nome: string;
  tipo: "conta" | "cartao" | "carteira" | "investimento" | "dinheiro";
  instituicao?: string;
  moeda: Currency;
  /** cartão de crédito */
  diaFechamento?: number;
  diaVencimento?: number;
  ativa: boolean;
}

export interface Category {
  id: string;
  nome: string;
  parentId?: string | null;
  tipo: "receita" | "despesa";
  fixa: boolean;
  dedutivelLivroCaixa: boolean;
  /** conta da DRE onde esta categoria é somada (só entidades PJ) */
  contaDre?: DreConta | null;
  escopo?: EntityType[]; // em quais tipos de entidade aparece
  cor?: string;
  icone?: string;
}

export type DreConta =
  | "receita_exportacao"
  | "receita_nacional"
  | "deducao_das"
  | "deducao_iss"
  | "prolabore"
  | "salarios_encargos"
  | "contabilidade_taxas"
  | "software_internet"
  | "bancarias_cambio"
  | "outras_despesas"
  | "depreciacao"
  | "irpj_csll"
  | "lucros_distribuidos"
  | "reserva_caixa"
  | "nao_operacional";

export interface Transaction {
  id: string;
  entityId: string;
  accountId?: string | null;
  categoryId?: string | null;
  kind: TxKind;
  competencia: MonthKey;
  vencimento?: ISODate | null;
  pagamento?: ISODate | null;
  valor: number; // na moeda original
  moeda: Currency;
  cotacao?: number | null; // BRL por unidade da moeda
  valorBrl: number;
  descricao: string;
  status: TxStatus;
  parcelaAtual?: number | null;
  parcelaTotal?: number | null;
  grupoParcelamentoId?: string | null;
  recorrenciaId?: string | null;
  tags: string[];
  anexo?: string | null;
  /** expressão original digitada, ex.: "=120+150" */
  valorExpressao?: string | null;
  /** quem pagou: id de pessoa ou de conta/cartão */
  pagoPor?: string | null;
  /** para receitas PJ: id do cliente/plataforma */
  clientId?: string | null;
  /** para AUTONOMO_PF: paciente */
  patientId?: string | null;
  /** receita marcada como exportação de serviço */
  exportacao?: boolean;
  invoiceId?: string | null;
  /** lançamento gerado automaticamente por outro (espelho de pró-labore, etc.) */
  origemId?: string | null;
  /** IOF/spread pago no câmbio, em BRL */
  custoCambioBrl?: number | null;
  meta?: Record<string, unknown>;
}

export interface Recurrence {
  id: string;
  entityId: string;
  descricao: string;
  categoryId?: string | null;
  accountId?: string | null;
  kind: TxKind;
  periodicidade: "mensal" | "anual";
  diaVencimento: number;
  mesVencimento?: number | null; // anual
  valorPadrao: number;
  moeda: Currency;
  ativa: boolean;
  inicio: MonthKey;
  fim?: MonthKey | null;
}

export interface Invoice {
  id: string;
  entityId: string;
  numero: string;
  data: ISODate;
  clientId?: string | null;
  tomador: string;
  moeda: Currency;
  valor: number;
  cotacao?: number | null;
  valorBrl: number;
  tipo: "exportacao" | "nacional";
  status: "pendente" | "recebida" | "cancelada";
  codigoServico?: string | null;
  municipio?: string | null;
  transactionIds: string[];
}

export interface Client {
  id: string;
  entityId: string;
  nome: string;
  tipo: "plataforma" | "cliente_final";
  pais?: string;
  moeda: Currency;
}

export interface Patient {
  id: string;
  entityId: string;
  nome: string;
  valorConsulta?: number | null;
  ativo: boolean;
}

export interface Investment {
  id: string;
  entityId: string; // dono (PESSOA)
  nome: string;
  instituicao?: string;
  tipo: "previdencia" | "cdb" | "cofrinho" | "conta_remunerada" | "acoes" | "fii" | "cripto" | "exterior" | "tesouro" | "outro";
  indexador?: string;
  ativo: boolean;
}

export interface InvestmentSnapshot {
  id: string;
  investmentId: string;
  data: ISODate;
  saldo: number;
}

export interface Contribution {
  id: string;
  investmentId: string;
  transactionId?: string | null;
  data: ISODate;
  valor: number;
}

export interface Payroll {
  id: string;
  entityId: string; // PJ
  pessoaId: string; // sócio
  competencia: MonthKey;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
  darfValor: number;
  darfVencimento: ISODate;
  darfPago: boolean;
  transactionIds: string[];
}

export interface Goal {
  id: string;
  entityId: string;
  nome: string;
  valorAlvo: number;
  prazo?: ISODate | null;
  valorAtual: number;
  investmentId?: string | null;
}

export interface Budget {
  id: string;
  entityId: string;
  categoryId: string;
  competencia: MonthKey | "*";
  valorMeta: number;
}

export interface Setting {
  key: string;
  value: unknown;
}
