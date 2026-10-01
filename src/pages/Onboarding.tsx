/** Wizard da primeira abertura. Nada aqui é pré-preenchido com dados de ninguém. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Entity, RegimeTributario, SplitRule } from "@core/domain/types";
import { newId } from "@core/ids";
import { addMonths, currentMonthKey, dateInMonth } from "@core/dates";
import { Alert, Button, Field, Input, Select, Switch } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { ComoUsar } from "@/components/ComoUsar";
import { novoTx, useStore } from "@/state/store";

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export default function Onboarding() {
  const s = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [nomeOrc, setNomeOrc] = useState("");
  const [pessoas, setPessoas] = useState([{ nome: "", renda: "" }]);
  const [split, setSplit] = useState<SplitRule>("proporcional");
  const [temPJ, setTemPJ] = useState(false);
  const [pj, setPj] = useState({ nome: "", cnpj: "", municipio: "", uf: "", regime: "" as RegimeTributario | "", exporta: false, moeda: "BRL" as "USD" | "EUR" | "BRL", inicio: "", dono: 0, escrituracao: false });
  const [modo, setModo] = useState<"zero" | "exemplo" | "importar" | null>(null);
  const [backupAuto, setBackupAuto] = useState(true);

  const pessoasValidas = pessoas.filter((p) => p.nome.trim());

  function concluir() {
    const casal: Entity = { id: newId("ent"), tipo: "CASAL", nome: nomeOrc.trim() || "Pessoal", config: { splitRule: split }, ativa: true };
    s.upsertEntity(casal);
    const ids: string[] = [];
    for (const p of pessoasValidas) {
      const e: Entity = { id: newId("ent"), tipo: "PESSOA", nome: p.nome.trim(), config: { rendaEstimada: Number(p.renda.replace(",", ".")) || 0 }, ativa: true };
      s.upsertEntity(e);
      ids.push(e.id);
    }
    if (temPJ) s.upsertEntity({ id: newId("ent"), tipo: "PJ", nome: pj.nome.trim() || "Empresa", documento: pj.cnpj || undefined, municipio: pj.municipio.trim() || undefined, uf: pj.uf || undefined, regime: (pj.regime || "SIMPLES_III") as RegimeTributario, config: { fatura: { moeda: pj.moeda, exportacao: pj.exporta }, inicioAtividade: pj.inicio || currentMonthKey(), proLabore: { modo: "minimoFatorR" }, escrituracaoContabil: pj.escrituracao, donoPessoaId: ids[pj.dono] ?? ids[0], mesTfe: 7 }, ativa: true });
    s.setSetting("onboarding.done", new Date().toISOString());
    void s.setBackupAuto(backupAuto);
    if (modo === "exemplo") seedExemplo(casal.id, ids);
    nav(modo === "importar" ? "/importar" : "/");
  }

  function seedExemplo(casalId: string, ids: string[]) {
    const mk = currentMonthKey();
    const prev = addMonths(mk, -1);
    const txs = [];
    for (const m of [prev, mk]) {
      txs.push(novoTx({ entityId: ids[0], kind: "receita", competencia: m, descricao: "Renda líquida (exemplo)", valor: 6500, categoryId: "rec-salario", status: "pago", pagoPor: ids[0] }));
      if (ids[1]) txs.push(novoTx({ entityId: ids[1], kind: "receita", competencia: m, descricao: "Renda líquida (exemplo)", valor: 3200, categoryId: "rec-salario", status: "pago", pagoPor: ids[1] }));
      txs.push(novoTx({ entityId: casalId, kind: "despesa", competencia: m, descricao: "Aluguel (exemplo)", valor: 2400, categoryId: "moradia-aluguel", vencimento: dateInMonth(m, 5), status: m === prev ? "pago" : "pendente" }));
      txs.push(novoTx({ entityId: casalId, kind: "despesa", competencia: m, descricao: "Mercado (exemplo)", valor: 1150, categoryId: "alimentacao-mercado", vencimento: dateInMonth(m, 20), status: m === prev ? "pago" : "pendente", valorExpressao: "=400+350+400" }));
      txs.push(novoTx({ entityId: casalId, kind: "despesa", competencia: m, descricao: "Internet (exemplo)", valor: 120, categoryId: "moradia-internet", vencimento: dateInMonth(m, 10), status: "pago" }));
    }
    s.upsertTransactions(txs.map((t) => ({ ...t, valorBrl: t.valor, tags: ["exemplo"] })));
  }

  const steps = ["Como usar", "Perfil", "Pessoas", "Empresa", "Dados", "Backup", "Tabelas fiscais"];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-10 px-4 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Logo size={40} className="shrink-0" />
          <div><h1 className="text-2xl font-semibold">Bem-vindo ao Dueto</h1><p className="text-text-3 text-sm">Organização financeira PF e PJ para devs: casa, renda autônoma e empresa num só lugar. Tudo fica só no seu computador.</p></div>
        </div>
        <ol className="flex flex-wrap gap-2 text-xs" aria-label="Etapas">
          {steps.map((t, i) => <li key={t} className={`pill ${i === step ? "pill-accent" : i < step ? "pill-good" : "pill-muted"}`}>{i + 1}. {t}</li>)}
        </ol>
        <div className="card p-5 flex flex-col gap-4">
          {step === 0 && (<>
            <h2 className="font-semibold">Como usar o Dueto</h2>
            <ComoUsar compacto />
          </>)}
          {step === 1 && (<>
            <h2 className="font-semibold">Perfil</h2>
            <Field label="Nome do orçamento"><Input value={nomeOrc} onChange={(e) => setNomeOrc(e.target.value)} placeholder="Ex.: Pessoal, Família Souza" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Moeda base"><Input value="BRL — real" disabled /></Field>
              <Field label="Idioma"><Input value="Português (Brasil)" disabled /></Field>
            </div>
            <p className="text-xs text-text-3">Receitas em USD/EUR são convertidas pela cotação informada em cada lançamento.</p>
          </>)}
          {step === 2 && (<>
            <h2 className="font-semibold">Pessoas do orçamento</h2>
            {pessoas.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_160px_auto] gap-2 items-end">
                <Field label={`Pessoa ${i + 1}`}><Input value={p.nome} onChange={(e) => setPessoas(pessoas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} placeholder="Nome" /></Field>
                <Field label="Renda estimada/mês"><Input className="mono" value={p.renda} onChange={(e) => setPessoas(pessoas.map((x, j) => (j === i ? { ...x, renda: e.target.value } : x)))} placeholder="0,00" /></Field>
                <Button variant="ghost" onClick={() => setPessoas(pessoas.filter((_, j) => j !== i))} disabled={pessoas.length <= 1}>Remover</Button>
              </div>
            ))}
            <Button size="sm" onClick={() => setPessoas([...pessoas, { nome: "", renda: "" }])}>+ Adicionar pessoa</Button>
            <Field label="Divisão das despesas comuns">
              <Select value={split} onChange={(e) => setSplit(e.target.value as SplitRule)}><option value="proporcional">Proporcional à renda</option><option value="igual">50/50 (partes iguais)</option><option value="manual">Percentuais manuais</option></Select>
            </Field>
          </>)}
          {step === 3 && (<>
            <h2 className="font-semibold">Tem empresa (PJ)?</h2>
            <Switch checked={temPJ} onCheckedChange={setTemPJ} label="Sim, há uma empresa prestadora de serviços" />
            {temPJ && (<div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nome / razão social"><Input value={pj.nome} onChange={(e) => setPj({ ...pj, nome: e.target.value })} placeholder="Ex.: Souza Tecnologia Ltda" /></Field>
              <Field label="CNPJ (opcional)"><Input className="mono" value={pj.cnpj} onChange={(e) => setPj({ ...pj, cnpj: e.target.value })} /></Field>
              <Field label="Município"><Input value={pj.municipio} onChange={(e) => setPj({ ...pj, municipio: e.target.value })} placeholder="Ex.: São Paulo" /></Field>
              <Field label="UF"><Select value={pj.uf} onChange={(e) => setPj({ ...pj, uf: e.target.value })}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
              <Field label="Regime tributário"><Select value={pj.regime} onChange={(e) => setPj({ ...pj, regime: e.target.value as RegimeTributario })}><option value="">— escolha —</option><option value="SIMPLES_III">Simples Nacional — Anexo III (Fator R)</option><option value="SIMPLES_V">Simples Nacional — Anexo V</option><option value="MEI">MEI</option><option value="PRESUMIDO">Lucro Presumido (estimativa)</option></Select></Field>
              <Field label="Início de atividade"><Input type="month" value={pj.inicio} onChange={(e) => setPj({ ...pj, inicio: e.target.value })} /></Field>
              <Field label="Moeda de faturamento"><Select value={pj.moeda} onChange={(e) => setPj({ ...pj, moeda: e.target.value as "USD" })}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></Select></Field>
              <Field label="Sócio (recebe pró-labore)"><Select value={pj.dono} onChange={(e) => setPj({ ...pj, dono: Number(e.target.value) })}>{pessoasValidas.map((p, i) => <option key={i} value={i}>{p.nome}</option>)}</Select></Field>
              <div className="flex items-end"><Switch checked={pj.exporta} onCheckedChange={(v) => setPj({ ...pj, exporta: v })} label="Fatura para o exterior (exportação de serviço)" /></div>
              <div className="flex items-end"><Switch checked={pj.escrituracao} onCheckedChange={(v) => setPj({ ...pj, escrituracao: v })} label="Mantém escrituração contábil" /></div>
            </div>)}
          </>)}
          {step === 4 && (<>
            <h2 className="font-semibold">Como começar?</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {([["importar", "Importar extratos", "Extratos do banco e faturas de cartão em CSV ou OFX; as categorias são sugeridas automaticamente."], ["zero", "Começar do zero", "Cadastre lançamentos manualmente."], ["exemplo", "Dados de exemplo", "Alguns lançamentos fictícios, marcados como exemplo, para conhecer o app."]] as const).map(([k, t, d]) => (
                <button key={k} onClick={() => setModo(k)} className={`card p-3 text-left hover:border-accent ${modo === k ? "border-accent ring-2 ring-accent/30" : ""}`}><div className="font-medium">{t}</div><div className="text-xs text-text-3 mt-1">{d}</div></button>
              ))}
            </div>
          </>)}
          {step === 5 && (<>
            <h2 className="font-semibold">Backup automático</h2>
            <p className="text-sm text-text-2">Tudo o que você digita é salvo na hora, no seu computador. Além disso, o Dueto pode guardar uma cópia compactada do banco uma vez por dia, mantendo as 30 mais recentes. Nada sai da sua máquina.</p>
            <Switch checked={backupAuto} onCheckedChange={setBackupAuto} label="Aceito que o Dueto faça um backup diário automático na pasta de dados" />
            <p className="text-xs text-text-3">Você pode mudar isso depois em Configurações → Backup, e exportar ou restaurar uma cópia a qualquer momento.</p>
          </>)}
          {step === 6 && (<>
            <h2 className="font-semibold">Tabelas fiscais</h2>
            <p className="text-sm text-text-2">O Dueto vem com tabelas versionadas por vigência (IRPF, INSS, Simples Nacional Anexos III e V, MEI, Lucro Presumido, ISS de São Paulo). Elas mudam todo ano: confira em <b>Configurações → Tabelas fiscais</b> e use <b>Adicionar vigência</b> quando sair uma nova. O app avisa quando a tabela mais recente ficar velha.</p>
            <Alert tone="info">Todos os valores de impostos são estimativas. Confirme com seu contador antes de recolher.</Alert>
          </>)}
        </div>
        <div className="flex justify-between">
          <Button onClick={() => setStep(step - 1)} disabled={step === 0}>Voltar</Button>
          {step < steps.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={(step === 2 && pessoasValidas.length === 0) || (step === 3 && temPJ && !pj.regime) || (step === 4 && !modo)}>{step === 0 ? "Começar" : "Continuar"}</Button>
          ) : (
            <Button variant="primary" onClick={concluir} disabled={pessoasValidas.length === 0}>Concluir</Button>
          )}
        </div>
      </div>
    </div>
  );
}
