/**
 * Avisos da tela atual num painel flutuante no canto inferior direito.
 * As páginas registram seus avisos com useAvisos(); o painel pode ser recolhido e cada aviso dispensado na sessão.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronUp, Info, X, XCircle } from "lucide-react";
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
  const [aberto, setAberto] = useState(true);
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const visiveis = avisos.filter((a) => !dispensados.has(a.msg));
  if (visiveis.length === 0) return null;
  const Icon = { warn: AlertTriangle, bad: XCircle, info: Info }[visiveis[0].tone];
  return (
    <aside className="fixed bottom-4 right-4 z-30 w-[min(400px,calc(100vw-32px))] flex flex-col gap-2" aria-label="Avisos">
      {aberto && visiveis.slice(0, 6).map((a) => {
        const I = { warn: AlertTriangle, bad: XCircle, info: Info }[a.tone];
        const cls = { warn: "border-warn/40 bg-warn-soft text-warn", bad: "border-bad/40 bg-bad-soft text-bad", info: "border-info/40 bg-info-soft text-info" }[a.tone];
        const body = <span className="text-text-2 text-sm leading-snug">{a.msg}</span>;
        return (
          <div key={a.msg} className={cn("rounded-lg border px-3 py-2 shadow-lg flex items-start gap-2 bg-surface", cls)} role={a.tone === "bad" ? "alert" : "status"}>
            <I size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">{a.to ? <Link to={a.to} className="hover:underline">{body}</Link> : body}</div>
            <button aria-label="Dispensar aviso" className="text-text-3 hover:text-text" onClick={() => setDispensados(new Set([...dispensados, a.msg]))}><X size={14} /></button>
          </div>
        );
      })}
      <button onClick={() => setAberto(!aberto)} className="self-end btn btn-secondary btn-sm shadow-lg">
        <Icon size={14} /> {visiveis.length} aviso{visiveis.length > 1 ? "s" : ""} {aberto ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </aside>
  );
}
