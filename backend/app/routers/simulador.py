from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.data.identificadores import a_empresa_id
from app.data.loader import cargar_datos_coes
from app.services.simulador_service import SimuladorService

router = APIRouter(prefix="/simulador", tags=["simulador"])

_servicio = SimuladorService(cargar_datos_coes())


class FilaEnergia(BaseModel):
    barra: str | int | None = Field(default=None, description="Nombre o código de la barra; vacío usa la barra por defecto.")
    dia: int | None = Field(default=None, ge=1, le=31)
    entregas: float = 0.0
    retiros: float = 0.0


class PedidoValorizar(BaseModel):
    pericodi: int
    granularidad: str = Field(default="mes", pattern="^(mes|dia)$")
    barra_defecto: int | None = None
    filas: list[FilaEnergia] = Field(default_factory=list, max_length=5000)


@router.get("/base/{empresa_id}/{pericodi}")
def base(empresa_id: str, pericodi: int):
    """Punto de partida del simulador: energía, montos liquidados, mecanismos y cuota de la empresa."""
    empresa_id = a_empresa_id(empresa_id)
    cuerpo = _servicio.base(empresa_id, pericodi)

    if all(v is None for v in cuerpo["liquidado"].values()) and not cuerpo["energia"]["por_barra"]:
        raise HTTPException(
            status_code=404,
            detail=f"{empresa_id} no tiene liquidación ni energía registrada en el periodo {pericodi}.",
        )

    return cuerpo


@router.get("/barras/{pericodi}")
def barras(pericodi: int):
    """Barras con costo marginal publicado en el mes, para elegir la barra a valorizar."""
    lista = _servicio.barras_con_cmg(pericodi)

    if not lista:
        raise HTTPException(status_code=404, detail=f"No hay costo marginal publicado para el periodo {pericodi}.")

    return {"pericodi": pericodi, "cmg_sistema": _servicio.cmg_sistema(pericodi), "barras": lista}


@router.post("/valorizar")
def valorizar(pedido: PedidoValorizar):
    """Valoriza entregas y retiros con el costo marginal publicado de cada barra."""
    if not pedido.filas:
        raise HTTPException(status_code=422, detail="No hay filas que valorizar.")

    return _servicio.valorizar(
        pedido.pericodi,
        pedido.granularidad,
        pedido.barra_defecto,
        [f.model_dump() for f in pedido.filas],
    )
