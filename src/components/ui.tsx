/**
 * Primitivas de UI no estilo shadcn/ui (Radix para diálogo, abas, switch e tooltip), estilizadas pelos tokens.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@core/money";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ---------------------------------------------------------------- Button
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "icon" };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "secondary", size = "md", type = "button", ...p }, ref) => (
  <button ref={ref} type={type} className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "icon" && "btn-icon", className)} {...p} />
));
Button.displayName = "Button";

// ---------------------------------------------------------------- Inputs
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn("input", className)} {...p} />);
Input.displayName = "Input";
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn("input", className)} {...p} />);
Select.displayName = "Select";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn("input min-h-20", className)} {...p} />);
Textarea.displayName = "Textarea";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-3">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <SwitchPrimitive.Root id={id} checked={checked} onCheckedChange={onCheckedChange} className={cn("relative h-5 w-9 rounded-full border transition-colors", checked ? "bg-accent border-accent" : "bg-surface-3 border-border-strong")}>
        <SwitchPrimitive.Thumb className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform translate-x-0.5", checked && "translate-x-[18px]")} />
      </SwitchPrimitive.Root>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Card
export function Card({ className, title, actions, children, padded = true }: { className?: string; title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          {title && <h3 className="text-sm font-semibold text-text">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && "px-4 pb-4", padded && !(title || actions) && "pt-4")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, moeda = "BRL", className }: { label: string; value: number | string; sub?: React.ReactNode; tone?: "good" | "warn" | "bad" | "accent"; moeda?: "BRL" | "USD" | "EUR" | "pct" | "raw"; className?: string }) {
  const v = typeof value === "number" ? (moeda === "pct" ? `${(value * 100).toFixed(2).replace(".", ",")}%` : moeda === "raw" ? String(value) : fmtMoney(value, moeda)) : value;
  const color = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "accent" ? "text-accent" : "text-text";
  return (
    <div className={cn("card px-4 py-3 flex flex-col gap-1 min-w-0", className)}>
      <span className="label truncate">{label}</span>
      <span className={cn("num text-xl font-semibold tracking-tight truncate", color)}>{v}</span>
      {sub && <span className="text-xs text-text-3 truncate">{sub}</span>}
    </div>
  );
}

export function Pill({ tone = "muted", children, className }: { tone?: "good" | "warn" | "bad" | "info" | "muted" | "accent"; children: React.ReactNode; className?: string }) {
  return <span className={cn("pill", `pill-${tone}`, className)}>{children}</span>;
}

export function Money({ v, moeda = "BRL", className, signed }: { v: number; moeda?: "BRL" | "USD" | "EUR"; className?: string; signed?: boolean }) {
  return <span className={cn("num", signed && v > 0 && "text-good", signed && v < 0 && "text-bad", className)}>{fmtMoney(v, moeda)}</span>;
}

export function Progress({ value, tone }: { value: number; tone?: "good" | "warn" | "bad" | "accent" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const bg = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : "bg-accent";
  return (
    <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width]", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <p className="font-medium text-text-2">{title}</p>
      {hint && <p className="text-sm text-text-3 max-w-md">{hint}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = "info", children, title }: { tone?: "info" | "warn" | "bad" | "good"; children: React.ReactNode; title?: string }) {
  const cls = { info: "bg-info-soft text-info border-info/30", warn: "bg-warn-soft text-warn border-warn/30", bad: "bg-bad-soft text-bad border-bad/30", good: "bg-good-soft text-good border-good/30" }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", cls)} role={tone === "bad" ? "alert" : "status"}>
      {title && <div className="font-semibold">{title}</div>}
      <div className={cn(tone !== "bad" && "text-text-2")}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Dialog
export function Dialog({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
        <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface shadow-xl focus:outline-none flex flex-col max-h-[90vh]", wide ? "max-w-4xl" : "max-w-xl")}>
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="text-sm text-text-3">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="btn btn-ghost btn-icon" aria-label="Fechar"><X size={16} /></DialogPrimitive.Close>
          </div>
          <div className="px-5 py-2 overflow-y-auto">{children}</div>
          {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Confirm({ open, onOpenChange, title, message, onConfirm, danger }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; message: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} footer={<><Button onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onOpenChange(false); }}>Confirmar</Button></>}>
      <p className="text-sm text-text-2">{message}</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Tabs
export function Tabs({ value, onValueChange, items, children, className }: { value: string; onValueChange: (v: string) => void; items: { value: string; label: React.ReactNode }[]; children: React.ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={cn("flex flex-col gap-4", className)}>
      <TabsPrimitive.List className="flex gap-1 border-b border-border overflow-x-auto" aria-label="Abas">
        {items.map((it) => (
          <TabsPrimitive.Trigger key={it.value} value={it.value} className="px-3 py-2 text-sm font-medium text-text-3 border-b-2 border-transparent -mb-px whitespace-nowrap data-[state=active]:text-accent data-[state=active]:border-accent hover:text-text">
            {it.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}
export const TabPanel = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <TabsPrimitive.Content value={value} className="focus:outline-none">
    <ErrorBoundary area={`a aba "${value}"`}>{children}</ErrorBoundary>
  </TabsPrimitive.Content>
);

// ---------------------------------------------------------------- Tooltip
export function Tip({ text, children }: { text: React.ReactNode; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-xs rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-2 shadow">{text}</TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-text-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Disclaimer() {
  return <p className="text-xs text-text-3 mt-4">Valores de impostos são estimativas do Dueto. Confirme com seu contador antes de recolher.</p>;
}
