"""El selector de empresa no debe ofrecer una eleccion sin salida.

57 de los 131 codigos del padron no tienen liquidacion en ningun periodo, y
muchos de los que si la tienen no la tienen en TODOS. Elegir uno de esos deja
la pantalla en un mensaje de error. Filtrar por periodo en el origen evita que
la interfaz ofrezca algo que no puede mostrar.
"""

from app.data.loader import cargar_datos_coes


def test_sin_periodo_devuelve_el_padron_completo(cliente):
    respuesta = cliente.get("/empresas")

    assert respuesta.status_code == 200

    empresas = respuesta.json()["empresas"]
    padron = cargar_datos_coes()["empresas"]

    assert len(empresas) == len(padron)


def test_con_periodo_solo_devuelve_empresas_con_liquidacion(cliente):
    datos = cargar_datos_coes()
    evolucion = datos["evolucion_liquidaciones"]

    pericodi = int(evolucion["pericodi"].max())

    esperadas = set(
        evolucion.loc[evolucion["pericodi"] == pericodi, "empresa_deudora"]
    )

    respuesta = cliente.get("/empresas", params={"pericodi": pericodi})

    assert respuesta.status_code == 200

    devueltas = {e["empresa_id"] for e in respuesta.json()["empresas"]}

    assert devueltas == esperadas


def test_el_filtro_recorta_de_verdad(cliente):
    """Si filtrar devolviera el padron entero, el filtro seria decorativo.

    Ya pasó una vez en este proyecto: un servidor sin --reload servia codigo
    viejo y el endpoint parecia funcionar devolviendo siempre las 131.
    """
    datos = cargar_datos_coes()
    pericodi = int(datos["evolucion_liquidaciones"]["pericodi"].max())

    total = len(cliente.get("/empresas").json()["empresas"])
    filtradas = len(
        cliente.get("/empresas", params={"pericodi": pericodi})
        .json()["empresas"]
    )

    assert filtradas < total


def test_un_periodo_inexistente_no_devuelve_empresas(cliente):
    respuesta = cliente.get("/empresas", params={"pericodi": 999999})

    assert respuesta.status_code == 200
    assert respuesta.json()["empresas"] == []
