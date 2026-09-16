from fastapi import APIRouter, HTTPException, Query

from app.data.loader import cargar_datos_coes
from app.data.identificadores import a_empresa_id
from app.services.publicacion_service import PublicacionService

router = APIRouter(prefix="/publicacion", tags=["publicacion"])

_servicio = PublicacionService(cargar_datos_coes())


@router.get("/{publicacion}")
def contenido(
    publicacion: int,
    empresa_id: str | None = Query(default=None, description="Si se indica, solo esa empresa; si no, todo el sector."),
):
    """Liquidaciones y recalculos que salen en la publicacion de un mes, por proceso."""
    empresa_id = a_empresa_id(empresa_id)
    cuerpo = _servicio.contenido(publicacion, empresa_id)

    if not any(b["items"] for b in cuerpo["procesos"]):
        raise HTTPException(
            status_code=404,
            detail=f"La publicacion {publicacion} no contiene liquidaciones para la seleccion.",
        )

    return cuerpo


@router.get("/{publicacion}/detalle/{proceso}/{pericodi}/{revision}")
def detalle(
    publicacion: int,
    proceso: str,
    pericodi: int,
    revision: int,
    empresa_id: str | None = Query(default=None),
):
    """Que provoco la variacion de una tarjeta, componente por componente."""
    empresa_id = a_empresa_id(empresa_id)
    cuerpo = _servicio.detalle(publicacion, proceso, pericodi, revision, empresa_id)

    if cuerpo is None:
        raise HTTPException(
            status_code=404,
            detail=f"{proceso} {pericodi} R{revision} no sale en la publicacion {publicacion}.",
        )

    return cuerpo
