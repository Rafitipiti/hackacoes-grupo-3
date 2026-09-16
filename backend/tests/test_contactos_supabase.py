"""Contactos en Supabase (spec, §12): la misma interfaz que el Excel, contra PostgREST.

No hay un proyecto Supabase en las pruebas: se simula PostgREST con un
transporte httpx en memoria que guarda las filas en un diccionario y
respeta los filtros y cabeceras que usa el servicio.
"""

import json

import httpx
import pytest

from app.services import contactos_service
from app.services.contactos_service import CAMPOS, ContactosExcel, ContactosSupabase, crear_servicio


class PostgrestFalso:
    """Lo justo de PostgREST para la tabla contactos."""

    def __init__(self):
        self.filas: dict[str, dict] = {}
        self.peticiones: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.peticiones.append(request)
        assert request.url.path == "/rest/v1/contactos"
        assert request.headers["apikey"] == "clave-secreta"
        assert request.headers["authorization"] == "Bearer clave-secreta"

        filtro = request.url.params.get("empresa_id")
        seleccion = list(self.filas.values())
        if filtro:
            assert filtro.startswith("eq.")
            seleccion = [f for f in seleccion if f["empresa_id"] == filtro[3:]]

        if request.method == "GET":
            return httpx.Response(200, json=sorted(seleccion, key=lambda f: f["empresa_id"]))

        if request.method == "POST":
            fila = json.loads(request.content)
            assert "merge-duplicates" in request.headers["prefer"]
            self.filas[fila["empresa_id"]] = fila
            return httpx.Response(201, json=[fila])

        if request.method == "DELETE":
            for f in seleccion:
                del self.filas[f["empresa_id"]]
            return httpx.Response(200, json=seleccion)

        return httpx.Response(405)


@pytest.fixture
def servidor():
    return PostgrestFalso()


@pytest.fixture
def servicio(servidor):
    return ContactosSupabase(
        "https://proyecto.supabase.co/", "clave-secreta", transporte=httpx.MockTransport(servidor)
    )


def test_guardar_hace_upsert_y_devuelve_la_ficha_completa(servicio, servidor):
    ficha = servicio.guardar("EMPRESA_001", {"banco": "BCP", "moneda": "PEN", "cci": "", "campo_raro": "x"})

    assert set(ficha) == set(CAMPOS)
    assert ficha["empresa_id"] == "EMPRESA_001"
    assert ficha["banco"] == "BCP"
    assert ficha["cci"] is None
    assert ficha["actualizado"]
    assert "campo_raro" not in servidor.filas["EMPRESA_001"]

    servicio.guardar("EMPRESA_001", {"banco": "BBVA"})
    assert len(servidor.filas) == 1
    assert servidor.filas["EMPRESA_001"]["banco"] == "BBVA"


def test_listar_obtener_y_eliminar(servicio):
    assert servicio.listar() == []
    assert servicio.obtener("EMPRESA_002") is None

    servicio.guardar("EMPRESA_002", {"razon_social": "Dos"})
    servicio.guardar("EMPRESA_001", {"razon_social": "Uno"})

    assert [f["empresa_id"] for f in servicio.listar()] == ["EMPRESA_001", "EMPRESA_002"]
    assert servicio.obtener("EMPRESA_002")["razon_social"] == "Dos"

    assert servicio.eliminar("EMPRESA_002") is True
    assert servicio.eliminar("EMPRESA_002") is False
    assert servicio.obtener("EMPRESA_002") is None


def test_un_error_de_supabase_no_pasa_en_silencio():
    def falla(request):
        return httpx.Response(500, json={"message": "caído"})

    servicio = ContactosSupabase("https://p.supabase.co", "clave-secreta", transporte=httpx.MockTransport(falla))

    with pytest.raises(httpx.HTTPStatusError):
        servicio.listar()


def test_crear_servicio_elige_segun_el_entorno(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert isinstance(crear_servicio(), ContactosExcel)
    assert crear_servicio().almacen == "excel"

    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "clave")
    assert isinstance(crear_servicio(), ContactosSupabase)
    assert crear_servicio().almacen == "supabase"


def test_el_router_declara_el_almacen(cliente):
    cuerpo = cliente.get("/contactos").json()
    assert cuerpo["almacen"] in ("excel", "supabase")
    assert cuerpo["almacen"] == contactos_service.crear_servicio().almacen
