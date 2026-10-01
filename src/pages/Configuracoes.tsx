/** Configurações: entidades, contas/cartões, categorias e regras, tabelas fiscais, backup, sobre. */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Account, Category, Entity, RegimeTributario } from "@core/domain/types";
import { fmtDate } from "@core/dates";
import { newId, slug } from "@core/ids";
import { fmtMoney } from "@core/money";
import { categoriaNome } from "@core/seed/categories";
import { tabelaDesatualizada, type TaxTables } from "@core/tax/tables";
import { Alert, Button, Card, Confirm, Dialog, Field, InfoTip, Input, Kbd, PageHeader, Pill, Select, Switch, TabPanel, Tabs, Textarea } from "@/components/ui";
import { useStore } from "@/state/store";

export default function Configuracoes() {
  const loc = useLocation();
  const [tab, setTab] = useState("entidades");
  useEffect(() => { const h = loc.hash.replace("#", ""); if (h) setTab(h); }, [loc.hash]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Configurações" />
      <Tabs value={tab} onValueChange={setTab} items={[{ value: "entidades", label: "Entidades" }, { value: "contas", label: "Contas e cartões" }, { value: "categorias", label: "Categorias e regras" }, { value: "fiscal", label: "Tabelas fiscais" }, { value: "backup", label: "Backup" }, { value: "sobre", label: "Sobre" }]}>
        <TabPanel value="entidades"><Entidades /></TabPanel>
        <TabPanel value="contas"><Contas /></TabPanel>
        <TabPanel value="categorias"><Categorias /></TabPanel>
        <TabPanel value="fiscal"><Fiscal /></TabPanel>
        <TabPanel value="backup"><Backup /></TabPanel>
        <TabPanel value="sobre"><Sobre /></TabPanel>
      </Tabs>
    </div>
  );
}

const TIPO_LABEL = { PESSOA: "Pessoa", CASAL: "Orçamento comum", PJ: "Empresa (PJ)" };

function Entidades() {
  const s = useStore();
  const [edit, setEdit] = useState<Entity | null>(null);
  const [del, setDel] = useState<Entity | null>(null);
  const pessoas = s.entities.filter((e) => e.tipo === "PESSOA");
  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => setEdit({ id: newId("ent"), tipo: "PESSOA", nome: "", config: {}, ativa: true })}><Plus size={14} /> Pessoa</Button>
        {!s.entities.some((e) => e.tipo === "PJ") && <Button onClick={() => setEdit({ id: newId("ent"), tipo: "PJ", nome: "", regime: "SIMPLES_III", config: { fatura: { moeda: "BRL", exportacao: false }, proLabore: { modo: "minimoFatorR" }, donoPessoaId: pessoas[0]?.id, mesTfe: 7 }, ativa: true })}><Plus size={14} /> Empresa</Button>}
      </div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Nome</th><th>Tipo</th><th>Detalhes</th><th>Ativa</th><th></th></tr></thead>
        <tbody>{s.entities.map((e) => <tr key={e.id}><td className="font-medium">{e.nome}</td><td><Pill tone="muted">{TIPO_LABEL[e.tipo]}</Pill></td>
          <td className="text-xs text-text-2">{e.tipo === "PJ" && `${e.regime} · ${e.municipio ?? ""}/${e.uf ?? ""} · ${e.config.fatura?.moeda ?? "BRL"}${e.config.fatura?.exportacao ? " exportação" : ""} · início ${e.config.inicioAtividade ?? "?"}`}{e.tipo === "PESSOA" && `renda estimada ${fmtMoney(e.config.rendaEstimada ?? 0)}`}{e.tipo === "CASAL" && `divisão ${e.config.splitRule ?? "proporcional"}`}</td>
          <td><Switch checked={e.ativa} onCheckedChange={(v) => s.upsertEntity({ ...e, ativa: v })} /></td><td><div className="flex gap-1 justify-end"><Button size="sm" onClick={() => setEdit(e)}>Editar</Button>{e.tipo !== "CASAL" && <Button size="sm" variant="ghost" onClick={() => setDel(e)}>Excluir</Button>}</div></td></tr>)}</tbody></table></div>
      {edit && <EntityForm ent={edit} onClose={() => setEdit(null)} />}
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir entidade" message={`Excluir "${del?.nome}" e todos os seus lançamentos?`} danger onConfirm={() => { if (!del) return; s.deleteTransactions(s.transactions.filter((t) => t.entityId === del.id).map((t) => t.id)); s.deleteEntity(del.id); }} />
    </div>
  );
}

function EntityForm({ ent, onClose }: { ent: Entity; onClose: () => void }) {
  const s = useStore();
  const [e, setE] = useState(ent);
  const cfg = (patch: Partial<Entity["config"]>) => setE({ ...e, config: { ...e.config, ...patch } });
  const pessoas = s.entities.filter((x) => x.tipo === "PESSOA");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`${TIPO_LABEL[e.tipo]}`} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!e.nome.trim()} onClick={() => { s.upsertEntity(e); onClose(); }}>Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2"><Input value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} /></Field>
        {e.tipo === "PESSOA" && <Field label="Renda estimada mensal"><Input className="mono" value={e.config.rendaEstimada ?? ""} onChange={(x) => cfg({ rendaEstimada: Number(x.target.value.replace(",", ".")) || 0 })} /></Field>}
        {e.tipo === "CASAL" && <Field label="Divisão"><Select value={e.config.splitRule ?? "proporcional"} onChange={(x) => cfg({ splitRule: x.target.value as "igual" })}><option value="proporcional">Proporcional à renda</option><option value="igual">50/50</option><option value="manual">Manual</option></Select></Field>}
        {e.tipo === "PJ" && <Field label="Pessoa dona / sócio"><Select value={e.config.donoPessoaId ?? ""} onChange={(x) => cfg({ donoPessoaId: x.target.value })}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>}
        {e.tipo === "PJ" && (<>
          <Field label="CNPJ"><Input className="mono" value={e.documento ?? ""} onChange={(x) => setE({ ...e, documento: x.target.value })} /></Field>
          <Field label="Regime"><Select value={e.regime ?? "SIMPLES_III"} onChange={(x) => setE({ ...e, regime: x.target.value as RegimeTributario })}><option value="SIMPLES_III">Simples — Anexo III (Fator R)</option><option value="SIMPLES_V">Simples — Anexo V</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido</option></Select></Field>
          <Field label="Município"><Input value={e.municipio ?? ""} onChange={(x) => setE({ ...e, municipio: x.target.value })} /></Field>
          <Field label="UF"><Input value={e.uf ?? ""} onChange={(x) => setE({ ...e, uf: x.target.value.toUpperCase().slice(0, 2) })} /></Field>
          <Field label="Início de atividade"><Input type="month" value={e.config.inicioAtividade ?? ""} onChange={(x) => cfg({ inicioAtividade: x.target.value })} /></Field>
          <Field label="Moeda de faturamento"><Select value={e.config.fatura?.moeda ?? "USD"} onChange={(x) => cfg({ fatura: { moeda: x.target.value as "USD", exportacao: e.config.fatura?.exportacao ?? true } })}><option>USD</option><option>EUR</option><option>BRL</option></Select></Field>
          <Field label="ISS (alíquota)"><Input className="mono" value={e.config.issAliquota ?? ""} onChange={(x) => cfg({ issAliquota: Number(x.target.value.replace(",", ".")) })} /></Field>
          <Field label="Código de serviço"><Input value={e.config.issCodigoServico ?? ""} onChange={(x) => cfg({ issCodigoServico: x.target.value })} placeholder="1.04" /></Field>
          <div className="col-span-2 flex flex-col gap-2">
            <Switch checked={e.config.fatura?.exportacao ?? true} onCheckedChange={(v) => cfg({ fatura: { moeda: e.config.fatura?.moeda ?? "USD", exportacao: v } })} label="Fatura para o exterior (exportação de serviço)" />
            <Switch checked={!!e.config.escrituracaoContabil} onCheckedChange={(v) => cfg({ escrituracaoContabil: v })} label="Mantém escrituração contábil (lucro distribuível pelo balanço)" />
            <Switch checked={!!e.config.fatorRManual} onCheckedChange={(v) => cfg({ fatorRManual: v })} label="Ignorar o Fator R e fixar o anexo do regime" />
          </div>
          <Field label="Método do Fator R" className="col-span-2">
            <Select value={e.config.fatorRMetodo ?? "anterior12"} onChange={(x) => cfg({ fatorRMetodo: x.target.value as "anterior12" })}>
              <option value="anterior12">12 meses anteriores (regra legal)</option><option value="corrente12">12 meses incluindo o mês corrente</option><option value="mensal">Só o mês (folha ÷ receita do mês)</option>
            </Select>
          </Field>
        </>)}
      </div>
    </Dialog>
  );
}

function Contas() {
  const s = useStore();
  const [edit, setEdit] = useState<Account | null>(null);
  const donos = s.entities;
  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      <div><Button variant="primary" onClick={() => setEdit({ id: newId("acc"), entityId: s.entities.find((e) => e.tipo === "CASAL")?.id ?? "", nome: "", tipo: "cartao", moeda: "BRL", ativa: true })}><Plus size={14} /> Conta / cartão</Button></div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Nome</th><th>Tipo</th><th>Dono</th><th>Instituição</th><th className="r">Fechamento</th><th className="r">Vencimento</th><th>Ativa</th><th></th></tr></thead>
        <tbody>{s.accounts.map((a) => <tr key={a.id}><td>{a.nome}</td><td>{a.tipo}</td><td className="text-text-2">{s.entities.find((e) => e.id === a.entityId)?.nome}</td><td className="text-text-2">{a.instituicao ?? ""}</td><td className="r num">{a.diaFechamento ?? "—"}</td><td className="r num">{a.diaVencimento ?? "—"}</td><td><Switch checked={a.ativa} onCheckedChange={(v) => s.upsertAccount({ ...a, ativa: v })} /></td><td><Button size="sm" onClick={() => setEdit(a)}>Editar</Button></td></tr>)}
          {s.accounts.length === 0 && <tr><td colSpan={8} className="text-center text-text-3 py-6">Nenhuma conta. A importação cria cartões a partir de sufixos como "(Porto)".</td></tr>}</tbody></table></div>
      {edit && <Dialog open onOpenChange={(o) => !o && setEdit(null)} title="Conta / cartão" footer={<><Button variant="danger" onClick={() => { s.deleteAccount(edit.id); setEdit(null); }}>Excluir</Button><Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" disabled={!edit.nome.trim()} onClick={() => { s.upsertAccount(edit); setEdit(null); }}>Salvar</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" className="col-span-2"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
          <Field label="Tipo"><Select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as Account["tipo"] })}><option value="conta">Conta corrente</option><option value="cartao">Cartão de crédito</option><option value="carteira">Carteira digital</option><option value="investimento">Conta de investimento</option><option value="dinheiro">Dinheiro</option></Select></Field>
          <Field label="Dono"><Select value={edit.entityId} onChange={(e) => setEdit({ ...edit, entityId: e.target.value })}>{donos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</Select></Field>
          <Field label="Instituição"><Input value={edit.instituicao ?? ""} onChange={(e) => setEdit({ ...edit, instituicao: e.target.value })} /></Field>
          <Field label="Moeda"><Select value={edit.moeda} onChange={(e) => setEdit({ ...edit, moeda: e.target.value as "BRL" })}><option>BRL</option><option>USD</option><option>EUR</option></Select></Field>
          {edit.tipo === "cartao" && <><Field label="Dia de fechamento"><Input type="number" min={1} max={31} value={edit.diaFechamento ?? ""} onChange={(e) => setEdit({ ...edit, diaFechamento: Number(e.target.value) || undefined })} /></Field><Field label="Dia de vencimento"><Input type="number" min={1} max={31} value={edit.diaVencimento ?? ""} onChange={(e) => setEdit({ ...edit, diaVencimento: Number(e.target.value) || undefined })} /></Field></>}
        </div>
      </Dialog>}
    </div>
  );
}

function Categorias() {
  const s = useStore();
  const [edit, setEdit] = useState<Category | null>(null);
  const [filtro, setFiltro] = useState<"CASAL" | "PJ">("CASAL");
  const cats = s.categories.filter((c) => !c.escopo || c.escopo.includes(filtro));
  const raizes = cats.filter((c) => !c.parentId);
  const aprendidas = s.rules.filter((r) => r.aprendida);
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          {(["CASAL", "PJ"] as const).map((k) => <button key={k} className={`pill ${filtro === k ? "pill-accent" : "pill-muted"}`} onClick={() => setFiltro(k)}>{TIPO_LABEL[k]}</button>)}
          <Button className="ml-auto" size="sm" variant="primary" onClick={() => setEdit({ id: "", nome: "", parentId: null, tipo: "despesa", fixa: false, contaDre: null, escopo: [filtro, ...(filtro === "CASAL" ? ["PESSOA" as const] : [])] })}><Plus size={14} /> Categoria</Button>
        </div>
        <div className="table-wrap"><table className="data"><thead><tr><th>Categoria</th><th>Tipo</th><th>Fixa</th><th>Conta DRE</th><th></th></tr></thead>
          <tbody>{raizes.flatMap((r) => [r, ...cats.filter((c) => c.parentId === r.id)]).map((c) => <tr key={c.id}><td style={{ paddingLeft: c.parentId ? 28 : 10 }}>{c.cor && !c.parentId && <span className="inline-block h-2.5 w-2.5 rounded-sm mr-2" style={{ background: c.cor }} />}{c.nome}</td><td className="text-text-2">{c.tipo}</td><td>{c.fixa ? "sim" : ""}</td><td className="text-xs text-text-3">{c.contaDre ?? ""}</td><td><Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Editar</Button></td></tr>)}</tbody></table></div>
      </div>
      <Card title={`Regras aprendidas (${aprendidas.length})`} info="Quando você corrige a categoria de um lançamento, o Dueto aprende a descrição para as próximas importações.">
        <ul className="text-sm divide-y divide-border max-h-96 overflow-y-auto">{aprendidas.map((r) => <li key={r.id} className="flex justify-between gap-2 py-1"><span className="truncate">"{r.pattern}" → {categoriaNome(r.categoryId, s.categories)}</span><button className="text-xs text-bad" onClick={() => s.deleteRule(r.id)}>remover</button></li>)}{aprendidas.length === 0 && <li className="py-2 text-text-3">Nenhuma ainda.</li>}</ul>
      </Card>
      {edit && <Dialog open onOpenChange={(o) => !o && setEdit(null)} title="Categoria" footer={<>{edit.id && <Button variant="danger" onClick={() => { s.deleteCategory(edit.id); setEdit(null); }}>Excluir</Button>}<Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" disabled={!edit.nome.trim()} onClick={() => { s.upsertCategory({ ...edit, id: edit.id || `${slug(edit.nome)}-${newId().slice(0, 4)}` }); setEdit(null); }}>Salvar</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" className="col-span-2"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
          <Field label="Categoria-pai"><Select value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })}><option value="">— (raiz)</option>{raizes.filter((r) => r.id !== edit.id).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</Select></Field>
          <Field label="Tipo"><Select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as "despesa" })}><option value="despesa">Despesa</option><option value="receita">Receita</option></Select></Field>
          {filtro === "PJ" && <Field label="Conta na DRE"><Select value={edit.contaDre ?? ""} onChange={(e) => setEdit({ ...edit, contaDre: (e.target.value || null) as Category["contaDre"] })}><option value="">—</option>{["receita_exportacao", "receita_nacional", "deducao_das", "deducao_iss", "prolabore", "salarios_encargos", "contabilidade_taxas", "software_internet", "bancarias_cambio", "outras_despesas", "depreciacao", "lucros_distribuidos", "reserva_caixa", "nao_operacional"].map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>}
          <div className="col-span-2 flex gap-4"><Switch checked={edit.fixa} onCheckedChange={(v) => setEdit({ ...edit, fixa: v })} label="Despesa fixa" /></div>
        </div>
      </Dialog>}
    </div>
  );
}

const KINDS: { kind: keyof TaxTables; label: string }[] = [
  { kind: "irpf", label: "IRPF mensal (IRRF)" }, { kind: "inss", label: "INSS (salário mínimo, teto, alíquotas)" }, { kind: "simplesAnexos", label: "Simples Nacional — Anexos III e V" },
  { kind: "simplesParams", label: "Simples — limites, Fator R, ISS" }, { kind: "mei", label: "MEI" }, { kind: "presumido", label: "Lucro Presumido" }, { kind: "iss", label: "ISS por município" }, { kind: "dividendos", label: "Dividendos" },
];

function Fiscal() {
  const s = useStore();
  const hoje = new Date().toISOString().slice(0, 10);
  const [edit, setEdit] = useState<{ kind: keyof TaxTables; json: string; id: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  function salvar() {
    if (!edit) return;
    try {
      const obj = JSON.parse(edit.json) as { id?: string; vigenciaInicio?: string; ativa?: boolean };
      if (!obj.vigenciaInicio || !/^\d{4}-\d{2}-\d{2}$/.test(obj.vigenciaInicio)) throw new Error("vigenciaInicio deve ser AAAA-MM-DD");
      const id = obj.id && obj.id !== edit.id ? obj.id : edit.id ?? `${edit.kind}-${obj.vigenciaInicio}-${newId().slice(0, 4)}`;
      s.upsertTaxTable(edit.kind, { ...obj, id, vigenciaInicio: obj.vigenciaInicio, ativa: obj.ativa ?? true, origem: "usuario" } as never);
      setEdit(null); setErro(null);
    } catch (e) { setErro((e as Error).message); }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-2 flex items-center gap-1.5">Tabelas fiscais por vigência <InfoTip>O cálculo de cada mês usa a vigência ativa mais recente com data ≤ o mês. Sem nenhuma vigência ativa, o Dueto usa a tabela padrão do app. Confira todo ano e use "Adicionar vigência" (copia a mais recente para você editar os valores). Estimativas: confirme com seu contador.</InfoTip></p>
      {KINDS.map(({ kind, label }) => {
        const list = s.taxTables[kind] as ({ id: string; vigenciaInicio: string; ativa: boolean; descricao?: string; origem?: string })[];
        const velha = (kind === "irpf" || kind === "inss") && tabelaDesatualizada(list, hoje);
        const semAtiva = kind !== "iss" && !list.some((t) => t.ativa);
        return (
          <Card key={kind} title={<span className="flex items-center gap-2">{label}{velha && <Pill tone="warn">possivelmente desatualizada</Pill>}{semAtiva && <Pill tone="bad">nenhuma vigência ativa: usando a padrão do app</Pill>}</span>} actions={<Button size="sm" onClick={() => { const last = [...list].sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))[0]; const base = last ? { ...last, id: undefined, origem: "usuario", vigenciaInicio: `${Number(last.vigenciaInicio.slice(0, 4)) + 1}-01-01` } : { vigenciaInicio: `${hoje.slice(0, 4)}-01-01`, ativa: true }; setEdit({ kind, json: JSON.stringify(base, null, 2), id: null }); }}><Plus size={14} /> Adicionar vigência</Button>}>
            <div className="table-wrap"><table className="data"><thead><tr><th>Vigência</th><th>Descrição</th><th>Origem</th><th>Ativa</th><th></th></tr></thead>
              <tbody>{[...list].sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio)).map((t) => <tr key={t.id}><td className="num">{fmtDate(t.vigenciaInicio)}</td><td>{t.descricao ?? t.id}</td><td className="text-text-3 text-xs">{t.origem ?? "seed"}</td><td><Switch checked={t.ativa} onCheckedChange={(v) => s.upsertTaxTable(kind, { ...t, ativa: v } as never)} /></td><td><div className="flex gap-1 justify-end"><Button size="sm" variant="ghost" onClick={() => setEdit({ kind, json: JSON.stringify(t, null, 2), id: t.id })}>Editar</Button><Button size="sm" variant="ghost" onClick={() => s.deleteTaxTable(kind, t.id)}>Excluir</Button></div></td></tr>)}</tbody></table></div>
          </Card>
        );
      })}
      {edit && <Dialog open onOpenChange={(o) => !o && setEdit(null)} title="Vigência (JSON)" description="Edite os valores. Alíquotas em fração (0,075 = 7,5%)." wide footer={<><Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" onClick={salvar}>Salvar</Button></>}>
        <Textarea className="mono min-h-96" value={edit.json} onChange={(e) => setEdit({ ...edit, json: e.target.value })} spellCheck={false} />
        {erro && <p className="text-sm text-bad mt-2">{erro}</p>}
      </Dialog>}
    </div>
  );
}

function Backup() {
  const s = useStore();
  const [lista, setLista] = useState<{ file: string; nome: string; data: string; tamanho: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const desktop = !!window.dueto;
  useEffect(() => { if (desktop) void window.dueto!.backup.list().then(setLista); }, [desktop, msg]);
  async function exportar() { await s.db?.saveNow(); const p = await window.dueto?.backup.export(s.db!.export()); setMsg(p ? `Backup exportado para ${p}` : "Cancelado"); }
  async function criar() { await s.db?.saveNow(); const p = await window.dueto?.backup.create(); setMsg(p ? `Backup criado: ${p}` : "Nada para copiar"); }
  async function restaurar(file?: string) { const bytes = await window.dueto?.backup.restore(file); if (bytes) { await s.replaceDatabase(bytes); setMsg("Backup restaurado."); } }
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {!desktop && <Alert tone="warn">Backups em arquivo só estão disponíveis no app desktop. No navegador, os dados ficam no IndexedDB.</Alert>}
      <Card title="Backup automático">
        <Switch checked={s.settings["backup.auto"] === true} onCheckedChange={(v) => void s.setBackupAuto(v)} label="Aceito que o Dueto faça um backup diário automático (zip na pasta de dados, mantém os 30 mais recentes)" />
        <p className="text-xs text-text-3 mt-2">Tudo o que você digita já é salvo na hora. O backup diário é uma cópia extra e só roda com o seu aceite. Nada sai do seu computador.</p>
      </Card>
      <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={exportar} disabled={!desktop}>Exportar backup (.zip)…</Button><Button onClick={() => restaurar()} disabled={!desktop}>Restaurar backup…</Button><Button onClick={criar} disabled={!desktop}>Criar backup agora</Button></div>
      {msg && <Alert tone="good">{msg}</Alert>}
      <p className="text-sm text-text-2">Backup automático diário em <span className="mono">{s.info?.backupDir ?? "%APPDATA%/Dueto/backups"}</span> (mantém os 30 mais recentes). Banco: <span className="mono">{s.info?.dbPath ?? "%APPDATA%/Dueto/dueto.db"}</span>.</p>
      {lista.length > 0 && <div className="table-wrap"><table className="data"><thead><tr><th>Arquivo</th><th>Data</th><th className="r">Tamanho</th><th></th></tr></thead><tbody>{lista.map((b) => <tr key={b.file}><td className="mono text-xs">{b.nome}</td><td className="num">{new Date(b.data).toLocaleString("pt-BR")}</td><td className="r num">{(b.tamanho / 1024).toFixed(0)} KB</td><td><Button size="sm" variant="ghost" onClick={() => restaurar(b.file)}>Restaurar</Button></td></tr>)}</tbody></table></div>}
      <Card title="Zona de risco"><Button variant="danger" onClick={() => setReset(true)}>Apagar todos os dados e recomeçar</Button></Card>
      <Confirm open={reset} onOpenChange={setReset} title="Apagar tudo" message="Isso apaga entidades, lançamentos e configurações (um backup automático é feito antes, no desktop). Continuar?" danger onConfirm={async () => { if (desktop) await window.dueto!.backup.create(); s.resetAll(); }} />
    </div>
  );
}

function Sobre() {
  const s = useStore();
  return (
    <div className="flex flex-col gap-4 max-w-3xl text-sm">
      <Card title={`Dueto ${s.info?.version ?? "(dev)"}`}>
        <p className="text-text-2">Organização financeira PF e PJ para devs. Funciona sem internet; seus dados ficam só neste computador. Licença MIT.</p>
        <p className="text-text-2 mt-2"><b>Aviso:</b> todos os valores de impostos (DAS, DARF, INSS, dividendos) são estimativas calculadas a partir de tabelas que mudam todo ano. Confirme com seu contador antes de recolher.</p>
      </Card>
      <Card title="Atalhos de teclado">
        <ul className="grid sm:grid-cols-2 gap-1">
          <li><Kbd>Ctrl K</Kbd> busca global</li><li><Kbd>Alt 1</Kbd>…<Kbd>Alt 7</Kbd> navegar entre telas</li><li><Kbd>[</Kbd> / <Kbd>]</Kbd> mês anterior / próximo</li><li><Kbd>T</Kbd> voltar ao mês atual</li><li><Kbd>Ctrl I</Kbd> importar planilha</li><li><Kbd>Esc</Kbd> fechar diálogos</li>
        </ul>
      </Card>
    </div>
  );
}
