/** Aba Impostos: linhas com flag, estimativa do Dueto e valor informado; outros impostos; detalhes do cálculo recolhidos. */
import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { addMonths, fmtDate, fmtMonth, monthRange } from "@core/dates";
import { newId } from "@core/ids";
import { fmtMoney, fmtPct, parseMoney, round2 } from "@core/money";
import { FATOR_R_METODOS, calcularFatorR, type FatorRMetodo } from "@core/tax/simples";
import { Button, Card, Dialog, Field, Input, Pill, Progress, Select, Stat, Switch } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { useAvisos } from "@/components/AvisosFlutuantes";
import { impostoDoMes, seriesPJ, tabelasPara } from "@/lib/fiscal";
import { configImpostos, linhasImposto, salvarImposto, totalImpostosMes, type ImpostoCustom, type LinhaImposto } from "@/lib/impostos";
import { GuiaDialog } from "@/pages/pj/GuiaDialog";
import { selPJ, useStore } from "@/state/store";

export function Impostos() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const imp = impostoDoMes(s, pj, mk);
  const linhas = linhasImposto(s, pj, mk);
  const tot = totalImpostosMes(s, pj, mk);
  const [novo, setNovo] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const cfg = configImpostos(pj);

  useAvisos([
    ...imp.alertas.map((a) => ({ tone: "warn" as const, msg: a })),
    ...(tot.informado === 0 && tot.estimado > 0 ? [{ tone: "info" as const, msg: `Nenhum imposto informado para ${fmtMonth(mk)}. Preencha os valores com o que vai recolher; a estimativa é só sugestão.` }] : []),
  ]);

  function setAtivo(tipo: string, v: boolean) {
    s.upsertEntity({ ...pj, config: { ...pj.config, impostos: { ...cfg, ativos: { ...(cfg.ativos ?? {}), [tipo]: v } } } as never });
  }
  function removerCustom(id: string) {
    const l = linhas.find((x) => x.tipo === `outro:${id}`);
    if (l?.tx) s.deleteTransaction(l.tx.id);
    s.upsertEntity({ ...pj, config: { ...pj.config, impostos: { ...cfg, outros: (cfg.outros ?? []).filter((c) => c.id !== id) } } as never });
  }
  const serie = monthRange(addMonths(mk, -11), mk).map((m) => ({ mes: m, ...(() => { const t = totalImpostosMes(s, pj, m); return { estimado: t.estimado, informado: t.informado }; })() }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Impostos informados no mês" value={tot.informado} tone="accent" sub={tot.informado ? "o que você vai recolher" : "nenhum valor informado ainda"} />
        <Stat label="Estimativa do Dueto" value={tot.estimado} sub="soma das linhas ativas" />
        <Stat label="Diferença" value={round2(tot.informado - tot.estimado)} tone={tot.informado && Math.abs(tot.informado - tot.estimado) > tot.estimado * 0.15 ? "warn" : undefined} sub="informado − estimado" />
        {imp.fatorR && <Stat label="Fator R" value={imp.fatorR.fatorR} moeda="pct" tone={imp.fatorR.fatorR >= 0.28 ? "good" : "warn"} sub={imp.das ? `Anexo ${imp.das.anexo} · faixa ${imp.das.faixa}` : ""} />}
      </div>

      <Card title={`Impostos de ${fmtMonth(mk, "long")}`} info={"Ligue só o que sua empresa recolhe. Digite o valor que vai pagar; \"usar\" copia a estimativa. Os valores ficam salvos e nunca são sobrescritos pelo cálculo."} actions={<Button size="sm" onClick={() => setNovo(true)}><Plus size={14} /> Outro imposto</Button>}>
        <div className="flex flex-col divide-y divide-border">
          {linhas.map((l) => <LinhaImpostoRow key={l.tipo} linha={l} mk={mk} onToggle={(v) => setAtivo(l.tipo, v)} onRemover={l.custom ? () => removerCustom(l.custom!.id) : undefined} />)}
        </div>
      </Card>

      <Card title="Estimado × informado (12 meses)">
        <BarsChart data={serie} series={[{ key: "estimado", nome: "Estimativa", cor: "var(--cat-1)" }, { key: "informado", nome: "Informado", cor: "var(--cat-2)" }]} height={180} />
      </Card>

      <button className="flex items-center gap-2 text-sm text-text-2 hover:text-text" onClick={() => setDetalhes(!detalhes)} aria-expanded={detalhes}>
        <ChevronDown size={16} className={detalhes ? "rotate-180 transition-transform" : "transition-transform"} /> Detalhes do cálculo (Fator R, partilha do DAS, memória)
      </button>
      {detalhes && <Detalhes />}

      {novo && <NovoImposto mk={mk} onClose={() => setNovo(false)} />}
    </div>
  );
}

function LinhaImpostoRow({ linha, mk, onToggle, onRemover }: { linha: LinhaImposto; mk: string; onToggle: (v: boolean) => void; onRemover?: () => void }) {
  const s = useStore();
  const pj = selPJ(s)!;
  const [valor, setValor] = useState<string>(linha.tx ? String(linha.tx.valorBrl) : "");
  const [guia, setGuia] = useState(false);
  const [venc, setVenc] = useState<string>(linha.tx?.vencimento ?? linha.vencimentoPadrao);
  const pago = linha.tx?.status === "pago";
  const commit = (v: string, vc = venc, pg = pago) => {
    const n = parseMoney(v);
    salvarImposto(s, pj, mk, linha, n, vc, pg);
  };
  return (
    <div className={`grid grid-cols-1 md:grid-cols-[auto_1fr_150px_150px_140px_auto] gap-3 items-center py-3 ${!linha.ativo ? "opacity-50" : ""}`}>
      <Switch checked={linha.ativo} onCheckedChange={onToggle} />
      <div className="min-w-0">
        <div className="font-medium flex items-center gap-2">{linha.nome}{linha.custom && <Pill tone="muted">{linha.custom.recorrente ? "todo mês" : "só este mês"}</Pill>}</div>
        <div className="text-xs text-text-3">{linha.descricao}</div>
      </div>
      <div className="text-sm">
        <div className="label">Estimativa</div>
        <div className="flex items-center gap-2"><span className="num">{linha.estimativa != null ? fmtMoney(linha.estimativa) : "—"}</span>{linha.estimativa != null && linha.ativo && <button className="text-xs text-accent hover:underline" onClick={() => { setValor(String(linha.estimativa)); commit(String(linha.estimativa)); }}>usar</button>}</div>
      </div>
      <Field label="Valor a recolher"><Input className="mono" value={valor} disabled={!linha.ativo} placeholder="0,00" onChange={(e) => setValor(e.target.value)} onBlur={() => commit(valor)} onKeyDown={(e) => e.key === "Enter" && commit(valor)} /></Field>
      <Field label="Vencimento"><Input type="date" value={venc} disabled={!linha.ativo} onChange={(e) => { setVenc(e.target.value); if (linha.tx) commit(valor, e.target.value); }} /></Field>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={pago} disabled={!linha.tx} onChange={(e) => commit(valor, venc, e.target.checked)} /> pago</label>
        {(linha.tipo === "das" || linha.tipo === "darf" || linha.tipo === "tribfed") && <Button size="sm" disabled={!linha.ativo} onClick={() => setGuia(true)} title="Lançar a guia com número, composição por código e data de pagamento">Guia</Button>}
        {onRemover && <button className="text-xs text-bad hover:underline" onClick={onRemover}>remover</button>}
        {linha.tx?.meta?.numeroDocumento ? <span className="text-[11px] text-text-3 mono">nº {String(linha.tx.meta.numeroDocumento)}</span> : null}
      </div>
      {guia && <GuiaDialog linha={linha} mk={mk} onClose={() => setGuia(false)} onSaved={(v, vc) => { setValor(String(v)); setVenc(vc); }} />}
    </div>
  );
}

function NovoImposto({ mk, onClose }: { mk: string; onClose: () => void }) {
  const s = useStore();
  const pj = selPJ(s)!;
  const [c, setC] = useState<ImpostoCustom>({ id: newId("imp"), nome: "", dia: 20, recorrente: false, competencia: mk, valorPadrao: undefined });
  const cfg = configImpostos(pj);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Outro imposto ou taxa" description="Ex.: TFE, parcelamento, ISS retido, taxa da junta comercial." footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!c.nome.trim()} onClick={() => { s.upsertEntity({ ...pj, config: { ...pj.config, impostos: { ...cfg, outros: [...(cfg.outros ?? []), { ...c, nome: c.nome.trim() }] } } as never }); onClose(); }}>Adicionar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2"><Input autoFocus value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} /></Field>
        <Field label="Dia de vencimento (mês seguinte)"><Input type="number" min={1} max={31} value={c.dia} onChange={(e) => setC({ ...c, dia: Number(e.target.value) || 20 })} /></Field>
        <Field label="Valor padrão (opcional)"><Input className="mono" value={c.valorPadrao ?? ""} onChange={(e) => setC({ ...c, valorPadrao: parseMoney(e.target.value) ?? undefined })} /></Field>
        <div className="col-span-2"><Switch checked={c.recorrente} onCheckedChange={(v) => setC({ ...c, recorrente: v })} label="Repete todo mês" /></div>
      </div>
    </Dialog>
  );
}

function Detalhes() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const imp = impostoDoMes(s, pj, mk);
  const tt = tabelasPara(s.taxTables, mk);
  const { receitas, folha } = seriesPJ(s, pj);
  const [simPl, setSimPl] = useState("");
  const das = imp.das;
  const proximo = addMonths(mk, 1);
  const metodo: FatorRMetodo = pj.config.fatorRMetodo ?? "anterior12";
  const mesAfetado = metodo === "anterior12" ? proximo : mk;
  const simulado = useMemo(() => {
    const f = new Map(folha);
    if (simPl !== "") f.set(mk, Number(simPl.replace(",", ".")) || 0);
    return calcularFatorR(mesAfetado, receitas, f, tt.params, pj.config.inicioAtividade, metodo);
  }, [simPl, folha, receitas, mk, mesAfetado, tt.params, pj.config.inicioAtividade, metodo]);
  const tribLabel: Record<string, string> = { irpj: "IRPJ", csll: "CSLL", cofins: "COFINS", pis: "PIS/Pasep", cpp: "CPP (INSS patronal)", iss: "ISS" };
  return (
    <div className="flex flex-col gap-4">
      {imp.fatorR && (
        <Card title="Fator R">
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <Field label="Método" hint={FATOR_R_METODOS.find((m) => m.id === metodo)?.descricao}>
              <Select value={metodo} onChange={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, fatorRMetodo: e.target.value as FatorRMetodo } })} className="max-w-md">{FATOR_R_METODOS.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Select>
            </Field>
            <div className="pb-6 flex flex-col gap-2">
              <Switch checked={pj.config.fatorRArredondar !== false} onCheckedChange={(v) => s.upsertEntity({ ...pj, config: { ...pj.config, fatorRArredondar: v } })} label="Arredondar a 2 casas antes de comparar com 28% (como o PGDAS-D)" />
              <Switch checked={!!pj.config.fatorRManual} onCheckedChange={(v) => s.upsertEntity({ ...pj, config: { ...pj.config, fatorRManual: v } })} label={`Ignorar o Fator R e fixar o anexo ${pj.regime === "SIMPLES_V" ? "V" : "III"}`} />
            </div>
          </div>
          <Progress value={Math.min(1, imp.fatorR.fatorR / 0.28)} tone={imp.fatorR.fatorR >= 0.28 ? "good" : "bad"} />
          <p className="text-sm mt-2">Fator R ({imp.fatorR.janela.de} a {imp.fatorR.janela.ate}): folha {fmtMoney(imp.fatorR.folha12)} ÷ receita {fmtMoney(imp.fatorR.rbt12)}{imp.fatorR.fatorRExato != null && <> = {fmtPct(imp.fatorR.fatorRExato)}</>} → <b className="num">{(imp.fatorR.fatorR * 100).toFixed(0)}%</b> <span className="text-text-3">({imp.fatorR.regra})</span>. Pró-labore mínimo em {fmtMonth(mk)} para ficar em 28% na apuração de {fmtMonth(mesAfetado)}: <b className="num">{fmtMoney(imp.proLaboreMinimo ?? 0)}</b>.</p>
          <div className="flex flex-wrap gap-3 items-end mt-2">
            <Field label={`Se o pró-labore de ${fmtMonth(mk)} for`}><Input className="mono w-40" value={simPl} onChange={(e) => setSimPl(e.target.value)} placeholder={String(folha.get(mk) ?? 0)} /></Field>
            <div className="text-sm pb-2">→ Fator R <b className="num">{fmtPct(simulado.fatorR)}</b> · Anexo <b>{simulado.anexo}</b></div>
          </div>
        </Card>
      )}
      {das && (
        <Card title="Partilha do DAS por tributo">
          <div className="table-wrap"><table className="data"><thead><tr><th>Tributo</th><th className="r">Partilha</th><th className="r">Alíq. efetiva</th><th className="r">Nacional</th><th className="r">Exportação</th><th className="r">Total</th></tr></thead>
            <tbody>{das.tributos.map((t) => <tr key={t.tributo}><td><span className="mono text-text-3 mr-2">{t.codigo}</span>{tribLabel[t.tributo]}</td><td className="r num">{fmtPct(t.percentualPartilha)}</td><td className="r num">{fmtPct(t.aliquotaEfetivaTributo)}</td><td className="r num">{fmtMoney(t.valorNacional)}</td><td className="r num">{t.valorExportacao ? fmtMoney(t.valorExportacao) : <span className="text-text-3">{["pis", "cofins", "iss"].includes(t.tributo) ? "excluído" : "—"}</span>}</td><td className="r num font-medium">{fmtMoney(t.valor)}</td></tr>)}
              <tr><td className="font-semibold">DAS</td><td colSpan={2}></td><td className="r num">{fmtMoney(das.receitaNacional)}</td><td className="r num">{fmtMoney(das.receitaExportacao)}</td><td className="r num font-semibold">{fmtMoney(das.das)}</td></tr></tbody></table></div>
        </Card>
      )}
      <Card title="Memória de cálculo" info={<>Tabelas: {tt.anexoIII.descricao}. Vencimento estimado do DAS: {das ? fmtDate(das.vencimento) : "—"}. Os códigos (1001 IRPJ, 1002 CSLL, 1006 INSS/CPP…) são os da composição da guia DAS.</>}><ol className="text-xs font-mono text-text-2 flex flex-col gap-1 list-decimal pl-4">{imp.memoria.map((m, i) => <li key={i}>{m}</li>)}</ol></Card>
    </div>
  );
}
