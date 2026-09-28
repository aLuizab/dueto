/** Importação de extratos bancários e faturas de cartão (CSV com mapeamento de colunas, ou OFX). */
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { extratoParaTransacoes, parseCsvExtrato, parseOfx, type CsvMapping, type ExtratoRow } from "@core/importers";
import { fmtMoney } from "@core/money";
import { newId } from "@core/ids";
import { Button, Card, Field, Input, PageHeader, Select, Switch } from "@/components/ui";
import { pickFiles } from "@/lib/utils";
import { useStore } from "@/state/store";

export default function Importar() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader title="Importar" subtitle="Extratos do banco e faturas de cartão em CSV ou OFX. As categorias são sugeridas e aprendem com suas correções." />
      <ExtratoImport />
      <Card title="Como exportar do seu banco">
        <ul className="text-sm text-text-2 list-disc pl-5 flex flex-col gap-1">
          <li><b>OFX</b> é o formato mais simples: a maioria dos bancos oferece "Exportar extrato → OFX" no internet banking. Não precisa de mapeamento.</li>
          <li><b>CSV</b>: informe qual coluna tem a data, a descrição e o valor. Faturas de cartão costumam listar compras como positivo; marque "Inverter sinal".</li>
          <li>Lançamentos repetidos (mesmo identificador do banco) são ignorados nas próximas importações.</li>
        </ul>
      </Card>
    </div>
  );
}

function ExtratoImport() {
  const s = useStore();
  const [rows, setRows] = useState<ExtratoRow[] | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [entityId, setEntityId] = useState(s.entities.find((e) => e.tipo === "CASAL")?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [map, setMap] = useState<CsvMapping>({ delimitador: "auto", colData: 0, colDescricao: 1, colValor: 2, formatoData: "dd/mm/yyyy", temCabecalho: true, inverterSinal: false });
  const [feito, setFeito] = useState<string | null>(null);
  const ent = s.entities.find((e) => e.id === entityId);
  const contas = s.accounts.filter((a) => a.entityId === entityId || (ent?.tipo === "CASAL" && s.entities.some((p) => p.tipo === "PESSOA" && p.id === a.entityId)));

  async function escolher() {
    setFeito(null);
    const files = await pickFiles({ title: "Extrato CSV ou OFX", extensions: ["csv", "txt", "ofx"] });
    if (!files[0]) return;
    const text = new TextDecoder("utf-8").decode(files[0].bytes);
    setNome(files[0].name);
    if (/<OFX|<STMTTRN>/i.test(text)) { const r = parseOfx(text); setRows(r.rows); setErros(r.erros); setRaw(null); }
    else { setRaw(text); const r = parseCsvExtrato(text, map); setRows(r.rows); setErros(r.erros); }
  }
  function remap(m: CsvMapping) { setMap(m); if (raw) { const r = parseCsvExtrato(raw, m); setRows(r.rows); setErros(r.erros); } }
  const preview = useMemo(() => rows?.slice(0, 8) ?? [], [rows]);

  function aplicar() {
    if (!rows || !ent) return;
    const fit = new Set(s.transactions.map((t) => String(t.meta?.fitId ?? "")).filter(Boolean));
    const txs = extratoParaTransacoes(rows, { entityId, accountId: accountId || null, escopo: ent.tipo, rules: s.rules, existentesFitIds: fit }).map((t) => ({ ...t, id: newId("tx") }));
    s.upsertTransactions(txs);
    setRows(null);
    setFeito(`${txs.length} lançamentos importados para ${ent.nome}.`);
  }

  return (
    <Card title={<span className="flex items-center gap-2"><FileText size={16} /> Extratos e faturas (CSV / OFX)</span>}>
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="Entidade"><Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>{s.entities.filter((e) => e.tipo !== "PESSOA").map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</Select></Field>
        <Field label="Conta / cartão"><Select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">—</option>{contas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></Field>
        <Button variant="primary" onClick={escolher}>Escolher arquivo…</Button>
        {nome && <span className="text-xs text-text-3">{nome}</span>}
      </div>
      {feito && <p className="text-sm text-good mt-3">{feito}</p>}
      {raw && (
        <div className="grid sm:grid-cols-6 gap-2 mt-3 items-end">
          <Field label="Coluna data"><Input type="number" min={0} value={map.colData} onChange={(e) => remap({ ...map, colData: Number(e.target.value) })} /></Field>
          <Field label="Coluna descrição"><Input type="number" min={0} value={map.colDescricao} onChange={(e) => remap({ ...map, colDescricao: Number(e.target.value) })} /></Field>
          <Field label="Coluna valor"><Input type="number" min={0} value={map.colValor} onChange={(e) => remap({ ...map, colValor: Number(e.target.value) })} /></Field>
          <Field label="Formato da data"><Select value={map.formatoData} onChange={(e) => remap({ ...map, formatoData: e.target.value as CsvMapping["formatoData"] })}><option value="dd/mm/yyyy">dd/mm/aaaa</option><option value="yyyy-mm-dd">aaaa-mm-dd</option><option value="mm/dd/yyyy">mm/dd/aaaa</option></Select></Field>
          <div className="pb-2"><Switch checked={map.temCabecalho} onCheckedChange={(v) => remap({ ...map, temCabecalho: v })} label="Tem cabeçalho" /></div>
          <div className="pb-2"><Switch checked={!!map.inverterSinal} onCheckedChange={(v) => remap({ ...map, inverterSinal: v })} label="Inverter sinal (fatura)" /></div>
        </div>
      )}
      {rows && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-text-2">{rows.length} linhas lidas{erros.length ? ` · ${erros.length} com erro` : ""}.</p>
          <div className="table-wrap"><table className="data"><thead><tr><th>Data</th><th>Descrição</th><th className="r">Valor</th></tr></thead><tbody>{preview.map((r, i) => <tr key={i}><td className="num">{r.data}</td><td>{r.descricao}</td><td className="r num">{fmtMoney(r.valor)}</td></tr>)}</tbody></table></div>
          {erros.length > 0 && <details className="text-xs text-text-3"><summary>Erros</summary><ul>{erros.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul></details>}
          <div className="flex justify-end gap-2"><Button onClick={() => setRows(null)}>Cancelar</Button><Button variant="primary" onClick={aplicar} disabled={!rows.length}>Importar {rows.length} lançamentos</Button></div>
        </div>
      )}
    </Card>
  );
}
