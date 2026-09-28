import { contextBridge, ipcRenderer } from "electron";

export interface DuetoBridge {
  info(): Promise<{ version: string; dataDir: string; dbPath: string; backupDir: string; platform: string }>;
  db: { load(): Promise<Uint8Array | null>; save(bytes: Uint8Array): Promise<boolean> };
  backup: {
    create(): Promise<string | null>;
    setAuto(enabled: boolean): Promise<boolean>;
    list(): Promise<{ file: string; nome: string; data: string; tamanho: number }[]>;
    export(bytes: Uint8Array): Promise<string | null>;
    restore(filePath?: string): Promise<Uint8Array | null>;
  };
  file: {
    open(opts: { title?: string; filters?: { name: string; extensions: string[] }[]; multiple?: boolean }): Promise<{ name: string; path: string; bytes: Uint8Array }[]>;
    save(opts: { defaultName: string; bytes: Uint8Array; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
  };
  shell: { open(url: string): Promise<void>; showInFolder(p: string): Promise<void> };
  ptax(isoDate: string): Promise<{ ok: true; compra: number; venda: number; dataHora: string } | { ok: false; erro: string }>;
  onMenu(cb: (action: string) => void): () => void;
}

const bridge: DuetoBridge = {
  info: () => ipcRenderer.invoke("app:info"),
  db: {
    load: async () => { const b = await ipcRenderer.invoke("db:load"); return b ? new Uint8Array(b) : null; },
    save: (bytes) => ipcRenderer.invoke("db:save", bytes),
  },
  backup: {
    create: () => ipcRenderer.invoke("backup:create"),
    setAuto: (enabled) => ipcRenderer.invoke("backup:setAuto", enabled),
    list: () => ipcRenderer.invoke("backup:list"),
    export: (bytes) => ipcRenderer.invoke("backup:export", bytes),
    restore: async (p) => { const b = await ipcRenderer.invoke("backup:restore", p); return b ? new Uint8Array(b) : null; },
  },
  file: {
    open: async (opts) => { const r = (await ipcRenderer.invoke("file:open", opts)) as { name: string; path: string; bytes: Uint8Array }[]; return r.map((f) => ({ ...f, bytes: new Uint8Array(f.bytes) })); },
    save: (opts) => ipcRenderer.invoke("file:save", opts),
  },
  shell: { open: (u) => ipcRenderer.invoke("shell:open", u), showInFolder: (p) => ipcRenderer.invoke("shell:showInFolder", p) },
  ptax: (d) => ipcRenderer.invoke("ptax:fetch", d),
  onMenu: (cb) => {
    const h = (_e: unknown, action: string) => cb(action);
    ipcRenderer.on("menu", h);
    return () => ipcRenderer.removeListener("menu", h);
  },
};

contextBridge.exposeInMainWorld("dueto", bridge);
