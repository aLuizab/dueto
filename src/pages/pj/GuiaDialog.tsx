/** Lançamento manual de uma guia (DAS ou DARF): número, valor total, vencimento, pagamento e composição por código. */
import { useMemo, useState } from "react";
import { fmtMoney, parseMoney, round2 } from "@core/money";
import { Button, Dialog, Field, Input, Switch } from "@/components/ui";
import { salvarImposto, type LinhaImposto } from "@/lib/impostos";
import { selPJ, useStore } from "@/state/store";

export function GuiaDialog({ linha, mk, onClose, onSaved }: { linha: LinhaImposto; mk: string; onClose: () => void; onSaved: (valor: number, vencimento: string) => void }) {
  const s = useStore();
  const pj = selPJ(s)!;
  const tx = linha.tx;
  const compSalva = (tx?.meta?.composicao as Record<string, number> | undefined) ?? undefined;
  const [numero, setNumero] = useState(String(tx?.meta?.numeroDocumento ?? ""));
  const [venc, setVenc] = useState(tx?.vencimento ?? linha.vencimentoPadrao);
  const [pagamento, setPagamento] = useState(tx?.pagamento ?? "");
  const [pago, setPago] = useState(tx?.status === "pago");
  const [usarComposicao, setUsarComposicao] = useState(!!compSalva || linha.composicao.length > 0);
  const [comp, setComp] = useState<Record<string, string>>(() => Object.fromEntries(linha.composicao.map((c) => [c.codigo, compSalva?.[c.codigo] != null ? String(compSalva[c.codigo]) : tx ? "" : String(c.valor)])));
  const [total, setTotal] = useState(tx ? String(tx.valorBrl) : linha.estimativa != null ? String(linha.estimativa) : "");
  const somaComp = useMemo(() => round2(Object.values(comp).reduce((a, v) => a + (parseMoney(v) ?? 0), 0)), [comp]);
  const valorFinal = usarComposicao && somaComp > 0 ? somaComp : parseMoney(total);

  function salvar() {
    if (!valorFinal || valorFinal <= 0) return;
    const composicao = usarComposicao ? Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, parseMoney(v) ?? 0]).filter(([, v]) => (v as number) > 0)) : undefined;
    salvarImposto(s, pj, mk, linha, valorFinal, venc, pago, { numeroDocumento: numero.trim() || undefined, pagamento: pago ? pagamento || venc : null, composicao });
    onSaved(valorFinal, venc);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Guia — ${linha.nome}`} description={`Referência ${mk}. Digite os valores como estão na guia; a estimativa do Dueto é só sugestão.`}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!valorFinal || valorFinal <= 0} onClick={salvar}>Salvar guia</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número do documento"><Input className="mono" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="07.20.26216.7777246-5" /></Field>
        <Field label="Vencimento"><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></Field>
        {linha.composicao.length > 0 && (
          <div className="col-span-2 flex flex-col gap-2">
            <Switch checked={usarComposicao} onCheckedChange={setUsarComposicao} label="Informar a composição por código (o total é a soma)" />
            {usarComposicao && (
              <div className="grid grid-cols-[80px_1fr_140px] gap-2 items-center text-sm">
                {linha.composicao.map((c) => (
                  <div key={c.codigo} className="contents">
                    <span className="mono text-text-3">{c.codigo}</span>
                    <span>{c.nome}<span className="text-xs text-text-3 ml-2">est. {fmtMoney(c.valor)}</span></span>
                    <Input className="mono text-right" value={comp[c.codigo] ?? ""} onChange={(e) => setComp({ ...comp, [c.codigo]: e.target.value })} placeholder="0,00" aria-label={`Valor ${c.nome}`} />
                  </div>
                ))}
                <span></span><span className="font-semibold">Total</span><span className="num text-right font-semibold">{fmtMoney(somaComp)}</span>
              </div>
            )}
          </div>
        )}
        {!(usarComposicao && somaComp > 0) && <Field label="Valor total" hint={linha.estimativa != null ? `estimativa ${fmtMoney(linha.estimativa)}` : undefined}><Input className="mono" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0,00" /></Field>}
        <div className="col-span-2 flex flex-wrap items-end gap-3">
          <Switch checked={pago} onCheckedChange={setPago} label="Já pago" />
          {pago && <Field label="Data do pagamento"><Input type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} /></Field>}
        </div>
        {linha.estimativa != null && valorFinal != null && valorFinal > 0 && Math.abs(valorFinal - linha.estimativa) > linha.estimativa * 0.15 && (
          <p className="col-span-2 text-xs text-warn">O valor informado difere mais de 15% da estimativa ({fmtMoney(linha.estimativa)}). Confira a receita e a folha lançadas no mês.</p>
        )}
      </div>
    </Dialog>
  );
}
