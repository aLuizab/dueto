/** Investimentos: produtos por pessoa/instituição, aportes, snapshots de saldo, variação e alocação. */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Investment } from "@core/domain/types";
import { addMonths, fmtDate, fmtMonth, lastDayOfMonth, monthRange, todayISO } from "@core/dates";
import { newId } from "@core/ids";
import { alocacaoPorTipo, evolucaoProduto, serieMensalPatrimonio, totalPorDono } from "@core/investments";
import { fmtMoney, fmtPct, round2 } from "@core/money";
import { Button, Card, Confirm, Dialog, Field, Input, Money, PageHeader, Select, Stat } from "@/components/ui";
import { DonutChart, LinesChart } from "@/components/charts";
import { selPessoas, useStore } from "@/state/store";

const TIPOS: Record<Investment["tipo"], string> = { previdencia: "Previdência", cdb: "CDB / LCI / LCA", cofrinho: "Cofrinho / caixinha", conta_remunerada: "Conta remunerada", acoes: "Ações / ETFs", fii: "FIIs", cripto: "Cripto", exterior: "Exterior", tesouro: "Tesouro Direto", outro: "Outro" };

export default function Investimentos() {
  const s = useStore();
  const mk = s.competencia;
  const pessoas = selPessoas(s);
  const ate = lastDayOfMonth(mk);
  const desde = lastDayOfMonth(addMonths(mk, -1));
  const [edit, setEdit] = useState<Investment | null>(null);
  const [snap, setSnap] = useState<Investment | null>(null);
  const [del, setDel] = useState<Investment | null>(null);
  const invs = s.investments.filter((i) => i.ativo);
  const evs = useMemo(() => invs.map((i) => evolucaoProduto(i, s.snapshots, s.contributions, ate, desde)), [invs, s.snapshots, s.contributions, ate, desde]);
  const porDono = totalPorDono(evs);
  const total = round2(Object.values(porDono).reduce((a, b) => a + b, 0));
  const variacao = round2(evs.reduce((a, e) => a + (e.variacao ?? 0), 0));
  const aportesMes = round2(evs.reduce((a, e) => a + e.aportes, 0));
  const serie = serieMensalPatrimonio(invs, s.snapshots, monthRange(addMonths(mk, -11), mk)).map((x) => ({ mes: x.mes, total: x.total, ...Object.fromEntries(pessoas.map((p) => [p.id, x.porDono[p.id] ?? 0])) }));
  const aloc = alocacaoPorTipo(evs).map((a) => ({ nome: TIPOS[a.tipo as Investment["tipo"]] ?? a.tipo, valor: a.valor }));
  const aportesTx = s.transactions.filter((t) => (t.categoryId === "investimentos" || t.categoryId === "pf-investimento") && t.competencia === mk);
  const nome = (id: string) => s.entities.find((e) => e.id === id)?.nome ?? "";
  const meta12 = Number(s.settings["inv.meta"] ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Investimentos" subtitle={`Posição em ${fmtDate(ate)}`} actions={<Button variant="primary" onClick={() => setEdit({ id: newId("inv"), entityId: pessoas[0]?.id ?? "", nome: "", tipo: "cdb", ativo: true })}><Plus size={14} /> Produto</Button>} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Total investido" value={total} tone="accent" sub={meta12 ? `${fmtPct(total / meta12)} da meta ${fmtMoney(meta12)}` : undefined} />
        {pessoas.map((p) => <Stat key={p.id} label={p.nome} value={porDono[p.id] ?? 0} />)}
        <Stat label="Aportes no período" value={aportesMes} />
        <Stat label="Variação (rentabilidade)" value={variacao} tone={variacao >= 0 ? "good" : "bad"} sub="saldo atual − (anterior + aportes)" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Evolução do patrimônio (12 meses)" className="lg:col-span-2"><LinesChart data={serie} series={[{ key: "total", nome: "Total" }, ...pessoas.map((p) => ({ key: p.id, nome: p.nome }))]} area /></Card>
        <Card title="Alocação por tipo">{aloc.length ? <DonutChart data={aloc} height={180} /> : <p className="text-sm text-text-3">Registre saldos para ver a alocação.</p>}</Card>
      </div>
      <Card title="Produtos" actions={<Field label="Meta de patrimônio"><Input className="mono w-36" value={meta12 || ""} onChange={(e) => s.setSetting("inv.meta", Number(e.target.value.replace(",", ".")) || 0)} placeholder="0" /></Field>}>
        <div className="table-wrap"><table className="data"><thead><tr><th>Produto</th><th>Dono</th><th>Instituição</th><th>Tipo</th><th className="r">Saldo anterior</th><th className="r">Aportes</th><th className="r">Saldo atual</th><th className="r">Variação</th><th className="r">Rentab.</th><th></th></tr></thead>
          <tbody>{evs.map((e) => { const inv = invs.find((i) => i.id === e.investmentId)!; return (
            <tr key={e.investmentId}><td>{e.nome}</td><td className="text-text-2">{nome(e.dono)}</td><td className="text-text-2">{inv.instituicao ?? ""}</td><td className="text-text-2">{TIPOS[e.tipo]}</td>
              <td className="r num">{e.saldoAnterior != null ? fmtMoney(e.saldoAnterior) : "—"}<div className="text-[10px] text-text-3">{e.dataAnterior ? fmtDate(e.dataAnterior) : ""}</div></td>
              <td className="r num">{fmtMoney(e.aportes)}</td>
              <td className="r num font-medium">{e.saldoAtual != null ? fmtMoney(e.saldoAtual) : "—"}<div className="text-[10px] text-text-3">{e.dataAtual ? fmtDate(e.dataAtual) : ""}</div></td>
              <td className="r">{e.variacao != null ? <Money v={e.variacao} signed /> : "—"}</td><td className="r num">{e.rentabilidade != null ? fmtPct(e.rentabilidade) : "—"}</td>
              <td><div className="flex gap-1 justify-end"><Button size="sm" onClick={() => setSnap(inv)}>Saldo</Button><Button size="sm" variant="ghost" onClick={() => setEdit(inv)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => setDel(inv)}>Excluir</Button></div></td></tr>); })}
            {evs.length === 0 && <tr><td colSpan={10} className="text-center text-text-3 py-6">Cadastre produtos (previdência, CDB, cofrinho, conta remunerada, ações, FII, cripto, exterior) e registre o saldo a cada mês.</td></tr>}</tbody></table></div>
      </Card>
      <Card title={`Aportes lançados em ${fmtMonth(mk)} (Casa e Autônomo)`}>
        <ul className="text-sm divide-y divide-border">{aportesTx.map((t) => { const ctb = s.contributions.find((c) => c.transactionId === t.id); return (
          <li key={t.id} className="flex items-center gap-3 py-1.5"><span className="flex-1">{t.descricao} <span className="text-text-3 text-xs">· {nome(t.entityId)}</span></span><span className="num">{fmtMoney(t.valorBrl)}</span>
            {ctb ? <span className="text-xs text-text-3">→ {invs.find((i) => i.id === ctb.investmentId)?.nome ?? "produto"}</span> : <Select className="w-48" value="" onChange={(e) => { if (e.target.value) s.upsertContribution({ id: newId("ctb"), investmentId: e.target.value, transactionId: t.id, data: t.pagamento ?? t.vencimento ?? `${t.competencia}-15`, valor: t.valorBrl }); }}><option value="">vincular a um produto…</option>{invs.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</Select>}</li>); })}
          {aportesTx.length === 0 && <li className="py-3 text-text-3">Nenhuma saída para investimento neste mês.</li>}</ul>
      </Card>
      {edit && <Dialog open onOpenChange={(o) => !o && setEdit(null)} title="Produto de investimento" footer={<><Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" disabled={!edit.nome.trim() || !edit.entityId} onClick={() => { s.upsertInvestment(edit); setEdit(null); }}>Salvar</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" className="col-span-2"><Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
          <Field label="Dono"><Select value={edit.entityId} onChange={(e) => setEdit({ ...edit, entityId: e.target.value })}>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
          <Field label="Tipo"><Select value={edit.tipo} onChange={(e) => setEdit({ ...edit, tipo: e.target.value as Investment["tipo"] })}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="Instituição"><Input value={edit.instituicao ?? ""} onChange={(e) => setEdit({ ...edit, instituicao: e.target.value })} /></Field>
          <Field label="Indexador"><Input value={edit.indexador ?? ""} onChange={(e) => setEdit({ ...edit, indexador: e.target.value })} placeholder="CDI, IPCA+, pré…" /></Field>
        </div>
      </Dialog>}
      {snap && <SnapshotForm inv={snap} onClose={() => setSnap(null)} />}
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir produto" message={`Excluir "${del?.nome}" e seus saldos/aportes?`} danger onConfirm={() => { if (!del) return; s.snapshots.filter((x) => x.investmentId === del.id).forEach((x) => s.deleteSnapshot(x.id)); s.contributions.filter((x) => x.investmentId === del.id).forEach((x) => s.deleteContribution(x.id)); s.deleteInvestment(del.id); }} />
    </div>
  );
}

function SnapshotForm({ inv, onClose }: { inv: Investment; onClose: () => void }) {
  const s = useStore();
  const [data, setData] = useState(todayISO());
  const [saldo, setSaldo] = useState("");
  const [aporte, setAporte] = useState("");
  const snaps = s.snapshots.filter((x) => x.investmentId === inv.id).sort((a, b) => b.data.localeCompare(a.data));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Saldo — ${inv.nome}`} footer={<><Button onClick={onClose}>Fechar</Button><Button variant="primary" disabled={!saldo} onClick={() => { s.upsertSnapshot({ id: newId("snap"), investmentId: inv.id, data, saldo: Number(saldo.replace(",", ".")) || 0 }); if (Number(aporte.replace(",", "."))) s.upsertContribution({ id: newId("ctb"), investmentId: inv.id, transactionId: null, data, valor: Number(aporte.replace(",", ".")) }); setSaldo(""); setAporte(""); }}>Registrar</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Field>
        <Field label="Saldo"><Input className="mono" value={saldo} onChange={(e) => setSaldo(e.target.value)} /></Field>
        <Field label="Aporte na data (opcional)"><Input className="mono" value={aporte} onChange={(e) => setAporte(e.target.value)} /></Field>
      </div>
      <ul className="mt-3 text-sm divide-y divide-border max-h-48 overflow-y-auto">{snaps.map((x) => <li key={x.id} className="flex justify-between py-1"><span className="num">{fmtDate(x.data)}</span><span className="num">{fmtMoney(x.saldo)}</span><button className="text-xs text-bad" onClick={() => s.deleteSnapshot(x.id)}>remover</button></li>)}</ul>
    </Dialog>
  );
}
