"""Simulador y capas de energía en Red y precios (spec, §12)."""

import pytest

from app.data.loader import cargar_datos_coes
from app.services.energia import energia_mes
from app.services.simulador_service import SimuladorService, normalizar

PERIODO = 137


@pytest.fixture(scope="module")
def servicio():
    return SimuladorService(cargar_datos_coes())


@pytest.fixture(scope="module")
def empresa_con_energia():
    tabla = energia_mes(PERIODO)
    assert not tabla.empty
    return tabla


# --- resolver barras ---------------------------------------------------------

def test_normalizar_quita_tildes_y_mayusculas():
    assert normalizar("  chilca  500 ") == "CHILCA 500"
    assert normalizar("Energía") == "ENERGIA"


def test_resuelve_barra_por_nombre_prefijo_y_codigo(servicio):
    exacta = servicio.resolver_barra("talara 220")
    assert exacta["barrnombre"] == "TALARA 220"

    assert servicio.resolver_barra(exacta["barrcodi"])["barrnombre"] == "TALARA 220"
    assert servicio.resolver_barra(str(exacta["barrcodi"]))["barrnombre"] == "TALARA 220"

    # Un prefijo que coincide con varias barras no se adivina.
    assert servicio.resolver_barra("T") is None
    assert servicio.resolver_barra("no existe esta barra") is None
    assert servicio.resolver_barra("") is None


# --- valorizar ---------------------------------------------------------------

def test_valorizar_mensual_aplica_cmg_por_mwh_por_mil(servicio):
    salida = servicio.valorizar(PERIODO, "mes", None, [
        {"barra": "TALARA 220", "entregas": 100.0, "retiros": 40.0},
    ])
    cmg = servicio.cmg(servicio.resolver_barra("TALARA 220")["barrcodi"], PERIODO)

    assert salida["filas"] == 1
    assert salida["total"] == pytest.approx(60.0 * cmg * 1000.0)
    assert salida["energia_neta"] == pytest.approx(60.0)
    assert salida["cmg_efectivo"] == pytest.approx(cmg)
    assert salida["al_promedio"] is None


def test_valorizar_diario_usa_el_cmg_del_dia_y_contrasta_con_el_promedio(servicio):
    barra = servicio.resolver_barra("TALARA 220")["barrcodi"]
    salida = servicio.valorizar(PERIODO, "dia", barra, [
        {"dia": 1, "entregas": 10.0, "retiros": 0.0},
        {"dia": 2, "entregas": 10.0, "retiros": 0.0},
    ])

    esperado = sum(10.0 * servicio.cmg(barra, PERIODO, d) * 1000.0 for d in (1, 2))
    assert salida["total"] == pytest.approx(esperado)
    assert salida["al_promedio"] == pytest.approx(20.0 * servicio.cmg(barra, PERIODO) * 1000.0)
    assert all(d["dia"] in (1, 2) for d in salida["detalle"])


def test_valorizar_declara_barras_no_reconocidas_y_dias_sin_cmg(servicio):
    salida = servicio.valorizar(PERIODO, "dia", None, [
        {"barra": "zzz inexistente", "dia": 1, "entregas": 1.0, "retiros": 0.0},
        {"barra": "TALARA 220", "dia": 31, "entregas": 1.0, "retiros": 0.0},  # junio tiene 30 dias
    ])

    assert salida["no_reconocidas"] == [{"fila": 1, "texto": "zzz inexistente", "motivo": "barra no reconocida"}]
    assert salida["sin_cmg"] == 1
    assert salida["detalle"][0]["monto"] is None
    assert salida["total"] == 0.0


def test_el_signo_sigue_al_portal_entregar_mas_es_cobrar(servicio):
    cobra = servicio.valorizar(PERIODO, "mes", None, [{"barra": "CHILCA 500", "entregas": 10, "retiros": 0}])
    paga = servicio.valorizar(PERIODO, "mes", None, [{"barra": "CHILCA 500", "entregas": 0, "retiros": 10}])

    assert cobra["total"] > 0
    assert paga["total"] == pytest.approx(-cobra["total"])


# --- base de la empresa ------------------------------------------------------

def test_base_trae_energia_liquidado_mecanismos_y_cuota(servicio, empresa_con_energia):
    totales = servicio.datos["revisiones_totales"]
    del_mes = totales[totales["pericodi"] == PERIODO]
    empresa = del_mes["emprcodi"].iloc[0]

    base = servicio.base(empresa, PERIODO)

    assert base["perinombre"] == "2026.Junio"
    assert base["dias_del_mes"] == 30
    assert base["cmg_sistema"] > 0
    assert set(base["liquidado"]) == {"LVTA", "LVTP", "LSCIO", "SST-SCT"}
    assert set(base["sistema"]) == set(base["cuota"])

    # El liquidado es la ultima revision conocida de cada proceso.
    for proceso, ficha in base["liquidado"].items():
        if ficha is None:
            continue
        propias = del_mes[(del_mes["emprcodi"] == empresa) & (del_mes["proceso"] == proceso)]
        ultima = propias.sort_values("revision").iloc[-1]
        assert ficha["monto"] == pytest.approx(float(ultima["monto_total"]))
        assert ficha["revision"] == int(ultima["revision"])

    # Los mecanismos de cada proceso suman su monto liquidado.
    for proceso, mecanismos in base["mecanismos"].items():
        if base["liquidado"][proceso] is None or not mecanismos:
            continue
        assert sum(mecanismos.values()) == pytest.approx(base["liquidado"][proceso]["monto"], rel=1e-6)


def test_la_cuota_es_una_participacion_acotada(servicio):
    cuotas = servicio.cuota("EMPRESA_021")
    for ficha in cuotas.values():
        if ficha is None:
            continue
        assert -1.0 <= ficha["minimo"] <= ficha["mediana"] <= ficha["maximo"] <= 1.0
        assert ficha["meses"] >= 1


# --- endpoints ---------------------------------------------------------------

def test_endpoint_base_por_ruc_y_404_para_desconocida(cliente):
    respuesta = cliente.get(f"/simulador/base/EMPRESA_021/{PERIODO}")
    assert respuesta.status_code == 200
    assert respuesta.json()["empresa_id"] == "EMPRESA_021"

    assert cliente.get(f"/simulador/base/EMPRESA_999/{PERIODO}").status_code == 404


def test_endpoint_valorizar_rechaza_pedidos_vacios(cliente):
    respuesta = cliente.post("/simulador/valorizar", json={"pericodi": PERIODO, "filas": []})
    assert respuesta.status_code == 422

    respuesta = cliente.post("/simulador/valorizar", json={
        "pericodi": PERIODO, "granularidad": "mes",
        "filas": [{"barra": "TALARA 220", "entregas": 1, "retiros": 0}],
    })
    assert respuesta.status_code == 200
    assert respuesta.json()["total"] > 0


def test_endpoint_barras_del_simulador_lista_las_que_tienen_precio(cliente):
    respuesta = cliente.get(f"/simulador/barras/{PERIODO}")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["barras"]
    assert all("cmg_promedio" in b for b in cuerpo["barras"])


# --- Red y precios: energia por barra ------------------------------------------

def test_barras_del_mapa_traen_energia_y_la_filtran_por_empresa(cliente, empresa_con_energia):
    sistema = cliente.get(f"/red/barras/{PERIODO}").json()

    assert sistema["entregas"] > 0
    assert sistema["retiros"] > 0
    assert {"entregas", "retiros"} <= set(sistema["barras"][0])
    assert sistema["entregas"] == pytest.approx(sum(b["entregas"] for b in sistema["barras"]))

    empresa = cliente.get(f"/red/barras/{PERIODO}?empresa_id=EMPRESA_021").json()
    assert empresa["empresa_id"] == "EMPRESA_021"
    assert 0 < empresa["entregas"] <= sistema["entregas"]
    assert 0 < empresa["retiros"] <= sistema["retiros"]

    # El precio es del sistema: no cambia con la empresa.
    assert empresa["barras"][0]["cmg_promedio"] == sistema["barras"][0]["cmg_promedio"]


def test_energia_diaria_de_una_barra_suma_lo_del_mes(cliente):
    barras = cliente.get(f"/red/barras/{PERIODO}").json()["barras"]
    con_energia = next(b for b in barras if b["entregas"] > 0)

    serie = cliente.get(f"/red/energia/{con_energia['barrcodi']}/{PERIODO}").json()["dias"]

    assert sum(d["entregas"] for d in serie) == pytest.approx(con_energia["entregas"])
    assert all(1 <= d["dia"] <= 31 for d in serie)
