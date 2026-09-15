"""Fija el contrato de los endpoints que el frontend consume hoy.

El frontend (frontend/src/App.jsx) solo llama a cuatro familias:
/periodos, /empresas, /radar/{pericodi} y /agente/*. Estos tests deben
seguir pasando después de cada tarea de limpieza del plan.
"""

PERIODO_DEMO = 138
EMPRESA_DEMO = "EMPRESA_001"


def test_health_responde(cliente):
    respuesta = cliente.get("/health")
    assert respuesta.status_code == 200


def test_periodos_devuelve_lista_con_pericodi(cliente):
    respuesta = cliente.get("/periodos")
    assert respuesta.status_code == 200

    periodos = respuesta.json()["periodos"]
    assert len(periodos) > 0
    assert "pericodi" in periodos[0]
    assert "perinombre" in periodos[0]


def test_empresas_devuelve_lista_con_empresa_id(cliente):
    respuesta = cliente.get("/empresas")
    assert respuesta.status_code == 200

    empresas = respuesta.json()["empresas"]
    assert len(empresas) > 0
    assert "empresa_id" in empresas[0]


def test_radar_de_un_periodo_valido(cliente):
    respuesta = cliente.get(f"/radar/{PERIODO_DEMO}")
    assert respuesta.status_code == 200

    cuerpo = respuesta.json()
    campos_requeridos = [
        "fecha", "periodo", "estado", "version_vigente",
        "total_agentes", "total_alertas", "agentes_analizados", "alertas"
    ]
    for campo in campos_requeridos:
        assert campo in cuerpo, (
            f"faltó campo '{campo}' en /radar/{PERIODO_DEMO}; "
            f"claves presentes: {list(cuerpo.keys())}"
        )

    assert isinstance(cuerpo["agentes_analizados"], list), (
        f"'agentes_analizados' debe ser lista, no {type(cuerpo['agentes_analizados']).__name__}"
    )
    assert isinstance(cuerpo["alertas"], list), (
        f"'alertas' debe ser lista, no {type(cuerpo['alertas']).__name__}"
    )


def test_radar_de_un_periodo_inexistente_es_404(cliente):
    respuesta = cliente.get("/radar/99999")
    assert respuesta.status_code == 404


def test_agente_resumen(cliente):
    respuesta = cliente.get(
        f"/agente/resumen/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200

    cuerpo = respuesta.json()
    assert "impulsores" in cuerpo, (
        f"faltó 'impulsores' en /agente/resumen; claves: {list(cuerpo.keys())}"
    )

    impulsores = cuerpo["impulsores"]
    assert isinstance(impulsores, dict), (
        f"'impulsores' debe ser dict, no {type(impulsores).__name__}"
    )
    assert "movimientos" in impulsores, (
        f"faltó 'movimientos' en impulsores; claves: {list(impulsores.keys())}"
    )
    assert isinstance(impulsores["movimientos"], list), (
        f"'movimientos' debe ser lista, no {type(impulsores['movimientos']).__name__}"
    )


def test_agente_explicacion(cliente):
    respuesta = cliente.get(
        f"/agente/explicacion/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200

    cuerpo = respuesta.json()
    assert isinstance(cuerpo, dict), (
        f"respuesta debe ser dict, no {type(cuerpo).__name__}"
    )
    assert len(cuerpo) > 0, (
        f"respuesta no puede estar vacía"
    )


def test_agente_contexto(cliente):
    respuesta = cliente.get(
        f"/agente/contexto/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200

    cuerpo = respuesta.json()
    assert isinstance(cuerpo, dict), (
        f"respuesta debe ser dict, no {type(cuerpo).__name__}"
    )
    assert len(cuerpo) > 0, (
        f"respuesta no puede estar vacía"
    )
