/** Aba Balanço: previsão mês a mês de receita, impostos, despesas, pró-labore, lucro, retirada e caixa. */
import { useMemo } from "react";
import { fmtMonth } from "@core/dates";
import { fmtMoney, parseMoney, round2 } from "@core/money";
import { Button, Card, Field, Input, Money, Select, Stat } from "@/components/ui";
import { BarsChart } from "@/components/charts";
import { useAvisos } from "@/components/AvisosFlutuantes";
import { montarBalanco, previsaoConfig, type PrevisaoConfig } from "@/lib/balanco";
import { selPJ, useStore } from "@/state/store";

export function Balanco() {
  const s = useStore();
  const pj = selPJ(s)!;
  const mk = s.competencia;
  const cfg = previsaoConfig(pj);
  const b = useMemo(() => montarBalanco(s, pj, mk), [s, pj, mk]);
  const r = b.result;
  const save = (patch: Partial<PrevisaoConfig>) => s.upsertEntity({ ...pj, config: { ...pj.config, previsao: { ...cfg, ...patch } } as never });
  const setMes = (campo: "receitaPorMes" | "retiradaPorMes", mes: string, v: string) => {
    const n = parseMoney(v);
    const map = { ...(cfg[campo] ?? {}) };
    if (n == null) delete map[mes]; else map[mes] = n;
    save({ [campo]: map } as Partial<PrevisaoConfig>);
  };
  useAvisos(r.linhas.filter((l) => l.alerta).slice(0, 3).map((l) => ({ tone: "warn" as const, msg: l.alerta! })));

  function preencherRetiradas() {
    const pct = cfg.retiradaPercentual ?? 0.7;
    const map = { ...(cfg.retiradaPorMes ?? {}) };
    for (const l of r.linhas) if (!l.realizado) map[l.mes] = round2(Math.max(0, Math.min(l.lucro, l.retiradaMaxima)) * pct);
    save({ retiradaPorMes: map });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Caixa hoje (pago até o mês anterior)" value={b.caixaInicial} />
        <Stat label={`Lucro previsto em ${r.linhas.length} meses`} value={r.totais.lucro} tone={r.totais.lucro >= 0 ? "good" : "bad"} />
        <Stat label="Impostos previstos" value={r.totais.impostos} />
        <Stat label="Retiradas planejadas" value={r.totais.retirada} tone="accent" />
        <Stat label="Caixa ao final" value={r.caixaFinal} tone={r.menorCaixa < (cfg.caixaMinimo ?? 0) ? "bad" : "good"} sub={`menor caixa no período ${fmtMoney(r.menorCaixa)}`} />
      </div>
      <Card title="Premissas da previsão" info="Meses passados usam os valores lançados. Meses futuros usam a receita prevista, os impostos estimados pelo Dueto (DAS ou regime, DARF do pró-labore e outros impostos recorrentes), as recorrências e a política de pró-labore. Edite a receita e a retirada de cada mês direto na tabela; tudo é salvo automaticamente.">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Receita mensal prevista" hint={`padrão: média dos últimos 3 meses (${fmtMoney(b.receitaPrevistaPadrao)})`}><Input className="mono w-40" defaultValue={cfg.receitaMensal ?? ""} placeholder={String(b.receitaPrevistaPadrao)} onBlur={(e) => save({ receitaMensal: parseMoney(e.target.value) ?? undefined })} /></Field>
          <Field label="Despesas mensais" hint={`padrão: recorrências ativas (${fmtMoney(b.despesasPadrao)})`}><Input className="mono w-36" defaultValue={cfg.despesasMensais ?? ""} placeholder={String(b.despesasPadrao)} onBlur={(e) => save({ despesasMensais: parseMoney(e.target.value) ?? undefined })} /></Field>
          <Field label="Reserva de caixa por mês"><Input className="mono w-36" defaultValue={pj.config.reservaCaixaMensal ?? ""} placeholder="0" onBlur={(e) => s.upsertEntity({ ...pj, config: { ...pj.config, reservaCaixaMensal: parseMoney(e.target.value) ?? undefined } })} /></Field>
          <Field label="Caixa mínimo"><Input className="mono w-36" defaultValue={cfg.caixaMinimo ?? ""} placeholder="0" onBlur={(e) => save({ caixaMinimo: parseMoney(e.target.value) ?? undefined })} /></Field>
          <Field label="Horizonte"><Select value={cfg.horizonte ?? 12} onChange={(e) => save({ horizonte: Number(e.target.value) as 6 | 12 })}><option value={6}>6 meses</option><option value={12}>12 meses</option></Select></Field>
          <Field label="% do lucro para retirar"><Input className="mono w-24" defaultValue={Math.round((cfg.retiradaPercentual ?? 0.7) * 100)} onBlur={(e) => save({ retiradaPercentual: (Number(e.target.value) || 70) / 100 })} /></Field>
          <Button onClick={preencherRetiradas}>Preencher retiradas</Button>
        </div>
      </Card>
      <Card title="Balanço mês a mês" padded={false}>
        <div className="table-wrap rounded-none border-0">
          <table className="data">
            <thead><tr><th>Mês</th><th className="r">Receita</th><th className="r">Impostos</th><th className="r">Despesas</th><th className="r">Pró-labore</th><th className="r">Reserva</th><th className="r">Lucro</th><th className="r">Retirada</th><th className="r">Máx. retirável</th><th className="r">Caixa final</th></tr></thead>
            <tbody>
              {r.linhas.map((l) => (
                <tr key={l.mes} className={l.realizado ? "text-text-2" : ""}>
                  <td className="num whitespace-nowrap">{fmtMonth(l.mes)}{l.realizado ? <span className="text-[10px] text-text-3 ml-1">realizado</span> : l.mes === mk ? <span className="text-[10px] text-accent ml-1">atual</span> : ""}</td>
                  <td className="r">{l.realizado || (l.mes === mk && l.receita > 0 && !cfg.receitaPorMes?.[mk]) ? <span className="num">{fmtMoney(l.receita)}</span> : <input className="input mono text-right w-28 py-0.5 min-h-7" defaultValue={cfg.receitaPorMes?.[l.mes] ?? ""} placeholder={String(l.receita)} onBlur={(e) => setMes("receitaPorMes", l.mes, e.target.value)} aria-label={`Receita prevista ${l.mes}`} />}</td>
                  <td className="r num">{fmtMoney(l.impostos)}</td>
                  <td className="r num">{fmtMoney(l.despesas)}</td>
                  <td className="r num">{fmtMoney(l.proLaboreBruto)}</td>
                  <td className="r num">{fmtMoney(l.reserva)}</td>
                  <td className="r"><Money v={l.lucro} signed /></td>
                  <td className="r">{l.realizado ? <span className="num">{fmtMoney(l.retirada)}</span> : <input className="input mono text-right w-28 py-0.5 min-h-7" defaultValue={cfg.retiradaPorMes?.[l.mes] ?? ""} placeholder="0" onBlur={(e) => setMes("retiradaPorMes", l.mes, e.target.value)} aria-label={`Retirada planejada ${l.mes}`} />}</td>
                  <td className="r num text-text-3">{fmtMoney(l.retiradaMaxima)}</td>
                  <td className={`r num font-medium ${l.caixaFinal < (cfg.caixaMinimo ?? 0) ? "text-bad" : ""}`}>{fmtMoney(l.caixaFinal)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2 font-semibold"><td>Total</td><td className="r num">{fmtMoney(r.totais.receita)}</td><td className="r num">{fmtMoney(r.totais.impostos)}</td><td className="r num">{fmtMoney(r.totais.despesas)}</td><td className="r num">{fmtMoney(r.totais.proLaboreBruto)}</td><td className="r num">{fmtMoney(r.totais.reserva)}</td><td className="r"><Money v={r.totais.lucro} signed /></td><td className="r num">{fmtMoney(r.totais.retirada)}</td><td></td><td className="r num">{fmtMoney(r.caixaFinal)}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Lucro, retirada e impostos por mês">
        <BarsChart data={r.linhas.map((l) => ({ mes: l.mes, lucro: l.lucro, retirada: l.retirada, impostos: l.impostos }))} series={[{ key: "lucro", nome: "Lucro", cor: "var(--cat-1)" }, { key: "retirada", nome: "Retirada", cor: "var(--cat-2)" }, { key: "impostos", nome: "Impostos", cor: "var(--cat-5)" }]} height={220} />
      </Card>
    </div>
  );
}
