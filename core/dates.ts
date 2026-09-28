import type { ISODate, MonthKey } from "./domain/types";

export const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const MESES_PT_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "AGOSTO" | "ago" | "Agosto/2026" → 8 (ou null) */
export function parseMonthName(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = stripAccents(String(s).toLowerCase().trim());
  // primeira palavra só com letras: "agosto", "ago", "agosto/2026", "set." → "agosto"/"ago"/"set"
  const word = (t.match(/^[a-z]+/) ?? [])[0];
  if (!word) return null;
  for (let i = 0; i < 12; i++) {
    const full = stripAccents(MESES_PT[i]);
    if (word === full || word === MESES_PT_ABREV[i]) return i + 1;
    // "setem", "outub" etc. (>= 4 letras e prefixo do nome completo) — evita "setor" casar com "set"
    if (word.length >= 4 && full.startsWith(word)) return i + 1;
  }
  return null;
}

export function monthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function splitMonthKey(mk: MonthKey): { year: number; month: number } {
  const [y, m] = mk.split("-").map(Number);
  return { year: y, month: m };
}

export function addMonths(mk: MonthKey, delta: number): MonthKey {
  const { year, month } = splitMonthKey(mk);
  const idx = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1);
}

export function monthDiff(a: MonthKey, b: MonthKey): number {
  const A = splitMonthKey(a), B = splitMonthKey(b);
  return (B.year - A.year) * 12 + (B.month - A.month);
}

export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let cur = from;
  while (cur <= to) { out.push(cur); cur = addMonths(cur, 1); }
  return out;
}

/** Os N meses anteriores a `mk` (exclui `mk`), em ordem cronológica. */
export function previousMonths(mk: MonthKey, n: number): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = n; i >= 1; i--) out.push(addMonths(mk, -i));
  return out;
}

export function monthKeyOf(d: ISODate | Date): MonthKey {
  const s = d instanceof Date ? toISODate(d) : d;
  return s.slice(0, 7);
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Data segura dentro do mês (dia 31 em fevereiro → 28/29). */
export function dateInMonth(mk: MonthKey, day: number): ISODate {
  const { year, month } = splitMonthKey(mk);
  const d = Math.min(Math.max(1, day), daysInMonth(year, month));
  return `${mk}-${String(d).padStart(2, "0")}`;
}

export function lastDayOfMonth(mk: MonthKey): ISODate {
  const { year, month } = splitMonthKey(mk);
  return dateInMonth(mk, daysInMonth(year, month));
}

/** Feriados nacionais fixos (sem móveis). Suficiente para "último dia útil" com margem. */
const FERIADOS_FIXOS = new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"]);

export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return !FERIADOS_FIXOS.has(mmdd);
}

export function lastBusinessDayOfMonth(mk: MonthKey): ISODate {
  const d = parseISODate(lastDayOfMonth(mk));
  while (!isBusinessDay(d)) d.setDate(d.getDate() - 1);
  return toISODate(d);
}

/** Se cair em fim de semana/feriado, empurra para o próximo dia útil (regra de DAS/DARF). */
export function nextBusinessDayOnOrAfter(iso: ISODate): ISODate {
  const d = parseISODate(iso);
  while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function fmtMonth(mk: MonthKey, style: "long" | "short" = "short"): string {
  const { year, month } = splitMonthKey(mk);
  const name = style === "long" ? MESES_PT[month - 1] : MESES_PT_ABREV[month - 1];
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return style === "long" ? `${cap} de ${year}` : `${cap}/${String(year).slice(2)}`;
}

export function fmtDate(iso: ISODate | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function currentMonthKey(): MonthKey {
  return monthKeyOf(new Date());
}
