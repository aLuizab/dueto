/** Busca global (Ctrl+K): lançamentos, telas, clientes, investimentos. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { fmtMoney } from "@core/money";
import { fmtDate } from "@core/dates";
import { normalizeText } from "@core/categorize";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

interface Item { id: string; titulo: string; sub?: string; grupo: string; run(): void }

export function CommandPalette() {
  const s = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (s.busca) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [s.busca]);

  const items = useMemo<Item[]>(() => {
    const n = normalizeText(q);
    const go = (to: string) => () => { s.setBusca(false); nav(to); };
    const temAutonomo = s.entities.some((e) => e.tipo === "AUTONOMO_PF" && e.ativa);
    const telas: Item[] = [
      { id: "t1", titulo: "Visão geral", grupo: "Telas", run: go("/") }, { id: "t2", titulo: "Casa (finanças do casal)", grupo: "Telas", run: go("/casal") },
      { id: "t3", titulo: "Empresa (PJ)", grupo: "Telas", run: go("/pj") }, ...(temAutonomo ? [{ id: "t4", titulo: "Autônomo", grupo: "Telas", run: go("/consultorio") }] : []),
      { id: "t5", titulo: "Investimentos", grupo: "Telas", run: go("/investimentos") }, { id: "t6", titulo: "Importar planilhas / extratos", grupo: "Telas", run: go("/importar") },
      { id: "t7", titulo: "Configurações e tabelas fiscais", grupo: "Telas", run: go("/config") }, { id: "t8", titulo: "Backup", grupo: "Telas", run: go("/config#backup") },
    ];
    if (!n) return telas;
    const out: Item[] = telas.filter((t) => normalizeText(t.titulo).includes(n));
    const ent = (id: string) => s.entities.find((e) => e.id === id);
    const rota = (t: { entityId: string }) => { const e = ent(t.entityId); return e?.tipo === "PJ" ? "/pj" : e?.tipo === "AUTONOMO_PF" ? "/consultorio" : "/casal"; };
    let count = 0;
    for (const t of s.transactions) {
      if (count >= 40) break;
      if (normalizeText(t.descricao).includes(n)) {
        count++;
        out.push({ id: t.id, titulo: t.descricao, sub: `${fmtDate(t.vencimento ?? t.pagamento) || t.competencia} · ${fmtMoney(t.valorBrl)} · ${ent(t.entityId)?.nome ?? ""}`, grupo: "Lançamentos", run: () => { s.setBusca(false); s.setCompetencia(t.competencia); nav(rota(t)); } });
      }
    }
    for (const p of s.patients) if (normalizeText(p.nome).includes(n)) out.push({ id: p.id, titulo: p.nome, grupo: "Clientes (autônomo)", run: go("/consultorio") });
    for (const c of s.clients) if (normalizeText(c.nome).includes(n)) out.push({ id: c.id, titulo: c.nome, grupo: "Clientes", run: go("/pj") });
    for (const i of s.investments) if (normalizeText(i.nome).includes(n)) out.push({ id: i.id, titulo: i.nome, grupo: "Investimentos", run: go("/investimentos") });
    return out;
  }, [q, s, nav]);

  useEffect(() => setIdx(0), [q]);

  return (
    <DialogPrimitive.Root open={s.busca} onOpenChange={s.setBusca}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <DialogPrimitive.Content className="fixed left-1/2 top-24 z-50 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 rounded-xl border border-border bg-surface shadow-xl overflow-hidden" onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
          if (e.key === "Enter") { e.preventDefault(); items[idx]?.run(); }
        }}>
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Busque lançamentos, clientes e telas</DialogPrimitive.Description>
          <div className="flex items-center gap-2 px-3 border-b border-border">
            <Search size={16} className="text-text-3" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lançamentos, clientes, telas…" className="flex-1 bg-transparent py-3 outline-none text-sm" aria-label="Buscar" />
          </div>
          <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
            {items.map((it, i) => (
              <li key={it.id} role="option" aria-selected={i === idx} className={cn("px-3 py-2 cursor-pointer flex items-center justify-between gap-3", i === idx && "bg-accent-soft")} onMouseEnter={() => setIdx(i)} onClick={it.run}>
                <div className="min-w-0"><div className="text-sm truncate">{it.titulo}</div>{it.sub && <div className="text-xs text-text-3 truncate">{it.sub}</div>}</div>
                <span className="text-[10px] uppercase tracking-wide text-text-3">{it.grupo}</span>
              </li>
            ))}
            {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-3">Nada encontrado.</li>}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
