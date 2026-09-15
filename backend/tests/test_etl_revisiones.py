import pandas as pd

from scripts.preparar_datos import (
    construir_fact_revisiones,
    construir_fact_revisiones_totales,
    construir_fact_calendario,
)

PROCESOS = {"LVTA", "LVTP", "LSCIO", "SST-SCT"}


def test_fact_revisiones_tiene_el_detalle_por_valorizacion():
    revisiones = construir_fact_revisiones()

    assert len(revisiones) == 29_875
    assert set(revisiones["proceso"]) == PROCESOS
    assert pd.api.types.is_float_dtype(revisiones["monto"])


def test_no_expone_el_ruc_anonimizado():
    revisiones = construir_fact_revisiones()

    assert "emprruc" not in revisiones.columns


def test_fact_revisiones_totales_es_el_rollup():
    totales = construir_fact_revisiones_totales()

    assert len(totales) == 16_925
    assert pd.api.types.is_float_dtype(totales["monto_total"])


def test_cada_periodo_tiene_exactamente_una_ultima_revision():
    totales = construir_fact_revisiones_totales()

    ultimas = totales[totales["es_ultima_revision"]]
    duplicadas = ultimas.duplicated(
        subset=["proceso", "emprcodi", "pericodi"]
    ).sum()

    assert duplicadas == 0


def test_el_calendario_queda_aplanado():
    calendario = construir_fact_calendario()

    assert "revisiones" not in calendario.columns
    assert {
        "proceso",
        "pericodi",
        "revision",
        "revision_nombre",
        "publicacion_pericodi",
    } <= set(calendario.columns)
    assert len(calendario) > 80


def test_cada_revision_se_publica_una_sola_vez():
    calendario = construir_fact_calendario()

    duplicadas = calendario.duplicated(
        subset=["proceso", "pericodi", "revision"]
    ).sum()

    assert duplicadas == 0
