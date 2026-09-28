/**
 * Abstração fina sobre o SheetJS para leitura de planilhas (.xlsx) com valores e fórmulas.
 * Coordenadas 1-based (linha 1 = primeira linha, coluna 1 = A), como na planilha.
 */
import * as XLSX from "xlsx";
import type { ISODate } from "../domain/types";

export interface CellInfo {
  v: unknown;
  f?: string;
  t: string;
  w?: string;
  z?: string;
}

export function colLetter(c: number): string {
  return XLSX.utils.encode_col(c - 1);
}

export function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const CHECK_MARKS = new Set(["✅", "✔", "✓", "☑", "ok", "x", "pago", "sim", "true"]);

export class Sheet {
  readonly maxRow: number;
  readonly maxCol: number;
  constructor(readonly name: string, private ws: XLSX.WorkSheet) {
    const ref = ws["!ref"];
    if (ref) {
      const r = XLSX.utils.decode_range(ref);
      this.maxRow = r.e.r + 1;
      this.maxCol = r.e.c + 1;
    } else {
      this.maxRow = 0;
      this.maxCol = 0;
    }
  }

  cell(r: number, c: number): CellInfo | undefined {
    if (r < 1 || c < 1) return undefined;
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const cell = this.ws[addr] as XLSX.CellObject | undefined;
    if (!cell || cell.v === undefined || cell.v === null) return undefined;
    return { v: cell.v, f: cell.f, t: cell.t, w: cell.w, z: typeof cell.z === "string" ? cell.z : undefined };
  }

  /** texto (trim) ou null */
  str(r: number, c: number): string | null {
    const cell = this.cell(r, c);
    if (!cell) return null;
    if (cell.t === "s" || typeof cell.v === "string") {
      const s = String(cell.v).trim();
      return s === "" ? null : s;
    }
    return null;
  }

  /** número (inclusive resultado em cache de fórmula) ou null */
  num(r: number, c: number): number | null {
    const cell = this.cell(r, c);
    if (!cell) return null;
    if (cell.t === "n" && typeof cell.v === "number" && Number.isFinite(cell.v)) return cell.v;
    if (cell.t === "b") return cell.v ? 1 : 0;
    return null;
  }

  formula(r: number, c: number): string | null {
    const cell = this.cell(r, c);
    return cell?.f ? `=${cell.f}` : null;
  }

  isDate(r: number, c: number): boolean {
    const cell = this.cell(r, c);
    if (!cell) return false;
    if (cell.t === "d" && cell.v instanceof Date) return true;
    if (cell.t === "n" && typeof cell.v === "number") {
      if (cell.z && /[dmy]/i.test(cell.z) && !/[#0]/.test(cell.z.replace(/\[.*?\]/g, ""))) return true;
      if (cell.w && /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(cell.w)) return true;
    }
    return false;
  }

  /** data ISO (YYYY-MM-DD) quando a célula é uma data; null caso contrário */
  date(r: number, c: number): ISODate | null {
    const cell = this.cell(r, c);
    if (!cell) return null;
    if (cell.t === "d" && cell.v instanceof Date) {
      const d = cell.v;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    if (this.isDate(r, c) && typeof cell.v === "number") {
      const p = XLSX.SSF.parse_date_code(cell.v);
      if (!p) return null;
      return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    }
    return null;
  }

  isCheck(r: number, c: number): boolean {
    const cell = this.cell(r, c);
    if (!cell) return false;
    if (cell.t === "b") return Boolean(cell.v);
    if (typeof cell.v === "string") return CHECK_MARKS.has(cell.v.trim().toLowerCase());
    return false;
  }

  /** procura células de texto que satisfaçam o predicado dentro de uma janela */
  findText(pred: (s: string, norm: string) => boolean, win?: { r1?: number; r2?: number; c1?: number; c2?: number }): { r: number; c: number; s: string }[] {
    const out: { r: number; c: number; s: string }[] = [];
    const r1 = win?.r1 ?? 1, r2 = Math.min(win?.r2 ?? this.maxRow, this.maxRow);
    const c1 = win?.c1 ?? 1, c2 = Math.min(win?.c2 ?? this.maxCol, this.maxCol);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      const s = this.str(r, c);
      if (s && pred(s, normalizeName(s))) out.push({ r, c, s });
    }
    return out;
  }
}

export class Workbook {
  readonly sheets: Sheet[];
  constructor(wb: XLSX.WorkBook) {
    this.sheets = wb.SheetNames.map((n) => new Sheet(n, wb.Sheets[n]));
  }
  find(name: string): Sheet | undefined {
    const n = normalizeName(name);
    return this.sheets.find((s) => normalizeName(s.name) === n) ?? this.sheets.find((s) => normalizeName(s.name).startsWith(n));
  }
  names(): string[] {
    return this.sheets.map((s) => s.name);
  }
}

export function readWorkbook(data: Uint8Array | ArrayBuffer): Workbook {
  const wb = XLSX.read(data, { type: data instanceof Uint8Array ? "array" : "array", cellFormula: true, cellNF: true, cellText: true, cellDates: false });
  return new Workbook(wb);
}

/** Exporta linhas para XLSX (Uint8Array). */
export function writeWorkbook(sheets: { name: string; rows: (string | number | null)[][] }[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((v) => (v == null ? "" : /[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(";")).join("\n");
}
