/**
 * Investimentos: variação = saldo atual − (saldo anterior + aportes no período), rentabilidade e alocação.
 */
import type { Contribution, Investment, InvestmentSnapshot } from "./domain/types";
import { round2, round4 } from "./money";

export interface EvolucaoProduto {
  investmentId: string;
  nome: string;
  dono: string;
  tipo: Investment["tipo"];
  saldoAnterior: number | null;
  saldoAtual: number | null;
  aportes: number;
  variacao: number | null;
  rentabilidade: number | null; // variação / (saldoAnterior + aportes)
  dataAnterior: string | null;
  dataAtual: string | null;
}

export function evolucaoProduto(inv: Investment, snaps: InvestmentSnapshot[], contribs: Contribution[], ate: string, desde?: string): EvolucaoProduto {
  const s = snaps.filter((x) => x.investmentId === inv.id && x.data <= ate).sort((a, b) => a.data.localeCompare(b.data));
  const atual = s[s.length - 1] ?? null;
  let anterior: InvestmentSnapshot | null = null;
  if (atual) {
    const antes = s.filter((x) => x.data < atual.data && (!desde || x.data >= desde));
    anterior = antes[antes.length - 1] ?? (desde ? null : s.filter((x) => x.data < atual.data).slice(-1)[0] ?? null);
  }
  const de = anterior?.data ?? desde ?? "0000-00-00";
  const aportes = round2(contribs.filter((c) => c.investmentId === inv.id && c.data > de && c.data <= (atual?.data ?? ate)).reduce((a, c) => a + c.valor, 0));
  let variacao: number | null = null;
  let rent: number | null = null;
  if (atual && anterior) {
    variacao = round2(atual.saldo - (anterior.saldo + aportes));
    const base = anterior.saldo + aportes;
    rent = base > 0 ? round4(variacao / base) : null;
  }
  return {
    investmentId: inv.id, nome: inv.nome, dono: inv.entityId, tipo: inv.tipo,
    saldoAnterior: anterior?.saldo ?? null, saldoAtual: atual?.saldo ?? null, aportes, variacao, rentabilidade: rent,
    dataAnterior: anterior?.data ?? null, dataAtual: atual?.data ?? null,
  };
}

export function totalPorDono(evs: EvolucaoProduto[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of evs) out[e.dono] = round2((out[e.dono] ?? 0) + (e.saldoAtual ?? 0));
  return out;
}

export function alocacaoPorTipo(evs: EvolucaoProduto[]): { tipo: string; valor: number; percentual: number }[] {
  const tot = evs.reduce((a, e) => a + (e.saldoAtual ?? 0), 0);
  const m = new Map<string, number>();
  for (const e of evs) m.set(e.tipo, (m.get(e.tipo) ?? 0) + (e.saldoAtual ?? 0));
  return [...m.entries()].map(([tipo, valor]) => ({ tipo, valor: round2(valor), percentual: tot > 0 ? round4(valor / tot) : 0 })).sort((a, b) => b.valor - a.valor);
}

/** Série mensal de patrimônio: último snapshot de cada produto em cada mês. */
export function serieMensalPatrimonio(invs: Investment[], snaps: InvestmentSnapshot[], meses: string[]): { mes: string; total: number; porDono: Record<string, number> }[] {
  return meses.map((mes) => {
    let total = 0;
    const porDono: Record<string, number> = {};
    for (const inv of invs) {
      const s = snaps.filter((x) => x.investmentId === inv.id && x.data.slice(0, 7) <= mes).sort((a, b) => a.data.localeCompare(b.data));
      const last = s[s.length - 1];
      if (!last) continue;
      total += last.saldo;
      porDono[inv.entityId] = round2((porDono[inv.entityId] ?? 0) + last.saldo);
    }
    return { mes, total: round2(total), porDono };
  });
}

export function tipoPorNome(nome: string): Investment["tipo"] {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/previd/.test(n)) return "previdencia";
  if (/cofrinho|caixinha/.test(n)) return "cofrinho";
  if (/mercado pago|\bmp\b|nubank|conta remunerada|picpay|rdb/.test(n)) return "conta_remunerada";
  if (/cdb|lci|lca/.test(n)) return "cdb";
  if (/tesouro|selic|ipca/.test(n)) return "tesouro";
  if (/fii|fundo imob/.test(n)) return "fii";
  if (/acao|acoes|etf|bova/.test(n)) return "acoes";
  if (/cripto|bitcoin|btc|eth/.test(n)) return "cripto";
  if (/exterior|usd|dolar|avenue|nomad|wise/.test(n)) return "exterior";
  return "outro";
}
