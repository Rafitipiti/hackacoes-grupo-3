"""La serie historica de una empresa (spec portal-analitico, 5.1 y 5.2)."""

import pytest

from app.data.loader import cargar_datos_coes

EMPRESA = "EMPRESA_001"


@pytest.fixture(scope="module")
def datos():
    return cargar_datos_coes()


@pytest.fixture(scope="module")
def historico(cliente):
    respuesta = cliente.get(f"/empresa/historico/{EMPRESA}")

    assert respuesta.status_code == 200

    return respuesta.json()


def test_cubre_los_periodos_con_liquidacion_en_orden(historico, datos):
    evolucion = datos["evolucion_liquidaciones"]

    esperados = sorted(
        int(p)
        for p in evolucion.loc[
            evolucion["empresa_deudora"] == EMPRESA, "pericodi"
        ].unique()
    )

    assert [p["pericodi"] for p in historico["periodos"]] == esperados


def test_el_total_es_el_mismo_que_ve_mi_empresa(historico, datos, cliente):
    """Dos pantallas que muestran el mismo mes no pueden dar dos totales.

    'Mi empresa' suma la evolucion mensual; si el historico sumara el
    monto restatado de las revisiones, el mismo mes saldria con dos
    cifras distintas segun donde se mire.
    """
    ultimo = historico["periodos"][-1]

    resumen = cliente.get(
        f"/agente/resumen/{EMPRESA}/{ultimo['pericodi']}"
    ).json()

    assert ultimo["liquidacion_total"] == pytest.approx(
        resumen["resultado"]["total"]
    )


def test_los_procesos_suman_el_total(historico):
    for periodo in historico["periodos"]:
        assert sum(periodo["procesos"].values()) == pytest.approx(
            periodo["liquidacion_total"]
        )


def test_el_efecto_neto_no_suma_montos_restatados(historico, datos):
    """La trampa que el spec deja anotada.

    Cada revision restata el mes completo, asi que sumar sus montos
    cuenta lo mismo varias veces. El efecto neto es la suma de los
    ajustes, que equivale a la ultima revision menos la R0 de cada
    proceso.
    """
    totales = datos["revisiones_totales"]
    filas = totales[totales["emprcodi"] == EMPRESA]

    for periodo in historico["periodos"]:
        del_mes = filas[filas["pericodi"] == periodo["pericodi"]]

        if del_mes.empty:
            continue

        esperado = sum(
            grupo.sort_values("revision")["monto_total"].iloc[-1]
            - grupo.sort_values("revision")["monto_total"].iloc[0]
            for _, grupo in del_mes.groupby("proceso")
        )

        assert periodo["efecto_neto_recalculos"] == pytest.approx(esperado)


def test_un_mes_sin_recalculos_tiene_efecto_neto_cero(historico):
    sin_revisiones = [
        p for p in historico["periodos"] if p["revisiones"] == 0
    ]

    assert sin_revisiones, "se esperaba al menos un mes sin recalculos"

    for periodo in sin_revisiones:
        assert periodo["efecto_neto_recalculos"] == pytest.approx(0.0)


def test_trae_la_identidad_para_titular_la_pantalla(historico):
    assert historico["ruc"]
    assert historico["razon_social"]


def test_marca_el_origen_de_cada_mes(historico):
    origenes = {p["origen"] for p in historico["periodos"]}

    assert origenes <= {"real", "sintetico"}
    assert "sintetico" in origenes


def test_una_empresa_sin_liquidaciones_devuelve_404(cliente, datos):
    empresas = datos["empresas"]
    evolucion = datos["evolucion_liquidaciones"]

    con_datos = set(evolucion["empresa_deudora"])
    sin_datos = [
        e for e in empresas["empresa_id"] if e not in con_datos
    ]

    respuesta = cliente.get(f"/empresa/historico/{sin_datos[0]}")

    assert respuesta.status_code == 404
