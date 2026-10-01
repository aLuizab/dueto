import { describe, expect, it } from "vitest";
import { faltamParcelas, generateRemainingInstallments, parseDescription } from "../parcelas";

describe("parseDescription", () => {
  it("parcela entre parênteses", () => {
    const p = parseDescription("Oculos Ana (06/10)");
    expect(p.descricao).toBe("Oculos Ana");
    expect(p.parcelaAtual).toBe(6);
    expect(p.parcelaTotal).toBe(10);
    expect(p.contaHint).toBeNull();
  });
  it("parcela sem parênteses", () => {
    const p = parseDescription("IPTU SJA 1/4");
    expect(p).toMatchObject({ descricao: "IPTU SJA", parcelaAtual: 1, parcelaTotal: 4 });
  });
  it("financiamento com espaços duplos", () => {
    const p = parseDescription("Financiamento Carro  (04/48)");
    expect(p).toMatchObject({ descricao: "Financiamento Carro", parcelaAtual: 4, parcelaTotal: 48 });
  });
  it("cartão entre parênteses", () => {
    expect(parseDescription("Mercado (Porto)")).toMatchObject({ descricao: "Mercado", contaHint: "Porto" });
    expect(parseDescription("Gasolina(Porto)")).toMatchObject({ descricao: "Gasolina", contaHint: "Porto" });
    expect(parseDescription("Academia (itau)")).toMatchObject({ descricao: "Academia", contaHint: "Itaú" });
    expect(parseDescription("Farmacia (Nub)")).toMatchObject({ descricao: "Farmacia", contaHint: "Nubank" });
    expect(parseDescription("Uber ￼(porto )")).toMatchObject({ descricao: "Uber", contaHint: "Porto" });
    expect(parseDescription("Presente dia dos Pais (Porto/ML)")).toMatchObject({ contaHint: "Porto" });
  });
  it("parcela + cartão", () => {
    const p = parseDescription("Whey  1/2 (porto)");
    expect(p).toMatchObject({ descricao: "Whey", parcelaAtual: 1, parcelaTotal: 2, contaHint: "Porto" });
  });
  it("mês no sufixo", () => {
    expect(parseDescription("Balança (6/10) - out")).toMatchObject({ descricao: "Balança", parcelaAtual: 6, parcelaTotal: 10, mesHint: 10 });
    expect(parseDescription("Pratinho 2/12 - out")).toMatchObject({ descricao: "Pratinho", parcelaAtual: 2, parcelaTotal: 12, mesHint: 10 });
    expect(parseDescription("Software fev")).toMatchObject({ descricao: "Software", mesHint: 2 });
    expect(parseDescription("Aluguel sala maio")).toMatchObject({ descricao: "Aluguel sala", mesHint: 5 });
    expect(parseDescription("Sala setembro")).toMatchObject({ descricao: "Sala", mesHint: 9 });
  });
  it("não confunde data com parcela", () => {
    const p = parseDescription("Salao 15/08 (Porto)");
    expect(p.parcelaAtual).toBeNull();
    expect(p.contaHint).toBe("Porto");
  });
  it("nome com parcela (com e sem espaço)", () => {
    expect(parseDescription("Cliente A (1/3)")).toMatchObject({ descricao: "Cliente A", parcelaAtual: 1, parcelaTotal: 3 });
    expect(parseDescription("ClienteB(3/4)")).toMatchObject({ descricao: "ClienteB", parcelaAtual: 3, parcelaTotal: 4 });
  });
});

describe("generateRemainingInstallments", () => {
  it("gera parcelas futuras a partir da atual", () => {
    const plan = generateRemainingInstallments({ competencia: "2026-09", parcelaAtual: 6, parcelaTotal: 10, valor: 87, diaVencimento: 10 });
    expect(plan).toHaveLength(4);
    expect(plan[0]).toMatchObject({ competencia: "2026-10", parcelaAtual: 7, vencimento: "2026-10-10" });
    expect(plan[3]).toMatchObject({ competencia: "2027-01", parcelaAtual: 10 });
    expect(faltamParcelas(6, 10)).toBe(4);
  });
  it("última parcela não gera nada", () => {
    expect(generateRemainingInstallments({ competencia: "2026-09", parcelaAtual: 4, parcelaTotal: 4, valor: 1 })).toHaveLength(0);
  });
});
