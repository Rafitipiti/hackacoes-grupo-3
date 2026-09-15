import pandas as pd

from scripts.preparar_datos import (
    construir_agg_cmg_diario,
    construir_agg_perfil_intradia,
    construir_agg_energia_diaria,
)


def test_cmg_diario_es_mucho_mas_chico_que_el_crudo():
    cmg = construir_agg_cmg_diario()

    # El crudo son 140.199 filas por barra y dia; el agregado es por
    # periodo y dia, asi que debe caber en menos de 1.000.
    assert len(cmg) < 1_000
    assert {"pericodi", "dia", "cmg_promedio"} <= set(cmg.columns)
    assert pd.api.types.is_float_dtype(cmg["cmg_promedio"])


def test_perfil_intradia_tiene_los_96_intervalos():
    perfil = construir_agg_perfil_intradia()

    assert perfil["intervalo"].nunique() == 96
    assert {"pericodi", "intervalo", "cmg_promedio"} <= set(perfil.columns)


def test_energia_diaria_separa_entregas_de_retiros():
    energia = construir_agg_energia_diaria()

    assert {"pericodi", "dia", "entregas", "retiros"} <= set(energia.columns)
    assert len(energia) < 1_000


def test_los_agregados_conservan_el_origen():
    for construir in (
        construir_agg_cmg_diario,
        construir_agg_perfil_intradia,
        construir_agg_energia_diaria,
    ):
        tabla = construir()
        assert "origen" in tabla.columns
