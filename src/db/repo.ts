/**
 * Mapeamento tabelas ↔ objetos de domínio (snake_case ↔ camelCase, JSON, booleanos).
 */
import type { Account, Budget, Category, Client, Contribution, Entity, Goal, Investment, InvestmentSnapshot, Invoice, Patient, Payroll, Recurrence, Transaction } from "@core/domain/types";
import type { CategRule } from "@core/categorize";
import type { Database, Row } from "./database";

type ColType = "text" | "num" | "bool" | "json";


function snake(k: string) {
  return k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

export class Table<T extends { id: string }> {
  private cols: { key: keyof T; col: string; type: ColType }[];
  constructor(readonly name: string, keys: (keyof T | [keyof T, ColType])[], private db: () => Database) {
    this.cols = keys.map((k) => (Array.isArray(k) ? { key: k[0], col: snake(String(k[0])), type: k[1] } : { key: k, col: snake(String(k)), type: "text" as ColType }));
  }
  private toRow(obj: T): unknown[] {
    return this.cols.map((c) => {
      const v = obj[c.key] as unknown;
      if (v === undefined || v === null) return null;
      switch (c.type) {
        case "bool": return v ? 1 : 0;
        case "json": return JSON.stringify(v);
        case "num": return Number(v);
        default: return String(v);
      }
    });
  }
  private fromRow(row: Row): T {
    const o: Record<string, unknown> = {};
    for (const c of this.cols) {
      const v = row[c.col];
      if (v === null || v === undefined) { o[String(c.key)] = c.type === "json" ? (c.col === "tags" || c.col === "transaction_ids" || c.col === "escopo" ? [] : c.col === "meta" || c.col === "config" ? {} : null) : c.type === "bool" ? false : null; continue; }
      switch (c.type) {
        case "bool": o[String(c.key)] = Boolean(v); break;
        case "json": try { o[String(c.key)] = JSON.parse(String(v)); } catch { o[String(c.key)] = null; } break;
        case "num": o[String(c.key)] = Number(v); break;
        default: o[String(c.key)] = String(v);
      }
    }
    return o as T;
  }
  all(): T[] {
    return this.db().all(`SELECT * FROM ${this.name}`).map((r) => this.fromRow(r));
  }
  upsert(obj: T): void {
    const names = this.cols.map((c) => c.col).join(", ");
    const marks = this.cols.map(() => "?").join(", ");
    this.db().run(`INSERT OR REPLACE INTO ${this.name} (${names}) VALUES (${marks})`, this.toRow(obj));
  }
  upsertMany(objs: T[]): void {
    if (!objs.length) return;
    this.db().transaction(() => { for (const o of objs) this.upsert(o); });
  }
  delete(id: string): void {
    this.db().run(`DELETE FROM ${this.name} WHERE id = ?`, [id]);
  }
  deleteMany(ids: string[]): void {
    if (!ids.length) return;
    this.db().transaction(() => { for (const id of ids) this.delete(id); });
  }
  deleteWhere(where: string, params: unknown[] = []): void {
    this.db().run(`DELETE FROM ${this.name} WHERE ${where}`, params);
  }
}

export function makeTables(db: () => Database) {
  return {
    entities: new Table<Entity>("entities", ["id", "tipo", "nome", "documento", "municipio", "uf", "regime", ["config", "json"], ["ativa", "bool"]], db),
    accounts: new Table<Account>("accounts", ["id", "entityId", "nome", "tipo", "instituicao", "moeda", ["diaFechamento", "num"], ["diaVencimento", "num"], ["ativa", "bool"]], db),
    categories: new Table<Category>("categories", ["id", "nome", "parentId", "tipo", ["fixa", "bool"], ["dedutivelLivroCaixa", "bool"], "contaDre", ["escopo", "json"], "cor", "icone"], db),
    transactions: new Table<Transaction>("transactions", [
      "id", "entityId", "accountId", "categoryId", "kind", "competencia", "vencimento", "pagamento", ["valor", "num"], "moeda", ["cotacao", "num"], ["valorBrl", "num"], "descricao", "status",
      ["parcelaAtual", "num"], ["parcelaTotal", "num"], "grupoParcelamentoId", "recorrenciaId", ["tags", "json"], "anexo", "valorExpressao", "pagoPor", "clientId", "patientId", ["exportacao", "bool"], "invoiceId", "origemId", ["custoCambioBrl", "num"], ["meta", "json"],
    ], db),
    recurrences: new Table<Recurrence>("recurrences", ["id", "entityId", "descricao", "categoryId", "accountId", "kind", "periodicidade", ["diaVencimento", "num"], ["mesVencimento", "num"], ["valorPadrao", "num"], "moeda", ["ativa", "bool"], "inicio", "fim"], db),
    invoices: new Table<Invoice>("invoices", ["id", "entityId", "numero", "data", "clientId", "tomador", "moeda", ["valor", "num"], ["cotacao", "num"], ["valorBrl", "num"], "tipo", "status", "codigoServico", "municipio", ["transactionIds", "json"]], db),
    clients: new Table<Client>("clients", ["id", "entityId", "nome", "tipo", "pais", "moeda"], db),
    patients: new Table<Patient>("patients", ["id", "entityId", "nome", ["valorConsulta", "num"], ["ativo", "bool"]], db),
    investments: new Table<Investment>("investments", ["id", "entityId", "nome", "instituicao", "tipo", "indexador", ["ativo", "bool"]], db),
    snapshots: new Table<InvestmentSnapshot>("investment_snapshots", ["id", "investmentId", "data", ["saldo", "num"]], db),
    contributions: new Table<Contribution>("contributions", ["id", "investmentId", "transactionId", "data", ["valor", "num"]], db),
    payrolls: new Table<Payroll>("payroll", ["id", "entityId", "pessoaId", "competencia", ["bruto", "num"], ["inss", "num"], ["irrf", "num"], ["liquido", "num"], ["darfValor", "num"], "darfVencimento", ["darfPago", "bool"], ["transactionIds", "json"]], db),
    goals: new Table<Goal>("goals", ["id", "entityId", "nome", ["valorAlvo", "num"], "prazo", ["valorAtual", "num"], "investmentId"], db),
    budgets: new Table<Budget>("budgets", ["id", "entityId", "categoryId", "competencia", ["valorMeta", "num"]], db),
    rules: new Table<CategRule>("categ_rules", ["id", "pattern", ["regex", "bool"], "categoryId", ["escopo", "json"], ["aprendida", "bool"], ["prioridade", "num"]], db),
  };
}

export type Tables = ReturnType<typeof makeTables>;

export interface TaxTableRow { id: string; kind: string; vigenciaInicio: string; ativa: boolean; origem: string; data: unknown }

export function loadTaxTables(db: Database): TaxTableRow[] {
  return db.all<Row>("SELECT * FROM tax_tables").map((r) => ({ id: String(r.id), kind: String(r.kind), vigenciaInicio: String(r.vigencia_inicio), ativa: Boolean(r.ativa), origem: String(r.origem), data: JSON.parse(String(r.data)) }));
}
export function saveTaxTable(db: Database, row: TaxTableRow): void {
  db.run("INSERT OR REPLACE INTO tax_tables (id, kind, vigencia_inicio, ativa, origem, data) VALUES (?,?,?,?,?,?)", [row.id, row.kind, row.vigenciaInicio, row.ativa ? 1 : 0, row.origem, JSON.stringify(row.data)]);
}
export function deleteTaxTable(db: Database, id: string): void {
  db.run("DELETE FROM tax_tables WHERE id = ?", [id]);
}

export function loadSettings(db: Database): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of db.all<Row>("SELECT key, value FROM settings")) { try { out[String(r.key)] = JSON.parse(String(r.value)); } catch { out[String(r.key)] = r.value; } }
  return out;
}
export function saveSetting(db: Database, key: string, value: unknown): void {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

export function loadObligationsDone(db: Database): Set<string> {
  return new Set(db.all<Row>("SELECT id FROM obligations_done").map((r) => String(r.id)));
}
export function setObligationDone(db: Database, id: string, entityId: string, competencia: string, done: boolean): void {
  if (done) db.run("INSERT OR REPLACE INTO obligations_done (id, entity_id, competencia, done_at) VALUES (?,?,?,?)", [id, entityId, competencia, new Date().toISOString()]);
  else db.run("DELETE FROM obligations_done WHERE id = ?", [id]);
}
