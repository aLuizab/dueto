"""
Fator "r" do Simples Nacional e anexo aplicável (III ou V), com cálculo opcional do DAS.

Base legal:
- LC 123/2006, art. 18, §§ 5º-J, 5º-K e 5º-M (fator r ≥ 28% → Anexo III; < 28% → Anexo V) e § 24 (folha de salários incluídos encargos).
- Resolução CGSN 140/2018, art. 26 (definição de FS12/RBT12r, folha de salários, casos com zero, início de atividade),
  art. 21 (RBT12 proporcionalizada para a faixa) e art. 25, § 4º (exportação: desconsiderar PIS, COFINS e ISS).
- Resolução CGSN 190/2026 (nova redação do art. 26, § 6º: fator r = 0,28 nos 2 primeiros meses de atividade).

Todo cálculo monetário usa decimal.Decimal.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, getcontext

getcontext().prec = 28

CENT = Decimal("0.01")
DOIS = Decimal("0.01")  # 2 casas
QUATRO = Decimal("0.0001")
CORTE = Decimal("0.28")
ZONA_DE_RISCO = Decimal("0.02")

# ------------------------------------------------------------------ tabelas (LC 123/2006, Anexos III e V, redação da LC 155/2016)
# faixa: (limite RBT12, alíquota nominal, parcela a deduzir, partilha em % {IRPJ, CSLL, COFINS, PIS, CPP, ISS})
Faixa = tuple[Decimal, Decimal, Decimal, dict[str, Decimal]]


def _p(irpj: str, csll: str, cofins: str, pis: str, cpp: str, iss: str) -> dict[str, Decimal]:
    return {"IRPJ": Decimal(irpj), "CSLL": Decimal(csll), "COFINS": Decimal(cofins), "PIS": Decimal(pis), "CPP": Decimal(cpp), "ISS": Decimal(iss)}


ANEXO_III: list[Faixa] = [
    (Decimal("180000.00"), Decimal("0.0600"), Decimal("0.00"), _p("4.00", "3.50", "12.74", "2.76", "43.40", "33.50")),
    (Decimal("360000.00"), Decimal("0.1120"), Decimal("9360.00"), _p("4.00", "3.50", "14.05", "3.05", "43.40", "32.00")),
    (Decimal("720000.00"), Decimal("0.1350"), Decimal("17640.00"), _p("4.00", "3.50", "13.64", "2.96", "43.40", "32.50")),
    (Decimal("1800000.00"), Decimal("0.1600"), Decimal("35640.00"), _p("4.00", "3.50", "13.64", "2.96", "43.40", "32.50")),
    (Decimal("3600000.00"), Decimal("0.2100"), Decimal("125640.00"), _p("4.00", "3.50", "12.82", "2.78", "43.40", "33.50")),
    (Decimal("4800000.00"), Decimal("0.3300"), Decimal("648000.00"), _p("35.00", "15.00", "16.03", "3.47", "30.50", "0.00")),
]
ANEXO_V: list[Faixa] = [
    (Decimal("180000.00"), Decimal("0.1550"), Decimal("0.00"), _p("25.00", "15.00", "14.10", "3.05", "28.85", "14.00")),
    (Decimal("360000.00"), Decimal("0.1800"), Decimal("4500.00"), _p("23.00", "15.00", "14.10", "3.05", "27.85", "17.00")),
    (Decimal("720000.00"), Decimal("0.1950"), Decimal("9900.00"), _p("24.00", "15.00", "14.92", "3.23", "23.85", "19.00")),
    (Decimal("1800000.00"), Decimal("0.2050"), Decimal("17100.00"), _p("21.00", "15.00", "15.74", "3.41", "23.85", "21.00")),
    (Decimal("3600000.00"), Decimal("0.2300"), Decimal("62100.00"), _p("23.00", "12.50", "14.10", "3.05", "23.85", "23.50")),
    (Decimal("4800000.00"), Decimal("0.3050"), Decimal("540000.00"), _p("35.00", "15.50", "16.44", "3.56", "29.50", "0.00")),
]
ANEXOS = {"III": ANEXO_III, "V": ANEXO_V}
TRIBUTOS = ("IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ISS")
EXCLUIDOS_EXPORTACAO = ("PIS", "COFINS", "ISS")  # Res. CGSN 140/2018, art. 25, § 4º


# ------------------------------------------------------------------ utilidades de mês
def parse_mes(s: str) -> tuple[int, int]:
    ano, mes = s.split("-")[:2]
    a, m = int(ano), int(mes)
    if not 1 <= m <= 12:
        raise ValueError(f"mês inválido: {s}")
    return a, m


def mes_str(a: int, m: int) -> str:
    return f"{a:04d}-{m:02d}"


def add_meses(s: str, n: int) -> str:
    a, m = parse_mes(s)
    idx = a * 12 + (m - 1) + n
    return mes_str(idx // 12, idx % 12 + 1)


def meses_anteriores(pa: str, n: int = 12) -> list[str]:
    """Os n meses imediatamente anteriores ao PA, em ordem cronológica (o PA não entra)."""
    return [add_meses(pa, -i) for i in range(n, 0, -1)]


def q2(v: Decimal) -> Decimal:
    return v.quantize(DOIS, rounding=ROUND_HALF_UP)


def q4(v: Decimal) -> Decimal:
    return v.quantize(QUATRO, rounding=ROUND_HALF_UP)


def D(v) -> Decimal:
    if isinstance(v, Decimal):
        return v
    if isinstance(v, float):
        return Decimal(str(v))
    return Decimal(str(v).replace(".", "").replace(",", ".")) if isinstance(v, str) and "," in str(v) else Decimal(str(v))


def _fmt(v: Decimal) -> str:
    """1234567.89 → 1.234.567,89"""
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _dec(v: Decimal) -> str:
    """decimal com vírgula, sem separador de milhar (para o fator r)"""
    return str(v).replace(".", ",")


# ------------------------------------------------------------------ resultado
@dataclass
class ResultadoFatorR:
    periodo_apuracao: str
    data_abertura: str
    mes_abertura: str
    meses_de_atividade_anteriores: int  # meses desde a abertura até o mês anterior ao PA
    meses_considerados: list[str]
    fs12: Decimal
    rbt12: Decimal
    fator_r_exato: Decimal | None  # None nos casos-limite (regra fixa)
    fator_r: Decimal  # valor usado na comparação (arredondado a 2 casas quando aplicável)
    anexo: str
    regra: str
    zona_de_risco: bool
    passos: list[str] = field(default_factory=list)


@dataclass
class ResultadoDAS:
    anexo: str
    faixa: int
    rbt12p: Decimal
    rbt12p_regra: str
    aliquota_nominal: Decimal
    parcela_deduzir: Decimal
    aliquota_efetiva_bruta: Decimal  # (RBT12p × nominal − PD) / RBT12p
    aliquota_efetiva_aplicada: Decimal  # após exclusão de PIS/COFINS/ISS na exportação (soma das partilhas aplicadas)
    receita_pa: Decimal
    exportacao: bool
    tributos: dict[str, Decimal]
    total: Decimal
    passos: list[str] = field(default_factory=list)


# ------------------------------------------------------------------ fator r
def calcular_fator_r(
    data_abertura: str,
    periodo_apuracao: str,
    receitas: dict[str, Decimal | str | float | int],
    folhas: dict[str, Decimal | str | float | int],
    *,
    arredondar_2_casas: bool = True,
    regra_190_2026: bool = True,
) -> ResultadoFatorR:
    """
    Res. CGSN 140/2018, art. 26:
      § 5º  FS12 = folha de salários dos 12 meses anteriores ao PA; RBT12r = receita bruta acumulada dos 12 meses
            anteriores ao PA (mercado interno + externo). O mês do PA não entra em nenhum dos dois.
      § 6º  (redação da Res. CGSN 190/2026) nos 2 primeiros meses de atividade o fator r é 0,28.
      § 7º  períodos posteriores: FS12 = 0 e RBT12r > 0 → r = 0,01; FS12 > 0 e RBT12r = 0 → r = 0,28;
            FS12 = 0 e RBT12r = 0 → r = 0,01; ambos > 0 → r = FS12 / RBT12r.
    Empresa com menos de 12 meses: somam-se apenas os meses desde a abertura (a razão das somas é igual à razão
    das médias × 12; não se usa a RBT12 proporcionalizada, que serve só para a faixa).
    """
    ab = date.fromisoformat(data_abertura)
    mes_ab = mes_str(ab.year, ab.month)
    pa_a, pa_m = parse_mes(periodo_apuracao)
    if periodo_apuracao < mes_ab:
        raise ValueError("período de apuração anterior à abertura")
    passos: list[str] = []
    janela = meses_anteriores(periodo_apuracao, 12)
    considerados = [m for m in janela if m >= mes_ab]
    idx_pa = pa_a * 12 + pa_m - 1
    idx_ab = ab.year * 12 + ab.month - 1
    meses_desde_abertura = idx_pa - idx_ab  # 0 = PA é o mês de abertura

    fs12 = sum((D(folhas.get(m, 0)) for m in considerados), Decimal("0"))
    rbt12 = sum((D(receitas.get(m, 0)) for m in considerados), Decimal("0"))
    faltando = [m for m in considerados if m not in receitas and m not in folhas]
    passos.append(f"PA {periodo_apuracao}; abertura {data_abertura} (mês {mes_ab}); meses de atividade antes do PA: {len(considerados)}")
    passos.append(f"Janela dos 12 meses anteriores ao PA: {janela[0]} a {janela[-1]}; considerados (desde a abertura): {considerados[0] if considerados else '—'} a {considerados[-1] if considerados else '—'}")
    if faltando:
        passos.append(f"Aviso: meses sem receita nem folha informadas (tratados como zero): {', '.join(faltando)}")
    passos.append("Folha de salários (FS12) = " + " + ".join(_fmt(q2(D(folhas.get(m, 0)))) for m in considerados) + f" = {_fmt(q2(fs12))}")
    passos.append("Receita bruta (RBT12r) = " + " + ".join(_fmt(q2(D(receitas.get(m, 0)))) for m in considerados) + f" = {_fmt(q2(rbt12))}")

    exato: Decimal | None = None
    if regra_190_2026 and meses_desde_abertura < 2:
        r = CORTE
        regra = "art. 26, § 6º (Res. 190/2026): fator r = 0,28 nos 2 primeiros meses de atividade"
    elif fs12 == 0 and rbt12 > 0:
        r = Decimal("0.01")
        regra = "art. 26, § 7º: FS12 = 0 e RBT12r > 0 → fator r = 0,01"
    elif fs12 > 0 and rbt12 == 0:
        r = CORTE
        regra = "art. 26, § 7º: FS12 > 0 e RBT12r = 0 → fator r = 0,28"
    elif fs12 == 0 and rbt12 == 0:
        r = Decimal("0.01")
        regra = "art. 26, § 7º: FS12 = 0 e RBT12r = 0 → fator r = 0,01"
    else:
        exato = fs12 / rbt12
        r = q2(exato) if arredondar_2_casas else exato
        regra = "art. 26, § 7º: fator r = FS12 ÷ RBT12r"
    passos.append(f"Regra aplicada: {regra}")
    if exato is not None:
        passos.append(f"Divisão: {_fmt(q2(fs12))} ÷ {_fmt(q2(rbt12))} = {_dec(q4(exato))} (exato: {_dec(exato.quantize(Decimal('0.0000000001')))})")
        passos.append(f"Arredondamento a 2 casas (como o PGDAS-D exibe): {_dec(r)}" if arredondar_2_casas else f"Sem arredondamento: {_dec(r)}")
    anexo = "III" if r >= CORTE else "V"
    passos.append(f"Comparação: {_dec(r)} {'≥' if anexo == 'III' else '<'} 0,28 → Anexo {anexo}")
    zona = exato is not None and abs(exato - CORTE) < ZONA_DE_RISCO
    if zona:
        passos.append(f"ATENÇÃO: fator r a {_dec(abs(q4(exato - CORTE)))} do corte de 0,28 (zona de risco < 0,02)")
    return ResultadoFatorR(periodo_apuracao, data_abertura, mes_ab, len(considerados), considerados, q2(fs12), q2(rbt12), exato, r, anexo, regra, zona, passos)


# ------------------------------------------------------------------ RBT12 proporcionalizada e DAS
def rbt12_proporcionalizada(data_abertura: str, periodo_apuracao: str, receitas: dict[str, Decimal | str | float | int], receita_pa: Decimal) -> tuple[Decimal, str]:
    """
    Res. CGSN 140/2018, art. 21, §§ 2º e 3º (início de atividade):
      - primeiro mês de atividade: RBT12p = receita do próprio mês × 12;
      - menos de 12 meses de atividade: média aritmética das receitas dos meses anteriores × 12;
      - 12 meses ou mais: soma dos 12 meses anteriores.
    """
    ab = date.fromisoformat(data_abertura)
    mes_ab = mes_str(ab.year, ab.month)
    considerados = [m for m in meses_anteriores(periodo_apuracao, 12) if m >= mes_ab]
    if not considerados:
        return q2(receita_pa * 12), "art. 21, § 3º: primeiro mês de atividade → receita do PA × 12"
    soma = sum((D(receitas.get(m, 0)) for m in considerados), Decimal("0"))
    if len(considerados) < 12:
        return q2(soma / len(considerados) * 12), f"art. 21, § 2º: média dos {len(considerados)} meses de atividade × 12 = {_fmt(q2(soma))} ÷ {len(considerados)} × 12"
    return q2(soma), "art. 21: soma dos 12 meses anteriores"


def faixa_para(rbt12p: Decimal, anexo: str) -> tuple[int, Faixa]:
    for i, f in enumerate(ANEXOS[anexo], start=1):
        if rbt12p <= f[0]:
            return i, f
    raise ValueError(f"RBT12p {rbt12p} acima do limite do Simples Nacional (4.800.000,00)")


def calcular_das(
    anexo: str,
    rbt12p: Decimal,
    receita_pa: Decimal,
    exportacao: bool,
    rbt12p_regra: str = "",
) -> ResultadoDAS:
    """
    Alíquota efetiva = (RBT12p × nominal − PD) ÷ RBT12p (LC 123, art. 18, § 1º-A).
    Cada tributo = receita × efetiva × percentual de partilha da faixa; na exportação, PIS, COFINS e ISS são
    desconsiderados (Res. 140, art. 25, § 4º). O total é a soma dos tributos arredondados.
    """
    passos: list[str] = []
    n, (limite, nominal, pd, partilha) = faixa_para(rbt12p, anexo)
    efetiva = (rbt12p * nominal - pd) / rbt12p if rbt12p > 0 else nominal
    passos.append(f"RBT12p = {_fmt(rbt12p)} ({rbt12p_regra}) → Anexo {anexo}, {n}ª faixa (até {_fmt(limite)}): nominal {_dec(q2(nominal * 100))}%, parcela a deduzir {_fmt(pd)}")
    passos.append(f"Alíquota efetiva = ({_fmt(rbt12p)} × {_dec(nominal)} − {_fmt(pd)}) ÷ {_fmt(rbt12p)} = {_dec(q4(efetiva * 100))}%")
    tributos: dict[str, Decimal] = {}
    soma_partilha = Decimal("0")
    for t in TRIBUTOS:
        pct = partilha[t] / Decimal("100")
        if exportacao and t in EXCLUIDOS_EXPORTACAO:
            passos.append(f"  {t}: {_dec(partilha[t])}% da partilha desconsiderado (exportação de serviços, art. 25, § 4º)")
            continue
        valor = q2(receita_pa * efetiva * pct)
        tributos[t] = valor
        soma_partilha += pct
        passos.append(f"  {t}: {_fmt(receita_pa)} × {_dec(q4(efetiva * 100))}% × {_dec(partilha[t])}% = {_fmt(valor)}")
    aplicada = efetiva * soma_partilha
    total = sum(tributos.values(), Decimal("0"))
    passos.append(f"Alíquota efetiva aplicada (soma das partilhas usadas {_dec(q2(soma_partilha * 100))}%): {_dec(q4(aplicada * 100))}% → {_fmt(receita_pa)} × {_dec(q4(aplicada * 100))}% = {_fmt(q2(receita_pa * aplicada))}")
    passos.append(f"DAS = soma dos tributos = {_fmt(total)}")
    if abs(total - q2(receita_pa * aplicada)) > Decimal("0.05"):
        passos.append("Aviso: a soma dos tributos difere da receita × alíquota aplicada por mais de 5 centavos")
    return ResultadoDAS(anexo, n, rbt12p, rbt12p_regra, nominal, pd, q4(efetiva * 100) / 100, q4(aplicada * 100) / 100, receita_pa, exportacao, tributos, total, passos)


def calcular(
    data_abertura: str,
    periodo_apuracao: str,
    receitas: dict,
    folhas: dict,
    receita_pa: Decimal | str | float | int | None = None,
    exportacao: bool = False,
    **opts,
) -> tuple[ResultadoFatorR, ResultadoDAS | None]:
    fr = calcular_fator_r(data_abertura, periodo_apuracao, receitas, folhas, **opts)
    das = None
    if receita_pa is not None:
        rp = D(receita_pa)
        rbt12p, regra = rbt12_proporcionalizada(data_abertura, periodo_apuracao, receitas, rp)
        das = calcular_das(fr.anexo, rbt12p, rp, exportacao, regra)
    return fr, das


# ------------------------------------------------------------------ CLI
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Fator r do Simples Nacional (Res. CGSN 140/2018, art. 26) e DAS opcional.")
    ap.add_argument("--abertura", required=True, help="data de abertura AAAA-MM-DD")
    ap.add_argument("--pa", required=True, help="período de apuração AAAA-MM")
    ap.add_argument("--receitas", required=True, help='JSON {"AAAA-MM": valor} dos 12 meses anteriores ao PA, ou caminho de arquivo .json')
    ap.add_argument("--folhas", required=True, help='JSON {"AAAA-MM": valor} dos 12 meses anteriores ao PA, ou caminho de arquivo .json')
    ap.add_argument("--receita-pa", help="receita bruta do PA (calcula o DAS)")
    ap.add_argument("--exportacao", action="store_true", help="receita do PA é exportação de serviços (zera PIS, COFINS e ISS)")
    ap.add_argument("--sem-arredondar", action="store_true", help="compara o fator r exato com 0,28 (sem arredondar a 2 casas)")
    ap.add_argument("--regra-antiga", action="store_true", help="ignora a Res. CGSN 190/2026 (0,28 nos 2 primeiros meses)")
    ap.add_argument("--json", action="store_true", help="saída em JSON")
    a = ap.parse_args(argv)

    def carregar(s: str) -> dict:
        if s.strip().startswith("{"):
            return json.loads(s)
        with open(s, encoding="utf-8") as f:
            return json.load(f)

    fr, das = calcular(a.abertura, a.pa, carregar(a.receitas), carregar(a.folhas), a.receita_pa, a.exportacao, arredondar_2_casas=not a.sem_arredondar, regra_190_2026=not a.regra_antiga)
    if a.json:
        out = {
            "fator_r": {**{k: (str(v) if isinstance(v, Decimal) else v) for k, v in fr.__dict__.items() if k != "passos"}},
            "das": None if das is None else {**{k: (str(v) if isinstance(v, Decimal) else v) for k, v in das.__dict__.items() if k not in ("passos", "tributos")}, "tributos": {k: str(v) for k, v in das.tributos.items()}},
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    print("== Fator r (Res. CGSN 140/2018, art. 26) ==")
    for p in fr.passos:
        print("  " + p)
    print(f"  → Folha 12 meses: R$ {_fmt(fr.fs12)} | RBT12: R$ {_fmt(fr.rbt12)} | Fator r: {_dec(fr.fator_r)} | Anexo {fr.anexo}" + ("  [ZONA DE RISCO]" if fr.zona_de_risco else ""))
    if das:
        print("\n== DAS ==")
        for p in das.passos:
            print("  " + p)
        print(f"  → DAS: R$ {_fmt(das.total)} (" + " / ".join(f"{k} {_fmt(v)}" for k, v in das.tributos.items()) + ")")
    print("\nEstimativa: confirme no PGDAS-D e com seu contador.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
