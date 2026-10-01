import { describe, expect, it } from "vitest";
import { calcularIrpfMensal, impostoPelaTabela } from "../tax/irpf";
import { inssProLabore } from "../tax/inss";
import { SEED_INSS, SEED_IRPF, SEED_SIMPLES_ANEXOS, SEED_SIMPLES_PARAMS, pickByVigencia, tabelaDesatualizada } from "../tax/tables";
import { aliquotaEfetiva, calcularDas, calcularFatorR, calcularRbt12, faixaPorRbt12, proLaboreMinimoFatorR, type SerieFolha, type SerieReceitas } from "../tax/simples";
import { calcularProLabore } from "../tax/prolabore";
import { calcularMei, calcularPresumidoMensal } from "../tax/outrosRegimes";
import { limiteIsencaoLucros, retencaoDividendos } from "../tax/dividendos";
import { SEED_DIVIDENDOS, SEED_MEI, SEED_PRESUMIDO } from "../tax/tables";

const irpf2025 = SEED_IRPF.find((t) => t.id === "irpf-2025-05")!;
const irpf2026 = SEED_IRPF.find((t) => t.id === "irpf-2026-01")!;
const inss2026 = SEED_INSS.find((t) => t.id === "inss-2026")!;
const anexoIII = SEED_SIMPLES_ANEXOS.find((a) => a.anexo === "III")!;
const anexoV = SEED_SIMPLES_ANEXOS.find((a) => a.anexo === "V")!;
const params = SEED_SIMPLES_PARAMS[0];

describe("tabelas por vigência", () => {
  it("escolhe a vigência correta", () => {
    expect(pickByVigencia(SEED_IRPF, "2025-03-01")!.id).toBe("irpf-2024-02");
    expect(pickByVigencia(SEED_IRPF, "2025-05-01")!.id).toBe("irpf-2025-05");
    expect(pickByVigencia(SEED_IRPF, "2026-09-01")!.id).toBe("irpf-2026-01");
    expect(pickByVigencia(SEED_INSS, "2026-01-15")!.teto).toBe(8475.55);
  });
  it("alerta tabela desatualizada", () => {
    expect(tabelaDesatualizada(SEED_INSS, "2026-09-28")).toBe(false);
    expect(tabelaDesatualizada(SEED_INSS, "2027-06-01")).toBe(true);
  });
});

describe("IRPF mensal", () => {
  it("tabela 2025: base 3.000 → 15% − 394,16", () => {
    expect(impostoPelaTabela(3000, irpf2025).imposto).toBe(55.84);
  });
  it("isento até 2.428,80", () => {
    expect(impostoPelaTabela(2428.8, irpf2025).imposto).toBe(0);
  });
  it("2026: rendimento 5.000 com desconto simplificado fica isento pelo redutor", () => {
    const r = calcularIrpfMensal({ rendimentoBruto: 5000, deducoes: 550, permitirDescontoSimplificado: true }, irpf2026);
    expect(r.imposto).toBe(0);
    expect(r.redutor).toBeGreaterThan(0);
  });
  it("2026: rendimento 6.000 tem redução parcial (978,62 − 13,3145% × 6.000 = 179,75)", () => {
    const r = calcularIrpfMensal({ rendimentoBruto: 6000, deducoes: 660, permitirDescontoSimplificado: false }, irpf2026);
    // base 5340 → 27,5% − 908,73 = 559,77; redutor 179,75 → 380,02
    expect(r.impostoTabela).toBe(559.77);
    expect(r.redutor).toBe(179.75);
    expect(r.imposto).toBe(380.02);
  });
  it("2026: acima de 7.350 não há redutor", () => {
    const r = calcularIrpfMensal({ rendimentoBruto: 8000, deducoes: 880 }, irpf2026);
    expect(r.redutor).toBe(0);
    expect(r.imposto).toBe(1049.27); // 7120 × 27,5% − 908,73
  });
  it("dependentes reduzem a base", () => {
    const a = calcularIrpfMensal({ rendimentoBruto: 6000, deducoes: 0, dependentes: 2, aplicarRedutor: false }, irpf2025);
    const b = calcularIrpfMensal({ rendimentoBruto: 6000, deducoes: 0, aplicarRedutor: false }, irpf2025);
    expect(a.baseCalculo).toBe(6000 - 2 * 189.59);
    expect(a.imposto).toBeLessThan(b.imposto);
  });
});

describe("INSS", () => {
  it("pró-labore 11% com teto", () => {
    expect(inssProLabore(5000, inss2026).inss).toBe(550);
    const r = inssProLabore(20000, inss2026);
    expect(r.inss).toBe(932.31); // 8475,55 × 11%
    expect(r.atingiuTeto).toBe(true);
  });
});

function serie(vals: Record<string, number>, exportPct = 0): SerieReceitas {
  const m: SerieReceitas = new Map();
  for (const [k, v] of Object.entries(vals)) m.set(k, { total: v, exportacao: v * exportPct });
  return m;
}
function folha(vals: Record<string, number>): SerieFolha {
  return new Map(Object.entries(vals));
}
const meses12 = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

describe("Simples Nacional", () => {
  it("RBT12 com 12 meses completos", () => {
    const r = serie(Object.fromEntries(meses12.map((m) => [m, 20000])));
    expect(calcularRbt12("2026-09", r).rbt12).toBe(240000);
  });
  it("RBT12 proporcionalizado em início de atividade", () => {
    const r = serie({ "2026-01": 10000, "2026-02": 20000, "2026-03": 30000 });
    const x = calcularRbt12("2026-03", r, "2026-01");
    expect(x.metodo).toBe("proporcional");
    expect(x.rbt12).toBe(180000); // média 15000 × 12
    const y = calcularRbt12("2026-01", r, "2026-01");
    expect(y.metodo).toBe("primeiroMes");
    expect(y.rbt12).toBe(120000);
  });
  it("faixa e alíquota efetiva Anexo III — faixa 2", () => {
    const f = faixaPorRbt12(240000, anexoIII);
    expect(f.faixa).toBe(2);
    // (240000 × 11,2% − 9360) / 240000 = 7,3%
    expect(aliquotaEfetiva(240000, f)).toBe(0.073);
  });
  it("faixa 1 = 6% nominal sem dedução", () => {
    expect(aliquotaEfetiva(150000, faixaPorRbt12(150000, anexoIII))).toBe(0.06);
  });
  it("partilhas somam 100% (exceto a 1ª faixa do Anexo III, que soma 99,90% no texto legal)", () => {
    for (const a of [anexoIII, anexoV]) for (const f of a.faixas) {
      const s = Object.values(f.partilha).reduce((x, y) => x + y, 0);
      if (a.anexo === "III" && f.faixa === 1) expect(Math.abs(s - 0.999)).toBeLessThan(1e-9);
      else expect(Math.abs(s - 1)).toBeLessThan(1e-9);
    }
  });
  it("DAS nacional Anexo III faixa 1: 10.000 × 6% × 99,9% = 599,40", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 10000])));
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 3000]))), anexoIII, anexoV, params });
    expect(d.anexo).toBe("III");
    expect(d.faixa).toBe(1);
    expect(d.das).toBe(599.4);
    expect(d.vencimento).toBe("2026-10-20");
  });
  it("DAS 100% exportação exclui PIS/COFINS/ISS: 6% × (4% + 3,5% + 43,4%) = 3,054%", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 10000])), 1);
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 3000]))), anexoIII, anexoV, params });
    expect(d.aliquotaEfetivaExportacao).toBe(0.03054);
    expect(d.das).toBe(305.4);
    const iss = d.tributos.find((t) => t.tributo === "iss")!;
    expect(iss.valor).toBe(0);
    expect(d.tributos.find((t) => t.tributo === "cpp")!.valor).toBe(260.4); // 10000 × 6% × 43,4%
    expect(d.tributos.reduce((a, t) => a + t.valor, 0)).toBeCloseTo(d.das, 2);
  });
  it("receita mista: exportação parcial", () => {
    const r: SerieReceitas = new Map(serie(Object.fromEntries(meses12.map((m) => [m, 10000]))));
    r.set("2026-09", { total: 10000, exportacao: 4000 });
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 3000]))), anexoIII, anexoV, params });
    // 6000 × 5,994% + 4000 × 3,054% = 359,64 + 122,16
    expect(d.das).toBe(481.8);
  });
  it("Anexo III faixa 2 nacional: efetiva 7,3% × 100%", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 20000])));
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 6000]))), anexoIII, anexoV, params });
    expect(d.faixa).toBe(2);
    expect(d.aliquotaEfetiva).toBe(0.073);
    expect(d.das).toBe(1460);
  });
  it("Fator R < 28% cai no Anexo V", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 10000])));
    const fr = calcularFatorR("2026-09", r, folha(Object.fromEntries(meses12.map((m) => [m, 2000]))), params);
    expect(fr.fatorR).toBe(0.2);
    expect(fr.anexo).toBe("V");
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 2000]))), anexoIII, anexoV, params });
    expect(d.anexo).toBe("V");
    expect(d.das).toBe(1550); // 15,5%
    expect(d.alertas.some((a) => a.includes("Anexo V"))).toBe(true);
  });
  it("Fator R exatamente 28% fica no Anexo III", () => {
    const r = serie(Object.fromEntries(meses12.map((m) => [m, 10000])));
    const fr = calcularFatorR("2026-09", r, folha(Object.fromEntries(meses12.map((m) => [m, 2800]))), params);
    expect(fr.fatorR).toBe(0.28);
    expect(fr.anexo).toBe("III");
  });
  it("métodos de Fator R: anterior12, corrente12 e mensal", () => {
    // 12 meses anteriores com folha 2.000; mês corrente com folha 6.000 e receita 10.000
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 10000])));
    const f = folha({ ...Object.fromEntries(meses12.map((m) => [m, 2000])), "2026-09": 6000 });
    const a = calcularFatorR("2026-09", r, f, params, null, "anterior12");
    expect(a.fatorR).toBe(0.2); // 24.000 / 120.000
    expect(a.anexo).toBe("V");
    const c = calcularFatorR("2026-09", r, f, params, null, "corrente12");
    expect(c.fatorRExato).toBe(0.233333); // (11 × 2.000 + 6.000) / 120.000
    expect(c.fatorR).toBe(0.23);
    expect(c.janela).toEqual({ de: "2025-10", ate: "2026-09", meses: 12 });
    const m = calcularFatorR("2026-09", r, f, params, null, "mensal");
    expect(m.fatorR).toBe(0.6);
    expect(m.anexo).toBe("III");
    // início de atividade: corrente12 proporcionaliza como a regra legal
    const rr = serie({ "2026-07": 10000, "2026-08": 10000, "2026-09": 10000 });
    const ff = folha({ "2026-07": 2800, "2026-08": 2800, "2026-09": 2800 });
    expect(calcularFatorR("2026-09", rr, ff, params, "2026-07", "corrente12").fatorR).toBe(0.28);
    expect(calcularFatorR("2026-09", rr, ff, params, "2026-07", "anterior12").fatorR).toBe(0.28);
    // o DAS respeita o método
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: f, anexoIII, anexoV, params, fatorRMetodo: "mensal" });
    expect(d.anexo).toBe("III");
    // simulador mensal: 28% da receita do mês
    expect(proLaboreMinimoFatorR({ mes: "2026-09", receitas: r, folha: f, params, metodo: "mensal" }).proLaboreMinimo).toBe(2800);
    expect(proLaboreMinimoFatorR({ mes: "2026-09", receitas: r, folha: f, params, metodo: "corrente12" }).afeta).toBe("2026-09");
    expect(proLaboreMinimoFatorR({ mes: "2026-09", receitas: r, folha: f, params, metodo: "anterior12" }).afeta).toBe("2026-10");
  });
  it("início de atividade (abertura 10/2025, 100% exportação): Fator R 0,29 → Anexo III; RBT12 proporcionalizado; DAS por código", () => {
    // caso fictício: receitas 04/2026 20.000 e 05/2026 30.000; folhas 03/2026 1.621, 04/2026 4.500, 05/2026 8.379
    const r: SerieReceitas = new Map([["2026-04", { total: 20000, exportacao: 20000 }], ["2026-05", { total: 30000, exportacao: 30000 }], ["2026-06", { total: 40000, exportacao: 40000 }]]);
    const f: SerieFolha = new Map([["2026-03", 1621], ["2026-04", 4500], ["2026-05", 8379]]);
    const fr = calcularFatorR("2026-06", r, f, params, "2025-10");
    expect(fr.rbt12).toBe(50000);
    expect(fr.folha12).toBe(14500);
    expect(fr.fatorRExato).toBe(0.29);
    expect(fr.anexo).toBe("III");
    expect(fr.janela).toEqual({ de: "2025-10", ate: "2026-05", meses: 8 });
    const d = calcularDas({ mes: "2026-06", receitas: r, folha: f, anexoIII, anexoV, params, inicioAtividade: "2025-10" });
    expect(d.rbt12).toBe(75000); // 50.000 ÷ 8 meses × 12 (art. 21)
    expect(d.faixa).toBe(1);
    expect(d.aliquotaEfetivaExportacao).toBe(0.03054); // 6% × (4% + 3,5% + 43,4%)
    expect(d.das).toBe(1221.6);
    const porCodigo = Object.fromEntries(d.tributos.filter((t) => t.valor > 0).map((t) => [t.codigo, t.valor]));
    expect(porCodigo).toEqual({ "1001": 96, "1002": 84, "1006": 1041.6 });
  });
  it("art. 26 §§ 6º e 7º: casos-limite e 2 primeiros meses", () => {
    const zero: SerieReceitas = new Map();
    const rec10k: SerieReceitas = new Map([["2026-05", { total: 10000, exportacao: 0 }]]);
    expect(calcularFatorR("2026-07", rec10k, new Map(), params, "2024-01")).toMatchObject({ fatorR: 0.01, anexo: "V" });
    expect(calcularFatorR("2026-07", zero, new Map([["2026-05", 1621]]), params, "2024-01")).toMatchObject({ fatorR: 0.28, anexo: "III" });
    expect(calcularFatorR("2026-07", zero, new Map(), params, "2024-01")).toMatchObject({ fatorR: 0.01, anexo: "V" });
    // 2 primeiros meses de atividade (Res. 190/2026)
    expect(calcularFatorR("2026-05", rec10k, new Map(), params, "2026-05")).toMatchObject({ fatorR: 0.28, anexo: "III" });
    expect(calcularFatorR("2026-06", rec10k, new Map(), params, "2026-05")).toMatchObject({ fatorR: 0.28, anexo: "III" });
    expect(calcularFatorR("2026-07", rec10k, new Map(), params, "2026-05").anexo).toBe("V");
    expect(calcularFatorR("2026-06", rec10k, new Map(), params, "2026-05", "anterior12", { regra190: false }).anexo).toBe("V");
    // arredondamento a 2 casas decide o anexo
    const r100: SerieReceitas = new Map([["2026-06", { total: 100000, exportacao: 0 }]]);
    expect(calcularFatorR("2026-07", r100, new Map([["2026-06", 27500]]), params, "2024-01")).toMatchObject({ fatorR: 0.28, anexo: "III" });
    expect(calcularFatorR("2026-07", r100, new Map([["2026-06", 27500]]), params, "2024-01", "anterior12", { arredondar: false }).anexo).toBe("V");
    expect(calcularFatorR("2026-07", r100, new Map([["2026-06", 27499]]), params, "2024-01")).toMatchObject({ fatorR: 0.27, anexo: "V" });
  });
  it("simulador de pró-labore mínimo", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 10000])));
    const f = folha(Object.fromEntries(meses12.map((m) => [m, 2800])));
    // janela set/25..set/26 sem set/25: out/25..set/26 → 12 meses × 10000 = 120000 × 28% = 33600; folha anteriores (out/25..ago/26) = 11 × 2800 = 30800 → mínimo 2800
    const s = proLaboreMinimoFatorR({ mes: "2026-09", receitas: r, folha: f, params });
    expect(s.proLaboreMinimo).toBe(2800);
    // se a receita de setembro dobrar, o mínimo sobe
    r.set("2026-09", { total: 20000, exportacao: 0 });
    expect(proLaboreMinimoFatorR({ mes: "2026-09", receitas: r, folha: f, params }).proLaboreMinimo).toBe(5600);
  });
  it("teto de ISS 5% redistribui para federais (Anexo III faixa 5)", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 250000])));
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha(Object.fromEntries(meses12.map((m) => [m, 80000]))), anexoIII, anexoV, params });
    expect(d.faixa).toBe(5);
    const iss = d.tributos.find((t) => t.tributo === "iss")!;
    expect(iss.aliquotaEfetivaTributo).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(d.issRedistribuido).toBeGreaterThan(0);
    const soma = d.tributos.reduce((a, t) => a + t.valor, 0);
    expect(Math.abs(soma - d.das)).toBeLessThan(0.05);
  });
  it("alerta de limite", () => {
    const r = serie(Object.fromEntries([...meses12, "2026-09"].map((m) => [m, 420000])));
    const d = calcularDas({ mes: "2026-09", receitas: r, folha: folha({}), anexoIII, anexoV, params, anexoForcado: "III" });
    expect(d.alertas.some((a) => a.includes("limite do Simples"))).toBe(true);
  });
});

describe("pró-labore", () => {
  it("bruto 8.000 em 2026: INSS 880,00; IRRF pela base legal", () => {
    const r = calcularProLabore({ competencia: "2026-08", bruto: 8000, inss: inss2026, irpf: irpf2026 });
    expect(r.inss).toBe(880);
    // base legal 7.120,00 → 27,5% − 908,73 = 1.049,27; simplificado 7.392,80 → 1.124,29 (pior) → usa legal
    // redutor: 978,62 − 0,133145 × 8.000 < 0 → 0
    expect(r.irrf).toBe(1049.27);
    expect(r.liquido).toBe(6070.73);
    expect(r.darf).toBe(1929.27);
    expect(r.darfVencimento).toBe("2026-09-21"); // 20/09/2026 é domingo
  });
  it("pró-labore de um salário mínimo 2026 não paga IR", () => {
    const r = calcularProLabore({ competencia: "2026-03", bruto: 1621, inss: inss2026, irpf: irpf2026 });
    expect(r.inss).toBe(178.31);
    expect(r.irrf).toBe(0);
    expect(r.liquido).toBe(1442.69);
  });
});

describe("outros regimes e dividendos", () => {
  it("MEI 2026: 5% de 1.621 + ISS 5", () => {
    const m = calcularMei({ receita12m: 50000, servicos: true }, SEED_MEI[0], inss2026);
    expect(m.dasMensal).toBe(86.05);
    expect(calcularMei({ receita12m: 90000 }, SEED_MEI[0], inss2026).excedeuLimite).toBe(true);
  });
  it("Lucro Presumido com exportação total: só IRPJ/CSLL", () => {
    const p = calcularPresumidoMensal({ receita: 30000, receitaExportacao: 30000, issAliquota: 0.029 }, SEED_PRESUMIDO[0]);
    expect(p.basePresumida).toBe(9600);
    expect(p.irpj).toBe(1440);
    expect(p.csll).toBe(864);
    expect(p.pis).toBe(0);
    expect(p.iss).toBe(0);
    expect(p.total).toBe(2304);
  });
  it("limite de isenção de lucros sem escrituração", () => {
    expect(limiteIsencaoLucros({ receitaBrutaPeriodo: 100000, irpjPagoNoDas: 240, escrituracaoContabil: false }).limiteIsento).toBe(31760);
  });
  it("retenção de dividendos acima de 50 mil/mês em 2026", () => {
    const p = SEED_DIVIDENDOS.find((d) => d.id === "div-2026")!;
    expect(retencaoDividendos(40000, p).retencao).toBe(0);
    expect(retencaoDividendos(60000, p).retencao).toBe(6000);
  });
});
