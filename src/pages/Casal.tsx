/** Módulo Pessoal (finanças da casa/casal): resumo do mês, lançamentos, quem paga o quê, metas, objetivos, cartões e recorrências. */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Budget, Goal, Recurrence, Transaction } from "@core/domain/types";
import { aporteSugerido, progressoMetas, quemPagaOQue, resumoMensalCasal } from "@core/couple";
import { addMonths, fmtDate, fmtMonth, todayISO } from "@core/dates";
import { pararDepoisDe, recorrenciaValeNoMes, repeteDepoisDe, retomarEm } from "@core/recorrencias";
import { newId } from "@core/ids";
import { fmtMoney, fmtPct, round2 } from "@core/money";
import { categoriaNome, categoriaRaiz } from "@core/seed/categories";
import { Button, Card, Confirm, Dialog, Field, InfoTip, Input, Money, PageHeader, Pill, Progress, Select, Stat, Switch, TabPanel, Tabs } from "@/components/ui";
import { DonutChart } from "@/components/charts";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionTable } from "@/components/TransactionTable";
import { selCasal, selPessoas, useStore } from "@/state/store";

export default function Casal() {
  const s = useStore();
  const mk = s.competencia;
  const casal = selCasal(s);
  const pessoas = selPessoas(s);
  const [tab, setTab] = useState("lancamentos");
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Transaction> | null; entityId: string }>({ open: false, entityId: casal?.id ?? "" });
  const hoje = todayISO();
  const ids = useMemo(() => [casal?.id ?? "", ...pessoas.map((p) => p.id)], [casal, pessoas]);
  const rows = useMemo(() => s.transactions.filter((t) => ids.includes(t.entityId) && t.competencia === mk), [s.transactions, ids, mk]);
  const resumo = useMemo(() => (casal ? resumoMensalCasal({ competencia: mk, transactions: s.transactions, categories: s.categories, pessoas, casalId: casal.id, carregarRestante: !casal.config.zerarRestante, hoje }) : null), [s.transactions, s.categories, pessoas, casal, mk, hoje]);
  if (!casal || !resumo) return null;

  const porCategoria = Object.entries(rows.filter((t) => t.kind === "despesa").reduce<Record<string, number>>((acc, t) => { const r = categoriaRaiz(t.categoryId, s.categories)?.nome ?? "Sem categoria"; acc[r] = (acc[r] ?? 0) + t.valorBrl; return acc; }, {})).map(([nome, valor]) => ({ nome, valor }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={casal.nome} subtitle={`${fmtMonth(mk, "long")} · ${pessoas.map((p) => p.nome).join(" e ")}`} actions={
        <Button variant="primary" onClick={() => setForm({ open: true, entityId: casal.id, initial: null })}><Plus size={14} /> Lançamento</Button>
      } />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Restante do mês anterior" value={resumo.restanteAnterior} sub={<Switch checked={!!casal.config.zerarRestante} onCheckedChange={(v) => s.upsertEntity({ ...casal, config: { ...casal.config, zerarRestante: v } })} label="zerar" />} />
        {resumo.receitasPorPessoa.map((p) => <Stat key={p.pessoaId} label={`Renda líquida — ${p.nome}`} value={p.liquido} sub={p.descontos ? `bruto ${fmtMoney(p.bruto)} · descontos ${fmtMoney(p.descontos)}` : undefined} />)}
        <Stat label="Total de receitas" value={resumo.totalReceitas} tone="good" />
        <Stat label="Despesas fixas + variáveis" value={resumo.totalDespesas} sub={`fixas ${fmtMoney(resumo.despesasFixas)} · variáveis ${fmtMoney(resumo.despesasVariaveis)}`} />
        <Stat label="Saldo do mês" value={resumo.saldo} tone={resumo.saldo >= 0 ? "good" : "bad"} sub={resumo.vencidas ? `${fmtMoney(resumo.vencidas)} vencidos` : resumo.pendentes ? `${fmtMoney(resumo.pendentes)} a pagar` : "tudo pago"} />
      </div>

      <Tabs value={tab} onValueChange={setTab} items={[{ value: "lancamentos", label: "Lançamentos" }, { value: "quem", label: "Quem paga o quê" }, { value: "metas", label: "Metas" }, { value: "objetivos", label: "Objetivos" }, { value: "cartoes", label: "Cartões" }, { value: "recorrencias", label: "Recorrências" }]}>
        <TabPanel value="lancamentos">
          <div className="grid xl:grid-cols-[1fr_320px] gap-4">
            <TransactionTable rows={rows} onEdit={(t) => setForm({ open: true, entityId: t.entityId, initial: t })} exportName={`pessoal-${mk}`} />
            <div className="flex flex-col gap-4">
              <Card title="Despesas por categoria"><DonutChart data={porCategoria} height={200} /></Card>
              <RecorrenciasDoMes entityIds={ids} />
            </div>
          </div>
        </TabPanel>
        <TabPanel value="quem"><QuemPaga rows={rows} /></TabPanel>
        <TabPanel value="metas"><Metas rows={rows} /></TabPanel>
        <TabPanel value="objetivos"><Objetivos /></TabPanel>
        <TabPanel value="cartoes"><Cartoes rows={rows} onEdit={(t) => setForm({ open: true, entityId: t.entityId, initial: t })} /></TabPanel>
        <TabPanel value="recorrencias"><Recorrencias entityIds={ids} /></TabPanel>
      </Tabs>
      <TransactionForm open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} entityId={form.entityId} initial={form.initial} />
    </div>
  );
}

function QuemPaga({ rows }: { rows: Transaction[] }) {
  const s = useStore();
  const casal = selCasal(s)!;
  const pessoas = selPessoas(s);
  const regra = casal.config.splitRule ?? "proporcional";
  const renda = (p: { id: string; config: { rendaEstimada?: number } }) => {
    const doMes = s.transactions.filter((t) => t.competencia === s.competencia && t.kind === "receita" && (t.entityId === p.id || t.pagoPor === p.id) && t.categoryId !== "rec-restante").reduce((a, t) => a + t.valorBrl, 0);
    return doMes || p.config.rendaEstimada || 0;
  };
  const comuns = rows.filter((t) => t.kind === "despesa" && t.entityId === casal.id);
  const r = quemPagaOQue({ regra, pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome, renda: renda(p) })), despesasComuns: comuns, manual: casal.config.splitManual });
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="Regra de divisão"><Select value={regra} onChange={(e) => s.upsertEntity({ ...casal, config: { ...casal.config, splitRule: e.target.value as "igual" } })}><option value="proporcional">Proporcional à renda do mês</option><option value="igual">50/50</option><option value="manual">Manual (%)</option></Select></Field>
        {regra === "manual" && pessoas.map((p) => <Field key={p.id} label={`${p.nome} (%)`}><Input className="mono w-24" value={casal.config.splitManual?.[p.id] ?? ""} onChange={(e) => s.upsertEntity({ ...casal, config: { ...casal.config, splitManual: { ...(casal.config.splitManual ?? {}), [p.id]: Number(e.target.value) } } })} /></Field>)}
      </div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Pessoa</th><th className="r">Renda</th><th className="r">Parte</th><th className="r">Deveria pagar</th><th className="r">Pagou</th><th className="r"><span className="inline-flex items-center gap-1">Transferir ao comum <InfoTip>"Pagou" considera o campo "quem pagou" dos lançamentos. Valor positivo em "transferir" = a pessoa ainda deve para a conta comum.</InfoTip></span></th></tr></thead>
        <tbody>{r.porPessoa.map((p) => <tr key={p.pessoaId}><td>{p.nome}</td><td className="r num">{fmtMoney(p.renda)}</td><td className="r num">{fmtPct(p.percentual)}</td><td className="r num">{fmtMoney(p.deveriaPagar)}</td><td className="r num">{fmtMoney(p.pagou)}</td><td className="r"><Money v={p.transferir} signed /></td></tr>)}
          <tr><td className="font-semibold">Despesas comuns</td><td colSpan={2}></td><td className="r num font-semibold">{fmtMoney(r.totalComum)}</td><td colSpan={2}></td></tr></tbody></table></div>
    </div>
  );
}

function Metas({ rows }: { rows: Transaction[] }) {
  const s = useStore();
  const casal = selCasal(s)!;
  const [cat, setCat] = useState("");
  const [valor, setValor] = useState("");
  const cats = s.categories.filter((c) => c.tipo === "despesa" && !c.parentId && (!c.escopo || c.escopo.includes("CASAL")));
  const metas = progressoMetas({ competencia: s.competencia, budgets: s.budgets.filter((b) => b.entityId === casal.id), transactions: rows, categories: s.categories });
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap gap-2 items-end">
        <Field label="Categoria"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
        <Field label="Meta mensal (R$)"><Input className="mono w-32" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Button variant="primary" disabled={!cat || !Number(valor.replace(",", "."))} onClick={() => { const b: Budget = { id: s.budgets.find((x) => x.entityId === casal.id && x.categoryId === cat && x.competencia === "*")?.id ?? newId("bud"), entityId: casal.id, categoryId: cat, competencia: "*", valorMeta: Number(valor.replace(",", ".")) }; s.upsertBudget(b); setValor(""); }}>Definir meta</Button>
      </div>
      {metas.length === 0 && <p className="text-sm text-text-3">Nenhuma meta definida. Metas valem para todos os meses.</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {metas.map((m) => (
          <div key={m.categoryId} className="card p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center"><span className="font-medium">{m.nome}</span>{m.status === "estourou" ? <Pill tone="bad">estourou</Pill> : m.status === "atencao" ? <Pill tone="warn">atenção</Pill> : <Pill tone="good">ok</Pill>}</div>
            <Progress value={m.percentual} tone={m.status === "estourou" ? "bad" : m.status === "atencao" ? "warn" : "good"} />
            <div className="flex justify-between text-xs text-text-3"><span className="num">{fmtMoney(m.gasto)} de {fmtMoney(m.meta)}</span><button className="text-bad" onClick={() => { const b = s.budgets.find((x) => x.entityId === casal.id && x.categoryId === m.categoryId); if (b) s.deleteBudget(b.id); }}>remover</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Objetivos() {
  const s = useStore();
  const casal = selCasal(s)!;
  const [edit, setEdit] = useState<Goal | null>(null);
  const [del, setDel] = useState<Goal | null>(null);
  const goals = s.goals.filter((g) => g.entityId === casal.id);
  const hoje = todayISO();
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div><Button variant="primary" onClick={() => setEdit({ id: newId("goal"), entityId: casal.id, nome: "", valorAlvo: 0, prazo: null, valorAtual: 0, investmentId: null })}><Plus size={14} /> Objetivo</Button></div>
      {goals.length === 0 && <p className="text-sm text-text-3">Reserva de emergência, viagem, casamento… cada objetivo tem valor-alvo, prazo e aporte sugerido.</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {goals.map((g) => { const a = aporteSugerido(g.valorAlvo, g.valorAtual, g.prazo, hoje); const pct = g.valorAlvo ? g.valorAtual / g.valorAlvo : 0; return (
          <div key={g.id} className="card p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start"><div><div className="font-medium">{g.nome}</div><div className="text-xs text-text-3">{g.prazo ? `até ${fmtDate(g.prazo)} · ${a.mesesRestantes} meses` : "sem prazo"}</div></div><Pill tone={pct >= 1 ? "good" : "accent"}>{Math.round(pct * 100)}%</Pill></div>
            <Progress value={pct} tone={pct >= 1 ? "good" : "accent"} />
            <div className="flex justify-between text-xs"><span className="num text-text-3">{fmtMoney(g.valorAtual)} de {fmtMoney(g.valorAlvo)}</span><span className="num">aporte sugerido {fmtMoney(a.aporte)}/mês</span></div>
            <div className="flex gap-2 justify-end"><Button size="sm" onClick={() => setEdit(g)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => setDel(g)}>Excluir</Button></div>
          </div>); })}
      </div>
      {edit && <GoalForm goal={edit} onClose={() => setEdit(null)} />}
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir objetivo" message={`Excluir "${del?.nome}"?`} danger onConfirm={() => del && s.deleteGoal(del.id)} />
    </div>
  );
}

function GoalForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const s = useStore();
  const [g, setG] = useState(goal);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={goal.nome ? "Editar objetivo" : "Novo objetivo"} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!g.nome || !g.valorAlvo} onClick={() => { s.upsertGoal(g); onClose(); }}>Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2"><Input value={g.nome} onChange={(e) => setG({ ...g, nome: e.target.value })} placeholder="Reserva de emergência" /></Field>
        <Field label="Valor-alvo"><Input className="mono" value={g.valorAlvo || ""} onChange={(e) => setG({ ...g, valorAlvo: Number(e.target.value.replace(",", ".")) || 0 })} /></Field>
        <Field label="Valor atual"><Input className="mono" value={g.valorAtual || ""} onChange={(e) => setG({ ...g, valorAtual: Number(e.target.value.replace(",", ".")) || 0 })} /></Field>
        <Field label="Prazo"><Input type="date" value={g.prazo ?? ""} onChange={(e) => setG({ ...g, prazo: e.target.value || null })} /></Field>
        <Field label="Investimento vinculado"><Select value={g.investmentId ?? ""} onChange={(e) => setG({ ...g, investmentId: e.target.value || null })}><option value="">—</option>{s.investments.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</Select></Field>
      </div>
    </Dialog>
  );
}

function Cartoes({ rows, onEdit }: { rows: Transaction[]; onEdit: (t: Transaction) => void }) {
  const s = useStore();
  const casalId = selCasal(s)?.id;
  const cartoes = s.accounts.filter((a) => a.tipo === "cartao" && a.ativa);
  const [sel, setSel] = useState<string>(cartoes.length > 1 ? "todos" : cartoes[0]?.id ?? "");
  const totalDe = (ts: Transaction[]) => round2(ts.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.valorBrl, 0));
  const porCartao = cartoes.map((c) => ({ c, total: totalDe(rows.filter((t) => t.accountId === c.id)) }));
  const ids = new Set(cartoes.map((c) => c.id));
  const todos = sel === "todos";
  const fatura = rows.filter((t) => (todos ? ids.has(t.accountId ?? "") : t.accountId === sel));
  const total = totalDe(fatura);
  const card = cartoes.find((c) => c.id === sel);
  const maior = [...porCartao].sort((a, b) => b.total - a.total)[0];
  const nomeCartao = (c: (typeof cartoes)[number]) => `${c.nome}${c.entityId !== casalId ? ` · ${s.entities.find((e) => e.id === c.entityId)?.nome ?? ""}` : ""}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        {cartoes.length > 1 && <button onClick={() => setSel("todos")} className={`pill ${todos ? "pill-accent" : "pill-muted"}`}>Todos os cartões · <span className="num">{fmtMoney(round2(porCartao.reduce((a, x) => a + x.total, 0)))}</span></button>}
        {porCartao.map(({ c, total: t }) => <button key={c.id} onClick={() => setSel(c.id)} className={`pill ${sel === c.id ? "pill-accent" : "pill-muted"}`}>{nomeCartao(c)} · <span className="num">{fmtMoney(t)}</span></button>)}
        {cartoes.length === 0 && <span className="text-sm text-text-3">Cadastre cartões em Configurações → Contas. Sufixos como "(Porto)" nas descrições viram cartões automaticamente na importação.</span>}
      </div>
      {todos && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Soma dos cartões no mês" value={total} />
        {maior && <Stat label="Maior fatura" value={maior.total} sub={maior.c.nome} />}
        <Stat label="Cartões" value={cartoes.length} moeda="raw" />
        <Stat label="Lançamentos" value={fatura.length} moeda="raw" />
      </div>}
      {card && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Fatura do mês" value={total} />
        <Stat label="Fechamento" value={card.diaFechamento ? `dia ${card.diaFechamento}` : "—"} moeda="raw" />
        <Stat label="Vencimento" value={card.diaVencimento ? `dia ${card.diaVencimento}` : "—"} moeda="raw" />
        <Stat label="Lançamentos" value={fatura.length} moeda="raw" />
      </div>}
      {(card || todos) && <TransactionTable rows={fatura} onEdit={onEdit} compact exportName={`fatura-${card ? card.nome : "cartoes"}-${s.competencia}`} />}
    </div>
  );
}

/** Recorrências que valem no mês aberto, com a chave que liga/desliga só neste mês. */
function RecorrenciasDoMes({ entityIds }: { entityIds: string[] }) {
  const s = useStore();
  const mk = s.competencia;
  const recs = s.recurrences.filter((r) => entityIds.includes(r.entityId) && (recorrenciaValeNoMes(r, mk) || s.transactions.some((t) => t.recorrenciaId === r.id && t.competencia === mk)));
  if (recs.length === 0) return null;
  return (
    <Card title={`Recorrências de ${fmtMonth(mk, "long").toLowerCase()}`} info="Desligar aqui tira o lançamento só deste mês; os outros meses continuam como estão. Para parar de vez, use a aba Recorrências.">
      <div className="flex flex-col gap-2">
        {recs.map((r) => {
          const tx = s.transactions.find((t) => t.recorrenciaId === r.id && t.competencia === mk);
          return (
            <div key={r.id} className={`flex items-center justify-between gap-2 text-sm ${tx ? "" : "opacity-60"}`}>
              <Switch checked={!!tx} onCheckedChange={(v) => s.setRecorrenciaNoMes(r.id, mk, v)} label={r.descricao} />
              <span className="num text-text-2 whitespace-nowrap">{fmtMoney(tx ? tx.valorBrl : r.valorPadrao, tx ? "BRL" : r.moeda)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function Recorrencias({ entityIds }: { entityIds: string[] }) {
  const s = useStore();
  const mk = s.competencia;
  const recs = s.recurrences.filter((r) => entityIds.includes(r.entityId));
  const [del, setDel] = useState<string | null>(null);
  function proximosMeses(r: Recurrence, v: boolean) {
    if (v) return s.upsertRecurrence(retomarEm(r, r.inicio > mk ? r.inicio : addMonths(mk, 1)));
    s.deleteTransactions(s.transactions.filter((t) => t.recorrenciaId === r.id && t.competencia > mk && t.status === "pendente").map((t) => t.id));
    s.upsertRecurrence(pararDepoisDe(useStore.getState().recurrences.find((x) => x.id === r.id) ?? r, mk));
  }
  return (
    <div className="table-wrap max-w-5xl">
      <table className="data"><thead><tr><th>Descrição</th><th>Categoria</th><th>Periodicidade</th><th className="r">Dia</th><th className="r">Valor</th><th><span className="inline-flex items-center gap-1">Começou em <InfoTip>Mude para um mês anterior para incluir o lançamento nos meses que já passaram (entram como pagos). Adiar o início remove os lançamentos pendentes de antes dele.</InfoTip></span></th>
        <th><span className="inline-flex items-center gap-1">Em {fmtMonth(mk)} <InfoTip>Liga/desliga só no mês aberto. Desligado, o lançamento deste mês sai das despesas; os outros meses não mudam.</InfoTip></span></th>
        <th><span className="inline-flex items-center gap-1">Meses seguintes <InfoTip>Desligado, a recorrência para depois de {fmtMonth(mk)}: lançamentos futuros ainda pendentes são removidos e os meses até {fmtMonth(mk)} ficam como estão.</InfoTip></span></th><th></th></tr></thead>
        <tbody>
          {recs.map((r) => {
            const noMes = s.transactions.some((t) => t.recorrenciaId === r.id && t.competencia === mk);
            return <tr key={r.id}><td>{r.descricao}</td><td className="text-text-2">{categoriaNome(r.categoryId, s.categories)}</td><td>{r.periodicidade}</td><td className="r num">{r.diaVencimento}</td><td className="r num">{fmtMoney(r.valorPadrao, r.moeda)}</td><td><Input type="month" className="w-36" value={r.inicio} max={mk > r.inicio ? mk : r.inicio} aria-label="Começou em" onChange={(e) => e.target.value && s.setInicioRecorrencia(r.id, e.target.value, true)} /></td>
              <td>{recorrenciaValeNoMes(r, mk) || noMes ? <Switch checked={noMes} onCheckedChange={(v) => s.setRecorrenciaNoMes(r.id, mk, v)} /> : <span className="text-text-3 text-xs">—</span>}</td>
              <td><Switch checked={repeteDepoisDe(r, mk)} onCheckedChange={(v) => proximosMeses(r, v)} /></td>
              <td><Button size="sm" variant="ghost" onClick={() => setDel(r.id)}>Excluir</Button></td></tr>;
          })}
          {recs.length === 0 && <tr><td colSpan={9} className="text-center text-text-3 py-6">Nenhuma recorrência. Abra um lançamento (novo ou existente) e ligue "Repetir todo mês": ele passa a aparecer sozinho nos lançamentos de cada mês.</td></tr>}
        </tbody></table>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir recorrência" message="Excluir a recorrência? Os lançamentos já criados continuam; ela só deixa de gerar novos." danger onConfirm={() => del && s.deleteRecurrence(del)} />
    </div>
  );
}
