"""Resolucion del identificador de empresa que llega por la API.

Los usuarios conocen a su empresa por el RUC, no por el codigo tecnico
del kit (EMPRESA_001). Todas las rutas con empresa aceptan ambos: un RUC
de once digitos se traduce al codigo interno, con el que trabajan los
servicios; un codigo interno pasa tal cual. Un RUC que no esta en el
padron es un 404, no una empresa vacia.
"""

import re

from fastapi import HTTPException

from app.data.loader import cargar_datos_coes

_RUC = re.compile(r"^\d{11}$")


def a_empresa_id(identificador: str | None) -> str | None:
    if identificador is None:
        return None

    valor = str(identificador).strip()

    if not _RUC.match(valor):
        return valor

    empresas = cargar_datos_coes()["empresas"]
    fila = empresas[empresas["ruc"] == valor]

    if fila.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No hay empresa con RUC {valor} en el padron.",
        )

    return str(fila["empresa_id"].iloc[0])
