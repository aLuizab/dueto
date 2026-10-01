/**
 * Categorias iniciais (seed). IDs são slugs estáveis para que regras de categorização
 * e migrações possam referenciá-las. Nada aqui é específico de uma pessoa.
 */
import type { Category, DreConta, EntityType } from "../domain/types";

type Seed = { id: string; nome: string; parent?: string; tipo?: "receita" | "despesa"; fixa?: boolean; dre?: DreConta; escopo: EntityType[]; cor?: string; icone?: string };

const CASAL: EntityType[] = ["CASAL", "PESSOA"];
const PJ: EntityType[] = ["PJ"];

const S: Seed[] = [
  // ---------- receitas (casal) ----------
  { id: "rec-salario", nome: "Salário / pró-labore", tipo: "receita", escopo: CASAL, icone: "wallet" },
  { id: "rec-lucros", nome: "Distribuição de lucros", tipo: "receita", escopo: CASAL, icone: "coins" },
  { id: "rec-restante", nome: "Restante do mês anterior", tipo: "receita", escopo: CASAL, icone: "rotate-ccw" },
  { id: "rec-outras", nome: "Outras receitas", tipo: "receita", escopo: CASAL, icone: "plus-circle" },

  // ---------- despesas (casal) ----------
  { id: "moradia", nome: "Moradia", fixa: true, escopo: CASAL, cor: "#6366f1", icone: "home" },
  { id: "moradia-aluguel", nome: "Aluguel", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-energia", nome: "Energia", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-agua", nome: "Água", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-internet", nome: "Internet", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-iptu", nome: "IPTU", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-seguranca", nome: "Segurança", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-faxina", nome: "Faxina / serviços domésticos", parent: "moradia", fixa: true, escopo: CASAL },
  { id: "moradia-manutencao", nome: "Manutenção / reforma", parent: "moradia", fixa: false, escopo: CASAL },
  { id: "moradia-outros", nome: "Outros de moradia", parent: "moradia", fixa: false, escopo: CASAL },

  { id: "transporte", nome: "Transporte", fixa: false, escopo: CASAL, cor: "#0ea5e9", icone: "car" },
  { id: "transporte-financiamento", nome: "Financiamento do carro", parent: "transporte", fixa: true, escopo: CASAL },
  { id: "transporte-seguro", nome: "Seguro do carro", parent: "transporte", fixa: true, escopo: CASAL },
  { id: "transporte-ipva", nome: "IPVA / revisão", parent: "transporte", fixa: true, escopo: CASAL },
  { id: "transporte-combustivel", nome: "Gasolina", parent: "transporte", fixa: false, escopo: CASAL },
  { id: "transporte-pedagio", nome: "Pedágio", parent: "transporte", fixa: false, escopo: CASAL },
  { id: "transporte-app", nome: "Uber / apps", parent: "transporte", fixa: false, escopo: CASAL },
  { id: "transporte-multas", nome: "Multas", parent: "transporte", fixa: false, escopo: CASAL },

  { id: "saude", nome: "Saúde", fixa: false, escopo: CASAL, cor: "#ef4444", icone: "heart-pulse" },
  { id: "saude-remedios", nome: "Remédios", parent: "saude", fixa: false, escopo: CASAL },
  { id: "saude-medicacao-continua", nome: "Medicação de uso contínuo", parent: "saude", fixa: true, escopo: CASAL },
  { id: "saude-psicologo", nome: "Psicólogo / terapia", parent: "saude", fixa: true, escopo: CASAL },
  { id: "saude-academia", nome: "Academia", parent: "saude", fixa: true, escopo: CASAL },
  { id: "saude-consultas", nome: "Consultas / exames", parent: "saude", fixa: false, escopo: CASAL },
  { id: "saude-seguro-vida", nome: "Seguro de vida / plano", parent: "saude", fixa: true, escopo: CASAL },

  { id: "alimentacao", nome: "Alimentação", fixa: false, escopo: CASAL, cor: "#f59e0b", icone: "utensils" },
  { id: "alimentacao-mercado", nome: "Mercado", parent: "alimentacao", fixa: false, escopo: CASAL },
  { id: "alimentacao-padaria", nome: "Padaria", parent: "alimentacao", fixa: false, escopo: CASAL },
  { id: "alimentacao-delivery", nome: "Delivery", parent: "alimentacao", fixa: false, escopo: CASAL },
  { id: "alimentacao-fora", nome: "Comer fora", parent: "alimentacao", fixa: false, escopo: CASAL },

  { id: "educacao", nome: "Educação", fixa: true, escopo: CASAL, cor: "#8b5cf6", icone: "graduation-cap" },
  { id: "educacao-faculdade", nome: "Faculdade", parent: "educacao", fixa: true, escopo: CASAL },
  { id: "educacao-cursos", nome: "Cursos", parent: "educacao", fixa: false, escopo: CASAL },

  { id: "pets", nome: "Pets", fixa: false, escopo: CASAL, cor: "#84cc16", icone: "paw-print" },
  { id: "cuidados", nome: "Cuidados pessoais", fixa: false, escopo: CASAL, cor: "#ec4899", icone: "sparkles" },
  { id: "presentes", nome: "Presentes", fixa: false, escopo: CASAL, cor: "#f472b6", icone: "gift" },
  { id: "dividas", nome: "Dívidas / parcelamentos", fixa: true, escopo: CASAL, cor: "#78716c", icone: "landmark" },
  { id: "cartao", nome: "Fatura de cartão de crédito", fixa: false, escopo: CASAL, cor: "#64748b", icone: "credit-card" },
  { id: "mesada", nome: "Mesada / transferências", fixa: true, escopo: CASAL, cor: "#14b8a6", icone: "arrow-left-right" },
  { id: "investimentos", nome: "Investimentos (aporte)", fixa: false, escopo: CASAL, cor: "#10b981", icone: "trending-up" },
  { id: "lazer", nome: "Lazer / eventos", fixa: false, escopo: CASAL, cor: "#f97316", icone: "party-popper" },
  { id: "lazer-streaming", nome: "Streaming / assinaturas", parent: "lazer", fixa: true, escopo: CASAL },
  { id: "lazer-viagem", nome: "Viagens", parent: "lazer", fixa: false, escopo: CASAL },
  { id: "vestuario", nome: "Vestuário", fixa: false, escopo: CASAL, cor: "#a855f7", icone: "shirt" },
  { id: "casa-compras", nome: "Casa / compras", fixa: false, escopo: CASAL, cor: "#22d3ee", icone: "shopping-bag" },
  { id: "outros", nome: "Outros", fixa: false, escopo: CASAL, cor: "#9ca3af", icone: "circle-dashed" },

  // ---------- PJ ----------
  { id: "pj-rec-exportacao", nome: "Receita de exportação de serviços", tipo: "receita", dre: "receita_exportacao", escopo: PJ },
  { id: "pj-rec-nacional", nome: "Receita nacional de serviços", tipo: "receita", dre: "receita_nacional", escopo: PJ },
  { id: "pj-rec-financeira", nome: "Receita financeira", tipo: "receita", dre: "nao_operacional", escopo: PJ },
  { id: "pj-das", nome: "DAS (Simples Nacional)", fixa: true, dre: "deducao_das", escopo: PJ },
  { id: "pj-iss", nome: "ISS (fora do Simples)", fixa: false, dre: "deducao_iss", escopo: PJ },
  { id: "pj-tributos-federais", nome: "IRPJ/CSLL/PIS/COFINS (Lucro Presumido)", fixa: true, dre: "deducao_das", escopo: PJ },
  { id: "pj-outros-impostos", nome: "Outros impostos e taxas", fixa: false, dre: "deducao_das", escopo: PJ },
  { id: "pj-prolabore", nome: "Pró-labore (bruto)", fixa: true, dre: "prolabore", escopo: PJ },
  { id: "pj-darf-prolabore", nome: "DARF pró-labore (INSS + IRRF)", fixa: true, dre: "prolabore", escopo: PJ },
  { id: "pj-salarios", nome: "Salários / estagiário + encargos", fixa: true, dre: "salarios_encargos", escopo: PJ },
  { id: "pj-contabilidade", nome: "Contabilidade", fixa: true, dre: "contabilidade_taxas", escopo: PJ },
  { id: "pj-taxas", nome: "TFE / taxas / parcelamentos", fixa: false, dre: "contabilidade_taxas", escopo: PJ },
  { id: "pj-software", nome: "Software / IA / ferramentas", fixa: true, dre: "software_internet", escopo: PJ },
  { id: "pj-internet", nome: "Internet / telefonia", fixa: true, dre: "software_internet", escopo: PJ },
  { id: "pj-coworking", nome: "Coworking / escritório", fixa: true, dre: "outras_despesas", escopo: PJ },
  { id: "pj-cambio", nome: "Despesas bancárias / câmbio (IOF, spread)", fixa: false, dre: "bancarias_cambio", escopo: PJ },
  { id: "pj-outras", nome: "Outras despesas operacionais", fixa: false, dre: "outras_despesas", escopo: PJ },
  { id: "pj-depreciacao", nome: "Depreciação", fixa: false, dre: "depreciacao", escopo: PJ },
  { id: "pj-lucros", nome: "Distribuição de lucros", fixa: false, dre: "lucros_distribuidos", escopo: PJ },
  { id: "pj-reserva", nome: "Reserva de caixa da empresa", fixa: true, dre: "reserva_caixa", escopo: PJ },
];

export const SEED_CATEGORIES: Category[] = S.map((s) => ({
  id: s.id,
  nome: s.nome,
  parentId: s.parent ?? null,
  tipo: s.tipo ?? "despesa",
  fixa: s.fixa ?? false,
  contaDre: s.dre ?? null,
  escopo: s.escopo,
  cor: s.cor,
  icone: s.icone,
}));

export function categoriaNome(id: string | null | undefined, cats: Category[] = SEED_CATEGORIES): string {
  if (!id) return "Sem categoria";
  const c = cats.find((x) => x.id === id);
  if (!c) return id;
  if (c.parentId) {
    const p = cats.find((x) => x.id === c.parentId);
    return p ? `${p.nome} › ${c.nome}` : c.nome;
  }
  return c.nome;
}

export function categoriaRaiz(id: string | null | undefined, cats: Category[] = SEED_CATEGORIES): Category | null {
  if (!id) return null;
  const c = cats.find((x) => x.id === id);
  if (!c) return null;
  if (c.parentId) return cats.find((x) => x.id === c.parentId) ?? c;
  return c;
}
