import pandas as pd
import pytest

from scripts.preparar_datos import (
    RAW,
    construir_fact_evolucion,
    construir_fact_bilateral,
    construir_fact_desglose,
)

pytestmark = pytest.mark.skipif(
    not RAW.exists(),
    reason=(
        "requiere el welcome kit en backend/data/raw/ "
        "(no versionado, ver README)"
    ),
)


def test_fact_evolucion_carga_los_veinte_meses():
    evolucion = construir_fact_evolucion()

    assert len(evolucion) == 109_458
    assert evolucion["pericodi"].nunique() == 20


def test_el_monto_es_numerico_no_texto():
    evolucion = construir_fact_evolucion()

    assert pd.api.types.is_float_dtype(evolucion["monto"])


def test_fact_bilateral_tiene_deudora_y_acreedora():
    bilateral = construir_fact_bilateral()

    assert len(bilateral) == 141_816
    assert {"empresa_deudora", "empresa_acreedora"} <= set(bilateral.columns)
    assert pd.api.types.is_float_dtype(bilateral["monto"])


def test_fact_desglose_unifica_los_tres_procesos():
    desglose = construir_fact_desglose()

    assert set(desglose["proceso"]) == {"LVTP", "SST-SCT", "LSCIO"}
    assert len(desglose) == 126_304
    assert pd.api.types.is_float_dtype(desglose["monto"])


def test_todos_los_hechos_conservan_el_campo_origen():
    for construir in (
        construir_fact_evolucion,
        construir_fact_bilateral,
        construir_fact_desglose,
    ):
        tabla = construir()
        assert "origen" in tabla.columns
        assert set(tabla["origen"]) <= {"real", "sintetico"}


from scripts.preparar_datos import TABLAS_SOPORTE, construir_soporte

# Las claves que AgentService e IntegrityService leen por nombre. Si alguna
# desaparece, el backend no arranca.
CLAVES_QUE_LOS_SERVICIOS_EXIGEN = {
    "energia_transferencias",
    "lscio_transferencias",
    "lscio_desglose",
    "potencia_desglose",
    "potencia_saldos",
    "sstsct_desglose",
    "costos_marginales_diario",
    "entregas",
    "retiros",
    "puntos_entrega",
}


def test_estan_todas_las_tablas_que_los_servicios_exigen():
    assert CLAVES_QUE_LOS_SERVICIOS_EXIGEN <= set(TABLAS_SOPORTE)


def test_cada_tabla_de_soporte_se_construye_y_no_viene_vacia():
    for clave in TABLAS_SOPORTE:
        tabla = construir_soporte(clave)
        assert len(tabla) > 0, clave
