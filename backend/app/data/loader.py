"""Carga la capa parquet curada.

Los datos crudos del welcome kit viven en data/raw/ (fuera de git) y se
convierten con `python -m scripts.preparar_datos`. El backend nunca lee
JSON crudo: solo parquet.
"""

from functools import lru_cache
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
CURATED = BASE_DIR / "data" / "curated"

# clave en memoria -> nombre del parquet.
#
# Las claves del primer bloque las leen AgentService e IntegrityService por
# nombre; renombrarlas obliga a reescribir ambos servicios.
TABLAS = {
    # contrato existente
    "periodos": "dim_periodo",
    "empresas": "dim_empresa",
    "evolucion_liquidaciones": "fact_evolucion",
    "energia_transferencias": "energia_transferencias",
    "energia_saldos": "energia_saldos",
    "lscio_transferencias": "lscio_transferencias",
    "lscio_desglose": "lscio_desglose",
    "lscio_saldos": "lscio_saldos",
    "potencia_desglose": "potencia_desglose",
    "potencia_saldos": "potencia_saldos",
    "sstsct_desglose": "sstsct_desglose",
    "costos_marginales_diario": "costos_marginales_diario",
    "entregas": "entregas",
    "retiros": "retiros",
    "puntos_entrega": "puntos_entrega",
    # nuevas de esta fase
    "barras": "dim_barra",
    "cruce_bilateral": "fact_bilateral",
    "desglose": "fact_desglose",
    "revisiones": "fact_revisiones",
    "revisiones_totales": "fact_revisiones_totales",
    "calendario": "fact_calendario",
    "cmg_diario": "agg_cmg_diario",
    "perfil_intradia": "agg_perfil_intradia",
    "energia_diaria": "agg_energia_diaria",
}


def cargar_tabla(nombre: str) -> pd.DataFrame:
    ruta = CURATED / f"{nombre}.parquet"

    if not ruta.exists():
        raise FileNotFoundError(
            f"Falta {ruta}. Genera la capa curada con: "
            f"python -m scripts.preparar_datos"
        )

    return pd.read_parquet(ruta)


@lru_cache(maxsize=1)
def cargar_datos_coes() -> dict[str, pd.DataFrame]:
    """Carga la capa curada una sola vez por proceso.

    AgentService llama a esta funcion en su __init__ y cada router la
    llama al importarse. Sin el cache, los mismos datos se cargarian
    cuatro veces y no cabrian en los 512 MB del free tier.
    """
    return {
        clave: cargar_tabla(nombre)
        for clave, nombre in TABLAS.items()
    }
