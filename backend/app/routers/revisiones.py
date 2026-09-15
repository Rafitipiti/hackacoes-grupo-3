from fastapi import APIRouter, HTTPException

from app.data.loader import cargar_datos_coes
from app.services.revision_service import RevisionService

router = APIRouter(prefix="/revisiones", tags=["revisiones"])

_servicio = RevisionService(cargar_datos_coes())


@router.get("/calendario/{publicacion_pericodi}")
def calendario(publicacion_pericodi: int):
    entradas = _servicio.calendario_de_publicacion(publicacion_pericodi)

    if not entradas:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No hay publicacion registrada para el periodo "
                f"{publicacion_pericodi}."
            ),
        )

    return {"publicacion_pericodi": publicacion_pericodi,
            "entradas": entradas}


@router.get("/cascada/{empresa_id}/{pericodi}")
def cascada(empresa_id: str, pericodi: int):
    por_proceso = _servicio.cascada(empresa_id, pericodi)

    if not por_proceso:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Sin historial de revisiones para {empresa_id} "
                f"en el periodo {pericodi}."
            ),
        )

    return {
        "empresa_id": empresa_id,
        "pericodi": pericodi,
        "procesos": por_proceso,
    }


@router.get("/impacto/{publicacion_pericodi}")
def impacto(publicacion_pericodi: int):
    return _servicio.impacto_de_publicacion(publicacion_pericodi)
