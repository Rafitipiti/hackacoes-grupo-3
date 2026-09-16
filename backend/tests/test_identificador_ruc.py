"""Las rutas con empresa aceptan el RUC ademas del codigo tecnico."""

import pytest

from app.data.loader import cargar_datos_coes


@pytest.fixture(scope="module")
def empresa_con_ruc():
    empresas = cargar_datos_coes()["empresas"]
    fila = empresas[empresas["ruc"].notna()].iloc[0]
    return fila["empresa_id"], fila["ruc"]


def test_el_ruc_y_el_codigo_devuelven_lo_mismo(cliente, empresa_con_ruc):
    empresa_id, ruc = empresa_con_ruc

    por_codigo = cliente.get(f"/empresa/historico/{empresa_id}").json()
    por_ruc = cliente.get(f"/empresa/historico/{ruc}").json()

    assert por_ruc["periodos"] == por_codigo["periodos"]
    assert por_ruc["ruc"] == ruc


def test_las_rutas_del_agente_aceptan_ruc(cliente, empresa_con_ruc):
    empresa_id, ruc = empresa_con_ruc
    pericodi = 137

    a = cliente.get(f"/agente/resumen/{empresa_id}/{pericodi}").json()
    b = cliente.get(f"/agente/resumen/{ruc}/{pericodi}").json()

    assert a["resultado"]["total"] == pytest.approx(b["resultado"]["total"])


def test_publicacion_acepta_ruc_en_la_consulta(cliente, empresa_con_ruc):
    empresa_id, ruc = empresa_con_ruc

    a = cliente.get("/publicacion/137", params={"empresa_id": empresa_id}).json()
    b = cliente.get("/publicacion/137", params={"empresa_id": ruc}).json()

    assert a["resumen"] == b["resumen"]


def test_un_ruc_desconocido_es_404(cliente):
    assert cliente.get("/empresa/historico/20999999999").status_code == 404
    assert cliente.get("/contactos/20999999999").status_code == 404
