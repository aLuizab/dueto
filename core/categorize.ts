/**
 * Categorização automática por regras de palavras-chave, com aprendizado a partir
 * das correções do usuário (regras aprendidas têm prioridade sobre as regras-semente).
 */
import type { EntityType } from "./domain/types";

export interface CategRule {
  id: string;
  /** substring (sem acento, minúscula) ou regex */
  pattern: string;
  regex?: boolean;
  categoryId: string;
  escopo?: EntityType[];
  /** regras aprendidas do usuário */
  aprendida?: boolean;
  prioridade?: number; // maior vence
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const C: EntityType[] = ["CASAL", "PESSOA"];
const PF: EntityType[] = ["AUTONOMO_PF"];
const PJ: EntityType[] = ["PJ"];

let n = 0;
const r = (pattern: string, categoryId: string, escopo: EntityType[], prioridade = 0, regex = false): CategRule => ({ id: `seed-${++n}`, pattern, categoryId, escopo, prioridade, regex });

export const SEED_RULES: CategRule[] = [
  // casal — específicas primeiro (prioridade maior)
  r("financiamento carro", "transporte-financiamento", C, 5),
  r("seguro carro", "transporte-seguro", C, 5),
  r("seguro vida", "saude-seguro-vida", C, 5),
  r("ipva", "transporte-ipva", C, 5),
  r("iptu", "moradia-iptu", C, 5),
  r("aluguel sala", "pf-aluguel-sala", PF, 6),
  r("aluguel", "moradia-aluguel", C, 4),
  r("energia", "moradia-energia", C),
  r("luz", "moradia-energia", C),
  r("^agua$", "moradia-agua", C, 3, true),
  r("^agua ", "moradia-agua", C, 3, true),
  r("contas casa", "moradia-outros", C, 4),
  r("internet", "moradia-internet", C),
  r("vivo", "moradia-internet", C),
  r("claro", "moradia-internet", C),
  r("seguranca", "moradia-seguranca", C),
  r("faxina", "moradia-faxina", C),
  r("instalacao", "moradia-manutencao", C),
  r("reforma", "moradia-manutencao", C),
  r("gasolina", "transporte-combustivel", C),
  r("combustivel", "transporte-combustivel", C),
  r("pedagio", "transporte-pedagio", C),
  r("uber", "transporte-app", C),
  r("99", "transporte-app", C, -1),
  r("transporte", "transporte-app", C),
  r("multa", "transporte-multas", C),
  r("remedio", "saude-remedios", C),
  r("farmacia", "saude-remedios", C),
  r("drogaria", "saude-remedios", C),
  r("^psi", "saude-psicologo", C, 3, true),
  r("psicolog", "saude-psicologo", C),
  r("terapia", "saude-psicologo", C),
  r("academia", "saude-academia", C),
  r("consulta", "saude-consultas", C),
  r("dentista", "saude-consultas", C),
  r("mercado", "alimentacao-mercado", C),
  r("supermercado", "alimentacao-mercado", C),
  r("padaria", "alimentacao-padaria", C),
  r("delivery", "alimentacao-delivery", C),
  r("ifood", "alimentacao-delivery", C),
  r("jantar", "alimentacao-fora", C),
  r("almoco", "alimentacao-fora", C),
  r("comer fora", "alimentacao-fora", C),
  r("japones", "alimentacao-fora", C),
  r("lanche", "alimentacao-fora", C),
  r("hot dog", "alimentacao-fora", C),
  r("acai", "alimentacao-fora", C),
  r("donuts", "alimentacao-fora", C),
  r("marmita", "alimentacao-fora", C),
  r("pizza", "alimentacao-fora", C),
  r("restaurante", "alimentacao-fora", C),
  r("cafe", "alimentacao-fora", C),
  r("bolo", "alimentacao-fora", C),
  r("alimentacao", "alimentacao-fora", C),
  r("faculdade", "educacao-faculdade", C),
  r("universidade", "educacao-faculdade", C),
  r("alura", "educacao-cursos", C),
  r("curso", "educacao-cursos", C),
  r("pets", "pets", C),
  r("pet ", "pets", C),
  r("racao", "pets", C),
  r("banho e tosa", "pets", C),
  r("veterinar", "pets", C),
  r("unha", "cuidados", C),
  r("salao", "cuidados", C),
  r("cabelo", "cuidados", C),
  r("hig pessoal", "cuidados", C),
  r("higiene", "cuidados", C),
  r("whey", "cuidados", C),
  r("presente", "presentes", C),
  r("natal", "presentes", C),
  r("divida", "dividas", C),
  r("emprestimo", "dividas", C),
  r("mesada", "mesada", C),
  r("investimento", "investimentos", C, 6),
  r("aporte", "investimentos", C, 6),
  r("cartao", "cartao", C, 2),
  r("fatura", "cartao", C, 2),
  r("streaming", "lazer-streaming", C),
  r("netflix", "lazer-streaming", C),
  r("spotify", "lazer-streaming", C),
  r("evento", "lazer", C),
  r("show", "lazer", C),
  r("viagem", "lazer-viagem", C),
  r("hotel", "lazer-viagem", C),
  r("passagem", "lazer-viagem", C),
  r("calca", "vestuario", C),
  r("roupa", "vestuario", C),
  r("c&a", "vestuario", C),
  r("renner", "vestuario", C),
  r("oculos", "saude-consultas", C),
  r("loja", "casa-compras", C),
  r("shopee", "casa-compras", C),
  r("meli", "casa-compras", C),
  r("mercado livre", "casa-compras", C, 3),
  r("fogao", "casa-compras", C),

  // autônomo PF (consultório)
  r("webdiet", "pf-software", PF),
  r("software", "pf-software", PF),
  r("sala", "pf-aluguel-sala", PF),
  r("crn", "pf-conselho", PF),
  r("crp", "pf-conselho", PF),
  r("conselho", "pf-conselho", PF),
  r("anuidade", "pf-conselho", PF),
  r("balanca", "pf-materiais", PF),
  r("colher", "pf-materiais", PF),
  r("muffin", "pf-materiais", PF),
  r("papa tudo", "pf-materiais", PF),
  r("pratinho", "pf-materiais", PF),
  r("chaves", "pf-materiais", PF),
  r("material", "pf-materiais", PF),
  r("evento", "pf-cursos", PF),
  r("interclinic", "pf-cursos", PF),
  r("psta", "pf-cursos", PF),
  r("curso", "pf-cursos", PF),
  r("congresso", "pf-cursos", PF),
  r("inss", "pf-inss", PF),
  r("gps", "pf-inss", PF),
  r("carne", "pf-carne-leao", PF),
  r("darf", "pf-carne-leao", PF),
  r("carona", "pf-transporte", PF),
  r("uber", "pf-transporte", PF),
  r("troco", "pf-outras", PF),

  // PJ
  r("das", "pj-das", PJ, 3),
  r("simples", "pj-das", PJ, 3),
  r("darf", "pj-darf-prolabore", PJ, 3),
  r("inss", "pj-darf-prolabore", PJ),
  r("pro-labore", "pj-prolabore", PJ, 4),
  r("pro labore", "pj-prolabore", PJ, 4),
  r("prolabore", "pj-prolabore", PJ, 4),
  r("retirada", "pj-lucros", PJ, 4),
  r("lucro", "pj-lucros", PJ, 4),
  r("dividendo", "pj-lucros", PJ, 4),
  r("caixa empresa", "pj-reserva", PJ, 5),
  r("reserva", "pj-reserva", PJ, 4),
  r("contabilidade", "pj-contabilidade", PJ, 3),
  r("contador", "pj-contabilidade", PJ, 3),
  r("agilize", "pj-contabilidade", PJ, 3),
  r("contabilizei", "pj-contabilidade", PJ, 3),
  r("estagiari", "pj-salarios", PJ, 3),
  r("salario", "pj-salarios", PJ, 3),
  r("funcionari", "pj-salarios", PJ, 3),
  r("fgts", "pj-salarios", PJ, 3),
  r("internet", "pj-internet", PJ),
  r("telefon", "pj-internet", PJ),
  r("claude", "pj-software", PJ),
  r("openai", "pj-software", PJ),
  r("chatgpt", "pj-software", PJ),
  r("github", "pj-software", PJ),
  r("software", "pj-software", PJ),
  r("saas", "pj-software", PJ),
  r("cartao", "pj-software", PJ, -1),
  r("damsp", "pj-taxas", PJ, 3),
  r("tfe", "pj-taxas", PJ, 3),
  r("taxa", "pj-taxas", PJ),
  r("parcelamento", "pj-taxas", PJ, 3),
  r("coworking", "pj-coworking", PJ),
  r("iof", "pj-cambio", PJ),
  r("cambio", "pj-cambio", PJ),
  r("spread", "pj-cambio", PJ),
  r("tarifa", "pj-cambio", PJ),
  r("wise", "pj-cambio", PJ),
  r("remessa", "pj-cambio", PJ),
];

export interface CategorizeResult {
  categoryId: string | null;
  ruleId: string | null;
  confianca: "alta" | "media" | "baixa";
}

export function categorize(descricao: string, escopo: EntityType, rules: CategRule[] = SEED_RULES): CategorizeResult {
  const text = normalizeText(descricao);
  if (!text) return { categoryId: null, ruleId: null, confianca: "baixa" };
  let best: { rule: CategRule; score: number } | null = null;
  for (const rule of rules) {
    if (rule.escopo && !rule.escopo.includes(escopo)) continue;
    let hit = false;
    if (rule.regex) {
      try { hit = new RegExp(rule.pattern, "i").test(text); } catch { hit = false; }
    } else {
      const p = normalizeText(rule.pattern);
      // palavra inteira ou prefixo de palavra (evita "das" casar com "dividas")
      hit = new RegExp(`(^|[^a-z0-9])${escapeRe(p)}`, "i").test(text);
    }
    if (!hit) continue;
    const score = (rule.prioridade ?? 0) + (rule.aprendida ? 100 : 0) + Math.min(rule.pattern.length, 20) / 100;
    if (!best || score > best.score) best = { rule, score };
  }
  if (!best) return { categoryId: null, ruleId: null, confianca: "baixa" };
  return { categoryId: best.rule.categoryId, ruleId: best.rule.id, confianca: best.rule.aprendida ? "alta" : best.score >= 3 ? "alta" : "media" };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cria uma regra aprendida a partir de uma correção do usuário. */
export function learnRule(descricao: string, categoryId: string, escopo: EntityType): CategRule {
  const text = normalizeText(descricao).replace(/\(.*?\)/g, "").replace(/\d+\s*\/\s*\d+/g, "").trim();
  return { id: `learn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, pattern: text, categoryId, escopo: [escopo], aprendida: true, prioridade: 50 };
}
