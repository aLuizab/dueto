/**
 * Importação genérica de extratos (CSV com mapeamento de colunas) e OFX.
 */
import { parseMoney, round2 } from "../money";
import { categorize, type CategRule } from "../categorize";
import type { EntityType, ISODate, Transaction } from "../domain/types";

export interface ExtratoRow {
  data: ISODate;
  descricao: string;
  valor: number; // positivo = crédito, negativo = débito
  fitId?: string;
}

export interface CsvMapping {
  delimitador?: "," | ";" | "\t" | "auto";
  colData: number;
  colDescricao: number;
  colValor: number;
  /** coluna separada de crédito/débito (opcional) */
  colCredito?: number | null;
  colDebito?: number | null;
  formatoData: "dd/mm/yyyy" | "yyyy-mm-dd" | "mm/dd/yyyy";
  temCabecalho: boolean;
  /** inverter sinal (faturas de cartão listam compras como positivo) */
  inverterSinal?: boolean;
}

export function detectDelimiter(text: string): "," | ";" | "\t" {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts = { ";": (line.match(/;/g) ?? []).length, ",": (line.match(/,/g) ?? []).length, "\t": (line.match(/\t/g) ?? []).length };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as "," | ";" | "\t") || ";";
}

export function parseCsvLines(text: string, delim: "," | ";" | "\t"): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; cur.push(field); rows.push(cur); cur = []; field = ""; }
    else field += ch;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function parseDate(s: string, fmt: CsvMapping["formatoData"]): ISODate | null {
  const t = s.trim();
  let m: RegExpMatchArray | null;
  if (fmt === "yyyy-mm-dd" && (m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (fmt === "dd/mm/yyyy" && (m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (fmt === "mm/dd/yyyy" && (m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

export function parseCsvExtrato(text: string, map: CsvMapping): { rows: ExtratoRow[]; erros: string[] } {
  const delim = !map.delimitador || map.delimitador === "auto" ? detectDelimiter(text) : map.delimitador;
  const lines = parseCsvLines(text, delim);
  const erros: string[] = [];
  const rows: ExtratoRow[] = [];
  lines.forEach((cols, i) => {
    if (i === 0 && map.temCabecalho) return;
    const data = parseDate(cols[map.colData] ?? "", map.formatoData);
    if (!data) { erros.push(`linha ${i + 1}: data inválida "${cols[map.colData]}"`); return; }
    let valor: number | null = null;
    if (map.colCredito != null && map.colDebito != null) {
      const c = parseMoney(cols[map.colCredito] ?? "") ?? 0, d = parseMoney(cols[map.colDebito] ?? "") ?? 0;
      valor = c - Math.abs(d);
    } else valor = parseMoney(cols[map.colValor] ?? "");
    if (valor == null) { erros.push(`linha ${i + 1}: valor inválido "${cols[map.colValor]}"`); return; }
    if (map.inverterSinal) valor = -valor;
    rows.push({ data, descricao: (cols[map.colDescricao] ?? "").trim(), valor: round2(valor) });
  });
  return { rows, erros };
}

export function parseOfx(text: string): { rows: ExtratoRow[]; erros: string[] } {
  const rows: ExtratoRow[] = [];
  const erros: string[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const b of blocks) {
    const get = (tag: string) => (b.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i")) ?? [])[1]?.trim();
    const dt = get("DTPOSTED");
    const amt = get("TRNAMT");
    const memo = get("MEMO") ?? get("NAME") ?? "";
    if (!dt || !amt) { erros.push("transação OFX sem data/valor"); continue; }
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const valor = parseMoney(amt.replace(",", "."));
    if (valor == null) { erros.push(`valor OFX inválido: ${amt}`); continue; }
    rows.push({ data, descricao: memo, valor: round2(valor), fitId: get("FITID") });
  }
  return { rows, erros };
}

export function extratoParaTransacoes(rows: ExtratoRow[], opts: { entityId: string; accountId: string | null; escopo: EntityType; rules: CategRule[]; existentesFitIds?: Set<string> }): Omit<Transaction, "id">[] {
  const out: Omit<Transaction, "id">[] = [];
  for (const r of rows) {
    if (r.fitId && opts.existentesFitIds?.has(r.fitId)) continue;
    const kind = r.valor >= 0 ? "receita" : "despesa";
    const cat = categorize(r.descricao, opts.escopo, opts.rules);
    out.push({
      entityId: opts.entityId, accountId: opts.accountId, categoryId: cat.categoryId, kind, competencia: r.data.slice(0, 7), vencimento: r.data, pagamento: r.data,
      valor: Math.abs(r.valor), moeda: "BRL", cotacao: null, valorBrl: Math.abs(r.valor), descricao: r.descricao, status: "conciliado", tags: ["import:extrato"], meta: { fitId: r.fitId ?? null, categoriaConfianca: cat.confianca },
    });
  }
  return out;
}
