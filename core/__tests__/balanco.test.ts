import { describe, expect, it } from "vitest";
import { mediaUltimos, projetarBalanco } from "../balanco";

describe("balanço projetado", () => {
  it("acumula caixa e detecta retirada acima do disponível", () => {
    const r = projetarBalanco(10000, [
      { mes: "2026-10", realizado: false, receita: 20000, impostos: 2000, despesas: 3000, proLaboreBruto: 5000, reserva: 1000, retirada: 5000 },
      { mes: "2026-11", realizado: false, receita: 20000, impostos: 2000, despesas: 3000, proLaboreBruto: 5000, reserva: 1000, retirada: 30000 },
    ], { caixaMinimo: 5000 });
    expect(r.linhas[0].lucro).toBe(9000);
    expect(r.linhas[0].caixaFinal).toBe(14000);
    expect(r.linhas[0].retiradaMaxima).toBe(14000); // 10000 + 9000 − 5000
    expect(r.linhas[0].alerta).toBeNull();
    expect(r.linhas[1].caixaFinal).toBe(-7000);
    expect(r.linhas[1].alerta).toContain("Caixa abaixo do mínimo");
    expect(r.totais.lucro).toBe(18000);
    expect(r.menorCaixa).toBe(-7000);
  });
  it("média dos últimos meses ignora zeros", () => {
    expect(mediaUltimos([0, 10000, 20000, 0, 30000], 2)).toBe(25000);
    expect(mediaUltimos([], 3)).toBe(0);
  });
});
