from decimal import Decimal

import pytest

from fator_r import calcular, calcular_das, calcular_fator_r, main, rbt12_proporcionalizada

# ------------------------------------------------------------------ caso fictício de início de atividade, PA 06/2026
ABERTURA = "2025-10-01"
PA = "2026-06"
RECEITAS = {"2025-10": 0, "2025-11": 0, "2025-12": 0, "2026-01": 0, "2026-02": 0, "2026-03": 0, "2026-04": "20000.00", "2026-05": "30000.00"}
FOLHAS = {"2025-10": 0, "2025-11": 0, "2025-12": 0, "2026-01": 0, "2026-02": 0, "2026-03": "1621.00", "2026-04": "4500.00", "2026-05": "8379.00"}


def test_caso_inicio_de_atividade_junho_2026():
    fr, das = calcular(ABERTURA, PA, RECEITAS, FOLHAS, receita_pa="40000.00", exportacao=True)
    assert fr.rbt12 == Decimal("50000.00")
    assert fr.fs12 == Decimal("14500.00")
    assert fr.fator_r_exato.quantize(Decimal("0.0001")) == Decimal("0.2900")
    assert fr.fator_r == Decimal("0.29")
    assert fr.anexo == "III"
    assert fr.meses_de_atividade_anteriores == 8
    assert fr.meses_considerados[0] == "2025-10" and fr.meses_considerados[-1] == "2026-05"
    assert fr.zona_de_risco is True  # 0,29 está a 0,01 do corte

    assert das is not None
    assert das.rbt12p == Decimal("75000.00")
    assert das.faixa == 1
    assert das.aliquota_efetiva_bruta == Decimal("0.06")
    assert das.aliquota_efetiva_aplicada == Decimal("0.03054")  # 6% × (4% + 3,5% + 43,4%)
    assert das.tributos == {"IRPJ": Decimal("96.00"), "CSLL": Decimal("84.00"), "CPP": Decimal("1041.60")}
    assert das.total == Decimal("1221.60")
    assert sum(das.tributos.values()) == das.total


def test_rbt12p_media_dos_meses_de_atividade():
    rbt12p, regra = rbt12_proporcionalizada(ABERTURA, PA, RECEITAS, Decimal("40000.00"))
    assert rbt12p == Decimal("75000.00")  # 50.000,00 ÷ 8 × 12
    assert "média dos 8 meses" in regra


def test_rbt12p_primeiro_mes_usa_receita_do_pa_vezes_12():
    rbt12p, regra = rbt12_proporcionalizada("2026-06-05", "2026-06", {}, Decimal("10000"))
    assert rbt12p == Decimal("120000.00")
    assert "primeiro mês" in regra


def test_mes_do_pa_nao_entra_na_janela():
    receitas = dict(RECEITAS, **{PA: "999999"})
    folhas = dict(FOLHAS, **{PA: "999999"})
    fr = calcular_fator_r(ABERTURA, PA, receitas, folhas)
    assert fr.rbt12 == Decimal("50000.00") and fr.fs12 == Decimal("14500.00")


# ------------------------------------------------------------------ casos-limite do art. 26, § 7º
DOZE = {f"2025-{m:02d}": 0 for m in range(7, 13)} | {f"2026-{m:02d}": 0 for m in range(1, 7)}


def test_folha_zero_receita_positiva_anexo_v():
    fr = calcular_fator_r("2024-01-10", "2026-07", dict(DOZE, **{"2026-05": "10000"}), DOZE)
    assert fr.fator_r == Decimal("0.01") and fr.anexo == "V" and "FS12 = 0 e RBT12r > 0" in fr.regra


def test_folha_positiva_receita_zero_anexo_iii():
    fr = calcular_fator_r("2024-01-10", "2026-07", DOZE, dict(DOZE, **{"2026-05": "1621"}))
    assert fr.fator_r == Decimal("0.28") and fr.anexo == "III" and "RBT12r = 0" in fr.regra


def test_ambos_zero_anexo_v():
    fr = calcular_fator_r("2024-01-10", "2026-07", DOZE, DOZE)
    assert fr.fator_r == Decimal("0.01") and fr.anexo == "V" and "FS12 = 0 e RBT12r = 0" in fr.regra


def test_dois_primeiros_meses_de_atividade_res_190_2026():
    # abertura em 2026-05: PA 2026-05 e 2026-06 → 0,28 (Anexo III) mesmo sem folha
    for pa in ("2026-05", "2026-06"):
        fr = calcular_fator_r("2026-05-20", pa, {"2026-05": "10000"}, {})
        assert fr.fator_r == Decimal("0.28") and fr.anexo == "III" and "190/2026" in fr.regra
    # terceiro mês: já usa FS12 ÷ RBT12r (aqui folha zero → 0,01)
    fr = calcular_fator_r("2026-05-20", "2026-07", {"2026-05": "10000", "2026-06": "10000"}, {})
    assert fr.fator_r == Decimal("0.01") and fr.anexo == "V"


def test_regra_antiga_sem_res_190():
    fr = calcular_fator_r("2026-05-20", "2026-06", {"2026-05": "10000"}, {"2026-05": "2000"}, regra_190_2026=False)
    assert fr.fator_r == Decimal("0.20") and fr.anexo == "V"


# ------------------------------------------------------------------ arredondamento, corte e zona de risco
def test_arredondamento_a_duas_casas_decide_o_anexo():
    receitas = dict(DOZE, **{"2026-06": "100000"})
    fr = calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "27500"}))  # 0,275 → 0,28
    assert fr.fator_r == Decimal("0.28") and fr.anexo == "III" and fr.zona_de_risco
    fr2 = calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "27500"}), arredondar_2_casas=False)
    assert fr2.anexo == "V"
    fr3 = calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "27499"}))  # 0,27499 → 0,27
    assert fr3.fator_r == Decimal("0.27") and fr3.anexo == "V"


def test_zona_de_risco_so_perto_do_corte():
    receitas = dict(DOZE, **{"2026-06": "100000"})
    assert calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "29900"})).zona_de_risco
    assert not calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "40000"})).zona_de_risco
    assert not calcular_fator_r("2024-01-10", "2026-07", receitas, dict(DOZE, **{"2026-06": "20000"})).zona_de_risco


# ------------------------------------------------------------------ DAS
def test_das_nacional_faixa_1_soma_das_partilhas_99_90():
    das = calcular_das("III", Decimal("120000.00"), Decimal("10000.00"), exportacao=False)
    assert set(das.tributos) == {"IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ISS"}
    assert das.total == sum(das.tributos.values())
    assert das.total == Decimal("599.40")  # 6% × 99,90% (texto legal da 1ª faixa do Anexo III)


def test_das_anexo_v_segunda_faixa():
    das = calcular_das("V", Decimal("240000.00"), Decimal("20000.00"), exportacao=False)
    # efetiva = (240000 × 18% − 4500) / 240000 = 16,125%
    assert das.aliquota_efetiva_bruta == Decimal("0.16125")
    assert das.faixa == 2
    assert das.total == sum(das.tributos.values())


def test_das_acima_do_limite_do_simples():
    with pytest.raises(ValueError):
        calcular_das("III", Decimal("5000000"), Decimal("1"), False)


def test_cli_passo_a_passo(capsys):
    rc = main(["--abertura", ABERTURA, "--pa", PA, "--receitas", '{"2026-04": 20000, "2026-05": 30000}', "--folhas", '{"2026-03": 1621, "2026-04": 4500, "2026-05": 8379}', "--receita-pa", "40000", "--exportacao"])
    out = capsys.readouterr().out
    assert rc == 0
    for trecho in ("FS12", "50.000,00", "14.500,00", "0,29", "Anexo III", "75.000,00", "ZONA DE RISCO", "IRPJ", "1.221,60"):
        assert trecho in out, trecho
