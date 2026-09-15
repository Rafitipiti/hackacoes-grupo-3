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


def test_la_cascada_devuelve_las_revisiones_en_orden_por_proceso(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    assert len(cascada) > 0

    for proceso, pasos in cascada.items():
        assert len(pasos) > 0
        revisiones = [paso["revision"] for paso in pasos]
        assert revisiones == sorted(revisiones)


def test_la_primera_revision_de_cada_proceso_no_tiene_ajuste(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    for proceso, pasos in cascada.items():
        primera = pasos[0]

        assert primera["revision"] == 0
        assert primera["ajuste"] is None
        assert primera["ajuste_pct"] is None


def test_el_ajuste_es_la_diferencia_contra_la_revision_anterior(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    for proceso, pasos in cascada.items():
        for anterior, actual in zip(pasos, pasos[1:]):
            esperado = actual["monto_total"] - anterior["monto_total"]
            assert actual["ajuste"] == pytest.approx(esperado, abs=1e-6)


def test_un_proceso_con_menos_revisiones_no_distorsiona_a_otro(servicio):
    """LVTP se queda en R1 mientras LVTA llega a R3.

    Consolidando, el ajuste de R1 a R2 daba -57%, que no es un
    recalculo sino LVTP saliendo de la suma. Separado por proceso,
    cada cadena mide solo sus propios recalculos.
    """
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    assert "LVTA" in cascada
    lvta = cascada["LVTA"]

    # La cadena de LVTA es la real, sin contaminacion de otros procesos.
    montos = [p["monto_total"] for p in lvta]
    assert montos == pytest.approx(
        [915642.9495, 890901.1251, 883962.2907, 874421.9370], abs=1e-3
    )

    # Ningun ajuste de LVTA supera el 10% en magnitud: son recalculos
    # finos, no saltos estructurales.
    for paso in lvta[1:]:
        assert abs(paso["ajuste_pct"]) < 0.10, (
            f"ajuste sospechoso en R{paso['revision']}: "
            f"{paso['ajuste_pct']:.2%}"
        )


def test_una_empresa_sin_revisiones_devuelve_diccionario_vacio(servicio):
    assert servicio.cascada("EMPRESA_INEXISTENTE", PERIODO_DEMO) == {}


def test_el_impacto_separa_el_mes_corriente_de_los_arrastres(servicio):
    impacto = servicio.impacto_de_publicacion(PUBLICACION_DEMO)

    assert {"corriente", "arrastre", "periodos_arrastrados"} <= set(impacto)
    assert impacto["periodos_arrastrados"] >= 0


def test_el_arrastre_suma_ajustes_no_montos_restatados(servicio):
    """Sumar montos restatados seria doble contabilidad.

    Cada revision restata el mes completo, asi que su monto ya
    incluye lo publicado antes. El arrastre es la suma de los
    ajustes (diferencia contra la revision anterior).
    """
    impacto = servicio.impacto_de_publicacion(PUBLICACION_DEMO)

    assert impacto["arrastre"] == pytest.approx(-4_515_658.58, abs=1.0)


def test_el_corriente_es_el_monto_del_propio_mes(servicio):
    impacto = servicio.impacto_de_publicacion(PUBLICACION_DEMO)

    assert impacto["corriente"] == pytest.approx(9_001_571.80, abs=1.0)


def test_endpoint_calendario(cliente):
    respuesta = cliente.get(f"/revisiones/calendario/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert len(respuesta.json()["entradas"]) > 0


def test_endpoint_cascada(cliente):
    respuesta = cliente.get(
        f"/revisiones/cascada/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )

    assert respuesta.status_code == 200
    assert len(respuesta.json()["procesos"]) > 0
    assert "LVTA" in respuesta.json()["procesos"]


def test_endpoint_cascada_de_empresa_inexistente_es_404(cliente):
    respuesta = cliente.get(f"/revisiones/cascada/EMPRESA_NADA/{PERIODO_DEMO}")

    assert respuesta.status_code == 404


def test_endpoint_impacto(cliente):
    respuesta = cliente.get(f"/revisiones/impacto/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert "arrastre" in respuesta.json()
