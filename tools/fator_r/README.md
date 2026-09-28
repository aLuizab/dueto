# Fator r do Simples Nacional (Python)

Calcula o fator "r" e o anexo aplicável (III ou V) conforme a Resolução CGSN 140/2018 (art. 26) e a LC 123/2006 (art. 18, §§ 5º-J, 5º-K e 5º-M), e, opcionalmente, o DAS do período. Todo cálculo monetário usa `decimal.Decimal`.

```
python fator_r.py --abertura 2025-10-01 --pa 2026-06 \
  --receitas '{"2026-04": 20000, "2026-05": 30000}' \
  --folhas '{"2026-03": 1621, "2026-04": 4500, "2026-05": 8379}' \
  --receita-pa 40000 --exportacao
```

`--receitas` e `--folhas` aceitam JSON inline ou caminho de arquivo `.json`. Meses ausentes valem zero. `--json` imprime a saída estruturada; `--sem-arredondar` compara o fator exato com 0,28; `--regra-antiga` ignora a Res. CGSN 190/2026.

Testes: `python -m pytest -q` nesta pasta.

## Regras aplicadas (art. 26 da Res. CGSN 140/2018)

| Item | Regra | Fonte |
|---|---|---|
| Janela | FS12 = folha dos 12 meses anteriores ao PA; RBT12r = receita bruta dos 12 meses anteriores (interno + externo). O PA não entra. | § 5º |
| Folha | Salários (base da CPP, com 13º), pró-labore, mais CPP patronal e FGTS efetivamente recolhidos. Aluguéis e lucros distribuídos não entram. | caput, §§ 2º e 3º |
| Menos de 12 meses | Somam-se só os meses desde a abertura. A razão das somas é igual à razão das médias × 12; a RBT12 proporcionalizada serve só para a faixa (art. 21). | § 5º + art. 21 |
| 2 primeiros meses de atividade | fator r = 0,28 (Anexo III), sem cálculo. | § 6º, redação da Res. CGSN 190/2026 |
| FS12 = 0 e RBT12r > 0 | r = 0,01 → Anexo V | § 7º |
| FS12 > 0 e RBT12r = 0 | r = 0,28 → Anexo III | § 7º |
| FS12 = 0 e RBT12r = 0 | r = 0,01 → Anexo V | § 7º |
| Corte | r ≥ 0,28 → Anexo III; r < 0,28 → Anexo V. O valor é arredondado a 2 casas (como o PGDAS-D exibe) antes da comparação; opção para desligar. | LC 123, art. 18, § 5º-J/5º-M |
| Zona de risco | aviso quando o fator exato está a menos de 0,02 do corte. | ferramenta |
| DAS | efetiva = (RBT12p × nominal − PD) ÷ RBT12p; partilha por tributo; exportação de serviços desconsidera PIS, COFINS e ISS; total = soma dos tributos arredondados. | LC 123, art. 18, § 1º-A; Res. 140, art. 25, § 4º |

Observação: a partilha da 1ª faixa do Anexo III soma 99,90% no texto legal, então para receita nacional o total dos tributos é receita × 5,994%, não × 6%. O CLI mostra os dois números.
