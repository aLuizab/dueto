import { describe, expect, it } from "vitest";
import { tabelasPara } from "../../src/lib/fiscal";
import { SEED_TAX_TABLES, type TaxTables } from "../tax/tables";

describe("tabelas fiscais sem vigência ativa", () => {
  it("usa a tabela padrão e avisa quando o usuário desativou todas as vigências", () => {
    const tt: TaxTables = {
      ...SEED_TAX_TABLES,
      mei: SEED_TAX_TABLES.mei.map((t) => ({ ...t, ativa: false })),
      presumido: SEED_TAX_TABLES.presumido.map((t) => ({ ...t, ativa: false })),
      dividendos: SEED_TAX_TABLES.dividendos.map((t) => ({ ...t, ativa: false })),
    };
    const r = tabelasPara(tt, "2026-09");
    expect(r.mei.percentualInssSobreMinimo).toBe(0.05);
    expect(r.presumido.presuncaoServicos).toBe(0.32);
    expect(r.dividendos.limiteMensalIsento).toBe(50000);
    expect(r.semVigenciaAtiva).toEqual(["MEI", "Lucro Presumido", "Dividendos"]);
  });
  it("sem aviso quando tudo está ativo", () => {
    expect(tabelasPara(SEED_TAX_TABLES, "2026-09").semVigenciaAtiva).toEqual([]);
  });
});
