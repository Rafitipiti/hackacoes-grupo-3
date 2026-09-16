import pandas as pd
from fastapi import APIRouter, Query

from app.data.loader import cargar_datos_coes

router = APIRouter(tags=["catalogos"])

_datos = cargar_datos_coes()


@router.get("/periodos")
def obtener_periodos():
    return {
        "periodos": _datos["periodos"].to_dict(orient="records")
    }


@router.get("/empresas")
def obtener_empresas(
    pericodi: int | None = Query(
        default=None,
        description=(
            "Si se indica, devuelve solo las empresas con liquidacion en ese "
            "periodo. Sin el, devuelve el padron completo."
        ),
    ),
):
    empresas = _datos["empresas"]

    if pericodi is not None:
        # Mismo criterio que usa AgentService para decidir si hay resumen:
        # si la empresa no aparece en evolucion para ese periodo, la pantalla
        # sale vacia. Filtrar aqui evita ofrecer una seleccion sin salida.
        evolucion = _datos["evolucion_liquidaciones"]

        con_datos = evolucion.loc[
            evolucion["pericodi"] == pericodi, "empresa_deudora"
        ].unique()

        empresas = empresas[empresas["empresa_id"].isin(con_datos)]

    return {
        "empresas": _sin_nulos_de_pandas(empresas)
    }


def _sin_nulos_de_pandas(tabla: pd.DataFrame) -> list[dict]:
    """Convierte los NA de pandas en None.

    Los 57 codigos sin liquidacion no tienen ruc ni razon social. Un NaN
    de pandas se serializa como el literal `NaN`, que no es JSON valido y
    que `JSON.parse` del navegador rechaza: la respuesta entera se cae por
    las empresas que nadie iba a mirar.
    """
    return tabla.astype(object).where(pd.notna(tabla), None).to_dict(
        orient="records"
    )
