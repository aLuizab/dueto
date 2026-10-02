/**
 * Recorrências viram lançamentos automaticamente em cada mês em que valem. Cada mês é independente:
 * desligar a recorrência em um mês (ou excluir o lançamento gerado) só afeta aquele mês.
 */
import type { MonthKey, Recurrence, Transaction } from "./domain/types";
import { addMonths, monthRange } from "./dates";

/** A recorrência se aplica a este mês (ativa, dentro de início/fim e, se anual, no mês certo)? */
export function recorrenciaValeNoMes(r: Recurrence, mk: MonthKey): boolean {
  return r.ativa && r.inicio <= mk && (!r.fim || r.fim >= mk) && (r.periodicidade === "mensal" || r.mesVencimento === Number(mk.slice(5, 7)));
}

export function desligadaNoMes(r: Recurrence, mk: MonthKey): boolean {
  return (r.mesesDesligados ?? []).includes(mk);
}

/** Meses (do início até `ate`) em que a recorrência vale, está ligada e ainda não tem lançamento. */
export function lancamentosRecorrentesFaltantes(recs: Recurrence[], transactions: Transaction[], ate: MonthKey): { rec: Recurrence; competencia: MonthKey }[] {
  const existentes = new Set(transactions.filter((t) => t.recorrenciaId).map((t) => `${t.recorrenciaId}|${t.competencia}`));
  const out: { rec: Recurrence; competencia: MonthKey }[] = [];
  for (const r of recs) {
    if (!r.ativa || r.inicio > ate) continue;
    const fim = r.fim && r.fim < ate ? r.fim : ate;
    for (const mk of monthRange(r.inicio, fim)) {
      if (recorrenciaValeNoMes(r, mk) && !desligadaNoMes(r, mk) && !existentes.has(`${r.id}|${mk}`)) out.push({ rec: r, competencia: mk });
    }
  }
  return out;
}

/** Liga/desliga a recorrência só em `mk`. */
export function alternarMes(r: Recurrence, mk: MonthKey, ligada: boolean): Recurrence {
  const set = new Set(r.mesesDesligados ?? []);
  if (ligada) set.delete(mk); else set.add(mk);
  return { ...r, mesesDesligados: [...set].sort() };
}

/** Ainda repete nos meses depois de `mk`? */
export function repeteDepoisDe(r: Recurrence, mk: MonthKey): boolean {
  return r.ativa && (!r.fim || r.fim > mk);
}

/** Para de repetir depois de `mk` (os meses até `mk` ficam como estão). */
export function pararDepoisDe(r: Recurrence, mk: MonthKey): Recurrence {
  return { ...r, fim: mk < r.inicio ? r.inicio : mk };
}

/**
 * Volta a repetir a partir de `mk`. Os meses parados antes de `mk` ficam desligados (não recria lançamentos
 * que a pessoa já tinha parado); de `mk` em diante tudo volta a ficar ligado.
 */
export function retomarEm(r: Recurrence, mk: MonthKey): Recurrence {
  const ultimo = r.fim ?? (r.ativa ? null : addMonths(r.inicio, -1));
  const lacuna = ultimo && ultimo < addMonths(mk, -1) ? monthRange(addMonths(ultimo, 1), addMonths(mk, -1)) : [];
  const desligados = [...new Set([...(r.mesesDesligados ?? []).filter((m) => m < mk), ...lacuna])].sort();
  return { ...r, ativa: true, fim: null, mesesDesligados: desligados };
}

/**
 * Muda o mês em que a recorrência começou. Antecipar inclui os meses anteriores (religando os que estavam
 * desligados nesse intervalo); adiar só move o início (quem chama remove os lançamentos que ficaram antes).
 */
export function mudarInicio(r: Recurrence, inicio: MonthKey): Recurrence {
  const desligados = inicio < r.inicio ? (r.mesesDesligados ?? []).filter((m) => m < inicio || m >= r.inicio) : r.mesesDesligados ?? [];
  return { ...r, inicio, mesesDesligados: desligados };
}
