import { describe, expect, it } from "vitest";
import type { Recurrence, Transaction } from "../domain/types";
import { alternarMes, lancamentosRecorrentesFaltantes, mudarInicio, pararDepoisDe, recorrenciaValeNoMes, repeteDepoisDe, retomarEm } from "../recorrencias";

const rec = (over: Partial<Recurrence> = {}): Recurrence => ({
  id: "rec1", entityId: "casal", descricao: "Internet", kind: "despesa", periodicidade: "mensal", diaVencimento: 10, valorPadrao: 100, moeda: "BRL", ativa: true, inicio: "2026-07", fim: null, mesesDesligados: [], ...over,
});
const tx = (recorrenciaId: string, competencia: string) => ({ id: `tx-${competencia}`, recorrenciaId, competencia }) as Transaction;
const meses = (r: { competencia: string }[]) => r.map((x) => x.competencia);

describe("lançamentos recorrentes faltantes", () => {
  it("gera um lançamento por mês do início até o mês pedido, sem repetir os que já existem", () => {
    const f = lancamentosRecorrentesFaltantes([rec()], [tx("rec1", "2026-07")], "2026-10");
    expect(meses(f)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("cada mês é independente: desligar setembro não afeta agosto nem outubro", () => {
    const r = alternarMes(rec(), "2026-09", false);
    expect(meses(lancamentosRecorrentesFaltantes([r], [], "2026-10"))).toEqual(["2026-07", "2026-08", "2026-10"]);
    const religada = alternarMes(r, "2026-09", true);
    expect(meses(lancamentosRecorrentesFaltantes([religada], [], "2026-10"))).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("respeita fim, recorrência inativa e periodicidade anual", () => {
    expect(meses(lancamentosRecorrentesFaltantes([rec({ fim: "2026-08" })], [], "2026-12"))).toEqual(["2026-07", "2026-08"]);
    expect(lancamentosRecorrentesFaltantes([rec({ ativa: false })], [], "2026-12")).toEqual([]);
    expect(meses(lancamentosRecorrentesFaltantes([rec({ periodicidade: "anual", mesVencimento: 11 })], [], "2027-12"))).toEqual(["2026-11", "2027-11"]);
    expect(recorrenciaValeNoMes(rec({ periodicidade: "anual", mesVencimento: 11 }), "2026-10")).toBe(false);
  });
});

describe("parar e retomar", () => {
  it("parar depois de um mês mantém os meses anteriores", () => {
    const r = pararDepoisDe(rec(), "2026-09");
    expect(repeteDepoisDe(r, "2026-09")).toBe(false);
    expect(repeteDepoisDe(r, "2026-08")).toBe(true);
    expect(meses(lancamentosRecorrentesFaltantes([r], [], "2026-12"))).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("retomar não recria os meses em que ficou parada, e religa os seguintes", () => {
    const parada = alternarMes(pararDepoisDe(rec(), "2026-08"), "2027-01", false);
    const r = retomarEm(parada, "2026-11");
    expect(r.fim).toBeNull();
    expect(meses(lancamentosRecorrentesFaltantes([r], [tx("rec1", "2026-07"), tx("rec1", "2026-08")], "2027-01"))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("retomar uma recorrência antiga desativada não preenche o passado", () => {
    const r = retomarEm(rec({ ativa: false }), "2026-10");
    expect(meses(lancamentosRecorrentesFaltantes([r], [], "2026-11"))).toEqual(["2026-10", "2026-11"]);
  });
});

describe("mês em que começou", () => {
  it("antecipar o início inclui os meses anteriores, religando os desligados no intervalo", () => {
    const r = mudarInicio(alternarMes(alternarMes(rec(), "2026-05", false), "2026-08", false), "2026-04");
    expect(r.inicio).toBe("2026-04");
    expect(r.mesesDesligados).toEqual(["2026-08"]);
    expect(meses(lancamentosRecorrentesFaltantes([r], [tx("rec1", "2026-07")], "2026-09"))).toEqual(["2026-04", "2026-05", "2026-06", "2026-09"]);
  });

  it("adiar o início não gera os meses de antes", () => {
    expect(meses(lancamentosRecorrentesFaltantes([mudarInicio(rec(), "2026-09")], [], "2026-10"))).toEqual(["2026-09", "2026-10"]);
  });
});
