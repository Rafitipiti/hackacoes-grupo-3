import pytest

from app.data.loader import cargar_datos_coes
from app.services.revision_service import RevisionService

PUBLICACION_DEMO = 138
EMPRESA_DEMO = "EMPRESA_001"
PERIODO_DEMO = 132


@pytest.fixture(scope="module")
def servicio():
    return RevisionService(cargar_datos_coes())


def test_el_calendario_lista_lo_que_trae_una_publicacion(servicio):
    entradas = servicio.calendario_de_publicacion(PUBLICACION_DEMO)

    assert len(entradas) > 0
    assert {"proceso", "pericodi", "revision"} <= set(entradas[0])

    # Una publicacion trae la R0 de su propio mes.
    propias = [
        e for e in entradas
        if e["pericodi"] == PUBLICACION_DEMO and e["revision"] == 0
    ]
    assert len(propias) > 0


def test_la_cascada_devuelve_las_revisiones_en_orden(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    assert len(cascada) > 0
    revisiones = [paso["revision"] for paso in cascada]
    assert revisiones == sorted(revisiones)


def test_la_primera_revision_no_tiene_ajuste(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)
    primera = cascada[0]

    assert primera["revision"] == 0
    assert primera["ajuste"] is None
    assert primera["ajuste_pct"] is None


def test_el_ajuste_es_la_diferencia_contra_la_revision_anterior(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    for anterior, actual in zip(cascada, cascada[1:]):
        esperado = actual["monto_total"] - anterior["monto_total"]
        assert actual["ajuste"] == pytest.approx(esperado, abs=1e-6)


def test_una_empresa_sin_revisiones_devuelve_lista_vacia(servicio):
    assert servicio.cascada("EMPRESA_INEXISTENTE", PERIODO_DEMO) == []


def test_el_impacto_separa_el_mes_corriente_de_los_arrastres(servicio):
    impacto = servicio.impacto_de_publicacion(PUBLICACION_DEMO)

    assert {"corriente", "arrastre", "periodos_arrastrados"} <= set(impacto)
    assert impacto["periodos_arrastrados"] >= 0


def test_endpoint_calendario(cliente):
    respuesta = cliente.get(f"/revisiones/calendario/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert len(respuesta.json()["entradas"]) > 0


def test_endpoint_cascada(cliente):
    respuesta = cliente.get(
        f"/revisiones/cascada/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )

    assert respuesta.status_code == 200
    assert len(respuesta.json()["pasos"]) > 0


def test_endpoint_cascada_de_empresa_inexistente_es_404(cliente):
    respuesta = cliente.get(f"/revisiones/cascada/EMPRESA_NADA/{PERIODO_DEMO}")

    assert respuesta.status_code == 404


def test_endpoint_impacto(cliente):
    respuesta = cliente.get(f"/revisiones/impacto/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert "arrastre" in respuesta.json()
