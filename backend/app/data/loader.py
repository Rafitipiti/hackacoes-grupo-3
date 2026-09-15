"""Carga la capa parquet curada.

Los datos crudos del welcome kit viven en data/raw/ (fuera de git) y se
convierten con `python -m scripts.preparar_datos`. El backend nunca lee
JSON crudo: solo parquet.
"""

from collections.abc import Mapping
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


def cargar_tabla_filtrada(nombre: str, pericodis: list[int]) -> pd.DataFrame:
    """Lee solo las filas de los periodos pedidos.

    pyarrow empuja el filtro al archivo, asi que las filas de otros
    periodos nunca se materializan en memoria. Para las tablas
    grandes (retiros son 82 MB completos) la diferencia es enorme.
    """
    ruta = CURATED / f"{nombre}.parquet"

    if not ruta.exists():
        raise FileNotFoundError(
            f"Falta {ruta}. Genera la capa curada con: "
            f"python -m scripts.preparar_datos"
        )

    return pd.read_parquet(
        ruta, filters=[("pericodi", "in", pericodis)]
    )


class CapaCurada(Mapping):
    """Tablas de la capa curada, cargadas la primera vez que se piden.

    Las 24 tablas suman ~224 MB en memoria, pero un request tipico toca
    cinco o seis. Cargarlas todas al arrancar dejaba 66 MB de margen en
    el free tier de 512 MB de Render, insuficiente: /radar hace .copy()
    de una tabla de 18 MB por request.
    """

    def __init__(self, tablas):
        self._tablas = tablas
        self._cargadas = {}

    def __getitem__(self, clave):
        if clave not in self._cargadas:
            self._cargadas[clave] = cargar_tabla(self._tablas[clave])
        return self._cargadas[clave]

    def __iter__(self):
        return iter(self._tablas)

    def __len__(self):
        return len(self._tablas)


@lru_cache(maxsize=1)
def cargar_datos_coes() -> Mapping[str, pd.DataFrame]:
    """Devuelve la capa curada. Una sola instancia por proceso.

    AgentService la construye en su __init__ y cada router la pide al
    importarse; el cache evita cuatro copias en memoria.
    """
    return CapaCurada(TABLAS)
