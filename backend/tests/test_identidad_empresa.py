"""La regla de adjudicacion de identidad (spec portal-analitico, 3.2).

Estas pruebas no necesitan el welcome kit: la regla es una funcion pura
sobre el padron versionado, y eso es justo lo que se quiere fijar.
"""

import pandas as pd
import pytest

from app.data.loader import cargar_datos_coes
from scripts.identidad_empresa import asignar_identidad, leer_padron


@pytest.fixture(scope="module")
def padron():
    return leer_padron()


def _empresas(cantidad: int) -> pd.DataFrame:
    return pd.DataFrame({
        "empresa_id": [f"EMPRESA_{i:03d}" for i in range(1, cantidad + 1)],
        "alias": [f"Alias {i}" for i in range(1, cantidad + 1)],
    })


def test_el_padron_trae_rucs_unicos(padron):
    assert len(padron) == 87
    assert padron["ruc"].nunique() == len(padron)


def test_solo_los_codigos_con_liquidacion_reciben_identidad(padron):
    empresas = _empresas(5)

    resultado = asignar_identidad(
        empresas, {"EMPRESA_002", "EMPRESA_004"}, padron
    )

    con_identidad = resultado.loc[resultado["ruc"].notna(), "empresa_id"]

    assert list(con_identidad) == ["EMPRESA_002", "EMPRESA_004"]


def test_la_asignacion_no_depende_del_orden_de_entrada(padron):
    empresas = _empresas(5)
    revueltas = empresas.iloc[::-1].reset_index(drop=True)

    con_liquidacion = {"EMPRESA_001", "EMPRESA_003", "EMPRESA_005"}

    pd.testing.assert_frame_equal(
        asignar_identidad(empresas, con_liquidacion, padron),
        asignar_identidad(revueltas, con_liquidacion, padron),
    )


def test_sigue_el_orden_del_padron_por_ruc(padron):
    """El i-esimo codigo con liquidacion recibe el i-esimo RUC ordenado.

    Si el emparejamiento dejara de ser por posicion sobre listas
    ordenadas, dos ejecuciones podrian repartir los RUC distinto y el
    portal atribuiria las cifras de una empresa a otra entre despliegues.
    """
    resultado = asignar_identidad(
        _empresas(4), {"EMPRESA_002", "EMPRESA_003"}, padron
    )

    asignados = list(resultado.loc[resultado["ruc"].notna(), "ruc"])

    assert asignados == list(padron["ruc"].head(2))


def test_un_padron_mas_corto_que_los_codigos_es_un_error(padron):
    empresas = _empresas(3)

    with pytest.raises(ValueError, match="padron"):
        asignar_identidad(
            empresas, set(empresas["empresa_id"]), padron.head(2)
        )


def test_la_capa_curada_ya_trae_la_identidad_aplicada():
    """dim_empresa.parquet se regenera con scripts.identidad_empresa.

    Es el archivo que el backend lee en tiempo de ejecucion; si quedara
    con el esquema viejo, el portal mostraria alias donde promete razon
    social.
    """
    empresas = cargar_datos_coes()["empresas"]

    assert {"ruc", "razon_social"} <= set(empresas.columns)
    assert empresas["ruc"].notna().sum() == 74
