/**
 * Estado global (zustand) com persistência em SQLite. Todas as coleções ficam em memória
 * (50 mil lançamentos cabem com folga) e cada mutação grava no banco e agenda o save do arquivo.
 */
import { create } from "zustand";
import type { Account, Budget, Category, Client, Contribution, Entity, Goal, Investment, InvestmentSnapshot, Invoice, Patient, Payroll, Recurrence, Transaction } from "@core/domain/types";
import { SEED_CATEGORIES } from "@core/seed/categories";
import { SEED_RULES, type CategRule, learnRule } from "@core/categorize";
import { SEED_TAX_TABLES, type TaxTables, type IrpfTable, type InssTable, type SimplesAnexoTable, type SimplesParams, type MeiParams, type PresumidoParams, type IssMunicipio, type DividendosParams } from "@core/tax/tables";
import { newId } from "@core/ids";
import { currentMonthKey } from "@core/dates";
import { Database } from "@/db/database";
import { deleteTaxTable, loadObligationsDone, loadSettings, loadTaxTables, makeTables, saveSetting, saveTaxTable, setObligationDone, type Tables, type TaxTableRow } from "@/db/repo";

export type Theme = "light" | "dark" | "system";

export interface Aviso { tone: "warn" | "bad" | "info"; msg: string; to?: string }

export interface AppState {
  ready: boolean;
  erro: string | null;
  db: Database | null;
  tables: Tables | null;
  ultimoSave: Date | null;
  info: { version: string; dataDir: string; dbPath: string; backupDir: string } | null;

  entities: Entity[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  invoices: Invoice[];
  clients: Client[];
  patients: Patient[];
  investments: Investment[];
  snapshots: InvestmentSnapshot[];
  contributions: Contribution[];
  payrolls: Payroll[];
  goals: Goal[];
  budgets: Budget[];
  rules: CategRule[];
  taxTables: TaxTables;
  settings: Record<string, unknown>;
  obligationsDone: Set<string>;

  // UI
  competencia: string;
  theme: Theme;
  busca: boolean;
  avisos: Aviso[];
  setAvisos(a: Aviso[]): void;
  setBackupAuto(v: boolean): Promise<void>;

  init(): Promise<void>;
  setCompetencia(mk: string): void;
  setTheme(t: Theme): void;
  setBusca(open: boolean): void;
  setSetting(key: string, value: unknown): void;

  upsertEntity(e: Entity): void;
  deleteEntity(id: string): void;
  upsertAccount(a: Account): void;
  deleteAccount(id: string): void;
  upsertCategory(c: Category): void;
  deleteCategory(id: string): void;
  upsertTransaction(t: Transaction, aprender?: boolean): void;
  upsertTransactions(ts: Transaction[]): void;
  deleteTransaction(id: string): void;
  deleteTransactions(ids: string[]): void;
  upsertRecurrence(r: Recurrence): void;
  deleteRecurrence(id: string): void;
  upsertInvoice(i: Invoice): void;
  deleteInvoice(id: string): void;
  upsertClient(c: Client): void;
  deleteClient(id: string): void;
  upsertPatient(p: Patient): void;
  deletePatient(id: string): void;
  upsertInvestment(i: Investment): void;
  deleteInvestment(id: string): void;
  upsertSnapshot(s: InvestmentSnapshot): void;
  deleteSnapshot(id: string): void;
  upsertContribution(c: Contribution): void;
  deleteContribution(id: string): void;
  upsertPayroll(p: Payroll): void;
  deletePayroll(id: string): void;
  upsertGoal(g: Goal): void;
  deleteGoal(id: string): void;
  upsertBudget(b: Budget): void;
  deleteBudget(id: string): void;
  upsertRule(r: CategRule): void;
  deleteRule(id: string): void;
  upsertTaxTable(kind: keyof TaxTables, row: { id: string; vigenciaInicio: string; ativa: boolean } & Record<string, unknown>): void;
  deleteTaxTable(kind: keyof TaxTables, id: string): void;
  toggleObligation(id: string, entityId: string, competencia: string, done: boolean): void;
  replaceDatabase(bytes: Uint8Array): Promise<void>;
  resetAll(): void;
}

function assembleTaxTables(rows: TaxTableRow[]): TaxTables {
  const t: TaxTables = { irpf: [], inss: [], simplesAnexos: [], simplesParams: [], mei: [], presumido: [], iss: [], dividendos: [] };
  for (const r of rows) {
    const data = { ...(r.data as object), id: r.id, vigenciaInicio: r.vigenciaInicio, ativa: r.ativa } as never;
    if (r.kind in t) (t[r.kind as keyof TaxTables] as unknown[]).push(data);
  }
  for (const k of Object.keys(t) as (keyof TaxTables)[]) (t[k] as { vigenciaInicio: string }[]).sort((a, b) => a.vigenciaInicio.localeCompare(b.vigenciaInicio));
  return t;
}

function seedTaxTables(db: Database) {
  const rows: TaxTableRow[] = [];
  const push = (kind: keyof TaxTables, list: { id: string; vigenciaInicio: string; ativa: boolean; origem?: string }[]) => {
    for (const x of list) rows.push({ id: x.id, kind, vigenciaInicio: x.vigenciaInicio, ativa: x.ativa, origem: x.origem ?? "seed", data: x });
  };
  push("irpf", SEED_TAX_TABLES.irpf); push("inss", SEED_TAX_TABLES.inss); push("simplesAnexos", SEED_TAX_TABLES.simplesAnexos); push("simplesParams", SEED_TAX_TABLES.simplesParams);
  push("mei", SEED_TAX_TABLES.mei); push("presumido", SEED_TAX_TABLES.presumido); push("iss", SEED_TAX_TABLES.iss); push("dividendos", SEED_TAX_TABLES.dividendos);
  db.transaction(() => { for (const r of rows) saveTaxTable(db, r); });
}

export const useStore = create<AppState>((set, get) => {
  const tbl = () => get().tables!;
  const dbx = () => get().db!;
  const loadAll = () => {
    const t = tbl();
    const db = dbx();
    set({
      entities: t.entities.all(), accounts: t.accounts.all(), categories: t.categories.all(), transactions: t.transactions.all(), recurrences: t.recurrences.all(),
      invoices: t.invoices.all(), clients: t.clients.all(), patients: t.patients.all(), investments: t.investments.all(), snapshots: t.snapshots.all(), contributions: t.contributions.all(),
      payrolls: t.payrolls.all(), goals: t.goals.all(), budgets: t.budgets.all(), rules: t.rules.all(), taxTables: assembleTaxTables(loadTaxTables(db)), settings: loadSettings(db), obligationsDone: loadObligationsDone(db),
    });
  };
  const ups = <T extends { id: string }>(key: keyof AppState, table: keyof Tables) => (obj: T) => {
    (tbl()[table] as unknown as { upsert(o: T): void }).upsert(obj);
    const list = get()[key] as unknown as T[];
    const i = list.findIndex((x) => x.id === obj.id);
    const next = i >= 0 ? list.map((x) => (x.id === obj.id ? obj : x)) : [...list, obj];
    set({ [key]: next } as Partial<AppState>);
  };
  const del = (key: keyof AppState, table: keyof Tables) => (id: string) => {
    (tbl()[table] as unknown as { delete(id: string): void }).delete(id);
    set({ [key]: (get()[key] as { id: string }[]).filter((x) => x.id !== id) } as Partial<AppState>);
  };

  return {
    ready: false, erro: null, db: null, tables: null, ultimoSave: null, info: null,
    entities: [], accounts: [], categories: [], transactions: [], recurrences: [], invoices: [], clients: [], patients: [], investments: [], snapshots: [], contributions: [], payrolls: [], goals: [], budgets: [], rules: [],
    taxTables: SEED_TAX_TABLES, settings: {}, obligationsDone: new Set(),
    competencia: currentMonthKey(), theme: "system", busca: false, avisos: [],
    setAvisos(a) { const cur = get().avisos; if (JSON.stringify(cur) !== JSON.stringify(a)) set({ avisos: a }); },
    async setBackupAuto(v) { get().setSetting("backup.auto", v); if (window.dueto) await window.dueto.backup.setAuto(v); },

    async init() {
      try {
        const db = await Database.open();
        db.onSaved = (at) => set({ ultimoSave: at });
        db.onError = (e) => set({ erro: `Falha ao salvar o banco: ${e.message}` });
        const tables = makeTables(() => db);
        set({ db, tables });
        // seeds na primeira execução
        if (tables.categories.all().length === 0) tables.categories.upsertMany(SEED_CATEGORIES);
        else {
          const atuais = tables.categories.all();
          const ids = new Set(atuais.map((c) => c.id));
          tables.categories.upsertMany(SEED_CATEGORIES.filter((c) => !ids.has(c.id)));
          // categorias do autônomo ficaram genéricas: atualiza o nome das que ainda têm o nome antigo da semente
          const antigos: Record<string, string> = { "pf-rec-consulta": "Consultas", "pf-rec-pacote": "Pacotes / acompanhamento", "pf-aluguel-sala": "Aluguel de sala", "pf-conselho": "Conselho profissional" };
          for (const c of atuais) { const seed = SEED_CATEGORIES.find((x) => x.id === c.id); if (seed && antigos[c.id] === c.nome && seed.nome !== c.nome) tables.categories.upsert({ ...c, nome: seed.nome }); }
        }
        if (tables.rules.all().length === 0) tables.rules.upsertMany(SEED_RULES);
        if (loadTaxTables(db).length === 0) seedTaxTables(db);
        loadAll();
        const s = get().settings;
        const theme = (s["ui.theme"] as Theme) ?? "system";
        set({ theme, ready: true, competencia: (s["ui.competencia"] as string) ?? currentMonthKey() });
        if (window.dueto) { set({ info: await window.dueto.info() }); await window.dueto.backup.setAuto(s["backup.auto"] === true); }
      } catch (e) {
        set({ erro: (e as Error).message, ready: true });
      }
    },
    setCompetencia(mk) { set({ competencia: mk }); if (get().db) saveSetting(dbx(), "ui.competencia", mk); },
    setTheme(t) { set({ theme: t }); if (get().db) saveSetting(dbx(), "ui.theme", t); },
    setBusca(open) { set({ busca: open }); },
    setSetting(key, value) { saveSetting(dbx(), key, value); set({ settings: { ...get().settings, [key]: value } }); },

    upsertEntity: ups<Entity>("entities", "entities"),
    deleteEntity: del("entities", "entities"),
    upsertAccount: ups<Account>("accounts", "accounts"),
    deleteAccount: del("accounts", "accounts"),
    upsertCategory: ups<Category>("categories", "categories"),
    deleteCategory: del("categories", "categories"),
    upsertTransaction(t, aprender) {
      const before = get().transactions.find((x) => x.id === t.id);
      ups<Transaction>("transactions", "transactions")(t);
      if (aprender && t.categoryId && before && before.categoryId !== t.categoryId) {
        const ent = get().entities.find((e) => e.id === t.entityId);
        const rule = learnRule(t.descricao, t.categoryId, ent?.tipo ?? "CASAL");
        get().upsertRule(rule);
      }
    },
    upsertTransactions(ts) {
      tbl().transactions.upsertMany(ts);
      const map = new Map(get().transactions.map((x) => [x.id, x]));
      for (const t of ts) map.set(t.id, t);
      set({ transactions: [...map.values()] });
    },
    deleteTransaction: del("transactions", "transactions"),
    deleteTransactions(ids) {
      tbl().transactions.deleteMany(ids);
      const s = new Set(ids);
      set({ transactions: get().transactions.filter((t) => !s.has(t.id)) });
    },
    upsertRecurrence: ups<Recurrence>("recurrences", "recurrences"),
    deleteRecurrence: del("recurrences", "recurrences"),
    upsertInvoice: ups<Invoice>("invoices", "invoices"),
    deleteInvoice: del("invoices", "invoices"),
    upsertClient: ups<Client>("clients", "clients"),
    deleteClient: del("clients", "clients"),
    upsertPatient: ups<Patient>("patients", "patients"),
    deletePatient: del("patients", "patients"),
    upsertInvestment: ups<Investment>("investments", "investments"),
    deleteInvestment: del("investments", "investments"),
    upsertSnapshot: ups<InvestmentSnapshot>("snapshots", "snapshots"),
    deleteSnapshot: del("snapshots", "snapshots"),
    upsertContribution: ups<Contribution>("contributions", "contributions"),
    deleteContribution: del("contributions", "contributions"),
    upsertPayroll: ups<Payroll>("payrolls", "payrolls"),
    deletePayroll: del("payrolls", "payrolls"),
    upsertGoal: ups<Goal>("goals", "goals"),
    deleteGoal: del("goals", "goals"),
    upsertBudget: ups<Budget>("budgets", "budgets"),
    deleteBudget: del("budgets", "budgets"),
    upsertRule: ups<CategRule>("rules", "rules"),
    deleteRule: del("rules", "rules"),
    upsertTaxTable(kind, row) {
      saveTaxTable(dbx(), { id: row.id, kind, vigenciaInicio: row.vigenciaInicio, ativa: row.ativa, origem: (row.origem as string) ?? "usuario", data: row });
      set({ taxTables: assembleTaxTables(loadTaxTables(dbx())) });
    },
    deleteTaxTable(_kind, id) {
      deleteTaxTable(dbx(), id);
      set({ taxTables: assembleTaxTables(loadTaxTables(dbx())) });
    },
    toggleObligation(id, entityId, competencia, done) {
      setObligationDone(dbx(), id, entityId, competencia, done);
      const s = new Set(get().obligationsDone);
      if (done) s.add(id); else s.delete(id);
      set({ obligationsDone: s });
    },
    async replaceDatabase(bytes) {
      await dbx().replaceWith(bytes);
      loadAll();
    },
    resetAll() {
      const db = dbx();
      db.transaction(() => {
        for (const tname of ["entities", "accounts", "categories", "transactions", "recurrences", "invoices", "clients", "patients", "investments", "investment_snapshots", "contributions", "tax_tables", "payroll", "goals", "budgets", "categ_rules", "obligations_done", "settings"]) db.exec(`DELETE FROM ${tname}`);
      });
      tbl().categories.upsertMany(SEED_CATEGORIES);
      tbl().rules.upsertMany(SEED_RULES);
      seedTaxTables(db);
      loadAll();
      set({ competencia: currentMonthKey() });
    },
  };
});

// ------------------------------------------------------------- seletores auxiliares
export const selPessoas = (s: AppState) => s.entities.filter((e) => e.tipo === "PESSOA" && e.ativa);
export const selCasal = (s: AppState) => s.entities.find((e) => e.tipo === "CASAL");
export const selPJ = (s: AppState) => s.entities.find((e) => e.tipo === "PJ" && e.ativa);
export const selAutonomo = (s: AppState) => s.entities.find((e) => e.tipo === "AUTONOMO_PF" && e.ativa);

export function novoTx(base: Partial<Transaction> & Pick<Transaction, "entityId" | "kind" | "competencia" | "descricao" | "valor">): Transaction {
  return {
    id: newId("tx"), accountId: null, categoryId: null, vencimento: null, pagamento: null, moeda: "BRL", cotacao: null, valorBrl: base.valor, status: "pendente",
    parcelaAtual: null, parcelaTotal: null, grupoParcelamentoId: null, recorrenciaId: null, tags: [], anexo: null, valorExpressao: null, pagoPor: null, clientId: null, patientId: null, exportacao: false, invoiceId: null, origemId: null, custoCambioBrl: null, meta: {},
    ...base,
  };
}

export type { IrpfTable, InssTable, SimplesAnexoTable, SimplesParams, MeiParams, PresumidoParams, IssMunicipio, DividendosParams };
