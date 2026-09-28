/** Módulo Autônomo PF (genérico): receitas por cliente, despesas do livro-caixa, carnê-leão, INSS e relatório anual. */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Patient, Transaction } from "@core/domain/types";
import { addMonths, dateInMonth, fmtDate, fmtMonth, todayISO } from "@core/dates";
import { newId, slug } from "@core/ids";
import { fmtMoney, fmtPct, round2 } from "@core/money";
import { generateRemainingInstallments } from "@core/parcelas";
import { inssContribuinteIndividual, sugerirPlanoInss } from "@core/tax/inss";
import { resumoAnualCarneLeao } from "@core/tax/carneLeao";
import { toCsv } from "@core/importers";
import { Alert, Button, Card, Dialog, Disclaimer, Field, Input, PageHeader, Pill, Select, Stat, Switch, TabPanel, Tabs } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionTable } from "@/components/TransactionTable";
import { carneLeaoSerie, tabelasPara } from "@/lib/fiscal";
import { useAvisos } from "@/components/AvisosFlutuantes";
import { downloadBytes } from "@/lib/utils";
import { novoTx, selAutonomo, useStore } from "@/state/store";

export default function Consultorio() {
  const s = useStore();
  const ent = selAutonomo(s);
  const mk = s.competencia;
  const [tab, setTab] = useState("receitas");
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Transaction> | null }>({ open: false });
  const [recForm, setRecForm] = useState(false);
  const rows = useMemo(() => (ent ? s.transactions.filter((t) => t.entityId === ent.id && t.competencia === mk) : []), [s.transactions, ent, mk]);
  const serie = useMemo(() => (ent ? carneLeaoSerie(s, ent, Number(mk.slice(0, 4))) : []), [s, ent, mk]);
  if (!ent) return <Alert tone="info">Nenhuma atividade autônoma cadastrada. Adicione em Configurações → Entidades.</Alert>;
  const rec = round2(rows.filter((t) => t.kind === "receita").reduce((a, t) => a + t.valorBrl, 0));
  const desp = round2(rows.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.valorBrl, 0));
  const res = round2(rec - desp);
  const pct = ent.config.percentualInvestimento ?? 0.5;
  const aporteSugerido = round2(Math.max(0, res) * pct);
  const aporteFeito = rows.find((t) => t.categoryId === "pf-investimento");
  const cl = serie.find((x) => x.competencia === mk);

  function lancarAporte() {
    s.upsertTransaction(novoTx({ entityId: ent!.id, kind: "transferencia", competencia: mk, descricao: `Aporte da atividade autônoma (${Math.round(pct * 100)}% do resultado)`, valor: aporteSugerido, categoryId: "pf-investimento", vencimento: dateInMonth(mk, 28), valorBrl: aporteSugerido, tags: ["investimento", "sugerido"] }));
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ent.nome} subtitle={<span className="flex gap-2 items-center flex-wrap">{fmtMonth(mk, "long")} {ent.config.profissao && <Pill tone="muted">{ent.config.profissao}</Pill>}{ent.config.profissaoRegulamentada && <Pill tone="warn">profissão regulamentada — não pode ser MEI</Pill>}</span>}
        actions={<><Button onClick={() => setForm({ open: true, initial: null })}><Plus size={14} /> Despesa</Button><Button variant="primary" onClick={() => setRecForm(true)}><Plus size={14} /> Recebimento</Button></>} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Receitas" value={rec} tone="good" />
        <Stat label="Despesas" value={desp} />
        <Stat label="Resultado" value={res} tone={res >= 0 ? "good" : "bad"} />
        <Stat label={`Aporte sugerido (${Math.round(pct * 100)}%)`} value={aporteSugerido} tone="accent" sub={aporteFeito ? `lançado: ${fmtMoney(aporteFeito.valorBrl)}` : <button className="text-accent underline" onClick={lancarAporte} disabled={!aporteSugerido}>lançar aporte</button>} />
        <Stat label="Carnê-leão do mês" value={cl?.imposto ?? 0} sub={cl ? `DARF 0190 até ${fmtDate(cl.darfVencimento)}` : undefined} />
        <Stat label="Base do carnê-leão" value={cl?.baseCalculo ?? 0} sub={cl ? `livro-caixa ${fmtMoney(cl.despesasUtilizadas)}` : undefined} />
      </div>
      <Tabs value={tab} onValueChange={setTab} items={[{ value: "receitas", label: "Receitas por cliente" }, { value: "despesas", label: "Despesas / livro-caixa" }, { value: "carne", label: "Carnê-leão" }, { value: "inss", label: "INSS" }, { value: "pacientes", label: "Clientes" }, { value: "anual", label: "Relatório anual (IRPF)" }]}>
        <TabPanel value="receitas"><TransactionTable rows={rows.filter((t) => t.kind === "receita")} onEdit={(t) => setForm({ open: true, initial: t })} exportName={`autonomo-receitas-${mk}`} /></TabPanel>
        <TabPanel value="despesas">
          <p className="text-xs text-text-3 mb-2">Categorias marcadas como dedutíveis no livro-caixa (aluguel de espaço, software, materiais e equipamentos, conselho, cursos, INSS) reduzem a base do carnê-leão. Ajuste em Configurações → Categorias.</p>
          <TransactionTable rows={rows.filter((t) => t.kind !== "receita")} onEdit={(t) => setForm({ open: true, initial: t })} exportName={`autonomo-despesas-${mk}`} />
        </TabPanel>
        <TabPanel value="carne"><CarneLeao /></TabPanel>
        <TabPanel value="inss"><Inss /></TabPanel>
        <TabPanel value="pacientes"><Pacientes /></TabPanel>
        <TabPanel value="anual"><Anual /></TabPanel>
      </Tabs>
      <TransactionForm open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} entityId={ent.id} initial={form.initial} kindDefault="despesa" />
      {recForm && <RecebimentoForm onClose={() => setRecForm(false)} />}
      <Disclaimer />
    </div>
  );
}

function RecebimentoForm({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const ent = selAutonomo(s)!;
  const pacientes = s.patients.filter((p) => p.entityId === ent.id && p.ativo);
  const [pac, setPac] = useState("");
  const [novo, setNovo] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [forma, setForma] = useState("pix");
  const [parcelas, setParcelas] = useState("1");
  const [recebido, setRecebido] = useState(true);
  function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!v) return;
    let patient = pacientes.find((p) => p.id === pac);
    if (!patient && novo.trim()) { patient = { id: newId("pat"), entityId: ent.id, nome: novo.trim(), valorConsulta: v, ativo: true }; s.upsertPatient(patient); }
    if (!patient) return;
    const total = Math.max(1, Number(parcelas) || 1);
    const mk = data.slice(0, 7);
    const grupo = total > 1 ? `pac_${slug(patient.nome)}_${newId()}` : null;
    const first = novoTx({ entityId: ent.id, kind: "receita", competencia: mk, descricao: total > 1 ? `${patient.nome} (1/${total})` : patient.nome, valor: v, categoryId: total > 1 ? "pf-rec-pacote" : "pf-rec-consulta", vencimento: data, pagamento: recebido ? data : null, status: recebido ? "pago" : "pendente", valorBrl: v, patientId: patient.id, parcelaAtual: total > 1 ? 1 : null, parcelaTotal: total > 1 ? total : null, grupoParcelamentoId: grupo, meta: { formaRecebimento: forma } });
    const txs = [first, ...generateRemainingInstallments({ competencia: mk, parcelaAtual: 1, parcelaTotal: total, valor: v, diaVencimento: Number(data.slice(8, 10)) }).map((f) => ({ ...first, id: newId("tx"), competencia: f.competencia, vencimento: f.vencimento, pagamento: null, status: "pendente" as const, descricao: `${patient!.nome} (${f.parcelaAtual}/${total})`, parcelaAtual: f.parcelaAtual }))];
    s.upsertTransactions(txs);
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Recebimento de cliente" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={salvar} disabled={!Number(valor.replace(",", ".")) || (!pac && !novo.trim())}>Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cliente"><Select value={pac} onChange={(e) => setPac(e.target.value)}><option value="">— novo —</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
        {!pac && <Field label="Nome do novo cliente"><Input value={novo} onChange={(e) => setNovo(e.target.value)} /></Field>}
        <Field label="Valor"><Input className="mono" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
        <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
        <Field label="Forma"><Select value={forma} onChange={(e) => setForma(e.target.value)}><option value="pix">Pix</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></Select></Field>
        <Field label="Parcelas (nº)" hint="Ex.: 3 → gera as parcelas futuras como pendentes"><Input type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} /></Field>
        <div className="col-span-2"><Switch checked={recebido} onCheckedChange={setRecebido} label="Já recebido" /></div>
      </div>
    </Dialog>
  );
}

function CarneLeao() {
  const s = useStore();
  const ent = selAutonomo(s)!;
  const mk = s.competencia;
  const ano = Number(mk.slice(0, 4));
  const serie = carneLeaoSerie(s, ent, ano);
  const cl = serie.find((x) => x.competencia === mk);
  const jaLancado = s.transactions.some((t) => t.entityId === ent.id && t.categoryId === "pf-carne-leao" && t.competencia === addMonths(mk, 1));
  function lancar() {
    if (!cl) return;
    s.upsertTransaction(novoTx({ entityId: ent.id, kind: "despesa", competencia: addMonths(mk, 1), descricao: `DARF 0190 carnê-leão ${fmtMonth(mk)}`, valor: cl.imposto, categoryId: "pf-carne-leao", vencimento: cl.darfVencimento, valorBrl: cl.imposto }));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={`Carnê-leão ${fmtMonth(mk, "long")}`} actions={<Button size="sm" variant="primary" onClick={lancar} disabled={!cl || cl.imposto <= 0 || jaLancado}>{jaLancado ? "DARF já lançado" : "Lançar DARF 0190"}</Button>}>
          {cl ? <ol className="text-xs font-mono text-text-2 flex flex-col gap-1 list-decimal pl-4">{cl.memoria.map((m, i) => <li key={i}>{m}</li>)}</ol> : <p className="text-sm text-text-3">Sem dados no mês.</p>}
          <div className="mt-3 flex items-center gap-3"><Switch checked={ent.config.aplicarRedutorCarneLeao !== false} onCheckedChange={(v) => s.upsertEntity({ ...ent, config: { ...ent.config, aplicarRedutorCarneLeao: v } })} label="Aplicar redutor de 2026 (Lei 15.270/2025) no cálculo mensal" /></div>
          <p className="text-xs text-text-3 mt-1">Receitas recebidas de pessoas físicas entram no carnê-leão; recebimentos de empresas (PJ) têm retenção na fonte e ficam fora. O excedente de livro-caixa transporta para os meses seguintes do mesmo ano.</p>
        </Card>
        <Card title={`Histórico ${ano}`}>
          <BarsChart data={serie.map((r) => ({ mes: r.competencia, receitas: r.receitasPF, livroCaixa: r.despesasUtilizadas, imposto: r.imposto }))} series={[{ key: "receitas", nome: "Receitas PF", cor: "var(--cat-1)" }, { key: "livroCaixa", nome: "Livro-caixa", cor: "var(--cat-2)" }, { key: "imposto", nome: "IR (carnê-leão)", cor: "var(--cat-5)" }]} height={220} />
        </Card>
      </div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Mês</th><th className="r">Receitas PF</th><th className="r">Livro-caixa usado</th><th className="r">Transportado</th><th className="r">INSS</th><th className="r">Base</th><th className="r">IR</th><th>Vencimento</th><th>Pago</th></tr></thead>
        <tbody>{serie.map((r) => { const pago = s.transactions.find((t) => t.entityId === ent.id && t.categoryId === "pf-carne-leao" && t.competencia === addMonths(r.competencia, 1)); return (
          <tr key={r.competencia}><td className="num">{fmtMonth(r.competencia)}</td><td className="r num">{fmtMoney(r.receitasPF)}</td><td className="r num">{fmtMoney(r.despesasUtilizadas)}</td><td className="r num">{fmtMoney(r.excedenteTransportado)}</td><td className="r num">{fmtMoney(r.inssPago)}</td><td className="r num">{fmtMoney(r.baseCalculo)}</td><td className="r num font-medium">{fmtMoney(r.imposto)}</td><td className="num">{fmtDate(r.darfVencimento)}</td><td>{pago ? <Pill tone={pago.status === "pendente" ? "warn" : "good"}>{pago.status}</Pill> : r.imposto > 0 ? <Pill tone="muted">não lançado</Pill> : ""}</td></tr>); })}</tbody></table></div>
    </div>
  );
}

function Inss() {
  const s = useStore();
  const ent = selAutonomo(s)!;
  const mk = s.competencia;
  const tt = tabelasPara(s.taxTables, mk);
  const plano = ent.config.inssPlano ?? "normal20";
  const base = ent.config.inssBase ?? tt.inss.salarioMinimo;
  const r = inssContribuinteIndividual({ plano, baseDesejada: base }, tt.inss);
  const rendaMedia = round2(s.transactions.filter((t) => t.entityId === ent.id && t.kind === "receita" && t.competencia >= addMonths(mk, -5) && t.competencia <= mk).reduce((a, t) => a + t.valorBrl, 0) / 6);
  const sug = sugerirPlanoInss(rendaMedia, tt.inss);
  const jaLancado = s.transactions.some((t) => t.entityId === ent.id && t.categoryId === "pf-inss" && t.competencia === mk);
  useAvisos(r.avisos.map((a) => ({ tone: "warn" as const, msg: a })));
  function lancar() {
    s.upsertTransaction(novoTx({ entityId: ent.id, kind: "despesa", competencia: mk, descricao: `GPS ${r.codigoGps} — INSS contribuinte individual ${fmtMonth(mk)}`, valor: r.contribuicao, categoryId: "pf-inss", vencimento: dateInMonth(addMonths(mk, 1), 15), valorBrl: r.contribuicao }));
    s.upsertEntity({ ...ent, config: { ...ent.config, inssValorMensal: r.contribuicao } });
  }
  return (
    <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
      <Card title="INSS contribuinte individual">
        <div className="flex flex-col gap-3">
          <Field label="Plano"><Select value={plano} onChange={(e) => s.upsertEntity({ ...ent, config: { ...ent.config, inssPlano: e.target.value as "normal20" } })}><option value="normal20">Plano normal — 20% sobre o salário de contribuição (GPS 1007)</option><option value="simplificado11">Plano simplificado — 11% do salário mínimo (GPS 1163)</option></Select></Field>
          {plano === "normal20" && <Field label={`Salário de contribuição (entre ${fmtMoney(tt.inss.salarioMinimo)} e ${fmtMoney(tt.inss.teto)})`}><Input className="mono" value={ent.config.inssBase ?? ""} onChange={(e) => s.upsertEntity({ ...ent, config: { ...ent.config, inssBase: Number(e.target.value.replace(",", ".")) || undefined } })} placeholder={String(tt.inss.salarioMinimo)} /></Field>}
          <dl className="grid grid-cols-2 text-sm gap-y-1"><dt className="text-text-3">Base</dt><dd className="num text-right">{fmtMoney(r.baseContribuicao)}</dd><dt className="text-text-3">Alíquota</dt><dd className="num text-right">{fmtPct(r.aliquota)}</dd><dt className="font-semibold">Contribuição mensal</dt><dd className="num text-right font-semibold">{fmtMoney(r.contribuicao)}</dd></dl>
          <Button variant="primary" onClick={lancar} disabled={jaLancado}>{jaLancado ? "INSS do mês já lançado" : "Lançar INSS do mês (dedutível no carnê-leão)"}</Button>
        </div>
      </Card>
      <Card title="Sugestão com base na renda">
        <p className="text-sm text-text-2">Renda média dos últimos 6 meses: <b className="num">{fmtMoney(rendaMedia)}</b>.</p>
        <p className="text-sm mt-2">Sugestão: <b>{sug.plano === "normal20" ? "plano normal (20%)" : "plano simplificado (11%)"}</b> com base {fmtMoney(sug.base)}. {sug.justificativa}</p>
        <p className="text-xs text-text-3 mt-3">O plano simplificado incide só sobre o salário mínimo e não dá direito à aposentadoria por tempo de contribuição. Tabela vigente: {tt.inss.descricao}.</p>
      </Card>
    </div>
  );
}

function Pacientes() {
  const s = useStore();
  const ent = selAutonomo(s)!;
  const [edit, setEdit] = useState<Patient | null>(null);
  const pacs = s.patients.filter((p) => p.entityId === ent.id);
  const total = (id: string) => round2(s.transactions.filter((t) => t.patientId === id && t.status !== "pendente").reduce((a, t) => a + t.valorBrl, 0));
  const pendente = (id: string) => round2(s.transactions.filter((t) => t.patientId === id && t.status === "pendente").reduce((a, t) => a + t.valorBrl, 0));
  return (
    <div className="flex flex-col gap-3 max-w-4xl">
      <div><Button variant="primary" onClick={() => setEdit({ id: newId("pat"), entityId: ent.id, nome: "", valorConsulta: null, ativo: true })}><Plus size={14} /> Cliente</Button></div>
      <div className="table-wrap"><table className="data"><thead><tr><th>Nome</th><th className="r">Valor padrão do serviço</th><th className="r">Recebido (total)</th><th className="r">A receber</th><th>Ativo</th><th></th></tr></thead>
        <tbody>{pacs.map((p) => <tr key={p.id}><td>{p.nome}</td><td className="r num">{p.valorConsulta ? fmtMoney(p.valorConsulta) : "—"}</td><td className="r num">{fmtMoney(total(p.id))}</td><td className="r num">{fmtMoney(pendente(p.id))}</td><td><Switch checked={p.ativo} onCheckedChange={(v) => s.upsertPatient({ ...p, ativo: v })} /></td><td><Button size="sm" variant="ghost" onClick={() => setEdit(p)}>Editar</Button></td></tr>)}
          {pacs.length === 0 && <tr><td colSpan={6} className="text-center text-text-3 py-6">Nenhum cliente.</td></tr>}</tbody></table></div>
      {edit && <Dialog open onOpenChange={(o) => !o && setEdit(null)} title="Cliente" footer={<><Button variant="danger" onClick={() => { s.deletePatient(edit.id); setEdit(null); }}>Excluir</Button><Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" disabled={!edit.nome.trim()} onClick={() => { s.upsertPatient(edit); setEdit(null); }}>Salvar</Button></>}>
        <div className="grid grid-cols-2 gap-3"><Field label="Nome" className="col-span-2"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field><Field label="Valor padrão do serviço"><Input className="mono" value={edit.valorConsulta ?? ""} onChange={(e) => setEdit({ ...edit, valorConsulta: Number(e.target.value.replace(",", ".")) || null })} /></Field></div>
      </Dialog>}
    </div>
  );
}

function Anual() {
  const s = useStore();
  const ent = selAutonomo(s)!;
  const ano = Number(s.competencia.slice(0, 4));
  const serie = carneLeaoSerie(s, ent, ano);
  const r = resumoAnualCarneLeao(serie, ano);
  const cats = new Map(s.categories.map((c) => [c.id, c]));
  const porCategoria = Object.entries(s.transactions.filter((t) => t.entityId === ent.id && t.kind === "despesa" && t.competencia.startsWith(String(ano)) && t.status !== "pendente").reduce<Record<string, number>>((acc, t) => { const c = cats.get(t.categoryId ?? ""); const k = `${c?.nome ?? "Sem categoria"}${c?.dedutivelLivroCaixa ? " (dedutível)" : ""}`; acc[k] = round2((acc[k] ?? 0) + t.valorBrl); return acc; }, {}));
  function exportar() {
    void downloadBytes(`carne-leao-${ano}.csv`, "﻿" + toCsv([["Mês", "Receitas PF", "Livro-caixa", "INSS", "Base", "IR"], ...serie.map((x) => [x.competencia, x.receitasPF, x.despesasUtilizadas, x.inssPago, x.baseCalculo, x.imposto]), [], ["Total", r.receitasPF, r.despesasLivroCaixa, r.inssPago, "", r.impostoPago]]), "text/csv");
  }
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={`Receitas PF ${ano}`} value={r.receitasPF} /><Stat label="Deduções (livro-caixa)" value={r.despesasLivroCaixa} /><Stat label="INSS pago" value={r.inssPago} /><Stat label="IR (carnê-leão) no ano" value={r.impostoPago} tone="accent" />
      </div>
      <Card title="Despesas do ano por categoria" actions={<Button size="sm" onClick={exportar}>Exportar CSV</Button>}>
        <ul className="text-sm divide-y divide-border">{porCategoria.map(([k, v]) => <li key={k} className="flex justify-between py-1"><span>{k}</span><span className="num">{fmtMoney(v)}</span></li>)}</ul>
        <p className="text-xs text-text-3 mt-3">Para a DIRPF: informe as receitas mensais no carnê-leão, as deduções do livro-caixa e o IR pago (código 0190). Receitas de PJ vão na ficha de rendimentos recebidos de PJ, com o IR retido.</p>
      </Card>
    </div>
  );
}
