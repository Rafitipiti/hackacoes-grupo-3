from fastapi import APIRouter, HTTPException, Query

from app.data.identificadores import a_empresa_id
from app.data.loader import cargar_datos_coes
from app.services.red_service import RedService

router = APIRouter(prefix="/red", tags=["red"])

_servicio = RedService(cargar_datos_coes())


@router.get("/barras/{pericodi}")
def barras(
    pericodi: int,
    empresa_id: str | None = Query(default=None, description="Si se indica, la energía de cada barra es solo la de esa empresa."),
):
    """Barras con costo marginal en el periodo, con ubicacion estimada y energía entregada y retirada."""
    empresa_id = a_empresa_id(empresa_id)
    lista = _servicio.barras(pericodi, empresa_id)

    if not lista:
        raise HTTPException(
            status_code=404,
            detail=f"No hay costo marginal registrado para el periodo {pericodi}.",
        )

    return {
        "pericodi": pericodi,
        "empresa_id": empresa_id,
        "total": len(lista),
        "con_ubicacion": sum(1 for b in lista if b["ubicacion_estimada"]),
        "entregas": sum(b["entregas"] for b in lista),
        "retiros": sum(b["retiros"] for b in lista),
        "sin_precio": _servicio.energia_sin_precio(pericodi, empresa_id),
        "barras": lista,
    }


@router.get("/cmg/{barrcodi}/{pericodi}")
def cmg_diario(barrcodi: int, pericodi: int):
    """Curva diaria del costo marginal de una barra en un periodo."""
    serie = _servicio.cmg_diario(barrcodi, pericodi)

    if not serie:
        raise HTTPException(
            status_code=404,
            detail=(
                f"La barra {barrcodi} no tiene costo marginal en el periodo "
                f"{pericodi}."
            ),
        )

    return {
        "barrcodi": barrcodi,
        "pericodi": pericodi,
        "periodos_disponibles": _servicio.periodos_con_dato(barrcodi),
        "dias": serie,
    }


@router.get("/energia/{barrcodi}/{pericodi}")
def energia_diaria(barrcodi: int, pericodi: int, empresa_id: str | None = Query(default=None)):
    """Entregas y retiros por día de una barra en un periodo (MWh)."""
    empresa_id = a_empresa_id(empresa_id)
    serie = _servicio.energia_diaria(barrcodi, pericodi, empresa_id)

    if not serie:
        raise HTTPException(
            status_code=404,
            detail=f"La barra {barrcodi} no registra energía en el periodo {pericodi} para la selección.",
        )

    return {"barrcodi": barrcodi, "pericodi": pericodi, "empresa_id": empresa_id, "dias": serie}
