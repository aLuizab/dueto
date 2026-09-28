/**
 * Avaliador seguro de expressões aritméticas usadas em campos de valor,
 * no estilo das planilhas: "=120+150", "=SUM(25598+6123+1600)", "1.234,56".
 * Suporta + - * / parênteses, SUM(...)/SOMA(...) e números com vírgula decimal.
 * Nunca usa eval.
 */
import { parseMoney, round2 } from "./money";

export interface EvaluatedValue {
  value: number;
  /** expressão original quando o usuário digitou uma fórmula (senão null) */
  expression: string | null;
}

type Tok = { t: "num"; v: number } | { t: "op"; v: string } | { t: "lp" } | { t: "rp" } | { t: "fn"; v: string } | { t: "comma" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      const n = parseMoney(raw);
      if (n == null) throw new Error(`número inválido: ${raw}`);
      toks.push({ t: "num", v: n });
      i = j;
      continue;
    }
    if ("+-*/".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
    if (c === ";") { toks.push({ t: "comma" }); i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z_]/.test(s[j])) j++;
      const name = s.slice(i, j).toUpperCase();
      if (!["SUM", "SOMA", "MAX", "MIN", "ABS", "ROUND", "ARRED"].includes(name)) throw new Error(`função desconhecida: ${name}`);
      toks.push({ t: "fn", v: name });
      i = j;
      continue;
    }
    throw new Error(`caractere inválido: ${c}`);
  }
  return toks;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}
  private peek(): Tok | undefined { return this.toks[this.i]; }
  private next(): Tok | undefined { return this.toks[this.i++]; }

  parse(): number {
    const v = this.expr();
    if (this.i !== this.toks.length) throw new Error("expressão malformada");
    return v;
  }
  private expr(): number {
    let v = this.term();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.v === "+" || p.v === "-")) {
        this.next();
        const r = this.term();
        v = p.v === "+" ? v + r : v - r;
      } else return v;
    }
  }
  private term(): number {
    let v = this.unary();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.v === "*" || p.v === "/")) {
        this.next();
        const r = this.unary();
        if (p.v === "/" && r === 0) throw new Error("divisão por zero");
        v = p.v === "*" ? v * r : v / r;
      } else return v;
    }
  }
  private unary(): number {
    const p = this.peek();
    if (p && p.t === "op" && (p.v === "-" || p.v === "+")) {
      this.next();
      const v = this.unary();
      return p.v === "-" ? -v : v;
    }
    return this.primary();
  }
  private primary(): number {
    const t = this.next();
    if (!t) throw new Error("expressão incompleta");
    if (t.t === "num") return t.v;
    if (t.t === "lp") {
      const v = this.expr();
      const r = this.next();
      if (!r || r.t !== "rp") throw new Error("parêntese não fechado");
      return v;
    }
    if (t.t === "fn") {
      const lp = this.next();
      if (!lp || lp.t !== "lp") throw new Error("esperado ( após função");
      const args: number[] = [];
      if (this.peek()?.t !== "rp") {
        args.push(this.expr());
        while (this.peek()?.t === "comma") { this.next(); args.push(this.expr()); }
      }
      const rp = this.next();
      if (!rp || rp.t !== "rp") throw new Error("parêntese não fechado");
      switch (t.v) {
        case "SUM": case "SOMA": return args.reduce((a, b) => a + b, 0);
        case "MAX": return Math.max(...args);
        case "MIN": return Math.min(...args);
        case "ABS": return Math.abs(args[0] ?? 0);
        case "ROUND": case "ARRED": return round2(args[0] ?? 0);
      }
    }
    throw new Error("token inesperado");
  }
}

/** Avalia uma expressão sem o '=' inicial. Lança erro se inválida. */
export function evaluateExpression(src: string): number {
  const toks = tokenize(src);
  if (toks.length === 0) throw new Error("expressão vazia");
  return round2(new Parser(toks).parse());
}

/**
 * Interpreta um campo de valor:
 *  - número → valor
 *  - "=120+150" → 270 com expression "=120+150"
 *  - "1.234,56" → 1234.56
 *  - "-", "", null → 0 (sem expressão)
 * Lança erro em expressão inválida.
 */
export function parseValueField(input: string | number | null | undefined): EvaluatedValue {
  if (input == null) return { value: 0, expression: null };
  if (typeof input === "number") return { value: round2(input), expression: null };
  const s = input.trim();
  if (s === "" || s === "-" || s === "—") return { value: 0, expression: null };
  if (s.startsWith("=")) {
    const body = s.slice(1);
    return { value: evaluateExpression(body), expression: s };
  }
  // string simples: pode ser "120+150" também
  if (/[+*/]/.test(s) || /\d-\d/.test(s)) {
    return { value: evaluateExpression(s), expression: `=${s}` };
  }
  const n = parseMoney(s);
  if (n == null) throw new Error(`valor inválido: ${input}`);
  return { value: round2(n), expression: null };
}
