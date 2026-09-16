from fastapi import APIRouter, HTTPException

from app.data.loader import cargar_datos_coes
from app.services.red_service import RedService

router = APIRouter(prefix="/red", tags=["red"])

_servicio = RedService(cargar_datos_coes())


@router.get("/barras/{pericodi}")
def barras(pericodi: int):
    """Barras con costo marginal en el periodo, con ubicacion estimada."""
    lista = _servicio.barras(pericodi)

    if not lista:
        raise HTTPException(
            status_code=404,
            detail=f"No hay costo marginal registrado para el periodo {pericodi}.",
        )

    return {
        "pericodi": pericodi,
        "total": len(lista),
        "con_ubicacion": sum(1 for b in lista if b["ubicacion_estimada"]),
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
