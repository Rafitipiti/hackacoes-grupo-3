from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import catalogos, empresa, panorama, revisiones

app = FastAPI(
    title="COES Liquidaciones 360",
    description=(
        "API para consulta, analisis y trazabilidad "
        "de liquidaciones del mercado electrico peruano."
    ),
    version="1.0.0",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalogos.router)
app.include_router(panorama.router)
app.include_router(empresa.router)
app.include_router(revisiones.router)


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
