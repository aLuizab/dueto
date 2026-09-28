/**
 * Banco SQLite local via sql.js (WASM, sem módulos nativos).
 * O arquivo é carregado/salvo pelo processo principal do Electron em %APPDATA%/Dueto/dueto.db.
 * Fora do Electron (dev no navegador), persiste em IndexedDB.
 */
import initSqlJs, { type Database as SqlDatabase, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { MIGRATIONS } from "./schema";

export type Row = Record<string, unknown>;

declare global {
  interface Window { dueto?: import("../../electron/preload").DuetoBridge }
}

const IDB_NAME = "dueto-db";
const IDB_KEY = "dueto.db";

async function idbLoad(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const tx = req.result.transaction("files", "readonly");
        const g = tx.objectStore("files").get(IDB_KEY);
        g.onsuccess = () => resolve(g.result ? new Uint8Array(g.result as ArrayBuffer) : null);
        g.onerror = () => resolve(null);
      };
    } catch { resolve(null); }
  });
}

async function idbSave(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onerror = () => resolve();
      req.onsuccess = () => {
        const tx = req.result.transaction("files", "readwrite");
        tx.objectStore("files").put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
    } catch { resolve(); }
  });
}

export class Database {
  private static sql: SqlJsStatic | null = null;
  private db!: SqlDatabase;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  onSaved?: (at: Date) => void;
  onError?: (e: Error) => void;

  static async open(): Promise<Database> {
    if (!Database.sql) Database.sql = await initSqlJs({ locateFile: () => wasmUrl });
    const inst = new Database();
    const bytes = window.dueto ? await window.dueto.db.load() : await idbLoad();
    inst.db = bytes ? new Database.sql.Database(bytes) : new Database.sql.Database();
    inst.migrate();
    return inst;
  }

  /** substitui o banco pelos bytes de um backup (e salva) */
  async replaceWith(bytes: Uint8Array): Promise<void> {
    this.db.close();
    this.db = new Database.sql!.Database(bytes);
    this.migrate();
    await this.saveNow();
  }

  private migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL)");
    const cur = this.get<{ v: number }>("SELECT COALESCE(MAX(version),0) AS v FROM schema_version")?.v ?? 0;
    for (const m of MIGRATIONS.filter((x) => x.version > cur).sort((a, b) => a.version - b.version)) {
      this.db.exec("BEGIN");
      try {
        this.db.exec(m.sql);
        this.db.run("INSERT INTO schema_version(version, applied_at) VALUES (?, ?)", [m.version, new Date().toISOString()]);
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }

  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params as never);
    this.markDirty();
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.markDirty();
  }

  all<T = Row>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      return out;
    } finally {
      stmt.free();
    }
  }

  get<T = Row>(sql: string, params: unknown[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN");
    try {
      const r = fn();
      this.db.exec("COMMIT");
      this.markDirty();
      return r;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  export(): Uint8Array {
    return this.db.export();
  }

  private markDirty() {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.saveNow(), 800);
  }

  async saveNow(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.dirty && !this.db) return;
    this.dirty = false;
    try {
      const bytes = this.db.export();
      if (window.dueto) await window.dueto.db.save(bytes);
      else await idbSave(bytes);
      this.onSaved?.(new Date());
    } catch (e) {
      this.dirty = true;
      this.onError?.(e as Error);
    }
  }
}
