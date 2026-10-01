# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

## [0.2.0] — 2026-09-30

### Alterado
- Aba **Casa** renomeada para **Pessoal** (rota `/pessoal`; `/casal` continua funcionando). Migração 3 renomeia o orçamento com o nome padrão antigo.
- Textos explicativos no meio das telas viraram ícones ⓘ com dica (Empresa, Impostos, Balanço, Lucros, Pessoal, Configurações). O painel de avisos começa recolhido, como um botão "N avisos" no canto. O aviso "sem vigência ativa" aparece só em Configurações → Tabelas fiscais.

### Corrigido
- **Gerar recorrências** agora informa o resultado (quantos lançamentos criou, se já existiam ou se não há recorrência). "Repetir todo mês" vincula o lançamento original à recorrência (sem duplicar o mês) e pode ser ligado/desligado ao editar um lançamento existente.

### Removido
- Perfil **Autônomo PF** por completo: tela "Autônomo", passo do assistente, entidade `AUTONOMO_PF`, carnê-leão/livro-caixa, INSS contribuinte individual, pacientes, categorias e regras `pf-*`, categoria "Renda autônoma", livro-caixa no pacote do contador e o importador da aba CONSULTÓRIO (agora ignorada).
- Migração 2 do banco: apaga entidades autônomas e seus lançamentos, recorrências, contas, metas e obrigações; remove a tabela `patients`, as categorias/regras `pf-*` e `rec-autonomo` (lançamentos nela ficam sem categoria) e as configurações `autonomo.*`.
- Atalhos das telas passam a ser `Alt+1…7`.

## [0.1.0] — 2026-09-28

### Adicionado
- Módulo **Casa**: restante do mês anterior, receitas por pessoa, despesas fixas/variáveis, saldo, quem paga o quê (proporcional/50-50/manual), metas por categoria, objetivos, cartões, recorrências.
- Módulo **Autônomo PF**: receitas por paciente (pacotes parcelados), despesas com livro-caixa, % do resultado para investimento, carnê-leão mensal (DARF 0190, redutor 2026 opcional), INSS contribuinte individual (20% / 11%), pacientes, relatório anual para o IRPF.
- **Impostos com flag por tributo**: ligue só o que a empresa recolhe; o Dueto mostra a estimativa e você informa o valor a pagar, que nunca é sobrescrito; "Outro imposto" para taxas não previstas.
- **Balanço projetado** da empresa: receita prevista, impostos, despesas, pró-labore, lucro, retirada planejada e caixa mês a mês, com alerta de caixa mínimo.
- **Avisos flutuantes** no canto inferior direito, recolhíveis, em vez de faixas no meio da página.
- **Aceite para backup automático** (assistente e Configurações → Backup). Autônomo é opcional no assistente e só aparece no menu quando cadastrado. Importação de planilhas removida da interface (fica só CSV/OFX).
- **Fator R conforme art. 26 da Res. CGSN 140/2018**: casos-limite (0,01 / 0,28), 0,28 nos 2 primeiros meses (Res. 190/2026), arredondamento a 2 casas antes do corte, códigos da guia DAS na partilha; casos de teste conferidos com o PGDAS-D. Ferramenta Python independente em `tools/fator_r/`.
- **Fator R configurável** por empresa: regra legal (12 meses anteriores), 12 meses incluindo o corrente, ou só o mês; opção de fixar o anexo do regime.
- Módulo **Empresa (PJ)**: recebimentos por quinzena/origem com cotação, NFS-e com conciliação, histórico de faturamento (média móvel, RBT12, projeção anual, comparativo anual), Simples Nacional Anexos III/V com RBT12 proporcionalizado, Fator R com simulador, partilha por tributo, exclusão de PIS/COFINS/ISS na exportação, teto de ISS, alertas de sublimite/limite, DAS previsto × pago, comparativo MEI/Presumido, pró-labore (INSS com teto + IRRF por vigência + DARF) com espelho no módulo Casa, distribuição de lucros (limite de isenção e retenção 2026), DRE mensal/anual com drill-down e indicadores, calendário de obrigações, pacote para o contador (zip).
- Módulo **Investimentos**: produtos por pessoa/instituição, snapshots de saldo, aportes (vinculados às saídas do Casa e do Consultório), variação e rentabilidade, evolução e alocação.
- **Visão geral**: cards, alertas, próximos vencimentos, fluxo de caixa consolidado.
- **Importação** de extratos CSV/OFX genéricos com mapeamento de colunas e categorização que aprende com correções.
- **Onboarding** genérico, tabelas fiscais versionadas por vigência (editáveis), backup automático diário em zip + exportar/restaurar, busca global (Ctrl+K), atalhos, tema claro/escuro, exportação CSV/XLSX de qualquer tabela.
- Instalador NSIS e versão portátil (electron-builder), `scripts/build-windows.ps1`, GitHub Actions de release.
