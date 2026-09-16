"""Procesos (pagos y cobros), Red y precios y Contactos (spec, seccion 9)."""

import pandas as pd
import pytest

from app.data.loader import cargar_datos_coes
from app.services.contactos_service import CAMPOS, ContactosService

PERIODO = 137


@pytest.fixture(scope="module")
def datos():
    return cargar_datos_coes()


# --- 9.1 Pagos y cobros ---------------------------------------------------

@pytest.fixture(scope="module")
def pagos(cliente, datos):
    # El cruce bilateral no cubre todos los meses de la evolucion: se toma
    # el ultimo que si tiene filas.
    bilateral = datos["cruce_bilateral"]
    periodo = int(bilateral["pericodi"].max())
    del_mes = bilateral[bilateral["pericodi"] == periodo]
    empresa = del_mes["empresa_deudora"].iloc[0]

    respuesta = cliente.get(f"/empresa/pagos-cobros/{empresa}/{periodo}")

    assert respuesta.status_code == 200

    return respuesta.json(), del_mes, empresa


def test_pagos_son_lo_que_la_empresa_debe_y_cobros_lo_que_le_deben(pagos):
    cuerpo, del_mes, empresa = pagos

    esperado_pagos = del_mes.loc[del_mes["empresa_deudora"] == empresa, "monto"].sum()
    esperado_cobros = del_mes.loc[del_mes["empresa_acreedora"] == empresa, "monto"].sum()

    assert cuerpo["total_pagos"] == pytest.approx(esperado_pagos)
    assert cuerpo["total_cobros"] == pytest.approx(esperado_cobros)
    assert cuerpo["neto"] == pytest.approx(esperado_cobros - esperado_pagos)


def test_los_procesos_suman_los_totales(pagos):
    cuerpo, _, _ = pagos

    assert sum(p["pagos"] for p in cuerpo["procesos"]) == pytest.approx(cuerpo["total_pagos"])
    assert sum(p["cobros"] for p in cuerpo["procesos"]) == pytest.approx(cuerpo["total_cobros"])


def test_las_contrapartes_llevan_identidad_y_suman_el_proceso(pagos):
    cuerpo, _, _ = pagos

    for proceso in cuerpo["procesos"]:
        assert sum(c["monto"] for c in proceso["contrapartes_pago"]) == pytest.approx(proceso["pagos"])
        assert sum(c["monto"] for c in proceso["contrapartes_cobro"]) == pytest.approx(proceso["cobros"])

        for contraparte in proceso["contrapartes_pago"] + proceso["contrapartes_cobro"]:
            assert contraparte["empresa_id"]
            assert "razon_social" in contraparte


def test_el_detalle_cubre_los_veinte_meses(datos):
    """Los meses que la fuente no trae se proyectan (proyectar_bilateral).

    Sin esto, Procesos quedaba vacio en enero-junio y agosto 2026 para
    todas las empresas.
    """
    bilateral = datos["cruce_bilateral"]
    periodos = datos["periodos"]

    assert set(int(p) for p in bilateral["pericodi"]) == set(int(p) for p in periodos["pericodi"])

    proyectados = bilateral[bilateral["pericodi"].isin([132, 137, 139])]
    assert (proyectados["origen"] == "sintetico").all()


def test_un_mes_sin_cruce_devuelve_la_ficha_vacia_con_los_meses_que_si(cliente, datos):
    """Si algun mes quedara sin detalle, la pantalla ofrece los que si lo tienen."""
    bilateral = datos["cruce_bilateral"]
    empresa = bilateral["empresa_deudora"].iloc[0]
    sin_dato = 999999

    respuesta = cliente.get(f"/empresa/pagos-cobros/{empresa}/{sin_dato}")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["procesos"] == []
    assert cuerpo["periodos_disponibles"]
    assert sin_dato not in cuerpo["periodos_disponibles"]


def test_sin_transferencias_devuelve_404(cliente):
    assert cliente.get("/empresa/pagos-cobros/EMPRESA_999/1").status_code == 404


# --- 9.2 Red y precios ----------------------------------------------------

@pytest.fixture(scope="module")
def barras(cliente):
    respuesta = cliente.get(f"/red/barras/{PERIODO}")

    assert respuesta.status_code == 200

    return respuesta.json()


def test_salen_las_barras_con_costo_marginal_en_el_mes(barras, datos):
    costos = datos["costos_marginales_diario"]
    esperadas = set(costos.loc[costos["pericodi"] == PERIODO, "barrcodi"])

    assert {b["barrcodi"] for b in barras["barras"]} == {int(x) for x in esperadas}
    assert barras["total"] == len(esperadas)


def test_toda_barra_tiene_coordenada_dentro_del_peru(barras):
    for b in barras["barras"]:
        assert -18.6 <= b["lat"] <= 0.2, b
        assert -81.6 <= b["lon"] <= -68.4, b


def test_declara_cuantas_ubicaciones_son_estimadas_y_cuantas_nominales(barras):
    estimadas = sum(1 for b in barras["barras"] if b["ubicacion_estimada"])

    assert barras["con_ubicacion"] == estimadas
    assert 0 < estimadas <= barras["total"]


def test_el_promedio_del_mes_es_el_promedio_de_los_dias(barras, datos):
    costos = datos["costos_marginales_diario"]
    primera = barras["barras"][0]

    dias = costos[
        (costos["pericodi"] == PERIODO) & (costos["barrcodi"] == primera["barrcodi"])
    ]

    assert primera["cmg_promedio"] == pytest.approx(dias["promedio"].mean())
    assert primera["dias"] == dias["dia"].nunique()


def test_la_curva_diaria_viene_ordenada_y_lista_los_periodos_con_dato(cliente, barras):
    barra = barras["barras"][0]["barrcodi"]

    respuesta = cliente.get(f"/red/cmg/{barra}/{PERIODO}")

    assert respuesta.status_code == 200

    cuerpo = respuesta.json()
    dias = [d["dia"] for d in cuerpo["dias"]]

    assert dias == sorted(dias)
    assert PERIODO in cuerpo["periodos_disponibles"]


def test_barra_sin_dato_en_el_periodo_devuelve_404(cliente):
    assert cliente.get("/red/cmg/1/999999").status_code == 404


# --- 9.3 Contactos --------------------------------------------------------

@pytest.fixture
def servicio(tmp_path):
    return ContactosService(tmp_path / "contactos.xlsx")


FICHA = {
    "razon_social": "EMPRESA DE PRUEBA S.A.",
    "ruc": "20123456789",
    "banco": "Banco de prueba",
    "tipo_cuenta": "Corriente",
    "moneda": "PEN",
    "numero_cuenta": "000-000",
    "cci": "00000000000000000000",
    "correos": "tesoreria@prueba.pe; pagos@prueba.pe",
    "telefonos": "01 000 0000",
    "notas": "Ficha de demostracion.",
}


def test_guardar_crea_el_libro_con_una_fila_por_empresa(servicio):
    servicio.guardar("EMPRESA_001", FICHA)
    servicio.guardar("EMPRESA_002", {**FICHA, "razon_social": "OTRA S.A."})
    servicio.guardar("EMPRESA_001", {**FICHA, "banco": "Cambiado"})

    libro = pd.read_excel(servicio.ruta, sheet_name="contactos", dtype=str)

    assert list(libro.columns) == CAMPOS
    assert list(libro["empresa_id"]) == ["EMPRESA_001", "EMPRESA_002"]
    assert libro.loc[libro["empresa_id"] == "EMPRESA_001", "banco"].iloc[0] == "Cambiado"


def test_obtener_devuelve_lo_guardado_y_none_si_no_hay(servicio):
    assert servicio.obtener("EMPRESA_001") is None

    servicio.guardar("EMPRESA_001", FICHA)
    ficha = servicio.obtener("EMPRESA_001")

    assert ficha["cci"] == FICHA["cci"]
    assert ficha["actualizado"]


def test_los_campos_vacios_se_guardan_vacios_no_como_texto(servicio):
    servicio.guardar("EMPRESA_001", {**FICHA, "notas": ""})

    assert servicio.obtener("EMPRESA_001")["notas"] is None


def test_eliminar_quita_la_fila(servicio):
    servicio.guardar("EMPRESA_001", FICHA)

    assert servicio.eliminar("EMPRESA_001") is True
    assert servicio.eliminar("EMPRESA_001") is False
    assert servicio.obtener("EMPRESA_001") is None


def test_la_api_rechaza_moneda_y_tipo_de_cuenta_desconocidos(cliente):
    r1 = cliente.put("/contactos/EMPRESA_PRUEBA", json={**FICHA, "moneda": "EUR"})
    r2 = cliente.put("/contactos/EMPRESA_PRUEBA", json={**FICHA, "tipo_cuenta": "Otra"})

    assert r1.status_code == 422
    assert r2.status_code == 422
