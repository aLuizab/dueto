/** Arredonda para 2 casas com correção de ponto flutuante (half away from zero). */
export function round2(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  return (sign * Math.round((abs + Number.EPSILON) * 100)) / 100;
}

export function round4(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(v) + Number.EPSILON) * 10000)) / 10000;
}

export function round6(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round((Math.abs(v) + Number.EPSILON) * 1e6)) / 1e6;
}

export function sum(values: Iterable<number>): number {
  let acc = 0;
  for (const v of values) acc += v || 0;
  return round2(acc);
}

export function toBrl(valor: number, moeda: string, cotacao?: number | null): number {
  if (moeda === "BRL") return round2(valor);
  if (!cotacao || cotacao <= 0) return 0;
  return round2(valor * cotacao);
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const usdFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });
const eurFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" });
const pctFmt = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtMoney(v: number, moeda: "BRL" | "USD" | "EUR" = "BRL"): string {
  const f = moeda === "USD" ? usdFmt : moeda === "EUR" ? eurFmt : brlFmt;
  return f.format(v || 0);
}

export function fmtPct(v: number): string {
  return pctFmt.format(v || 0);
}

/** Converte string pt-BR ("1.234,56") ou en ("1234.56") em número. */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = input.trim().replace(/[R$\s]/g, "");
  if (!s || s === "-") return null;
  if (s.includes(",") && s.includes(".")) {
    // decide qual é decimal pelo último separador
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
