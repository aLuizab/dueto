/**
 * Gráficos (Recharts) seguindo as regras de dataviz: um eixo só, paleta categórica em ordem fixa,
 * marcas finas, grade discreta, tooltip sempre presente, legenda quando há 2+ séries.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney } from "@core/money";
import { fmtMonth } from "@core/dates";
import { CAT_COLORS } from "@/lib/utils";

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace(".", ",")} mil` : String(Math.round(v)));

function TooltipBox({ active, payload, label, moeda = "BRL" }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; moeda?: "BRL" | "USD" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow">
      <div className="font-semibold mb-1">{label && /^\d{4}-\d{2}$/.test(label) ? fmtMonth(label, "long") : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-text-2"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />{p.name}</span>
          <span className="num font-medium">{fmtMoney(p.value, moeda)}</span>
        </div>
      ))}
    </div>
  );
}

export interface Serie { key: string; nome: string; cor?: string; stack?: string }

export function BarsChart({ data, series, height = 240, moeda = "BRL", xKey = "mes" }: { data: Record<string, unknown>[]; series: Serie[]; height?: number; moeda?: "BRL" | "USD"; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis dataKey={xKey} tickFormatter={(v) => (/^\d{4}-\d{2}$/.test(String(v)) ? fmtMonth(String(v)) : String(v))} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TooltipBox moeda={moeda} />} cursor={{ fill: "var(--surface-3)", opacity: 0.5 }} />
        {series.length > 1 && <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.nome} stackId={s.stack} fill={s.cor ?? CAT_COLORS[i % CAT_COLORS.length]} radius={s.stack ? 0 : [4, 4, 0, 0]} maxBarSize={38} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LinesChart({ data, series, height = 240, moeda = "BRL", xKey = "mes", area }: { data: Record<string, unknown>[]; series: Serie[]; height?: number; moeda?: "BRL" | "USD"; xKey?: string; area?: boolean }) {
  const C = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <C data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={(v) => (/^\d{4}-\d{2}$/.test(String(v)) ? fmtMonth(String(v)) : String(v))} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={<TooltipBox moeda={moeda} />} />
        {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) =>
          area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.nome} stroke={s.cor ?? CAT_COLORS[i % CAT_COLORS.length]} fill={s.cor ?? CAT_COLORS[i % CAT_COLORS.length]} fillOpacity={0.12} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.nome} stroke={s.cor ?? CAT_COLORS[i % CAT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ),
        )}
      </C>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220, moeda = "BRL" }: { data: { nome: string; valor: number }[]; height?: number; moeda?: "BRL" | "USD" }) {
  const top = [...data].sort((a, b) => b.valor - a.valor);
  const shown = top.slice(0, 5);
  const rest = top.slice(5).reduce((a, d) => a + d.valor, 0);
  if (rest > 0) shown.push({ nome: "Outros", valor: rest });
  const total = shown.reduce((a, d) => a + d.valor, 0);
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie data={shown} dataKey="valor" nameKey="nome" innerRadius={height * 0.3} outerRadius={height * 0.45} paddingAngle={2} stroke="var(--surface)" strokeWidth={2}>
            {shown.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
          </Pie>
          <Tooltip content={<TooltipBox moeda={moeda} />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-1 text-xs min-w-40">
        {shown.map((d, i) => (
          <li key={d.nome} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-text-2"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />{d.nome}</span>
            <span className="num">{total ? Math.round((d.valor / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
