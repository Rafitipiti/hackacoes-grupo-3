from fastapi import APIRouter, HTTPException
from app.data.identificadores import a_empresa_id
from pydantic import BaseModel, Field

from app.services.contactos_service import MONEDAS, TIPOS_CUENTA, crear_servicio

router = APIRouter(prefix="/contactos", tags=["contactos"])

_servicio = crear_servicio()


class Ficha(BaseModel):
    razon_social: str | None = Field(default=None, max_length=200)
    ruc: str | None = Field(default=None, max_length=11)
    banco: str | None = Field(default=None, max_length=80)
    tipo_cuenta: str | None = Field(default=None, max_length=30)
    moneda: str | None = Field(default=None, max_length=3)
    numero_cuenta: str | None = Field(default=None, max_length=40)
    cci: str | None = Field(default=None, max_length=20)
    correos: str | None = Field(default=None, max_length=300)
    telefonos: str | None = Field(default=None, max_length=120)
    notas: str | None = Field(default=None, max_length=1000)


@router.get("")
def listar():
    return {
        "almacen": _servicio.almacen,
        "monedas": MONEDAS,
        "tipos_cuenta": TIPOS_CUENTA,
        "fichas": _servicio.listar(),
    }


@router.get("/{empresa_id}")
def obtener(empresa_id: str):
    empresa_id = a_empresa_id(empresa_id)
    ficha = _servicio.obtener(empresa_id)

    if ficha is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay ficha de contacto para {empresa_id}.",
        )

    return ficha


@router.put("/{empresa_id}")
def guardar(empresa_id: str, ficha: Ficha):
    empresa_id = a_empresa_id(empresa_id)
    if ficha.moneda and ficha.moneda not in MONEDAS:
        raise HTTPException(status_code=422, detail=f"Moneda no valida: {ficha.moneda}.")

    if ficha.tipo_cuenta and ficha.tipo_cuenta not in TIPOS_CUENTA:
        raise HTTPException(
            status_code=422, detail=f"Tipo de cuenta no valido: {ficha.tipo_cuenta}."
        )

    return _servicio.guardar(empresa_id, ficha.model_dump())


@router.delete("/{empresa_id}")
def eliminar(empresa_id: str):
    empresa_id = a_empresa_id(empresa_id)
    if not _servicio.eliminar(empresa_id):
        raise HTTPException(
            status_code=404,
            detail=f"No hay ficha de contacto para {empresa_id}.",
        )

    return {"eliminada": empresa_id}
