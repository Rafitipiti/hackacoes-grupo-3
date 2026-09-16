"""El comparador entre empresas (spec portal-analitico, 5.3)."""

import pytest

from app.data.loader import cargar_datos_coes

PERIODO = 137


@pytest.fixture(scope="module")
def datos():
    return cargar_datos_coes()


@pytest.fixture(scope="module")
def comparativa(cliente):
    respuesta = cliente.get(f"/empresas/comparar/{PERIODO}")

    assert respuesta.status_code == 200

    return respuesta.json()


def test_trae_a_todas_las_empresas_con_liquidacion_en_el_mes(comparativa, datos):
    evolucion = datos["evolucion_liquidaciones"]

    esperadas = set(
        evolucion.loc[evolucion["pericodi"] == PERIODO, "empresa_deudora"]
    )

    assert {e["empresa_id"] for e in comparativa["empresas"]} == esperadas


def test_cada_empresa_lleva_su_identidad(comparativa):
    """Sin razon social el comparador seria una lista de codigos tecnicos."""
    for empresa in comparativa["empresas"]:
        assert empresa["razon_social"]
        assert empresa["ruc"]


def test_el_total_coincide_con_el_historico(comparativa, cliente):
    """La cifra de una empresa no puede cambiar segun la pantalla."""
    empresa = comparativa["empresas"][0]

    historico = cliente.get(
        f"/empresa/historico/{empresa['empresa_id']}"
    ).json()

    del_mes = next(p for p in historico["periodos"] if p["pericodi"] == PERIODO)

    assert empresa["liquidacion_total"] == pytest.approx(
        del_mes["liquidacion_total"]
    )
    assert empresa["efecto_neto_recalculos"] == pytest.approx(
        del_mes["efecto_neto_recalculos"]
    )


def test_el_monto_restatado_es_la_ultima_revision_no_la_suma(comparativa, datos):
    totales = datos["revisiones_totales"]

    for empresa in comparativa["empresas"]:
        filas = totales[
            (totales["pericodi"] == PERIODO)
            & (totales["emprcodi"] == empresa["empresa_id"])
        ]

        if filas.empty:
            assert empresa["monto_restatado"] is None
            continue

        esperado = sum(
            grupo.sort_values("revision")["monto_total"].iloc[-1]
            for _, grupo in filas.groupby("proceso")
        )

        assert empresa["monto_restatado"] == pytest.approx(esperado)
        assert empresa["revision"] == int(filas["revision"].max())


def test_un_periodo_sin_liquidaciones_devuelve_404(cliente):
    assert cliente.get("/empresas/comparar/999999").status_code == 404
