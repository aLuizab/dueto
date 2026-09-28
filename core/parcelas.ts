/**
 * Parsing de parcelas em descrições ("Óculos (06/10)", "IPTU SJA 1/4", "Balança (2/10) - out")
 * e geração de parcelas futuras.
 */
import { addMonths, dateInMonth, parseMonthName } from "./dates";
import type { MonthKey } from "./domain/types";

export interface ParsedDescription {
  /** descrição limpa, sem a marcação de parcela e sem o sufixo de cartão */
  descricao: string;
  parcelaAtual: number | null;
  parcelaTotal: number | null;
  /** sufixo entre parênteses interpretado como cartão/conta: "(Porto)", "(itau)", "(Nub)" */
  contaHint: string | null;
  /** mês citado no texto ("- out", "setembro") */
  mesHint: number | null;
  original: string;
}

const PARCELA_RE = /\(?\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\)?/;

const CONTA_ALIASES: Record<string, string> = {
  porto: "Porto", itau: "Itaú", itaú: "Itaú", nub: "Nubank", nubank: "Nubank", nu: "Nubank",
  inter: "Inter", c6: "C6", meli: "Mercado Pago", mp: "Mercado Pago", mercadopago: "Mercado Pago",
  latam: "Latam", ml: "Mercado Livre", pix: "Pix", xp: "XP", bb: "Banco do Brasil", caixa: "Caixa",
  santander: "Santander", bradesco: "Bradesco", picpay: "PicPay", "deb autom itaú": "Itaú (débito automático)",
};

export function normalizeContaHint(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (CONTA_ALIASES[k]) return CONTA_ALIASES[k];
  // "Porto/ML" → primeiro
  const first = k.split(/[\/,]/)[0].trim();
  if (CONTA_ALIASES[first]) return CONTA_ALIASES[first];
  return raw.trim();
}

export function parseDescription(text: string): ParsedDescription {
  const original = text;
  let s = text.replace(/​|￼/g, "").replace(/\s+/g, " ").trim();
  let parcelaAtual: number | null = null;
  let parcelaTotal: number | null = null;
  let contaHint: string | null = null;
  let mesHint: number | null = null;

  const pm = s.match(PARCELA_RE);
  if (pm) {
    const a = Number(pm[1]);
    const b = Number(pm[2]);
    // evita interpretar datas "15/08" como parcela: exige atual <= total e total <= 120
    if (a >= 1 && b >= 1 && a <= b && b <= 120) {
      parcelaAtual = a;
      parcelaTotal = b;
      s = s.replace(pm[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  // sufixo " - out" / " - set"
  const mm = s.match(/\s[-–]\s*([a-zçã]{3,9})\s*$/i);
  if (mm) {
    const m = parseMonthName(mm[1]);
    if (m) { mesHint = m; s = s.slice(0, mm.index).trim(); }
  }

  // parênteses restantes: "(Porto)", "(Nub)", "(porto )", "(Porto/ML)"
  const cm = s.match(/\(([^()]{1,30})\)\s*$/);
  if (cm) {
    const inner = cm[1].trim();
    if (inner && !/^\d/.test(inner)) {
      contaHint = normalizeContaHint(inner);
      s = s.slice(0, cm.index).trim();
    }
  }
  // "Gasolina(Porto)" sem espaço
  const cm2 = s.match(/^(.*\S)\(([^()]{1,30})\)$/);
  if (!contaHint && cm2 && !/^\d/.test(cm2[2].trim())) {
    contaHint = normalizeContaHint(cm2[2]);
    s = cm2[1].trim();
  }

  // mês no final sem hífen: "Software fev", "Sala outubro", "Aluguel sala maio"
  if (mesHint == null) {
    const parts = s.split(" ");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length >= 3) {
      const m = parseMonthName(last);
      if (m && /^[a-zçã]+$/i.test(last)) { mesHint = m; s = parts.slice(0, -1).join(" ").trim(); }
    }
  }

  s = s.replace(/\s+-\s*$/, "").replace(/\s{2,}/g, " ").trim();
  return { descricao: s, parcelaAtual, parcelaTotal, contaHint, mesHint, original };
}

export interface InstallmentPlan {
  competencia: MonthKey;
  vencimento: string;
  parcelaAtual: number;
  parcelaTotal: number;
  valor: number;
}

/**
 * Dada a parcela atual observada em `competencia`, gera as parcelas restantes (futuras).
 * Ex.: "(06/10)" em 2026-09 → 07/10 em 2026-10 ... 10/10 em 2027-01.
 */
export function generateRemainingInstallments(opts: {
  competencia: MonthKey;
  parcelaAtual: number;
  parcelaTotal: number;
  valor: number;
  diaVencimento?: number | null;
}): InstallmentPlan[] {
  const out: InstallmentPlan[] = [];
  const dia = opts.diaVencimento ?? 10;
  for (let p = opts.parcelaAtual + 1; p <= opts.parcelaTotal; p++) {
    const mk = addMonths(opts.competencia, p - opts.parcelaAtual);
    out.push({ competencia: mk, vencimento: dateInMonth(mk, dia), parcelaAtual: p, parcelaTotal: opts.parcelaTotal, valor: opts.valor });
  }
  return out;
}

/** Gera o plano completo de parcelas a partir da 1ª. */
export function generateInstallments(opts: { primeiraCompetencia: MonthKey; total: number; valorParcela: number; diaVencimento?: number | null }): InstallmentPlan[] {
  const out: InstallmentPlan[] = [];
  const dia = opts.diaVencimento ?? 10;
  for (let p = 1; p <= opts.total; p++) {
    const mk = addMonths(opts.primeiraCompetencia, p - 1);
    out.push({ competencia: mk, vencimento: dateInMonth(mk, dia), parcelaAtual: p, parcelaTotal: opts.total, valor: opts.valorParcela });
  }
  return out;
}

export function faltamParcelas(atual: number | null | undefined, total: number | null | undefined): number | null {
  if (!atual || !total) return null;
  return Math.max(0, total - atual);
}
