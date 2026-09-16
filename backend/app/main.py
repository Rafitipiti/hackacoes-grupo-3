import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import catalogos, contactos, empresa, panorama, publicacion, red, revisiones

app = FastAPI(
    title="COES Liquidaciones 360",
    description=(
        "API para consulta, analisis y trazabilidad "
        "de liquidaciones del mercado electrico peruano."
    ),
    version="1.0.0",
)

ORIGENES_DEV = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def origenes_permitidos() -> list[str]:
    """Los origenes de produccion llegan por CORS_ORIGINS, separados por coma."""
    configurados = os.getenv("CORS_ORIGINS", "").strip()

    if not configurados:
        return ORIGENES_DEV

    return ORIGENES_DEV + [
        origen.strip()
        for origen in configurados.split(",")
        if origen.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes_permitidos(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalogos.router)
app.include_router(panorama.router)
app.include_router(empresa.router)
app.include_router(revisiones.router)
app.include_router(red.router)
app.include_router(contactos.router)
app.include_router(publicacion.router)


@app.get("/")
def raiz():
    return {
        "servicio": "COES Liquidaciones 360",
        "version": app.version,
        "documentacion": "/docs",
    }


@app.get("/health")
def health():
    return {"estado": "ok"}
