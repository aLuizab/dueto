/** Guia "Como usar": aparece na primeira etapa do assistente e na tela Como usar do menu. */
import { Kbd } from "@/components/ui";

const PASSOS: { titulo: string; texto: React.ReactNode }[] = [
  {
    titulo: "Cadastre quem faz parte das suas finanças",
    texto: <>No assistente, informe as pessoas do orçamento e diga se há renda de autônomo (freelas, consultoria, aulas, atendimentos) e se há empresa. Tudo pode ser alterado depois em <b>Configurações → Entidades</b>.</>,
  },
  {
    titulo: "Traga seus dados",
    texto: <>Em <b>Importar</b>, carregue extratos CSV ou OFX do banco e do cartão; as categorias são sugeridas e aprendem com suas correções. Os valores ficam salvos na hora, sem botão de salvar. Ou lance à mão com o botão <b>Lançamento</b>: o valor aceita contas como <span className="mono">=120+150</span>, e uma descrição como <span className="mono">Óculos (06/10)</span> cria as parcelas futuras.</>,
  },
  {
    titulo: "Acompanhe o mês",
    texto: <>Escolha o mês no topo da tela. A <b>Visão geral</b> mostra o saldo pessoal, a receita da empresa, os impostos do mês, contas vencidas e os próximos vencimentos. Marque como pago clicando na caixa ao lado de cada lançamento.</>,
  },
  {
    titulo: "Organize a casa",
    texto: <>Em <b>Pessoal</b>, veja receitas por pessoa, despesas fixas e variáveis, quanto cada um deve transferir para o comum, metas por categoria, objetivos e faturas de cartão. Marque "Repetir todo mês" nas contas fixas e use <b>Gerar recorrências</b> a cada mês.</>,
  },
  {
    titulo: "Cuide da empresa",
    texto: <>Em <b>Empresa</b>, registre os recebimentos (em dólar, com a cotação do dia) e as notas. Na aba <b>Impostos</b>, ligue só o que a empresa recolhe e digite o valor que vai pagar; o Dueto mostra a estimativa ao lado. A aba <b>Balanço</b> prevê lucro, impostos e retiradas nos próximos meses. Em <b>Pró-labore</b>, salve o valor do mês: o app gera o DARF e lança o líquido como receita da pessoa na Casa. <b>DRE</b> exporta o pacote para o contador.</>,
  },
  {
    titulo: "Investimentos",
    texto: <>Em <b>Investimentos</b>, cadastre os produtos e registre o saldo de cada um uma vez por mês para ver rentabilidade e evolução.</>,
  },
  {
    titulo: "Mantenha em dia",
    texto: <>Uma vez por ano, confira as <b>Tabelas fiscais</b> (IRPF, INSS, Simples) e adicione a nova vigência. Tudo é salvo na hora; com o seu aceite, o app também guarda um backup diário. Em <b>Configurações → Backup</b> você liga isso, exporta ou restaura uma cópia.</>,
  },
];

export function ComoUsar({ compacto }: { compacto?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="grid grid-cols-[28px_1fr] gap-3 items-start">
            <span className="h-7 w-7 rounded-full bg-accent-soft text-accent text-sm font-semibold flex items-center justify-center num" aria-hidden>{i + 1}</span>
            <div>
              <div className="font-medium">{p.titulo}</div>
              <p className="text-sm text-text-2 max-w-[70ch]">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
      {!compacto && (
        <div className="card-flat p-3 text-sm flex flex-col gap-1">
          <div className="label">Atalhos</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-text-2">
            <span><Kbd>Ctrl K</Kbd> buscar</span>
            <span><Kbd>Alt 1</Kbd>…<Kbd>Alt 8</Kbd> trocar de tela</span>
            <span><Kbd>[</Kbd> <Kbd>]</Kbd> mês anterior e próximo</span>
            <span><Kbd>T</Kbd> mês atual</span>
            <span><Kbd>Ctrl I</Kbd> importar</span>
          </div>
        </div>
      )}
      <p className="text-xs text-text-3">Seus dados ficam só neste computador. Os valores de impostos são estimativas: confirme com seu contador antes de recolher.</p>
    </div>
  );
}
