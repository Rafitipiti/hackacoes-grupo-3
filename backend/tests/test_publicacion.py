"""La publicacion mensual: tarjetas por proceso y su detalle (spec, seccion 11)."""

import pandas as pd
import pytest

from app.data.loader import cargar_datos_coes
from app.services.publicacion_service import COMPONENTES_LVTEA

PUBLICACION = 137


@pytest.fixture(scope="module")
def datos():
    return cargar_datos_coes()


@pytest.fixture(scope="module")
def publicacion(cliente):
    respuesta = cliente.get(f"/publicacion/{PUBLICACION}")
    assert respuesta.status_code == 200
    return respuesta.json()


def _items(publicacion):
    return [i for b in publicacion["procesos"] for i in b["items"]]


def test_cada_tarjeta_es_una_liquidacion_que_salio_en_esa_publicacion(publicacion, datos):
    totales = datos["revisiones_totales"]
    del_mes = totales[totales["publicacion_pericodi"] == PUBLICACION]
    esperadas = set(map(tuple, del_mes[["proceso", "pericodi", "revision"]].drop_duplicates().values))

    obtenidas = {(i["proceso"], i["pericodi"], i["revision"]) for i in _items(publicacion)}

    assert obtenidas == {(p, int(pc), int(r)) for p, pc, r in esperadas}


def test_la_tarjeta_del_sector_es_lo_que_cobran_las_acreedoras(publicacion, datos):
    """La liquidacion es suma cero entre empresas: sumar netos daria S/ 0.

    La tarjeta del sector muestra el volumen que se mueve, es decir, la suma
    de los netos positivos (lo que cobran las acreedoras).
    """
    totales = datos["revisiones_totales"]
    item = _items(publicacion)[0]

    filas = totales[
        (totales["publicacion_pericodi"] == PUBLICACION)
        & (totales["proceso"] == item["proceso"])
        & (totales["pericodi"] == item["pericodi"])
        & (totales["revision"] == item["revision"])
    ]["monto_total"]

    assert item["monto"] == pytest.approx(filas.clip(lower=0).sum())
    assert item["monto"] > 0
    assert publicacion["alcance"] == "sector"


def test_con_empresa_la_tarjeta_es_su_neto_con_signo(cliente, datos):
    totales = datos["revisiones_totales"]
    del_mes = totales[totales["publicacion_pericodi"] == PUBLICACION]
    fila = del_mes[del_mes["monto_total"] < 0].iloc[0]

    cuerpo = cliente.get(f"/publicacion/{PUBLICACION}", params={"empresa_id": fila["emprcodi"]}).json()
    item = next(
        i for i in _items(cuerpo)
        if i["proceso"] == fila["proceso"] and i["pericodi"] == fila["pericodi"] and i["revision"] == fila["revision"]
    )

    esperado = del_mes[
        (del_mes["emprcodi"] == fila["emprcodi"]) & (del_mes["proceso"] == fila["proceso"])
        & (del_mes["pericodi"] == fila["pericodi"]) & (del_mes["revision"] == fila["revision"])
    ]["monto_total"].sum()

    assert item["monto"] == pytest.approx(esperado)
    assert item["monto"] < 0
    assert cuerpo["alcance"] == "empresa"


def test_r0_se_compara_con_el_mes_anterior_y_rn_con_su_version_previa(publicacion):
    for item in _items(publicacion):
        if item["base"] is None:
            continue
        if item["revision"] == 0:
            assert item["base_pericodi"] == item["pericodi"] - 1
        else:
            assert item["base_pericodi"] == item["pericodi"]
            assert item["base_revision"] == item["revision"] - 1


def test_el_resumen_separa_mes_en_curso_de_recalculos(publicacion):
    items = _items(publicacion)
    r = publicacion["resumen"]

    assert r["liquidacion_mes_curso"] == pytest.approx(sum(i["monto"] for i in items if i["revision"] == 0))
    assert r["efecto_neto_recalculos"] == pytest.approx(
        sum(i["delta"] for i in items if i["revision"] > 0 and i["delta"] is not None)
    )
    assert r["recalculos"] == sum(1 for i in items if i["revision"] > 0)


def test_filtrar_por_empresa_recorta_los_montos(cliente, datos):
    totales = datos["revisiones_totales"]
    empresa = totales[totales["publicacion_pericodi"] == PUBLICACION]["emprcodi"].iloc[0]

    todo = cliente.get(f"/publicacion/{PUBLICACION}").json()
    una = cliente.get(f"/publicacion/{PUBLICACION}", params={"empresa_id": empresa}).json()

    assert abs(una["resumen"]["liquidacion_mes_curso"]) < abs(todo["resumen"]["liquidacion_mes_curso"])


def test_las_componentes_de_lvtea_cuadran_con_el_total_y_van_por_impacto(cliente, publicacion):
    item = next(i for i in _items(publicacion) if i["proceso"] == "LVTA")

    detalle = cliente.get(
        f"/publicacion/{PUBLICACION}/detalle/LVTA/{item['pericodi']}/{item['revision']}"
    ).json()

    assert detalle["componentes_simulados"] is True
    assert {c["componente"] for c in detalle["componentes"]} == {
        "Valorización de Entregas",
        "Valorización de Retiros",
        "Ingreso Tarifario y Rentas por Congestión",
    }
    assert sum(c["actual"] for c in detalle["componentes"]) == pytest.approx(item["monto"], rel=1e-6)

    impactos = [abs(c["delta"]) for c in detalle["componentes"] if c["delta"] is not None]
    assert impactos == sorted(impactos, reverse=True)


def test_las_componentes_de_los_otros_procesos_son_sus_valorizaciones(cliente, publicacion, datos):
    item = next(i for i in _items(publicacion) if i["proceso"] == "LVTP")
    detalle = cliente.get(
        f"/publicacion/{PUBLICACION}/detalle/LVTP/{item['pericodi']}/{item['revision']}"
    ).json()

    revisiones = datos["revisiones"]
    esperadas = set(revisiones[revisiones["proceso"] == "LVTP"]["valorizacion"])

    assert detalle["componentes_simulados"] is False
    assert {c["componente"] for c in detalle["componentes"]} <= esperadas
    assert sum(c["actual"] for c in detalle["componentes"]) == pytest.approx(item["monto"], rel=1e-6)


def test_el_historial_marca_la_revision_de_esta_publicacion_y_las_futuras(cliente, publicacion):
    item = next(i for i in _items(publicacion) if i["revision"] > 0) if any(i["revision"] > 0 for i in _items(publicacion)) else _items(publicacion)[0]
    detalle = cliente.get(
        f"/publicacion/{PUBLICACION}/detalle/{item['proceso']}/{item['pericodi']}/{item['revision']}"
    ).json()

    marcadas = [h for h in detalle["historial"] if h["en_esta_publicacion"]]
    assert len(marcadas) == 1 and marcadas[0]["revision"] == item["revision"]
    for h in detalle["historial"]:
        assert h["futura"] == (h["publicacion_pericodi"] > PUBLICACION)


def test_el_archivo_simulado_cuadra_al_centavo(datos):
    tabla = pd.read_csv(COMPONENTES_LVTEA)
    revisiones = datos["revisiones"]
    original = revisiones[revisiones["proceso"] == "LVTA"].groupby(["emprcodi", "pericodi", "revision"])["monto"].sum()
    control = tabla.groupby(["emprcodi", "pericodi", "revision"])["monto"].sum()

    assert (control - original.reindex(control.index)).abs().max() < 1e-3


def test_tarjeta_inexistente_devuelve_404(cliente):
    assert cliente.get(f"/publicacion/{PUBLICACION}/detalle/LVTA/1/9").status_code == 404
    assert cliente.get("/publicacion/999999").status_code == 404
