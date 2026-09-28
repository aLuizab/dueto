/** Visão de cima: cards, fluxo de caixa consolidado, alertas e próximos vencimentos. */
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { addMonths, fmtDate, fmtMonth, monthRange, todayISO } from "@core/dates";
import { fmtMoney, round2 } from "@core/money";
import { resumoMensalCasal } from "@core/couple";
import { evolucaoProduto } from "@core/investments";
import { tabelaDesatualizada } from "@core/tax/tables";
import { Card, Disclaimer, Stat } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { impostoDoMes, obrigacoesDoMes, proLaboreDoMes, seriesPJ } from "@/lib/fiscal";
import { totalImpostosMes } from "@/lib/impostos";
import { useAvisos } from "@/components/AvisosFlutuantes";
import { selAutonomo, selCasal, selPJ, selPessoas, useStore } from "@/state/store";

export default function Dashboard() {
  const s = useStore();
  const mk = s.competencia;
  const casal = selCasal(s);
  const pessoas = selPessoas(s);
  const pj = selPJ(s);
  const aut = selAutonomo(s);
  const hoje = todayISO();

  const resumo = useMemo(() => (casal ? resumoMensalCasal({ competencia: mk, transactions: s.transactions, categories: s.categories, pessoas, casalId: casal.id, carregarRestante: !casal.config.zerarRestante, hoje }) : null), [s.transactions, s.categories, pessoas, casal, mk, hoje]);
  const imp = useMemo(() => (pj ? impostoDoMes(s, pj, mk) : null), [s, pj, mk]);
  const pl = useMemo(() => (pj ? proLaboreDoMes(s, pj, mk) : null), [s, pj, mk]);
  const recPJ = useMemo(() => {
    if (!pj) return { usd: 0, brl: 0 };
    const doMes = s.transactions.filter((t) => t.entityId === pj.id && t.kind === "receita" && t.competencia === mk);
    return { usd: round2(doMes.filter((t) => t.moeda === "USD").reduce((a, t) => a + t.valor, 0)), brl: round2(doMes.reduce((a, t) => a + t.valorBrl, 0)) };
  }, [s.transactions, pj, mk]);
  const cons = useMemo(() => {
    if (!aut) return null;
    const doMes = s.transactions.filter((t) => t.entityId === aut.id && t.competencia === mk);
    const rec = doMes.filter((t) => t.kind === "receita").reduce((a, t) => a + t.valorBrl, 0);
    const desp = doMes.filter((t) => t.kind === "despesa").reduce((a, t) => a + t.valorBrl, 0);
    return { rec: round2(rec), desp: round2(desp), res: round2(rec - desp) };
  }, [s.transactions, aut, mk]);
  const totalInvestido = useMemo(() => {
    const ate = `${mk}-31`;
    return round2(s.investments.filter((i) => i.ativo).reduce((a, inv) => a + (evolucaoProduto(inv, s.snapshots, s.contributions, ate).saldoAtual ?? 0), 0));
  }, [s.investments, s.snapshots, s.contributions, mk]);

  const proximos = useMemo(() => {
    const lim = addMonths(mk, 0);
    void lim;
    const end = new Date(); end.setDate(end.getDate() + 7);
    const endIso = end.toISOString().slice(0, 10);
    return s.transactions.filter((t) => t.status === "pendente" && t.kind !== "receita" && t.vencimento && t.vencimento >= hoje && t.vencimento <= endIso).sort((a, b) => a.vencimento!.localeCompare(b.vencimento!)).slice(0, 12);
  }, [s.transactions, hoje, mk]);

  const alertas = useMemo(() => {
    const out: { tone: "warn" | "bad" | "info"; msg: string; to: string }[] = [];
    const vencidas = s.transactions.filter((t) => t.status === "pendente" && t.kind === "despesa" && t.vencimento && t.vencimento < hoje);
    if (vencidas.length) out.push({ tone: "bad", msg: `${vencidas.length} conta(s) vencida(s), total ${fmtMoney(vencidas.reduce((a, t) => a + t.valorBrl, 0))}.`, to: "/casal" });
    if (imp?.fatorR && imp.fatorR.rbt12 > 0 && imp.fatorR.fatorR < 0.28) out.push({ tone: "warn", msg: `Fator R em ${(imp.fatorR.fatorR * 100).toFixed(1)}% (< 28%): tributação pelo Anexo V. Pró-labore mínimo sugerido este mês: ${fmtMoney(imp.proLaboreMinimo ?? 0)}.`, to: "/pj" });
    const semCotacao = s.transactions.filter((t) => t.moeda !== "BRL" && !t.cotacao);
    if (semCotacao.length) out.push({ tone: "warn", msg: `${semCotacao.length} lançamento(s) em moeda estrangeira sem cotação informada.`, to: "/pj" });
    const notasSemRecebimento = s.invoices.filter((i) => i.status === "pendente");
    if (notasSemRecebimento.length) out.push({ tone: "info", msg: `${notasSemRecebimento.length} nota(s) fiscal(is) sem recebimento conciliado.`, to: "/pj" });
    if (tabelaDesatualizada(s.taxTables.irpf, hoje) || tabelaDesatualizada(s.taxTables.inss, hoje)) out.push({ tone: "warn", msg: "Tabelas fiscais (IRPF/INSS) podem estar desatualizadas: adicione a vigência do ano.", to: "/config#fiscal" });
    for (const a of imp?.alertas ?? []) if (!a.includes("Anexo V")) out.push({ tone: "warn", msg: a, to: "/pj" });
    return out;
  }, [s.transactions, s.invoices, s.taxTables, imp, hoje]);

  useAvisos(alertas);
  const impostosMes = useMemo(() => (pj ? totalImpostosMes(s, pj, mk) : null), [s, pj, mk]);
  const serie6 = useMemo(() => {
    if (!casal) return [];
    return monthRange(addMonths(mk, -5), mk).map((m) => {
      const r = resumoMensalCasal({ competencia: m, transactions: s.transactions, categories: s.categories, pessoas, casalId: casal.id, carregarRestante: false, hoje });
      return { mes: m, receitas: r.totalReceitas, despesas: r.totalDespesas };
    });
  }, [s.transactions, s.categories, pessoas, casal, mk, hoje]);

  const obrig = useMemo(() => obrigacoesDoMes(s, [pj, aut].filter(Boolean) as never, mk).filter((o) => !o.concluida && o.tipo === "pagamento").slice(0, 6), [s, pj, aut, mk]);
  const lucrosMes = pj ? round2(s.transactions.filter((t) => t.entityId === pj.id && t.categoryId === "pj-lucros" && t.competencia === mk).reduce((a, t) => a + t.valorBrl, 0)) : 0;
  const aportesMes = round2(s.transactions.filter((t) => (t.categoryId === "investimentos" || t.categoryId === "pf-investimento") && t.competencia === mk).reduce((a, t) => a + t.valorBrl, 0));
  const { receitas } = pj ? seriesPJ(s, pj) : { receitas: new Map() };
  void receitas;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-semibold">Visão geral</h1><p className="text-sm text-text-3">{fmtMonth(mk, "long")}</p></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Saldo da casa no mês" value={resumo?.saldo ?? 0} tone={(resumo?.saldo ?? 0) >= 0 ? "good" : "bad"} sub={resumo ? `receitas ${fmtMoney(resumo.totalReceitas)} · despesas ${fmtMoney(resumo.totalDespesas)}` : undefined} />
        <Stat label="Receita da empresa" value={recPJ.brl} sub={pj ? (recPJ.usd ? `US$ ${recPJ.usd.toLocaleString("pt-BR")}` : pj.config.fatura?.moeda ?? "BRL") : "sem PJ"} />
        <Stat label="Fator R" value={imp?.fatorR ? imp.fatorR.fatorR : 0} moeda="pct" tone={imp?.fatorR && imp.fatorR.fatorR >= 0.28 ? "good" : "warn"} sub={imp?.das ? `Anexo ${imp.das.anexo} · faixa ${imp.das.faixa}` : imp?.regime ?? "—"} />
        <Stat label="Impostos do mês" value={impostosMes?.total ?? 0} sub={impostosMes ? (impostosMes.informado ? `informado ${fmtMoney(impostosMes.informado)} · estimado ${fmtMoney(impostosMes.estimado)}` : `estimativa; informe em Empresa → Impostos`) : undefined} />
        {aut && <Stat label={`Resultado — ${aut.nome}`} value={cons?.res ?? 0} tone={(cons?.res ?? 0) >= 0 ? "good" : "bad"} sub={cons ? `${fmtMoney(cons.rec)} − ${fmtMoney(cons.desp)}` : undefined} />}
        <Stat label="Total investido" value={totalInvestido} tone="accent" sub={`aportes no mês ${fmtMoney(aportesMes)}`} />
      </div>


      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Receitas × despesas da casa (6 meses)" className="lg:col-span-2">
          <BarsChart data={serie6} series={[{ key: "receitas", nome: "Receitas", cor: "var(--cat-1)" }, { key: "despesas", nome: "Despesas", cor: "var(--cat-2)" }]} />
        </Card>
        <Card title="Próximos 7 dias">
          {proximos.length === 0 ? <p className="text-sm text-text-3">Nada vencendo nos próximos 7 dias.</p> : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {proximos.map((t) => <li key={t.id} className="flex justify-between gap-2 py-1.5"><span className="truncate"><span className="num text-text-3 mr-2">{fmtDate(t.vencimento).slice(0, 5)}</span>{t.descricao}</span><span className="num whitespace-nowrap">{fmtMoney(t.valorBrl)}</span></li>)}
            </ul>
          )}
          {obrig.length > 0 && (<>
            <h4 className="label mt-4 mb-1">Obrigações do mês</h4>
            <ul className="flex flex-col divide-y divide-border text-sm">
              {obrig.map((o) => <li key={o.id} className="flex justify-between gap-2 py-1.5"><span className="truncate"><span className="num text-text-3 mr-2">{fmtDate(o.vencimento).slice(0, 5)}</span>{o.titulo}</span><span className="num whitespace-nowrap">{o.valorPrevisto != null ? fmtMoney(o.valorPrevisto) : ""}</span></li>)}
            </ul>
          </>)}
        </Card>
      </div>

      <Card title="Fluxo de caixa consolidado do mês">
        <div className={`grid gap-3 items-stretch text-sm ${aut ? "md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]" : "md:grid-cols-[1fr_auto_1fr_auto_1fr]"}`}>
          <FlowBox titulo={pj?.nome ?? "Empresa"} linhas={[["Receita", recPJ.brl], ["DAS", -(imp?.valorTributo ?? 0)], ["Despesas", -(pj ? round2(s.transactions.filter((t) => t.entityId === pj.id && t.kind === "despesa" && t.competencia === mk && !["pj-prolabore", "pj-darf-prolabore", "pj-das", "pj-lucros"].includes(t.categoryId ?? "")).reduce((a, t) => a + t.valorBrl, 0)) : 0)]]} />
          <Arrow label={`pró-labore ${fmtMoney(pl?.liquido ?? 0)}${lucrosMes ? ` + lucros ${fmtMoney(lucrosMes)}` : ""}`} />
          {aut && <><FlowBox titulo={aut.nome} linhas={[["Receita", cons?.rec ?? 0], ["Despesas", -(cons?.desp ?? 0)], ["Resultado", cons?.res ?? 0]]} />
          <Arrow label="resultado" /></>}
          <FlowBox titulo={casal?.nome ?? "Casa"} linhas={[["Receitas", resumo?.totalReceitas ?? 0], ["Despesas", -(resumo?.totalDespesas ?? 0)], ["Saldo", resumo?.saldo ?? 0]]} destaque />
          <Arrow label={`aportes ${fmtMoney(aportesMes)}`} />
          <FlowBox titulo="Investimentos" linhas={[["Patrimônio", totalInvestido], ["Aportes no mês", aportesMes]]} />
        </div>
      </Card>
      <Disclaimer />
    </div>
  );
}

function FlowBox({ titulo, linhas, destaque }: { titulo: string; linhas: [string, number][]; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-accent bg-accent-soft/40" : "border-border bg-surface-2"}`}>
      <div className="font-semibold mb-1 truncate">{titulo}</div>
      {linhas.map(([l, v]) => <div key={l} className="flex justify-between gap-2 text-xs"><span className="text-text-3">{l}</span><span className={`num ${v < 0 ? "text-bad" : ""}`}>{fmtMoney(v)}</span></div>)}
    </div>
  );
}
function Arrow({ label }: { label: string }) {
  return <div className="flex md:flex-col items-center justify-center gap-1 text-text-3 text-[11px] text-center"><ArrowRight size={16} className="rotate-90 md:rotate-0" /><span className="max-w-24 leading-tight">{label}</span></div>;
}
