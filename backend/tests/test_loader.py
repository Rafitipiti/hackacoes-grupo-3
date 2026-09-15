import pandas as pd

from app.data.loader import cargar_datos_coes

# Contrato que AgentService, IntegrityService y los routers leen por nombre.
CLAVES_DEL_CONTRATO_EXISTENTE = {
    "periodos",
    "empresas",
    "evolucion_liquidaciones",
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

CLAVES_NUEVAS = {
    "barras",
    "cruce_bilateral",
    "desglose",
    "revisiones",
    "revisiones_totales",
    "calendario",
    "cmg_diario",
    "perfil_intradia",
    "energia_diaria",
}

CLAVES_ESPERADAS = CLAVES_DEL_CONTRATO_EXISTENTE | CLAVES_NUEVAS


def test_carga_todas_las_claves_esperadas():
    datos = cargar_datos_coes()

    assert CLAVES_ESPERADAS <= set(datos)


def test_todo_lo_cargado_es_dataframe():
    datos = cargar_datos_coes()

    for clave, tabla in datos.items():
        assert isinstance(tabla, pd.DataFrame), clave
        assert len(tabla) > 0, clave


def test_los_periodos_cubren_veinte_meses():
    datos = cargar_datos_coes()

    assert len(datos["periodos"]) == 20


def test_las_empresas_traen_alias():
    datos = cargar_datos_coes()

    assert "alias" in datos["empresas"].columns


def test_los_datos_se_cargan_una_sola_vez():
    """Sin cache, cuatro consumidores cargarian cuatro copias en RAM."""
    primera = cargar_datos_coes()
    segunda = cargar_datos_coes()

    assert primera is segunda
