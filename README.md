# Dueto

**Organização financeira PF e PJ para devs.**

## Como usar

1. **Instale e abra.** O assistente pergunta quem faz parte do orçamento e se há empresa.
2. **Traga seus dados.** Em *Importar*, carregue extratos CSV/OFX do banco e do cartão, ou lance à mão com *Lançamento* (o valor aceita `=120+150`; `Óculos (06/10)` cria as parcelas futuras). Tudo é salvo na hora.
3. **Acompanhe o mês.** Escolha o mês no topo; a *Visão geral* mostra saldo, impostos, vencidas e próximos vencimentos.
4. **Empresa.** Registre recebimentos (USD com cotação) e notas. Em *Impostos*, ligue só o que a empresa recolhe e informe o valor a pagar (a estimativa do Dueto fica ao lado; "Outro imposto" cobre taxas não previstas). *Balanço* prevê lucro, impostos, retiradas e caixa mês a mês. *Pró-labore* gera o DARF e lança o líquido em Pessoal; *DRE* exporta o pacote para o contador.
5. **Investimentos.** Saldos mensais, aportes e rentabilidade de cada produto.
6. **Uma vez por ano**, confira *Configurações → Tabelas fiscais*. O backup diário só roda depois do seu aceite, em *Configurações → Backup*.

O mesmo guia fica no app, em **Como usar** (menu lateral ou `Alt+7`).

## O que é

App **desktop, offline e em pt-BR** que junta num só lugar:

1. **Pessoal** — finanças pessoais em casal (contas compartilhadas e individuais, quem paga o quê, metas, objetivos);
2. **Empresa (PJ)** — prestadora de serviços que fatura em USD para o exterior: notas, Simples Nacional com Fator R, pró-labore, DRE, lucros, obrigações;
3. **Investimentos** — produtos por pessoa, aportes, saldos, rentabilidade e alocação.

Tudo fica em um SQLite local (`%APPDATA%\Dueto\dueto.db`) com backup diário em `.zip`. Nenhuma dependência de internet; a cotação PTAX é um botão opcional.

> **Aviso:** os valores de impostos são estimativas. Confirme com seu contador antes de recolher.

## Instalação (Windows)

Baixe na página de Releases:

- `Dueto-Setup-x.y.z.exe` — instalador (NSIS), cria atalhos e permite escolher a pasta;
- `Dueto-portable.exe` — versão portátil, sem instalação.

Na primeira abertura, um assistente pergunta as pessoas do orçamento, se há empresa, e se você quer importar planilhas, começar do zero ou usar dados de exemplo.

## Importação

- **Extratos e faturas** em CSV (mapeamento de colunas) ou OFX, com categorização automática que aprende com suas correções. Lançamentos repetidos são ignorados.
- Exportação CSV/XLSX de qualquer tabela e **pacote para o contador** (zip com DRE, lançamentos, notas e DAS/DARF).
- Não há importação de planilhas de controle: cada planilha tem um formato diferente e o app não conseguiria interpretá-las com segurança.

## O que o app calcula

| Módulo | Cálculos |
|---|---|
| Pessoal | restante do mês anterior, receitas líquidas por pessoa, despesas fixas/variáveis, saldo, divisão proporcional/50-50/manual, metas por categoria, aporte sugerido para objetivos |
| PJ | impostos do mês com flag por tributo, estimativa do Dueto e valor informado pelo usuário (nunca sobrescrito), outros impostos; balanço projetado (receita prevista, impostos, despesas, pró-labore, lucro, retirada e caixa); RBT12 (com proporcionalização no início de atividade), Fator R com método configurável (regra legal, 12 meses incluindo o corrente, ou mensal) e simulador de pró-labore mínimo, Anexos III/V com partilha por tributo, exclusão de PIS/COFINS/ISS na exportação, teto de ISS, sublimite/limite, DAS previsto × pago, MEI e Lucro Presumido (estimativas), pró-labore (INSS com teto + IRRF por vigência, redutor 2026), distribuição de lucros (limite de isenção e retenção), DRE com indicadores e projeção de caixa, calendário de obrigações |
| Investimentos | variação = saldo atual − (anterior + aportes), rentabilidade, evolução e alocação |

A memória de cálculo com exemplos numéricos está em [docs/memoria-de-calculo.md](docs/memoria-de-calculo.md); as decisões e suposições em [docs/assumptions.md](docs/assumptions.md).

## Desenvolvimento

Stack: **Electron + React + TypeScript + Vite**, Tailwind v4, Radix (diálogo/abas/switch/tooltip), Recharts, SQLite via `sql.js`, Vitest. As regras de negócio e cálculos fiscais ficam em `core/` (TypeScript puro, sem dependência de UI ou de Electron).

```bash
npm install
npm test           # testes do core (fiscal, parcelas, expressões, CSV/OFX, desempenho 50k)
npm run dev        # Vite + Electron com hot reload
npm run build      # typecheck + Vite + esbuild (electron/)
npm run dist:win   # instalador NSIS + portátil em release/ (no Windows)
npm run report:samples   # regenera docs/relatorio-importacao-samples.md
```

### Build público × build pessoal

- `npm run dist:win` gera o **público** em `release/publico/` (`Dueto-Setup-x.y.z.exe`, `Dueto-portable.exe`). Não contém dados: abre no assistente. É o que vai para a Release.
- `npm run seed:pessoal` copia o seu banco (`%APPDATA%\Dueto\dueto.db`) para `private/seed/`, e `npm run dist:win:pessoal` gera o **pessoal** em `release/pessoal/` (`Dueto-Pessoal-*.exe`). Ele embute essa cópia e a restaura na primeira abertura quando a máquina não tem banco. Não distribua.
- `private/`, `samples/` e o relatório da importação estão no `.gitignore`.
- Para testar qualquer build sem tocar nos seus dados: `Dueto.exe --data-dir=C:\caminho\teste`.

### Assinatura digital

Os executáveis não são assinados. No Windows 11 com o **Controle Inteligente de Aplicativos** (Smart App Control) em modo obrigatório, um `.exe` novo e sem assinatura pode ser bloqueado com a mensagem "bloqueado pela política do Device Guard". Para distribuir ao público, assine o instalador e o portátil (por exemplo com Azure Trusted Signing ou um certificado de assinatura de código) configurando `win.azureSignOptions` ou `CSC_LINK`/`CSC_KEY_PASSWORD` no electron-builder.

No Windows, `scripts\build-windows.ps1` faz tudo; a Action `.github/workflows/release.yml` compila em `windows-latest` e anexa os binários à Release quando uma tag `v*.*.*` é criada.

Estrutura:

```
core/            regras e cálculos (tax/, importers/, dre, couple, investments, parcelas, expression)
electron/        processo principal (janela, arquivo do banco, backups, diálogos, PTAX) e preload
src/             renderer React (db/, state/, components/, pages/)
docs/            memória de cálculo, suposições, relatório das planilhas de exemplo
samples/         planilhas de exemplo usadas pelos testes dos importadores
```

Atalhos: `Ctrl+K` busca, `Alt+1…7` telas, `[` `]` mês anterior/próximo, `T` mês atual, `Ctrl+I` importar.

## Licença

MIT.
