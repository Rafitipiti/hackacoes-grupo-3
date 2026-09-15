from fastapi import APIRouter

from app.data.loader import cargar_datos_coes

router = APIRouter(tags=["catalogos"])

_datos = cargar_datos_coes()


@router.get("/periodos")
def obtener_periodos():
    return {
        "periodos": _datos["periodos"].to_dict(orient="records")
    }


@router.get("/empresas")
def obtener_empresas():
    return {
        "empresas": _datos["empresas"].to_dict(orient="records")
    }
