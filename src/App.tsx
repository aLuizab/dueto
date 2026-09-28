import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BookOpen, Briefcase, ChevronLeft, ChevronRight, Home, LayoutDashboard, Moon, Search, Settings, Sun, UserRound, TrendingUp, Upload, Monitor } from "lucide-react";
import { addMonths, currentMonthKey, fmtMonth } from "@core/dates";
import { Button, Kbd } from "@/components/ui";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/Dashboard";
import Casal from "@/pages/Casal";
import PJ from "@/pages/PJ";
import Consultorio from "@/pages/Consultorio";
import Investimentos from "@/pages/Investimentos";
import Configuracoes from "@/pages/Configuracoes";
import Importar from "@/pages/Importar";
import Onboarding from "@/pages/Onboarding";
import Ajuda from "@/pages/Ajuda";
import { Logo } from "@/components/Logo";
import { CommandPalette } from "@/components/CommandPalette";
import { AvisosFlutuantes } from "@/components/AvisosFlutuantes";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

const NAV = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard, key: "1" },
  { to: "/casal", label: "Casa", icon: Home, key: "2" },
  { to: "/pj", label: "Empresa", icon: Briefcase, key: "3" },
  { to: "/consultorio", label: "Autônomo", icon: UserRound, key: "4" },
  { to: "/investimentos", label: "Investimentos", icon: TrendingUp, key: "5" },
  { to: "/importar", label: "Importar", icon: Upload, key: "6" },
  { to: "/config", label: "Configurações", icon: Settings, key: "7" },
  { to: "/ajuda", label: "Como usar", icon: BookOpen, key: "8" },
];

export default function App() {
  const s = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { void s.init(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    applyTheme(s.theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => applyTheme(s.theme);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [s.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); s.setBusca(true); return; }
      if (typing) return;
      if (e.altKey && /^[1-8]$/.test(e.key)) { const n = NAV[Number(e.key) - 1]; if (n) nav(n.to); }
      if (e.key === "[") s.setCompetencia(addMonths(s.competencia, -1));
      if (e.key === "]") s.setCompetencia(addMonths(s.competencia, 1));
      if (e.key === "t" || e.key === "T") s.setCompetencia(currentMonthKey());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, nav]);

  useEffect(() => {
    if (!window.dueto) return;
    return window.dueto.onMenu((a) => {
      if (a === "import") nav("/importar");
      if (a === "backup:export" || a === "backup:restore") nav("/config#backup");
      if (a === "about") nav("/config#sobre");
    });
  }, [nav]);

  const onboarded = useMemo(() => s.entities.some((e) => e.tipo === "PESSOA"), [s.entities]);
  const temAutonomo = s.entities.some((e) => e.tipo === "AUTONOMO_PF" && e.ativa);
  const navVisivel = NAV.filter((n) => n.to !== "/consultorio" || temAutonomo);

  if (!s.ready) return <div className="h-full flex items-center justify-center text-text-3">Abrindo o banco local…</div>;
  if (s.erro && !s.db) return <div className="h-full flex items-center justify-center p-8 text-bad">{s.erro}</div>;
  if (!onboarded) return <Onboarding />;

  return (
    <div className="h-full flex">
      <aside className={cn("flex flex-col border-r border-border bg-surface transition-[width]", collapsed ? "w-14" : "w-56")}>
        <div className="flex items-center gap-2 px-3 h-14 border-b border-border">
          <Logo size={28} className="shrink-0" />
          {!collapsed && <div className="leading-tight"><div className="font-semibold">Dueto</div><div className="text-[10px] text-text-3">finanças PF e PJ para devs</div></div>}
        </div>
        <nav className="flex-1 py-2 flex flex-col gap-0.5 px-2" aria-label="Principal">
          {navVisivel.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} title={`${n.label} (Alt+${n.key})`} className={({ isActive }) => cn("flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-2 hover:bg-surface-2 hover:text-text", isActive && "bg-accent-soft text-accent font-medium")}>
              <n.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-border flex flex-col gap-1">
          <button className="btn btn-ghost btn-sm justify-start" onClick={() => s.setTheme(s.theme === "light" ? "dark" : s.theme === "dark" ? "system" : "light")} title="Tema">
            {s.theme === "light" ? <Sun size={16} /> : s.theme === "dark" ? <Moon size={16} /> : <Monitor size={16} />}{!collapsed && <span>{s.theme === "light" ? "Claro" : s.theme === "dark" ? "Escuro" : "Sistema"}</span>}
          </button>
          <button className="btn btn-ghost btn-sm justify-start" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">{collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Recolher</span></>}</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center gap-3 px-4">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Mês anterior" onClick={() => s.setCompetencia(addMonths(s.competencia, -1))}><ChevronLeft size={16} /></Button>
            <input type="month" aria-label="Mês de competência" className="input w-40 num" value={s.competencia} onChange={(e) => e.target.value && s.setCompetencia(e.target.value)} />
            <Button size="icon" variant="ghost" aria-label="Próximo mês" onClick={() => s.setCompetencia(addMonths(s.competencia, 1))}><ChevronRight size={16} /></Button>
            <span className="text-sm text-text-2 ml-1 hidden md:inline">{fmtMonth(s.competencia, "long")}</span>
          </div>
          <button className="ml-auto flex items-center gap-2 input max-w-xs text-text-3 cursor-text" onClick={() => s.setBusca(true)}>
            <Search size={14} /> <span className="flex-1 text-left text-sm">Buscar…</span> <Kbd>Ctrl K</Kbd>
          </button>
          <span className="text-[11px] text-text-3 hidden lg:inline num" title="Último salvamento">{s.ultimoSave ? `salvo ${s.ultimoSave.toLocaleTimeString("pt-BR")}` : ""}</span>
        </header>
        {s.erro && <div className="bg-bad-soft text-bad text-sm px-4 py-1">{s.erro}</div>}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary area="esta tela" resetKey={loc.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/casal" element={<Casal />} />
            <Route path="/pj" element={<PJ />} />
            <Route path="/consultorio" element={temAutonomo ? <Consultorio /> : <Dashboard />} />
            <Route path="/investimentos" element={<Investimentos />} />
            <Route path="/importar" element={<Importar />} />
            <Route path="/config" element={<Configuracoes />} />
            <Route path="/ajuda" element={<Ajuda />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
      <AvisosFlutuantes />
    </div>
  );
}
