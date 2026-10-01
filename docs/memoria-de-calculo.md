# Memória de cálculo fiscal

Casos de teste documentados com números. Todos estão cobertos por `core/__tests__/tax.test.ts`. Estimativas: confirme com seu contador.

## 1. Tabelas versionadas

| Tabela | Vigência | Valores-semente |
|---|---|---|
| IRPF mensal | 2024-02 | isento até 2.259,20; 7,5% (−169,44); 15% (−381,44); 22,5% (−662,77); 27,5% (−896,00); simplificado 564,80 |
| IRPF mensal | 2025-05 | isento até 2.428,80; 7,5% (−182,16) até 2.826,65; 15% (−394,16) até 3.751,05; 22,5% (−675,49) até 4.664,68; 27,5% (−908,73); simplificado 607,20 |
| IRPF mensal | 2026-01 | tabela de 2025-05 + redutor Lei 15.270/2025: isenção até 5.000; entre 5.000,01 e 7.350: redução = 978,62 − 13,3145% × rendimento |
| INSS | 2025-01 | mínimo 1.518,00; teto 8.157,41 |
| INSS | 2026-01 | mínimo 1.621,00; teto 8.475,55 |
| Simples Anexo III | 2018-01 | 6% / 11,2% (PD 9.360) / 13,5% (17.640) / 16% (35.640) / 21% (125.640) / 33% (648.000) |
| Simples Anexo V | 2018-01 | 15,5% / 18% (4.500) / 19,5% (9.900) / 20,5% (17.100) / 23% (62.100) / 30,5% (540.000) |
| Simples params | 2018-01 | limite 4.800.000; sublimite 3.600.000; Fator R 28%; ISS máx. 5%; DAS dia 20 |
| MEI | 2025-01 | limite 81.000; INSS 5% do mínimo + ISS 5 (+ ICMS 1) |
| Presumido | — | presunção 32%; IRPJ 15% + 10% acima de 20.000/mês; CSLL 9%; PIS 0,65%; COFINS 3% |
| Dividendos | 2026-01 | retenção 10% acima de 50.000/mês por beneficiário |

A escolha da vigência é "a mais recente com data ≤ dia 1 do mês de competência".

## 2. IRRF mensal

**Base 3.000 (tabela 2025)**: 3.000 × 15% − 394,16 = **55,84**.

**Pró-labore 8.000 em ago/2026**: INSS 11% = 880,00 → base legal 7.120,00 → 27,5% − 908,73 = 1.049,27. Desconto simplificado (8.000 − 607,20 = 7.392,80 → 1.124,29) é pior, então usa a base legal. Redutor: 978,62 − 0,133145 × 8.000 < 0 → 0. **IRRF 1.049,27; líquido 6.070,73; DARF 1.929,27** (vence 21/09/2026 porque dia 20 é domingo).

**Rendimento 6.000, deduções 660 (2026)**: base 5.340 → 559,77; redutor 978,62 − 798,87 = 179,75 → **380,02**.

**Rendimento 5.000 com INSS 550 e simplificado (2026)**: imposto pela tabela 312,89; redutor = imposto → **0**.

**Um salário mínimo (1.621) em 2026**: INSS 178,31; IRRF 0; líquido 1.442,69.

## 3. INSS

- Pró-labore 5.000 → 550,00. Pró-labore 20.000 → base limitada a 8.475,55 → **932,31**.

## 4. Simples Nacional

### RBT12
- 12 meses de 20.000 → RBT12 240.000.
- Início em jan/2026 com 10.000, 20.000, 30.000: em mar/2026 RBT12 = média(10.000, 20.000) × 12 = **180.000** (método proporcional); em jan/2026 = 10.000 × 12 = 120.000 (primeiro mês).

### Alíquota efetiva
- Anexo III, RBT12 240.000 (2ª faixa): (240.000 × 11,2% − 9.360) / 240.000 = **7,30%**.
- 1ª faixa: 6% nominal, PD 0 → 6%.

### Partilha e DAS
- Receita nacional 10.000, Anexo III 1ª faixa: 10.000 × 6% × 99,9% (soma da partilha legal) = **599,40**.
- Receita 100% exportação 10.000: excluídos PIS 2,76%, COFINS 12,74% e ISS 33,5% → restam IRPJ 4% + CSLL 3,5% + CPP 43,4% = 50,9% → alíquota 6% × 50,9% = **3,054%** → DAS **305,40** (CPP = 10.000 × 6% × 43,4% = 260,40; ISS = 0).
- Mista: 6.000 nacional + 4.000 exportação → 6.000 × 5,994% + 4.000 × 3,054% = **481,80**.
- Anexo III 2ª faixa nacional 20.000 → 20.000 × 7,3% = **1.460,00**.
- ISS acima de 5% (Anexo III 5ª faixa, RBT12 3.000.000): ISS efetivo 33,5% × ~16,8% = 5,6% > 5% → limitado a 5%, excedente redistribuído proporcionalmente aos federais; soma dos tributos = DAS.

### Fator R
- Folha 2.000/mês, receita 10.000/mês → 20% → **Anexo V** → DAS 10.000 × 15,5% = 1.550,00, com alerta.
- Folha 2.800/mês → exatamente 28% → Anexo III.
- Simulador: receitas de 10.000/mês, folha 2.800 nos 11 meses anteriores; para setembro: 28% × 120.000 − 30.800 = **2.800**. Se a receita de setembro dobrar (20.000): 28% × 130.000 − 30.800 = **5.600**.

### Exemplo: início de atividade (fictício; empresa aberta em 10/2025, 100% exportação)
- **PA 06/2026**: receitas 04/2026 20.000,00 e 05/2026 30.000,00 (RBT12r 50.000,00); folhas 03/2026 1.621,00, 04/2026 4.500,00, 05/2026 8.379,00 (FS12 14.500,00). Fator R = **0,29** → Anexo III. RBT12p = 50.000,00 ÷ 8 × 12 = 75.000,00 (1ª faixa, 6%). Receita do PA 40.000,00 × 6% × (4% + 3,5% + 43,4%) = **1.221,60** = 1001 IRPJ 96,00 + 1002 CSLL 84,00 + 1006 INSS/CPP 1.041,60; PIS, COFINS e ISS são desconsiderados na exportação.
- Regras do art. 26 (Res. CGSN 140/2018) no núcleo: FS12 e RBT12r são somas dos 12 meses anteriores (o PA não entra); folha = 0 e receita > 0 → 0,01; folha > 0 e receita = 0 → 0,28; ambos zero → 0,01; 2 primeiros meses de atividade → 0,28 (Res. 190/2026); comparação com 28% após arredondar a 2 casas (configurável).

### Métodos de Fator R (flag por empresa)
- 12 meses anteriores com folha 2.000 e receita 10.000; mês corrente com folha 6.000: **anterior12** = 24.000 / 120.000 = 20% (Anexo V); **corrente12** = (11 × 2.000 + 6.000) / 120.000 = 23,33% (V); **mensal** = 6.000 / 10.000 = 60% (III).
- Simulador mensal: 28% × receita do mês = 2.800. `corrente12` e `mensal` afetam a apuração do próprio mês; `anterior12` afeta o mês seguinte.

### Alertas
- RBT12 > 4.800.000: risco de exclusão. RBT12 > 3.600.000: ISS fora do Simples. > 80% do limite: aviso. Fator R < 28%: Anexo V; entre 28% e 30%: "próximo do mínimo".

### DAS: vencimento
Dia 20 do mês seguinte, empurrado para o próximo dia útil (fim de semana/feriado nacional fixo).

## 5. Outros regimes

- **MEI 2026**: 5% × 1.621 + ISS 5 = **86,05**/mês; acima de 81.000/ano alerta de estouro.
- **Lucro Presumido**, receita 30.000 (100% exportação), ISS 2,9%: base 9.600 → IRPJ 1.440 + CSLL 864 + PIS 0 + COFINS 0 + ISS 0 = **2.304** (carga 7,68%).

## 6. Lucros

- Sem escrituração: receita 100.000, IRPJ no DAS 240 → limite isento 100.000 × 32% − 240 = **31.760**.
- Dividendos 2026: 40.000 no mês → sem retenção; 60.000 → retenção 10% = **6.000**.

## 7. Parcelamento e expressões

- "Óculos (06/10)" em set/2026, R$ 87 → gera 07/10 (out/26) … 10/10 (jan/27); "faltam 4".
- `=120+150` → 270 (guarda a expressão); `=13.35+132.31+34.68+99.08+90.86+118.69+3.5` → 492,47; `=3676.06-88.81-125` → 3.462,25; `1.234,56` → 1234,56; `-` → 0.
