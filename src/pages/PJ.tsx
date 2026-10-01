/** Módulo Empresa (PJ): receitas e notas, impostos (Simples/MEI/Presumido), pró-labore, lucros, DRE, obrigações e despesas. */
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Plus } from "lucide-react";
import type { Invoice, Transaction } from "@core/domain/types";
import { addMonths, dateInMonth, fmtDate, fmtMonth, monthRange, todayISO } from "@core/dates";
import { newId } from "@core/ids";
import { fmtMoney, fmtPct, round2 } from "@core/money";
import { projetarCaixa } from "@core/dre";
import { limiteIsencaoLucros, retencaoDividendos } from "@core/tax/dividendos";
import { calcularRbt12 } from "@core/tax/simples";
import { toCsv } from "@core/importers";
import { Alert, Button, Card, Dialog, Disclaimer, Field, InfoTip, Input, Money, PageHeader, Pill, Select, Stat, Switch, TabPanel, Tabs } from "@/components/ui";
import { useAvisos } from "@/components/AvisosFlutuantes";
import { Impostos } from "@/pages/pj/Impostos";
import { Balanco } from "@/pages/pj/Balanco";
import { linhasImposto, salvarImposto, totalImpostosMes } from "@/lib/impostos";
import { parseMoney } from "@core/money";
import { LinesChart } from "@/components/charts";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionTable } from "@/components/TransactionTable";
import { Recorrencias } from "@/pages/Casal";
import { dreDoPeriodo, impostoDoMes, obrigacoesDoMes, proLaboreDoMes, seriesPJ, tabelasPara } from "@/lib/fiscal";
import { downloadBytes } from "@/lib/utils";
import { novoTx, selPJ, useStore } from "@/state/store";

export default function PJ() {
  const s = useStore();
  const pj = selPJ(s);
  const mk = s.competencia;
  const [tab, setTab] = useState("receitas");
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Transaction> | null; kind: "receita" | "despesa" }>({ open: false, kind: "receita" });
  const imp = useMemo(() => (pj ? impostoDoMes(s, pj, mk) : null), [s, pj, mk]);
  if (!pj) return <Alert tone="info">Nenhuma empresa cadastrada. Adicione em Configurações → Entidades.</Alert>;
  const rows = s.transactions.filter((t) => t.entityId === pj.id && t.competencia === mk);
  const regimeLabel = { SIMPLES_III: "Simples — Anexo III", SIMPLES_V: "Simples — Anexo V", MEI: "MEI", PRESUMIDO: "Lucro Presumido" }[pj.regime ?? "SIMPLES_III"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={pj.nome} subtitle={<span className="flex gap-2 items-center flex-wrap">{fmtMonth(mk, "long")} <Pill tone="accent">{regimeLabel}</Pill>{imp?.fatorR && imp.fatorR.rbt12 > 0 && <Pill tone={imp.fatorR.fatorR >= 0.28 ? "good" : "warn"}>Fator R {fmtPct(imp.fatorR.fatorR)}</Pill>}{pj.config.fatura?.exportacao && <Pill tone="info">exportação de serviços</Pill>}</span>}
        actions={<><Button onClick={() => setForm({ open: true, kind: "despesa", initial: null })}><Plus size={14} /> Despesa</Button><Button variant="primary" onClick={() => setForm({ open: true, kind: "receita", initial: null })}><Plus size={14} /> Recebimento</Button></>} />
      <Tabs value={tab} onValueChange={setTab} items={[{ value: "receitas", label: "Receitas e notas" }, { value: "impostos", label: "Impostos" }, { value: "balanco", label: "Balanço" }, { value: "prolabore", label: "Pró-labore" }, { value: "lucros", label: "Lucros" }, { value: "dre", label: "DRE" }, { value: "obrigacoes", label: "Obrigações" }, { value: "despesas", label: "Despesas" }]}>
        <TabPanel value="receitas"><Receitas rows={rows} onEdit={(t) => setForm({ open: true, kind: "receita", initial: t })} /></TabPanel>
        <TabPanel value="impostos"><Impostos /></TabPanel>
        <TabPanel value="balanco"><Balanco /></TabPanel>
        <TabPanel value="prolabore"><ProLabore /></TabPanel>
        <TabPanel value="lucros"><Lucros /></TabPanel>
        <TabPanel value="dre"><Dre /></TabPanel>
        <TabPanel value="obrigacoes"><Obrigacoes /></TabPanel>
        <TabPanel value="despesas">
          <div className="flex flex-col gap-4">
            <TransactionTable rows={rows.filter((t) => t.kind !== "receita")} onEdit={(t) => setForm({ open: true, kind: "despesa", initial: t })} exportName={`pj-despesas-${mk}`} />
            <Card title="Recorrências da empresa"><Recorrencias entityIds={[pj.id]} /></Card>
          </div>
        </TabPanel>
      </Tabs>
      <TransactionForm open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} entityId={pj.id} initial={form.initial} kindDefault={form.kind} />
      <Disclaimer />
    </div>
  );
}

// ---------------------------------------------------------------- Receitas e notas
function Receitas({ rows, onEdit }: { rows: Transaction[]; onEdit: (t: Transaction) => void }) {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const rec = rows.filter((t) => t.kind === "receita");
  const usd = round2(rec.filter((t) => t.moeda === "USD").reduce((a, t) => a + t.valor, 0));
  const brl = round2(rec.reduce((a, t) => a + t.valorBrl, 0));
  const cotMedia = usd ? round2(rec.filter((t) => t.moeda === "USD").reduce((a, t) => a + t.valorBrl, 0) / usd) : null;
  const { receitas } = seriesPJ(s, pj);
  const rbt = calcularRbt12(mk, receitas, pj.config.inicioAtividade);
  const meses = monthRange(addMonths(mk, -17), mk);
  const hist = meses.map((m) => {
    const r = receitas.get(m)?.total ?? 0;
    const janela = monthRange(addMonths(m, -11), m).map((x) => receitas.get(x)?.total ?? 0);
    const n = janela.filter((x) => x > 0).length || 1;
    return { mes: m, receita: r, media12: round2(janela.reduce((a, b) => a + b, 0) / n) };
  });
  const ano = mk.slice(0, 4);
  const anoAnt = String(Number(ano) - 1);
  const somaAno = (y: string) => round2([...receitas.entries()].filter(([m]) => m.startsWith(y)).reduce((a, [, r]) => a + r.total, 0));
  const realizadoAno = somaAno(ano);
  const mesesComReceita = [...receitas.keys()].filter((m) => m.startsWith(ano) && (receitas.get(m)?.total ?? 0) > 0).length || 1;
  const projecaoAnual = round2((realizadoAno / mesesComReceita) * 12);
  const [inv, setInv] = useState<Invoice | null>(null);
  const invoices = s.invoices.filter((i) => i.entityId === pj.id).sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Receita do mês (BRL)" value={brl} tone="good" />
        <Stat label="Receita do mês (USD)" value={usd} moeda="USD" sub={cotMedia ? `cotação média ${cotMedia}` : undefined} />
        <Stat label="RBT12" value={rbt.rbt12} sub={rbt.metodo === "12meses" ? "12 meses anteriores" : rbt.metodo === "proporcional" ? `proporcionalizado (${rbt.mesesConsiderados} meses)` : "1º mês × 12"} />
        <Stat label={`Realizado em ${ano}`} value={realizadoAno} sub={`projeção anual ${fmtMoney(projecaoAnual)}`} />
        <Stat label={`Comparativo ${anoAnt}`} value={somaAno(anoAnt)} sub={somaAno(anoAnt) ? `${fmtPct(realizadoAno / somaAno(anoAnt) - 1)} vs. ${anoAnt}` : "sem dados"} />
      </div>
      <Card title="Histórico de faturamento (18 meses) e média móvel 12m">
        <LinesChart data={hist} series={[{ key: "receita", nome: "Receita BRL", cor: "var(--cat-1)" }, { key: "media12", nome: "Média móvel 12m", cor: "var(--cat-2)" }]} area />
      </Card>
      <Card title="Recebimentos do mês" actions={<span className="text-xs text-text-3">quinzenas, origem, cotação e IOF/spread por lançamento</span>}>
        <TransactionTable rows={rec} onEdit={onEdit} exportName={`pj-receitas-${mk}`} />
      </Card>
      <Card title="Notas fiscais (NFS-e)" info={pj.config.fatura?.exportacao ? "Exportação de serviços: ISS não incide (LC 116, art. 2º, I) desde que o resultado se verifique no exterior; a Prefeitura de São Paulo exige comprovação (contrato, invoice, câmbio). PIS/COFINS/ISS saem da partilha do DAS." : undefined} actions={<Button size="sm" variant="primary" onClick={() => setInv({ id: newId("inv"), entityId: pj.id, numero: "", data: todayISO(), clientId: null, tomador: "", moeda: pj.config.fatura?.moeda ?? "USD", valor: 0, cotacao: null, valorBrl: 0, tipo: pj.config.fatura?.exportacao ? "exportacao" : "nacional", status: "pendente", codigoServico: pj.config.issCodigoServico ?? null, municipio: pj.municipio ?? null, transactionIds: [] })}><Plus size={14} /> Nota</Button>}>
        <div className="table-wrap">
          <table className="data"><thead><tr><th>Nº</th><th>Data</th><th>Tomador</th><th>Tipo</th><th className="r">Valor</th><th className="r">BRL</th><th>Status</th><th>Recebimento</th><th></th></tr></thead>
            <tbody>
              {invoices.map((i) => {
                const tx = s.transactions.filter((t) => i.transactionIds.includes(t.id));
                return (<tr key={i.id}><td className="num">{i.numero}</td><td className="num">{fmtDate(i.data)}</td><td>{i.tomador}</td><td>{i.tipo === "exportacao" ? <Pill tone="info">exportação</Pill> : "nacional"}</td><td className="r num">{fmtMoney(i.valor, i.moeda)}</td><td className="r num">{fmtMoney(i.valorBrl)}</td>
                  <td>{i.status === "recebida" ? <Pill tone="good">recebida</Pill> : i.status === "cancelada" ? <Pill tone="muted">cancelada</Pill> : <Pill tone="warn">pendente</Pill>}</td>
                  <td className="text-xs text-text-2">{tx.map((t) => `${fmtDate(t.pagamento ?? t.vencimento)} ${fmtMoney(t.valorBrl)}`).join("; ") || "—"}</td>
                  <td><Button size="sm" variant="ghost" onClick={() => setInv(i)}>Editar</Button></td></tr>);
              })}
              {invoices.length === 0 && <tr><td colSpan={9} className="text-center text-text-3 py-6">Cadastre as notas emitidas e concilie com os recebimentos. Município padrão: {pj.municipio ?? "—"}.</td></tr>}
            </tbody></table>
        </div>
      </Card>
      {inv && <InvoiceForm invoice={inv} onClose={() => setInv(null)} />}
    </div>
  );
}

function InvoiceForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const s = useStore();
  const pj = selPJ(s)!;
  const [i, setI] = useState(invoice);
  const candidatos = s.transactions.filter((t) => t.entityId === pj.id && t.kind === "receita" && !t.invoiceId || i.transactionIds.includes(t.id)).sort((a, b) => (b.pagamento ?? b.competencia).localeCompare(a.pagamento ?? a.competencia)).slice(0, 60);
  const clientes = s.clients.filter((c) => c.entityId === pj.id);
  function salvar() {
    const valorBrl = i.moeda === "BRL" ? i.valor : round2(i.valor * (i.cotacao ?? 0));
    const status = i.status === "cancelada" ? "cancelada" : i.transactionIds.length ? "recebida" : "pendente";
    s.upsertInvoice({ ...i, valorBrl, status });
    for (const t of s.transactions) {
      if (i.transactionIds.includes(t.id) && t.invoiceId !== i.id) s.upsertTransaction({ ...t, invoiceId: i.id, status: t.status === "pendente" ? "pago" : t.status });
      if (!i.transactionIds.includes(t.id) && t.invoiceId === i.id) s.upsertTransaction({ ...t, invoiceId: null });
    }
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={invoice.numero ? `Nota ${invoice.numero}` : "Nova nota fiscal"} footer={<><Button variant="danger" onClick={() => { s.deleteInvoice(i.id); onClose(); }}>Excluir</Button><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={salvar}>Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número"><Input className="mono" value={i.numero} onChange={(e) => setI({ ...i, numero: e.target.value })} /></Field>
        <Field label="Data de emissão"><Input type="date" value={i.data} onChange={(e) => setI({ ...i, data: e.target.value })} /></Field>
        <Field label="Tomador" className="col-span-2"><Input value={i.tomador} onChange={(e) => setI({ ...i, tomador: e.target.value })} list="clientes" /><datalist id="clientes">{clientes.map((c) => <option key={c.id} value={c.nome} />)}</datalist></Field>
        <Field label="Moeda"><Select value={i.moeda} onChange={(e) => setI({ ...i, moeda: e.target.value as "USD" })}><option>BRL</option><option>USD</option><option>EUR</option></Select></Field>
        <Field label="Valor"><Input className="mono" value={i.valor || ""} onChange={(e) => setI({ ...i, valor: Number(e.target.value.replace(",", ".")) || 0 })} /></Field>
        {i.moeda !== "BRL" && <Field label="Cotação"><Input className="mono" value={i.cotacao ?? ""} onChange={(e) => setI({ ...i, cotacao: Number(e.target.value.replace(",", ".")) || null })} /></Field>}
        <Field label="Tipo"><Select value={i.tipo} onChange={(e) => setI({ ...i, tipo: e.target.value as "exportacao" })}><option value="exportacao">Exportação de serviço</option><option value="nacional">Nacional</option></Select></Field>
        <Field label="Código de serviço (LC 116)"><Input value={i.codigoServico ?? ""} onChange={(e) => setI({ ...i, codigoServico: e.target.value || null })} placeholder="1.04" /></Field>
        <Field label="Status"><Select value={i.status} onChange={(e) => setI({ ...i, status: e.target.value as "pendente" })}><option value="pendente">Pendente</option><option value="recebida">Recebida</option><option value="cancelada">Cancelada</option></Select></Field>
        <Field label="Conciliar com recebimentos" className="col-span-2">
          <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 flex flex-col gap-1">
            {candidatos.map((t) => <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={i.transactionIds.includes(t.id)} onChange={(e) => setI({ ...i, transactionIds: e.target.checked ? [...i.transactionIds, t.id] : i.transactionIds.filter((x) => x !== t.id) })} /><span className="num text-text-3">{fmtDate(t.pagamento ?? t.vencimento) || t.competencia}</span><span className="flex-1 truncate">{t.descricao}</span><span className="num">{fmtMoney(t.valorBrl)}</span></label>)}
            {candidatos.length === 0 && <span className="text-xs text-text-3">Nenhum recebimento sem nota.</span>}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Pró-labore
function ProLabore() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const salvo = s.payrolls.find((p) => p.entityId === pj.id && p.competencia === mk);
  const [bruto, setBruto] = useState<string>("");
  const calc = proLaboreDoMes(s, pj, mk, bruto === "" ? undefined : Number(bruto.replace(",", ".")) || 0);
  const dono = s.entities.find((e) => e.id === (pj.config.donoPessoaId ?? "")) ?? s.entities.find((e) => e.tipo === "PESSOA");
  const modo = pj.config.proLabore?.modo ?? "minimoFatorR";

  function salvar() {
    const ids: string[] = [];
    if (salvo) s.deleteTransactions(salvo.transactionIds);
    const liq = novoTx({ entityId: pj.id, kind: "despesa", competencia: mk, descricao: `Pró-labore líquido ${fmtMonth(mk)}`, valor: calc.liquido, categoryId: "pj-prolabore", vencimento: dateInMonth(addMonths(mk, 1), 5), status: "pendente", valorBrl: calc.liquido, tags: ["prolabore"] });
    const darf = novoTx({ entityId: pj.id, kind: "despesa", competencia: mk, descricao: `DARF pró-labore ${fmtMonth(mk)} (INSS ${fmtMoney(calc.inss)} + IRRF ${fmtMoney(calc.irrf)})`, valor: calc.darf, categoryId: "pj-darf-prolabore", vencimento: calc.darfVencimento, status: "pendente", valorBrl: calc.darf, tags: ["prolabore"] });
    const txs = [liq, darf];
    if (dono) txs.push(novoTx({ entityId: dono.id, kind: "receita", competencia: mk, descricao: `Pró-labore líquido (${pj.nome})`, valor: calc.liquido, categoryId: "rec-salario", vencimento: liq.vencimento, status: "pendente", valorBrl: calc.liquido, pagoPor: dono.id, origemId: liq.id, tags: ["espelho-pj"], meta: { bruto: calc.bruto, descontos: calc.inss + calc.irrf } }));
    s.upsertTransactions(txs);
    ids.push(...txs.map((t) => t.id));
    s.upsertPayroll({ id: salvo?.id ?? newId("pay"), entityId: pj.id, pessoaId: dono?.id ?? "", competencia: mk, bruto: calc.bruto, inss: calc.inss, irrf: calc.irrf, liquido: calc.liquido, darfValor: calc.darf, darfVencimento: calc.darfVencimento, darfPago: false, transactionIds: ids });
  }
  const hist = s.payrolls.filter((p) => p.entityId === pj.id).sort((a, b) => b.competencia.localeCompare(a.competencia));
  useAvisos(calc.avisos.map((a) => ({ tone: "warn" as const, msg: a })));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <Card title={`Pró-labore de ${fmtMonth(mk, "long")}`} info={<>Salvar gera: despesa "pró-labore líquido", despesa "DARF" (dia 20 do mês seguinte) e a receita espelhada de {dono?.nome ?? "sócio"} no módulo Pessoal. No Anexo III a CPP patronal está dentro do DAS.</>}>
          <div className="flex flex-col gap-3">
            <Field label="Política"><Select value={modo} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, proLabore: { ...(pj.config.proLabore ?? {}), modo: e.target.value as "fixo" } } })}><option value="minimoFatorR">Mínimo para Fator R ≥ 28% (sugerido)</option><option value="percentual">% da receita do mês</option><option value="fixo">Valor fixo</option></Select></Field>
            {modo === "percentual" && <Field label="% da receita"><Input className="mono" value={pj.config.proLabore?.percentual ?? ""} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, proLabore: { modo, percentual: Number(e.target.value.replace(",", ".")) } } })} placeholder="0,28" /></Field>}
            {modo === "fixo" && <Field label="Valor fixo"><Input className="mono" value={pj.config.proLabore?.valor ?? ""} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, proLabore: { modo, valor: Number(e.target.value.replace(",", ".")) } } })} /></Field>}
            <Field label="Bruto deste mês" hint={`sugerido pela política: ${fmtMoney(calc.sugerido)}${salvo ? ` · salvo: ${fmtMoney(salvo.bruto)}` : ""}`}><Input className="mono" value={bruto} onChange={(e) => setBruto(e.target.value)} placeholder={String(salvo?.bruto ?? calc.sugerido)} /></Field>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-text-3">Bruto</dt><dd className="num text-right">{fmtMoney(calc.bruto)}</dd>
              <dt className="text-text-3">INSS 11% (teto {fmtMoney(calc.inssBase)})</dt><dd className="num text-right text-bad">− {fmtMoney(calc.inss)}</dd>
              <dt className="text-text-3">IRRF (base {fmtMoney(calc.irrfBase)})</dt><dd className="num text-right text-bad">− {fmtMoney(calc.irrf)}</dd>
              <dt className="font-semibold">Líquido para o sócio</dt><dd className="num text-right font-semibold">{fmtMoney(calc.liquido)}</dd>
              <dt className="text-text-3">DARF (INSS + IRRF)</dt><dd className="num text-right">{fmtMoney(calc.darf)} <span className="text-xs text-text-3">até {fmtDate(calc.darfVencimento)}</span></dd>
            </dl>
            <Button variant="primary" onClick={salvar} disabled={calc.bruto <= 0}>{salvo ? "Atualizar pró-labore e lançamentos" : "Salvar e gerar lançamentos"}</Button>
          </div>
        </Card>
        <Card title="Memória de cálculo"><ol className="text-xs font-mono text-text-2 flex flex-col gap-1 list-decimal pl-4">{calc.memoria.map((m, i) => <li key={i}>{m}</li>)}</ol></Card>
      </div>
      <Card title="Histórico">
        <div className="table-wrap"><table className="data"><thead><tr><th>Competência</th><th className="r">Bruto</th><th className="r">INSS</th><th className="r">IRRF</th><th className="r">Líquido</th><th className="r">DARF</th><th>Venc. DARF</th><th>DARF pago</th></tr></thead>
          <tbody>{hist.map((p) => <tr key={p.id}><td className="num">{fmtMonth(p.competencia, "long")}</td><td className="r num">{fmtMoney(p.bruto)}</td><td className="r num">{fmtMoney(p.inss)}</td><td className="r num">{fmtMoney(p.irrf)}</td><td className="r num">{fmtMoney(p.liquido)}</td><td className="r num">{fmtMoney(p.darfValor)}</td><td className="num">{fmtDate(p.darfVencimento)}</td><td><Switch checked={p.darfPago} onCheckedChange={(v) => s.upsertPayroll({ ...p, darfPago: v })} /></td></tr>)}
            {hist.length === 0 && <tr><td colSpan={8} className="text-center text-text-3 py-6">Nenhum pró-labore salvo.</td></tr>}</tbody></table></div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Lucros
function Lucros() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const ano = mk.slice(0, 4);
  const dre = dreDoPeriodo(s, pj, `${ano}-01`, mk);
  const tt = tabelasPara(s.taxTables, mk);
  const irpjDas = dre.linhas.find((l) => l.chave === "irpj_csll")?.valor ?? 0;
  const limite = limiteIsencaoLucros({ receitaBrutaPeriodo: dre.receitaBruta, irpjPagoNoDas: irpjDas * 0.53, escrituracaoContabil: !!pj.config.escrituracaoContabil, lucroContabil: dre.lucroLiquido });
  const retiradas = s.transactions.filter((t) => t.entityId === pj.id && t.categoryId === "pj-lucros").sort((a, b) => b.competencia.localeCompare(a.competencia));
  const doMes = round2(retiradas.filter((t) => t.competencia === mk).reduce((a, t) => a + t.valorBrl, 0));
  const ret = retencaoDividendos(doMes, tt.dividendos);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const dono = s.entities.find((e) => e.id === (pj.config.donoPessoaId ?? "")) ?? s.entities.find((e) => e.tipo === "PESSOA");
  const reserva = round2(s.transactions.filter((t) => t.entityId === pj.id && t.categoryId === "pj-reserva" && t.competencia.startsWith(ano)).reduce((a, t) => a + t.valorBrl, 0));
  const distribuivel = round2(dre.lucroLiquido - dre.lucrosDistribuidos - reserva);
  useAvisos([
    ...(ret.retencao ? [{ tone: "warn" as const, msg: `Distribuição de ${fmtMoney(doMes)} neste mês excede ${fmtMoney(tt.dividendos.limiteMensalIsento ?? 0)}: retenção estimada de ${fmtMoney(ret.retencao)} na fonte.` }] : []),
  ]);
  function registrar() {
    const v = Number(valor.replace(",", "."));
    if (!v) return;
    const tx = novoTx({ entityId: pj.id, kind: "despesa", competencia: data.slice(0, 7), descricao: "Distribuição de lucros", valor: v, categoryId: "pj-lucros", vencimento: data, pagamento: data, status: "pago", valorBrl: v });
    const txs = [tx];
    if (dono) txs.push(novoTx({ entityId: dono.id, kind: "receita", competencia: tx.competencia, descricao: `Distribuição de lucros (${pj.nome})`, valor: v, categoryId: "rec-lucros", pagamento: data, status: "pago", valorBrl: v, pagoPor: dono.id, origemId: tx.id, tags: ["espelho-pj"] }));
    s.upsertTransactions(txs);
    setValor("");
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={`Lucro líquido acumulado ${ano}`} value={dre.lucroLiquido} tone={dre.lucroLiquido >= 0 ? "good" : "bad"} />
        <Stat label="Já distribuído no ano" value={dre.lucrosDistribuidos} />
        <Stat label="Reserva de caixa no ano" value={reserva} />
        <Stat label="Lucro distribuível (estimado)" value={distribuivel} tone="accent" sub={<span className="flex items-center gap-1">isento até {fmtMoney(limite.limiteIsento)} no ano <InfoTip label="Sobre a isenção de lucros">
          <p>Limite de isenção ({limite.metodo === "escrituracao" ? "com escrituração contábil: todo o lucro apurado" : "sem escrituração: presunção de 32% − IRPJ do DAS"}): <b className="num">{fmtMoney(limite.limiteIsento)}</b> no ano. Acima disso, a parcela é tributável na pessoa física.</p>
          {tt.dividendos.limiteMensalIsento != null && <p className="mt-1">Desde {fmtDate(tt.dividendos.vigenciaInicio)}, distribuições acima de {fmtMoney(tt.dividendos.limiteMensalIsento)} por mês ao mesmo sócio têm retenção de {fmtPct(tt.dividendos.aliquotaAcimaLimite)} na fonte.</p>}
          <p className="mt-1">Distribuível = resultado − já distribuído − reservas. Para prever retiradas com folga de caixa, use a aba Balanço.</p>
        </InfoTip></span>} />
      </div>
      <Card title="Registrar retirada de lucros">
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="Valor"><Input className="mono w-40" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
          <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
          <Button variant="primary" onClick={registrar} disabled={!Number(valor.replace(",", "."))}>Registrar</Button>
          <InfoTip>A retirada vira receita de {dono?.nome ?? "sócio"} no módulo Pessoal.</InfoTip>
        </div>
      </Card>
      <div className="table-wrap"><table className="data"><thead><tr><th>Data</th><th>Descrição</th><th className="r">Valor</th><th></th></tr></thead><tbody>
        {retiradas.map((t) => <tr key={t.id}><td className="num">{fmtDate(t.pagamento ?? t.vencimento) || t.competencia}</td><td>{t.descricao}</td><td className="r num">{fmtMoney(t.valorBrl)}</td><td><Button size="sm" variant="ghost" onClick={() => { s.deleteTransactions([t.id, ...s.transactions.filter((x) => x.origemId === t.id).map((x) => x.id)]); }}>Excluir</Button></td></tr>)}
        {retiradas.length === 0 && <tr><td colSpan={4} className="text-center text-text-3 py-6">Nenhuma retirada registrada.</td></tr>}</tbody></table></div>
    </div>
  );
}

// ---------------------------------------------------------------- DRE
function Dre() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const [periodo, setPeriodo] = useState<"mes" | "ano">("mes");
  const [drill, setDrill] = useState<string[] | null>(null);
  const de = periodo === "mes" ? mk : `${mk.slice(0, 4)}-01`;
  const ate = periodo === "mes" ? mk : `${mk.slice(0, 4)}-12`;
  const dre = dreDoPeriodo(s, pj, de, ate);
  const resultados = monthRange(addMonths(mk, -5), mk).map((m) => dreDoPeriodo(s, pj, m, m).lucroLiquido);
  const saldoCaixa = round2(s.transactions.filter((t) => t.entityId === pj.id && t.competencia <= mk && t.status !== "pendente").reduce((a, t) => a + (t.kind === "receita" ? t.valorBrl : t.kind === "despesa" ? -t.valorBrl : 0), 0));
  const drillRows = drill ? s.transactions.filter((t) => drill.includes(t.id)) : [];

  async function pacoteContador() {
    const ano = mk.slice(0, 4);
    const zip = new JSZip();
    const d = dreDoPeriodo(s, pj, `${ano}-01`, `${ano}-12`);
    zip.file(`DRE-${ano}.csv`, "﻿" + toCsv([["Linha", "Valor (BRL)"], ...d.linhas.map((l) => [l.titulo, l.valor])]));
    const txs = s.transactions.filter((t) => t.entityId === pj.id && t.competencia.startsWith(ano));
    zip.file(`lancamentos-${ano}.csv`, "﻿" + toCsv([["Competência", "Data", "Descrição", "Categoria", "Tipo", "Moeda", "Valor", "Cotação", "Valor BRL", "Exportação", "Status"], ...txs.map((t) => [t.competencia, t.pagamento ?? t.vencimento ?? "", t.descricao, s.categories.find((c) => c.id === t.categoryId)?.nome ?? "", t.kind, t.moeda, t.valor, t.cotacao ?? "", t.valorBrl, t.exportacao ? "sim" : "não", t.status] as (string | number | null)[])]));
    zip.file(`notas-${ano}.csv`, "﻿" + toCsv([["Número", "Data", "Tomador", "Tipo", "Moeda", "Valor", "Cotação", "Valor BRL", "Status"], ...s.invoices.filter((i) => i.entityId === pj.id && i.data.startsWith(ano)).map((i) => [i.numero, i.data, i.tomador, i.tipo, i.moeda, i.valor, i.cotacao ?? "", i.valorBrl, i.status])]));
    const dasDarf = monthRange(`${ano}-01`, `${ano}-12`).map((m) => { const i = impostoDoMes(s, pj, m); const p = s.payrolls.find((x) => x.entityId === pj.id && x.competencia === m); return [m, i.valorTributo, i.das?.aliquotaEfetiva ?? "", i.das?.anexo ?? i.regime ?? "", i.fatorR?.fatorR ?? "", p?.bruto ?? "", p?.inss ?? "", p?.irrf ?? "", p?.darfValor ?? ""] as (string | number | null)[]; });
    zip.file(`das-darf-${ano}.csv`, "﻿" + toCsv([["Mês", "DAS estimado", "Alíquota efetiva", "Anexo/regime", "Fator R", "Pró-labore bruto", "INSS", "IRRF", "DARF"], ...dasDarf]));
    zip.file("LEIA-ME.txt", `Pacote gerado pelo Dueto em ${new Date().toLocaleString("pt-BR")}. Valores de impostos são estimativas; confira antes de recolher.`);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await downloadBytes(`dueto-pacote-contador-${ano}.zip`, bytes, "application/zip");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden">{(["mes", "ano"] as const).map((p) => <button key={p} onClick={() => setPeriodo(p)} className={`px-3 py-1.5 text-sm ${periodo === p ? "bg-accent text-on-accent" : "bg-surface text-text-2"}`}>{p === "mes" ? fmtMonth(mk, "long") : `Ano ${mk.slice(0, 4)}`}</button>)}</div>
        <Button className="ml-auto" onClick={pacoteContador}>Exportar pacote para o contador (.zip)</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Margem líquida" value={dre.indicadores.margemLiquida} moeda="pct" tone={dre.indicadores.margemLiquida >= 0 ? "good" : "bad"} />
        <Stat label="Carga tributária efetiva" value={dre.indicadores.cargaTributariaEfetiva} moeda="pct" sub="(DAS + DARF) / receita" />
        <Stat label="Custo total do sócio" value={dre.indicadores.custoTotalSocio} sub="pró-labore + lucros" />
        <Stat label="Caixa acumulado (pago)" value={saldoCaixa} />
        <Stat label="Projeção de caixa 3 / 6 / 12m" value={`${fmtMoney(projetarCaixa({ saldoAtual: saldoCaixa, resultadosMensais: resultados, meses: 3 }).saldoProjetado)}`} moeda="raw" sub={`${fmtMoney(projetarCaixa({ saldoAtual: saldoCaixa, resultadosMensais: resultados, meses: 6 }).saldoProjetado)} · ${fmtMoney(projetarCaixa({ saldoAtual: saldoCaixa, resultadosMensais: resultados, meses: 12 }).saldoProjetado)}`} />
      </div>
      <div className="table-wrap max-w-4xl">
        <table className="data"><tbody>
          {dre.linhas.map((l) => (
            <tr key={l.chave} className={l.tipo === "subtotal" || l.tipo === "resultado" ? "bg-surface-2 font-semibold" : ""}>
              <td style={{ paddingLeft: 10 + l.nivel * 18 }} className={l.tipo === "info" ? "text-text-3 italic" : ""}>{l.titulo}</td>
              <td className="r num" style={{ width: 160 }}>{l.tipo === "deducao" || l.tipo === "despesa" ? <span className={l.valor ? "text-bad" : ""}>{l.valor ? `(${fmtMoney(l.valor)})` : "—"}</span> : <Money v={l.valor} />}</td>
              <td style={{ width: 90 }}>{l.transactionIds.length > 0 && <button className="text-xs text-accent" onClick={() => setDrill(l.transactionIds)}>{l.transactionIds.length} lanç.</button>}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
      {drill && <Dialog open onOpenChange={(o) => !o && setDrill(null)} title="Lançamentos da linha" wide><TransactionTable rows={drillRows} compact /></Dialog>}
    </div>
  );
}

// ---------------------------------------------------------------- Obrigações
function Obrigacoes() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const obs = obrigacoesDoMes(s, [pj], mk).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  void totalImpostosMes;
  const linhas = linhasImposto(s, pj, mk);
  const linhaDe = (id: string) => (id.startsWith("das-") || id.startsWith("dasmei-") ? linhas.find((l) => l.tipo === "das") : id.startsWith("darf-pl-") ? linhas.find((l) => l.tipo === "darf") : id.startsWith("darf-fed-") ? linhas.find((l) => l.tipo === "tribfed") : undefined);
  const [parc, setParc] = useState({ nome: "", valor: "", parcela: "", total: "", dia: "30" });
  const parcelamentos = (pj.config as { parcelamentos?: { nome: string; parcela: number; total: number; valor: number; dia: number }[] }).parcelamentos ?? [];
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <ul className="flex flex-col divide-y divide-border card">
        {obs.map((o) => (
          <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
            <input type="checkbox" checked={o.concluida} onChange={(e) => s.toggleObligation(o.id, o.entityId, o.competencia, e.target.checked)} aria-label={`Concluir ${o.titulo}`} className="h-4 w-4" />
            <div className="flex-1 min-w-0"><div className={`font-medium ${o.concluida ? "line-through text-text-3" : ""}`}>{o.titulo}</div><div className="text-xs text-text-3">{o.descricao}</div></div>
            {(() => { const l = linhaDe(o.id); return l ? (
              <div className="flex flex-col items-end gap-0.5">
                <input className="input mono text-right w-32 py-0.5 min-h-7" defaultValue={l.tx ? String(l.tx.valorBrl) : ""} placeholder={l.estimativa != null ? String(l.estimativa) : "0,00"} aria-label={`Valor ${o.titulo}`} onBlur={(e) => salvarImposto(s, pj, mk, l, parseMoney(e.target.value), l.tx?.vencimento ?? o.vencimento)} />
                <span className="text-[11px] text-text-3">{l.tx ? "informado" : "estimativa; digite o valor da guia"}</span>
              </div>
            ) : null; })()}
            <div className="text-right"><div className="num text-sm">{fmtDate(o.vencimento)}</div>{o.valorPrevisto != null && !linhaDe(o.id) && <div className="num text-xs text-text-3">{fmtMoney(o.valorPrevisto)}</div>}</div>
            <Pill tone={o.tipo === "pagamento" ? "warn" : o.tipo === "declaracao" ? "info" : "muted"}>{o.tipo}</Pill>
          </li>
        ))}
      </ul>
      <Card title="TFE, contabilidade e parcelamentos">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="TFE anual (R$)"><Input className="mono" value={pj.config.tfeAnual ?? ""} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, tfeAnual: Number(e.target.value.replace(",", ".")) || 0 } })} /></Field>
          <Field label="Mês de vencimento da TFE"><Input type="number" min={1} max={12} value={pj.config.mesTfe ?? 7} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, mesTfe: Number(e.target.value) } })} /></Field>
          <Field label="ISS (alíquota municipal)"><Input className="mono" value={pj.config.issAliquota ?? ""} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, issAliquota: Number(e.target.value.replace(",", ".")) } })} placeholder="0,029" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-end">
          <Field label="Parcelamento (ex.: Regularize)"><Input value={parc.nome} onChange={(e) => setParc({ ...parc, nome: e.target.value })} /></Field>
          <Field label="Valor"><Input className="mono w-28" value={parc.valor} onChange={(e) => setParc({ ...parc, valor: e.target.value })} /></Field>
          <Field label="Parcela"><Input className="mono w-20" value={parc.parcela} onChange={(e) => setParc({ ...parc, parcela: e.target.value })} /></Field>
          <Field label="de"><Input className="mono w-20" value={parc.total} onChange={(e) => setParc({ ...parc, total: e.target.value })} /></Field>
          <Field label="Dia"><Input className="mono w-20" value={parc.dia} onChange={(e) => setParc({ ...parc, dia: e.target.value })} /></Field>
          <Button onClick={() => { if (!parc.nome) return; s.upsertEntity({ ...pj, config: { ...pj.config, parcelamentos: [...parcelamentos, { nome: parc.nome, valor: Number(parc.valor.replace(",", ".")) || 0, parcela: Number(parc.parcela) || 1, total: Number(parc.total) || 1, dia: Number(parc.dia) || 30 }] } as never }); setParc({ nome: "", valor: "", parcela: "", total: "", dia: "30" }); }}>Adicionar</Button>
        </div>
        {parcelamentos.length > 0 && <ul className="mt-2 text-sm">{parcelamentos.map((p, i) => <li key={i} className="flex gap-2 items-center"><span>{p.nome} — parcela {p.parcela}/{p.total} de {fmtMoney(p.valor)} (dia {p.dia})</span><button className="text-xs text-bad" onClick={() => s.upsertEntity({ ...pj, config: { ...pj.config, parcelamentos: parcelamentos.filter((_, j) => j !== i) } as never })}>remover</button></li>)}</ul>}
      </Card>
    </div>
  );
}
