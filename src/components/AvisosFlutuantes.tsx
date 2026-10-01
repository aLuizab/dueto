/**
 * Avisos da tela atual num botão discreto no canto inferior direito; a lista só abre quando o usuário clica.
 * As páginas registram seus avisos com useAvisos(); cada aviso pode ser dispensado na sessão.
 * Também exibe a notificação temporária de ações (store.notificar).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, X, XCircle } from "lucide-react";
import { useStore, type Aviso } from "@/state/store";
import { cn } from "@/lib/utils";

export function useAvisos(lista: Aviso[]) {
  const set = useStore((s) => s.setAvisos);
  const key = JSON.stringify(lista);
  useEffect(() => {
    set(lista);
    return () => set([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function AvisosFlutuantes() {
  const avisos = useStore((s) => s.avisos);
  const [aberto, setAberto] = useState(false);
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const visiveis = avisos.filter((a) => !dispensados.has(a.msg));
  if (visiveis.length === 0) return null;
  const tone = visiveis.some((a) => a.tone === "bad") ? "bad" : visiveis.some((a) => a.tone === "warn") ? "warn" : "info";
  const Icon = { warn: AlertTriangle, bad: XCircle, info: Info }[tone];
  const corBotao = { warn: "text-warn", bad: "text-bad", info: "text-info" }[tone];
  return (
    <aside className="fixed bottom-4 right-4 z-30 w-[min(380px,calc(100vw-32px))] flex flex-col items-end gap-2 pointer-events-none" aria-label="Avisos">
      {aberto && visiveis.slice(0, 6).map((a) => {
        const I = { warn: AlertTriangle, bad: XCircle, info: Info }[a.tone];
        const cls = { warn: "border-warn/40 bg-warn-soft text-warn", bad: "border-bad/40 bg-bad-soft text-bad", info: "border-info/40 bg-info-soft text-info" }[a.tone];
        const body = <span className="text-text-2 text-sm leading-snug">{a.msg}</span>;
        return (
          <div key={a.msg} className={cn("pointer-events-auto w-full rounded-lg border px-3 py-2 shadow-lg flex items-start gap-2 bg-surface", cls)} role={a.tone === "bad" ? "alert" : "status"}>
            <I size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">{a.to ? <Link to={a.to} className="hover:underline">{body}</Link> : body}</div>
            <button aria-label="Dispensar aviso" className="text-text-3 hover:text-text" onClick={() => setDispensados(new Set([...dispensados, a.msg]))}><X size={14} /></button>
          </div>
        );
      })}
      <button onClick={() => setAberto(!aberto)} aria-expanded={aberto} title={aberto ? "Recolher avisos" : "Ver avisos desta tela"} className="pointer-events-auto btn btn-secondary btn-sm shadow-lg rounded-full">
        <Icon size={14} className={corBotao} /> {visiveis.length} aviso{visiveis.length > 1 ? "s" : ""} {aberto ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </aside>
  );
}

export function Notificacao() {
  const n = useStore((s) => s.notificacao);
  const notificar = useStore((s) => s.notificar);
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(() => notificar(null), 4500);
    return () => clearTimeout(t);
  }, [n, notificar]);
  if (!n) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[min(480px,calc(100vw-32px))] rounded-lg border border-border bg-surface px-3 py-2 shadow-lg flex items-center gap-2 text-sm text-text-2">
      <CheckCircle2 size={16} className="shrink-0 text-accent" />
      <span>{n.msg}</span>
      <button aria-label="Fechar" className="text-text-3 hover:text-text" onClick={() => notificar(null)}><X size={14} /></button>
    </div>
  );
}
