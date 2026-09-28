/**
 * Processo principal do Electron: janela, persistência do arquivo SQLite (%APPDATA%/Dueto/dueto.db),
 * backups diários em .zip, diálogos de arquivo e busca opcional da cotação PTAX (só com rede).
 * Toda a lógica de negócio fica no renderer/core; aqui só há o que exige acesso ao sistema.
 */
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, nativeTheme, net, protocol } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, basename, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const APP_SCHEME = "app";
const APP_HOST = "dueto";

// esquema privilegiado para servir o build (suporta fetch do .wasm do SQLite e mantém a CSP 'self')
protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: false } }]);

function registerAppProtocol() {
  const distDir = join(__dirname, "../dist");
  protocol.handle(APP_SCHEME, (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || p === "") p = "/index.html";
    const file = normalize(join(distDir, p));
    if (!file.startsWith(normalize(distDir))) return new Response("forbidden", { status: 403 });
    if (!existsSync(file)) return new Response("not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}
// pasta de dados: %APPDATA%/Dueto, ou --data-dir=<caminho> (útil para testar sem tocar nos dados reais)
const dataDirArg = process.argv.find((a) => a.startsWith("--data-dir="))?.slice("--data-dir=".length);
const dataDir = dataDirArg ? dataDirArg : join(app.getPath("appData"), "Dueto");
// banco embutido só no build pessoal (extraResources → seed/dueto.db); o build público não tem este arquivo
const seedDbPath = join(process.resourcesPath ?? "", "seed", "dueto.db");
const dbPath = join(dataDir, "dueto.db");
const backupDir = join(dataDir, "backups");

function ensureDirs() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function createBackup(reason = "auto"): Promise<string | null> {
  ensureDirs();
  if (!existsSync(dbPath)) return null;
  const zip = new JSZip();
  zip.file("dueto.db", readFileSync(dbPath));
  zip.file("meta.json", JSON.stringify({ app: "Dueto", version: app.getVersion(), createdAt: new Date().toISOString(), reason }, null, 2));
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const file = join(backupDir, `dueto-${todayStamp()}${reason === "auto" ? "" : "-" + reason}.zip`);
  writeFileSync(file, buf);
  // mantém os 30 mais recentes
  const files = readdirSync(backupDir).filter((f) => f.endsWith(".zip")).map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const x of files.slice(30)) try { unlinkSync(join(backupDir, x.f)); } catch { /* ignore */ }
  return file;
}

const autoBackupFlag = () => join(dataDir, "auto-backup.json");
function autoBackupEnabled(): boolean {
  try { return JSON.parse(readFileSync(autoBackupFlag(), "utf8")).enabled === true; } catch { return false; }
}

/** Backup diário só depois que o usuário aceitou em Configurações → Backup (ou no assistente). */
function dailyBackupIfNeeded() {
  ensureDirs();
  if (!autoBackupEnabled()) return;
  const expected = join(backupDir, `dueto-${todayStamp()}.zip`);
  if (!existsSync(expected)) void createBackup("auto");
}

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Dueto",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f1115" : "#f6f7f9",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });
  win.once("ready-to-show", () => win?.show());
  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
  }
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  win.on("closed", () => { win = null; });
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Arquivo",
      submenu: [
        { label: "Exportar backup…", click: () => win?.webContents.send("menu", "backup:export") },
        { label: "Restaurar backup…", click: () => win?.webContents.send("menu", "backup:restore") },
        { type: "separator" },
        { label: "Importar extrato…", accelerator: "CmdOrCtrl+I", click: () => win?.webContents.send("menu", "import") },
        { type: "separator" },
        { role: "quit", label: "Sair" },
      ],
    },
    { label: "Editar", submenu: [{ role: "undo", label: "Desfazer" }, { role: "redo", label: "Refazer" }, { type: "separator" }, { role: "cut", label: "Recortar" }, { role: "copy", label: "Copiar" }, { role: "paste", label: "Colar" }, { role: "selectAll", label: "Selecionar tudo" }] },
    { label: "Exibir", submenu: [{ role: "reload", label: "Recarregar" }, { role: "toggleDevTools", label: "Ferramentas do desenvolvedor" }, { type: "separator" }, { role: "resetZoom", label: "Zoom padrão" }, { role: "zoomIn", label: "Aumentar zoom" }, { role: "zoomOut", label: "Diminuir zoom" }, { type: "separator" }, { role: "togglefullscreen", label: "Tela cheia" }] },
    { label: "Ajuda", submenu: [{ label: "Sobre o Dueto", click: () => win?.webContents.send("menu", "about") }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------ IPC
ipcMain.handle("app:info", () => ({ version: app.getVersion(), dataDir, dbPath, backupDir, platform: process.platform }));

ipcMain.handle("db:load", () => {
  ensureDirs();
  if (!existsSync(dbPath) && app.isPackaged && existsSync(seedDbPath)) {
    // build pessoal em máquina sem banco: restaura a cópia embutida
    writeFileSync(dbPath, readFileSync(seedDbPath));
  }
  if (!existsSync(dbPath)) return null;
  return readFileSync(dbPath);
});

ipcMain.handle("db:save", (_e, bytes: Uint8Array) => {
  ensureDirs();
  const tmp = dbPath + ".tmp";
  writeFileSync(tmp, Buffer.from(bytes));
  renameSync(tmp, dbPath);
  return true;
});

ipcMain.handle("backup:create", async () => createBackup("manual"));

ipcMain.handle("backup:setAuto", (_e, enabled: boolean) => {
  ensureDirs();
  const antes = autoBackupEnabled();
  writeFileSync(autoBackupFlag(), JSON.stringify({ enabled: !!enabled, updatedAt: new Date().toISOString() }));
  if (enabled && !antes) dailyBackupIfNeeded();
  return true;
});

ipcMain.handle("backup:list", () => {
  ensureDirs();
  return readdirSync(backupDir).filter((f) => f.endsWith(".zip")).map((f) => ({ file: join(backupDir, f), nome: f, data: statSync(join(backupDir, f)).mtime.toISOString(), tamanho: statSync(join(backupDir, f)).size })).sort((a, b) => b.data.localeCompare(a.data));
});

ipcMain.handle("backup:export", async (_e, bytes: Uint8Array) => {
  const r = await dialog.showSaveDialog(win!, { title: "Exportar backup", defaultPath: join(app.getPath("documents"), `dueto-backup-${todayStamp()}.zip`), filters: [{ name: "Backup Dueto", extensions: ["zip"] }] });
  if (r.canceled || !r.filePath) return null;
  const zip = new JSZip();
  zip.file("dueto.db", Buffer.from(bytes));
  zip.file("meta.json", JSON.stringify({ app: "Dueto", version: app.getVersion(), createdAt: new Date().toISOString(), reason: "export" }, null, 2));
  writeFileSync(r.filePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return r.filePath;
});

ipcMain.handle("backup:restore", async (_e, filePath?: string) => {
  let file = filePath;
  if (!file) {
    const r = await dialog.showOpenDialog(win!, { title: "Restaurar backup", properties: ["openFile"], filters: [{ name: "Backup Dueto", extensions: ["zip", "db"] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    file = r.filePaths[0];
  }
  const buf = readFileSync(file);
  if (file.endsWith(".db")) return buf;
  const zip = await JSZip.loadAsync(buf);
  const entry = zip.file("dueto.db");
  if (!entry) throw new Error("O arquivo não contém dueto.db");
  await createBackup("antes-de-restaurar");
  return await entry.async("nodebuffer");
});

ipcMain.handle("file:open", async (_e, opts: { title?: string; filters?: { name: string; extensions: string[] }[]; multiple?: boolean }) => {
  const r = await dialog.showOpenDialog(win!, { title: opts.title ?? "Abrir arquivo", properties: opts.multiple ? ["openFile", "multiSelections"] : ["openFile"], filters: opts.filters });
  if (r.canceled) return [];
  return r.filePaths.map((p) => ({ name: basename(p), path: p, bytes: readFileSync(p) }));
});

ipcMain.handle("file:save", async (_e, opts: { defaultName: string; bytes: Uint8Array; filters?: { name: string; extensions: string[] }[] }) => {
  const r = await dialog.showSaveDialog(win!, { defaultPath: join(app.getPath("documents"), opts.defaultName), filters: opts.filters });
  if (r.canceled || !r.filePath) return null;
  writeFileSync(r.filePath, Buffer.from(opts.bytes));
  return r.filePath;
});

ipcMain.handle("shell:open", (_e, target: string) => shell.openExternal(target));
ipcMain.handle("shell:showInFolder", (_e, p: string) => shell.showItemInFolder(p));

/** Cotação PTAX (BCB/Olinda). Só funciona com rede; o app nunca depende disso. */
ipcMain.handle("ptax:fetch", async (_e, isoDate: string) => {
  const [y, m, d] = isoDate.split("-");
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${m}-${d}-${y}'&$format=json`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { value: { cotacaoCompra: number; cotacaoVenda: number; dataHoraCotacao: string }[] };
    const v = json.value?.[0];
    if (!v) return { ok: false, erro: "Sem cotação para a data (fim de semana/feriado?)" };
    return { ok: true, compra: v.cotacaoCompra, venda: v.cotacaoVenda, dataHora: v.dataHoraCotacao };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
});

// ------------------------------------------------------------------ ciclo de vida
app.setAppUserModelId("app.dueto.desktop");
app.whenReady().then(() => {
  ensureDirs();
  if (!isDev) registerAppProtocol();
  buildMenu();
  createWindow();
  dailyBackupIfNeeded();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
