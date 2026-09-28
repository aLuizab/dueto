/**
 * Formulário de lançamento: aceita expressão no valor (=120+150), parcelamento (gera parcelas futuras),
 * moeda/cotação com busca PTAX opcional, recorrência, status e "quem pagou".
 */
import { useEffect, useMemo, useState } from "react";
import type { Currency, Transaction, TxKind, TxStatus } from "@core/domain/types";
import { parseValueField } from "@core/expression";
import { newId, slug } from "@core/ids";
import { round2, toBrl } from "@core/money";
import { generateRemainingInstallments } from "@core/parcelas";
import { categorize } from "@core/categorize";
import { categoriaNome } from "@core/seed/categories";
import { dateInMonth, monthKeyOf, todayISO } from "@core/dates";
import { Button, Dialog, Field, Input, Select, Switch } from "@/components/ui";
import { novoTx, useStore } from "@/state/store";

export interface TxFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityId: string;
  initial?: Partial<Transaction> | null;
  kindDefault?: TxKind;
}

export function TransactionForm({ open, onOpenChange, entityId, initial, kindDefault = "despesa" }: TxFormProps) {
  const s = useStore();
  const ent = s.entities.find((e) => e.id === entityId);
  const escopo = ent?.tipo ?? "CASAL";
  const cats = useMemo(() => s.categories.filter((c) => !c.escopo || c.escopo.includes(escopo) || (escopo === "PESSOA" && c.escopo.includes("CASAL"))), [s.categories, escopo]);
  const pessoas = s.entities.filter((e) => e.tipo === "PESSOA");
  const contas = s.accounts.filter((a) => a.ativa && (a.entityId === entityId || pessoas.some((p) => p.id === a.entityId)));
  const editing = !!initial?.id;

  const [kind, setKind] = useState<TxKind>(initial?.kind ?? kindDefault);
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [valorTxt, setValorTxt] = useState(initial?.valorExpressao ?? (initial?.valor != null ? String(initial.valor) : ""));
  const [moeda, setMoeda] = useState<Currency>(initial?.moeda ?? "BRL");
  const [cotacao, setCotacao] = useState(initial?.cotacao ? String(initial.cotacao) : "");
  const [competencia, setCompetencia] = useState(initial?.competencia ?? s.competencia);
  const [vencimento, setVencimento] = useState(initial?.vencimento ?? "");
  const [pagamento, setPagamento] = useState(initial?.pagamento ?? "");
  const [status, setStatus] = useState<TxStatus>(initial?.status ?? "pendente");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [pagoPor, setPagoPor] = useState(initial?.pagoPor ?? "");
  const [parcelas, setParcelas] = useState(initial?.parcelaTotal ? String(initial.parcelaTotal) : "");
  const [parcelaAtual, setParcelaAtual] = useState(initial?.parcelaAtual ? String(initial.parcelaAtual) : "1");
  const [exportacao, setExportacao] = useState(initial?.exportacao ?? (ent?.tipo === "PJ" && ent.config.fatura?.exportacao !== false));
  const [recorrente, setRecorrente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ptaxMsg, setPtaxMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? kindDefault); setDescricao(initial?.descricao ?? ""); setValorTxt(initial?.valorExpressao ?? (initial?.valor != null ? String(initial.valor) : ""));
    setMoeda(initial?.moeda ?? "BRL"); setCotacao(initial?.cotacao ? String(initial.cotacao) : ""); setCompetencia(initial?.competencia ?? s.competencia);
    setVencimento(initial?.vencimento ?? ""); setPagamento(initial?.pagamento ?? ""); setStatus(initial?.status ?? "pendente"); setCategoryId(initial?.categoryId ?? "");
    setAccountId(initial?.accountId ?? ""); setPagoPor(initial?.pagoPor ?? ""); setParcelas(initial?.parcelaTotal ? String(initial.parcelaTotal) : ""); setParcelaAtual(initial?.parcelaAtual ? String(initial.parcelaAtual) : "1");
    setExportacao(initial?.exportacao ?? (ent?.tipo === "PJ" && ent.config.fatura?.exportacao !== false)); setRecorrente(false); setErro(null); setPtaxMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // sugestão automática de categoria
  useEffect(() => {
    if (editing || !descricao || categoryId) return;
    const c = categorize(descricao, escopo, s.rules);
    if (c.categoryId) setCategoryId(c.categoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descricao]);

  const valorEval = useMemo(() => { try { return parseValueField(valorTxt); } catch { return null; } }, [valorTxt]);
  const valorBrl = valorEval ? toBrl(valorEval.value, moeda, Number(cotacao) || null) : 0;

  async function buscarPtax() {
    if (!window.dueto) { setPtaxMsg("Busca PTAX disponível só no app desktop."); return; }
    const data = pagamento || vencimento || dateInMonth(competencia, 15);
    setPtaxMsg("Buscando…");
    const r = await window.dueto.ptax(data);
    if (r.ok) { setCotacao(String(r.venda)); setPtaxMsg(`PTAX venda ${r.venda} (${r.dataHora})`); } else setPtaxMsg(`Sem cotação: ${r.erro}`);
  }

  function salvar() {
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!valorEval || valorEval.value <= 0) return setErro("Valor inválido. Use número ou expressão como =120+150.");
    if (moeda !== "BRL" && !(Number(cotacao) > 0)) return setErro("Informe a cotação para converter em BRL.");
    const total = Number(parcelas) || 0;
    const atual = Math.max(1, Number(parcelaAtual) || 1);
    const grupo = total > 1 ? initial?.grupoParcelamentoId ?? `parc_${slug(descricao)}_${newId()}` : null;
    const st: TxStatus = status;
    const base: Transaction = {
      ...novoTx({ entityId, kind, competencia, descricao: descricao.trim(), valor: valorEval.value }),
      ...(initial?.id ? { id: initial.id } : {}),
      moeda, cotacao: moeda === "BRL" ? null : Number(cotacao), valorBrl, valorExpressao: valorEval.expression,
      vencimento: vencimento || null, pagamento: st === "pendente" ? null : pagamento || vencimento || todayISO(), status: st,
      categoryId: categoryId || null, accountId: accountId || null, pagoPor: pagoPor || null,
      parcelaAtual: total > 1 ? atual : null, parcelaTotal: total > 1 ? total : null, grupoParcelamentoId: grupo,
      exportacao: kind === "receita" && ent?.tipo === "PJ" ? exportacao : false,
      tags: initial?.tags ?? [], meta: initial?.meta ?? {}, recorrenciaId: initial?.recorrenciaId ?? null, clientId: initial?.clientId ?? null, patientId: initial?.patientId ?? null, invoiceId: initial?.invoiceId ?? null, origemId: initial?.origemId ?? null, custoCambioBrl: initial?.custoCambioBrl ?? null, anexo: initial?.anexo ?? null,
    };
    if (ent?.tipo === "PJ" && kind === "receita") base.categoryId = base.categoryId || (base.exportacao ? "pj-rec-exportacao" : "pj-rec-nacional");
    s.upsertTransaction(base, editing);
    if (!editing && total > 1 && atual < total) {
      const dia = vencimento ? Number(vencimento.slice(8, 10)) : 10;
      const futuras = generateRemainingInstallments({ competencia, parcelaAtual: atual, parcelaTotal: total, valor: valorEval.value, diaVencimento: dia }).map((f) => ({
        ...base, id: newId("tx"), competencia: f.competencia, vencimento: f.vencimento, pagamento: null, status: "pendente" as TxStatus, parcelaAtual: f.parcelaAtual, valorBrl: toBrl(f.valor, moeda, Number(cotacao) || null),
      }));
      s.upsertTransactions(futuras);
    }
    if (!editing && recorrente) {
      s.upsertRecurrence({ id: newId("rec"), entityId, descricao: descricao.trim(), categoryId: base.categoryId, accountId: base.accountId, kind, periodicidade: "mensal", diaVencimento: vencimento ? Number(vencimento.slice(8, 10)) : 10, mesVencimento: null, valorPadrao: valorEval.value, moeda, ativa: true, inicio: competencia, fim: null });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={editing ? "Editar lançamento" : "Novo lançamento"} description={ent ? `${ent.nome}` : undefined}
      footer={<><Button onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="primary" onClick={salvar}>{editing ? "Salvar" : "Adicionar"}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tipo">
          <Select value={kind} onChange={(e) => setKind(e.target.value as TxKind)}>
            <option value="despesa">Despesa</option><option value="receita">Receita</option><option value="transferencia">Transferência</option>
          </Select>
        </Field>
        <Field label="Competência (mês)"><Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} /></Field>
        <Field label="Descrição" className="sm:col-span-2"><Input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder='Ex.: "Óculos (06/10)", "Mercado (Porto)"' /></Field>
        <Field label="Valor" hint={valorEval && valorEval.expression ? `= ${round2(valorEval.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Aceita expressões: =120+150"}>
          <Input className="mono" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="0,00 ou =120+150" />
        </Field>
        <Field label="Moeda">
          <Select value={moeda} onChange={(e) => setMoeda(e.target.value as Currency)}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></Select>
        </Field>
        {moeda !== "BRL" && (
          <Field label={`Cotação (BRL por ${moeda})`} hint={ptaxMsg ?? (valorBrl ? `= ${valorBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : undefined)} className="sm:col-span-2">
            <div className="flex gap-2"><Input className="mono" value={cotacao} onChange={(e) => setCotacao(e.target.value)} placeholder="5,10" /><Button onClick={buscarPtax}>Buscar PTAX</Button></div>
          </Field>
        )}
        <Field label="Categoria">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— sem categoria —</option>
            {cats.filter((c) => c.tipo === (kind === "receita" ? "receita" : "despesa")).map((c) => <option key={c.id} value={c.id}>{categoriaNome(c.id, s.categories)}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TxStatus)}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="conciliado">Conciliado</option></Select>
        </Field>
        <Field label="Vencimento"><Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></Field>
        <Field label="Pagamento"><Input type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} disabled={status === "pendente"} /></Field>
        <Field label="Conta / cartão">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">—</option>{contas.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.tipo === "cartao" ? " (cartão)" : ""}</option>)}</Select>
        </Field>
        {pessoas.length > 0 && (
          <Field label="Quem pagou / recebeu">
            <Select value={pagoPor} onChange={(e) => setPagoPor(e.target.value)}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select>
          </Field>
        )}
        <Field label="Parcelas (total)" hint="Ex.: 10 → gera as parcelas futuras automaticamente"><Input type="number" min={0} value={parcelas} onChange={(e) => setParcelas(e.target.value)} /></Field>
        {Number(parcelas) > 1 && <Field label="Parcela atual"><Input type="number" min={1} max={Number(parcelas)} value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} /></Field>}
        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
          {ent?.tipo === "PJ" && kind === "receita" && <Switch checked={exportacao} onCheckedChange={setExportacao} label="Exportação de serviço" />}
          {!editing && <Switch checked={recorrente} onCheckedChange={setRecorrente} label="Repetir todo mês (recorrência)" />}
        </div>
        {erro && <p className="sm:col-span-2 text-sm text-bad">{erro}</p>}
        {ent?.tipo === "CASAL" || ent?.tipo === "PESSOA" ? <p className="sm:col-span-2 text-xs text-text-3">Mês de competência: {monthKeyOf(vencimento || `${competencia}-01`) === competencia ? "igual ao vencimento" : "diferente do vencimento (ok para faturas de cartão)"}.</p> : null}
      </div>
    </Dialog>
  );
}
