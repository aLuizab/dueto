# Suposições e decisões

Registro das escolhas feitas sem consultar o autor do pedido, como solicitado.

## Stack e empacotamento

- **Electron em vez de Tauri.** A máquina de build não tem Rust nem o Visual Studio Build Tools (MSVC), e não há permissão de administrador para instalá-los; Tauri no Windows exige a toolchain MSVC (o alvo GNU não é suportado pelo WebView2). O pedido autorizava o fallback **Electron + electron-builder**, que foi adotado. O `core/` (regras, cálculos, importadores) é TypeScript puro e independente do Electron, então uma migração futura para Tauri troca só a casca (`electron/` → `src-tauri/`).
- **SQLite via `sql.js` (WASM)**, não `better-sqlite3`: evita módulo nativo (que exigiria compilar contra o Electron sem MSVC). O banco fica em memória no renderer e é gravado em `%APPDATA%/Dueto/dueto.db` pelo processo principal a cada mutação (debounce de 800 ms, gravação atômica via arquivo temporário). No navegador (modo dev sem Electron) persiste em IndexedDB.
- **Fontes do sistema** (Segoe UI Variable / Cascadia Mono) em vez de Google Fonts: o app precisa funcionar sem internet.
- **Build Windows a partir do WSL** com `signAndEditExecutable: false` (sem wine, o ícone e os metadados do `.exe` não são embutidos). O workflow do GitHub Actions roda em `windows-latest` e produz os binários com ícone; `scripts/build-windows.ps1` faz o mesmo localmente no Windows.
- Uma única janela, HashRouter, tema claro/escuro/sistema.

## Domínio

- Toda entidade `AUTONOMO_PF` e `PJ` tem uma **pessoa dona** (`config.donoPessoaId`); pró-labore líquido e retiradas de lucro viram receita espelhada dessa pessoa no módulo Casa. Sem dono configurado, usa-se a primeira pessoa.
- "Restante do mês anterior" = saldo positivo do mês anterior (opção **zerar** no módulo Casa). Se o mês anterior não tem lançamentos, é zero.
- Despesa **fixa** é atributo da categoria (não do lançamento); a planilha só tinha "DESPESAS FIXAS".

## Fiscal (ver também `memoria-de-calculo.md`)

- **INSS do autônomo**: o plano simplificado (11%) incide **somente sobre o salário mínimo** (não sobre "valor entre mínimo e teto", como estava no pedido); o plano normal (20%) admite base entre mínimo e teto. Implementado assim por ser a regra legal.
- **IRPF 2026**: tabela de mai/2025 + redutor da Lei 15.270/2025 (isenção total até R$ 5.000; parcial até R$ 7.350: `978,62 − 13,3145% × rendimento`, limitado ao imposto). O redutor é aplicado ao IRRF do pró-labore e, por padrão, ao carnê-leão (chave `aplicarRedutorCarneLeao`, desligável), porque a regra fala em rendimentos tributáveis mensais; confirme com o contador.
- **INSS 2026**: salário mínimo R$ 1.621,00 e teto R$ 8.475,55 (conferir a Portaria MPS/MF do ano).
- **Simples Nacional**: Anexos III e V conforme LC 155/2016. A partilha oficial da 1ª faixa do Anexo III soma 99,90% (texto legal); o app aplica os percentuais como estão, como o PGDAS-D. Teto de ISS de 5% com redistribuição proporcional aos tributos federais. Exportação: PIS, COFINS e ISS excluídos da partilha sobre a receita de exportação.
- **RBT12/Fator R em início de atividade**: proporcionalização (média × 12; 1º mês × 12) para receita e folha (Res. CGSN 140/2018, arts. 21 e 26).
- **Método do Fator R (flag `fatorRMetodo` por empresa)**: `anterior12` (padrão, regra legal: 12 meses anteriores ao PA, proporcionalizados), `corrente12` (12 meses terminando no PA) ou `mensal` (folha ÷ receita do próprio mês, aproximação usada em planilhas). `fatorRManual` = ignorar o Fator R e fixar o anexo do regime. Ambos em Empresa → Impostos e em Configurações → Entidades.
- **Impostos informados**: cada tributo do mês é um lançamento com `meta.imposto` (tipo) e `meta.impostoDe` (mês de referência), competência = mês de referência e vencimento no mês seguinte. A estimativa do Dueto fica em `meta.estimativa`, só como sugestão; o cálculo nunca sobrescreve o valor digitado. Flags por tributo em `config.impostos.ativos`; outros impostos em `config.impostos.outros`. ISS vem desligado no Simples (já está no DAS).
- **Balanço**: meses passados usam lançamentos; futuros usam receita prevista (média dos 3 últimos meses realizados, editável), DAS/regime estimado sobre a série projetada, DARF do pró-labore pela política da empresa, recorrências ativas e reserva mensal. Caixa inicial = tudo pago até o mês anterior.
- **Backup automático** só roda com o aceite do usuário (`backup.auto`), gravado também em `auto-backup.json` na pasta de dados para o processo principal ler na abertura.
- **Simulador de pró-labore mínimo**: calcula o valor no mês M para que o Fator R da apuração de M+1 (janela M−11..M) fique ≥ 28%.
- **Salários/estagiário** (categoria `pj-salarios`) compõem a folha do Fator R junto com o pró-labore.
- **Lucro distribuível** = lucro líquido da DRE do ano − distribuído − reserva de caixa. Limite de isenção sem escrituração = 32% da receita − IRPJ do DAS (LC 123, art. 14).
- **Dividendos 2026**: retenção de 10% quando a distribuição ao mesmo sócio excede R$ 50 mil no mês (Lei 15.270/2025), parametrizável por vigência.
- **ISS São Paulo**: seed com 2,9% para informática (item 1), 2% saúde/educação, 5% demais; confira o código de serviço. TFE anual: valor informado pelo usuário (a planilha trazia R$ 288,63 em julho).
- MEI e Lucro Presumido são **estimativas simplificadas** (IRPJ/CSLL trimestrais distribuídos mensalmente; adicional de 10% sobre o que excede R$ 20 mil/mês de base).
- Feriados: só os nacionais fixos, para "último dia útil" e "dia 20 útil".

## Importação

- Só extratos CSV/OFX genéricos (mapeamento de colunas, categorização que aprende com as correções, lançamentos repetidos ignorados). Não há importador de planilhas pessoais no repositório.

## Fora de escopo / limitações desta versão

- Sem sincronização entre computadores; backup manual/zip.
- Anexos IV e I/II do Simples não estão implementados (serviços dos Anexos III/V apenas).
- Cotação PTAX é opcional (botão) e nunca bloqueia o uso offline.
