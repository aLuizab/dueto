import { describe, expect, it } from "vitest";
import { resumoMensalCasal } from "../couple";
import { calcularDre } from "../dre";
import type { Entity, Transaction } from "../domain/types";
import { SEED_CATEGORIES } from "../seed/categories";
import { categorize } from "../categorize";

function gerar(n: number): Transaction[] {
  const out: Transaction[] = [];
  const cats = ["moradia-aluguel", "alimentacao-mercado", "transporte-combustivel", "saude-remedios", "lazer", "pj-software", "pj-rec-exportacao"];
  for (let i = 0; i < n; i++) {
    const m = 1 + (i % 12);
    const y = 2020 + Math.floor((i / 12) % 7);
    out.push({
      id: `tx${i}`, entityId: i % 5 === 0 ? "pj" : "casal", accountId: null, categoryId: cats[i % cats.length], kind: i % 7 === 6 ? "receita" : "despesa",
      competencia: `${y}-${String(m).padStart(2, "0")}`, vencimento: `${y}-${String(m).padStart(2, "0")}-10`, pagamento: null, valor: 10 + (i % 500), moeda: "BRL", cotacao: null, valorBrl: 10 + (i % 500),
      descricao: `Lançamento ${i} mercado`, status: i % 3 ? "pago" : "pendente", tags: [], exportacao: i % 7 === 6,
    });
  }
  return out;
}

describe("desempenho com 50 mil lançamentos", () => {
  const txs = gerar(50_000);
  const pessoas: Entity[] = [{ id: "p1", tipo: "PESSOA", nome: "A", config: {}, ativa: true }];
  it("resumo mensal do casal em < 200 ms", () => {
    const t0 = performance.now();
    const r = resumoMensalCasal({ competencia: "2024-05", transactions: txs, categories: SEED_CATEGORIES, pessoas, casalId: "casal", carregarRestante: true, hoje: "2026-09-28" });
    expect(r.totalDespesas).toBeGreaterThan(0);
    expect(performance.now() - t0).toBeLessThan(200);
  });
  it("DRE anual em < 200 ms", () => {
    const t0 = performance.now();
    const d = calcularDre({ transactions: txs.filter((t) => t.entityId === "pj"), categories: SEED_CATEGORIES, de: "2024-01", ate: "2024-12" });
    expect(d.linhas.length).toBeGreaterThan(5);
    expect(performance.now() - t0).toBeLessThan(200);
  });
  it("categoriza 5 mil descrições em < 1 s", () => {
    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) categorize(txs[i].descricao, "CASAL");
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
