/**
 * Tabela de lançamentos com busca, ordenação, marcação de pago, edição/remoção e exportação CSV/XLSX.
 * Renderiza só as linhas visíveis (janela virtual simples) para aguentar dezenas de milhares de registros.
 */
import { useMemo, useRef, useState } from "react";
import { Check, Download, Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@core/domain/types";
import { fmtDate, todayISO } from "@core/dates";
import { categoriaNome } from "@core/seed/categories";
import { faltamParcelas } from "@core/parcelas";
import { toCsv, writeWorkbook } from "@core/importers";
import { Button, Confirm, Input, Money, Pill, Tip } from "@/components/ui";
import { downloadBytes } from "@/lib/utils";
import { useStore } from "@/state/store";

type SortKey = "vencimento" | "descricao" | "valorBrl" | "status" | "categoria";

export function TransactionTable({ rows, onEdit, showEntity, compact, exportName = "lancamentos" }: { rows: Transaction[]; onEdit?: (t: Transaction) => void; showEntity?: boolean; compact?: boolean; exportName?: string }) {
  const s = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "vencimento", d: 1 });
  const [del, setDel] = useState<Transaction | null>(null);
  const [scroll, setScroll] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const catName = (id: string | null | undefined) => categoriaNome(id, s.categories);
  const entName = (id: string) => s.entities.find((e) => e.id === id)?.nome ?? "";
  const accName = (id: string | null | undefined) => (id ? s.accounts.find((a) => a.id === id)?.nome ?? "" : "");
  const hoje = todayISO();

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = n ? rows.filter((t) => t.descricao.toLowerCase().includes(n) || catName(t.categoryId).toLowerCase().includes(n) || accName(t.accountId).toLowerCase().includes(n)) : rows;
    const key = (t: Transaction) => sort.k === "categoria" ? catName(t.categoryId) : sort.k === "vencimento" ? (t.vencimento ?? t.pagamento ?? `${t.competencia}-99`) : t[sort.k];
    return [...base].sort((a, b) => { const x = key(a), y = key(b); return (x! < y! ? -1 : x! > y! ? 1 : 0) * sort.d; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, s.categories, s.accounts]);

  const ROW = compact ? 34 : 38;
  const H = Math.min(560, Math.max(200, filtered.length * ROW + 40));
  const start = Math.max(0, Math.floor(scroll / ROW) - 5);
  const end = Math.min(filtered.length, start + Math.ceil(H / ROW) + 10);
  const visible = filtered.slice(start, end);
  const total = filtered.reduce((a, t) => a + (t.kind === "receita" ? t.valorBrl : t.kind === "despesa" ? -t.valorBrl : 0), 0);

  const th = (k: SortKey, label: string, cls = "") => (
    <th className={cls}><button className="uppercase tracking-wide hover:text-text" onClick={() => setSort((p) => ({ k, d: p.k === k ? ((-p.d) as 1 | -1) : 1 }))}>{label}{sort.k === k ? (sort.d === 1 ? " ↑" : " ↓") : ""}</button></th>
  );

  function marcarPago(t: Transaction) {
    s.upsertTransaction({ ...t, status: t.status === "pendente" ? "pago" : "pendente", pagamento: t.status === "pendente" ? t.pagamento ?? hoje : null });
  }
  function exportar(tipo: "csv" | "xlsx") {
    const head = ["Competência", "Vencimento", "Pagamento", "Descrição", "Categoria", "Conta", "Valor", "Moeda", "Cotação", "Valor BRL", "Status", "Parcela", "Tipo"];
    const data = filtered.map((t) => [t.competencia, t.vencimento ?? "", t.pagamento ?? "", t.descricao, catName(t.categoryId), accName(t.accountId), t.valor, t.moeda, t.cotacao ?? "", t.valorBrl, t.status, t.parcelaTotal ? `${t.parcelaAtual}/${t.parcelaTotal}` : "", t.kind]);
    if (tipo === "csv") void downloadBytes(`${exportName}.csv`, "﻿" + toCsv([head, ...data]), "text/csv");
    else void downloadBytes(`${exportName}.xlsx`, writeWorkbook([{ name: "Lançamentos", rows: [head, ...data] }]));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Filtrar lançamentos…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Filtrar" />
        <span className="text-xs text-text-3">{filtered.length} itens · saldo <Money v={total} signed /></span>
        <div className="ml-auto flex gap-1">
          <Button size="sm" onClick={() => exportar("csv")}><Download size={14} /> CSV</Button>
          <Button size="sm" onClick={() => exportar("xlsx")}><Download size={14} /> XLSX</Button>
        </div>
      </div>
      <div ref={wrapRef} className="table-wrap" style={{ maxHeight: H }} onScroll={(e) => setScroll((e.target as HTMLDivElement).scrollTop)}>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              {th("vencimento", "Venc.")}
              {th("descricao", "Descrição")}
              {th("categoria", "Categoria")}
              {showEntity && <th>Entidade</th>}
              <th>Conta</th>
              {th("valorBrl", "Valor", "r")}
              {th("status", "Status")}
              <th style={{ width: 72 }}></th>
            </tr>
          </thead>
          <tbody>
            {start > 0 && <tr><td colSpan={9} style={{ height: start * ROW, padding: 0, border: 0 }} /></tr>}
            {visible.map((t) => {
              const vencida = t.status === "pendente" && t.vencimento && t.vencimento < hoje;
              const faltam = faltamParcelas(t.parcelaAtual, t.parcelaTotal);
              return (
                <tr key={t.id} style={{ height: ROW }}>
                  <td>
                    <Tip text={t.status === "pendente" ? "Marcar como pago" : "Voltar para pendente"}>
                      <button aria-label="Alternar pago" onClick={() => marcarPago(t)} className={`h-5 w-5 rounded border flex items-center justify-center ${t.status !== "pendente" ? "bg-good border-good text-white" : "border-border-strong"}`}>{t.status !== "pendente" && <Check size={12} />}</button>
                    </Tip>
                  </td>
                  <td className="num whitespace-nowrap text-text-2">{fmtDate(t.vencimento ?? t.pagamento) || t.competencia}</td>
                  <td>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[28ch]" title={t.descricao}>{t.descricao}</span>
                      {t.parcelaTotal && <Pill tone="muted">{t.parcelaAtual}/{t.parcelaTotal}{faltam ? ` · faltam ${faltam}` : ""}</Pill>}
                      {t.exportacao && <Pill tone="info">export.</Pill>}
                      {t.tags.includes("projecao") && <Pill tone="muted">projeção</Pill>}
                      {t.valorExpressao && <Tip text={t.valorExpressao}><span className="mono text-[10px] text-text-3">ƒ</span></Tip>}
                    </div>
                  </td>
                  <td className="text-text-2 whitespace-nowrap">{catName(t.categoryId)}</td>
                  {showEntity && <td className="text-text-2 whitespace-nowrap">{entName(t.entityId)}</td>}
                  <td className="text-text-3 whitespace-nowrap">{accName(t.accountId)}</td>
                  <td className="r whitespace-nowrap">
                    <Money v={t.kind === "despesa" ? -t.valorBrl : t.valorBrl} signed={t.kind !== "transferencia"} />
                    {t.moeda !== "BRL" && <div className="text-[10px] text-text-3 num">{t.valor.toLocaleString("pt-BR", { style: "currency", currency: t.moeda })} @ {t.cotacao ?? "?"}</div>}
                  </td>
                  <td>{vencida ? <Pill tone="bad">vencida</Pill> : t.status === "pago" ? <Pill tone="good">pago</Pill> : t.status === "conciliado" ? <Pill tone="info">conciliado</Pill> : <Pill tone="warn">pendente</Pill>}</td>
                  <td>
                    <div className="flex gap-0.5 justify-end">
                      {onEdit && <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(t)}><Pencil size={14} /></Button>}
                      <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setDel(t)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {end < filtered.length && <tr><td colSpan={9} style={{ height: (filtered.length - end) * ROW, padding: 0, border: 0 }} /></tr>}
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center text-text-3 py-8">Nenhum lançamento.</td></tr>}
          </tbody>
        </table>
      </div>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir lançamento" message={`Excluir "${del?.descricao}"? ${del?.grupoParcelamentoId ? "As outras parcelas do grupo não serão afetadas." : ""}`} danger onConfirm={() => del && s.deleteTransaction(del.id)} />
    </div>
  );
}
