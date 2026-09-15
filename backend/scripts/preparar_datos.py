"""Convierte el welcome kit COES (JSON) en una capa parquet curada.

Determinista: misma entrada, misma salida. Ejecutar desde backend/:

    python -m scripts.preparar_datos
"""

import json
import random
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
RAW = BASE_DIR / "data" / "raw"
CURATED = BASE_DIR / "data" / "curated"

SEED = 20260915

# El alias es un nombre de fantasia, no una re-identificacion. La regla 8.2
# del kit prohibe re-identificar; la clave tecnica sigue siendo EMPRESA_00X
# y el RUC real nunca entra al backend.
PREFIJOS_ALIAS = [
    "Generadora",
    "Distribuidora",
    "Transmisora",
    "Comercializadora",
    "Energia",
    "Hidroelectrica",
    "Termoelectrica",
    "Eolica",
]

SUFIJOS_ALIAS = [
    "Andina", "del Norte", "del Sur", "Pacifico", "Amazonas",
    "Central", "Altiplano", "Costa Verde", "Maranon", "Urubamba",
    "Cordillera", "del Oriente", "Pampas", "Titicaca", "Vilcanota",
    "Chira", "Santa", "Mantaro", "Rimac",
]


def leer_json(ruta_relativa: str) -> list[dict]:
    """Lee un JSON del kit crudo. Todos son arreglos de objetos planos."""
    ruta = RAW / ruta_relativa

    if not ruta.exists():
        raise FileNotFoundError(f"No se encontro {ruta}")

    with open(ruta, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


def _generar_alias(cantidad: int) -> list[str]:
    """Genera alias unicos y estables, barajados con semilla fija."""
    combinaciones = [
        f"{prefijo} {sufijo}"
        for prefijo in PREFIJOS_ALIAS
        for sufijo in SUFIJOS_ALIAS
    ]

    if cantidad > len(combinaciones):
        raise ValueError(
            f"Se necesitan {cantidad} alias y solo hay "
            f"{len(combinaciones)} combinaciones."
        )

    combinaciones.sort()
    random.Random(SEED).shuffle(combinaciones)

    return combinaciones[:cantidad]


def construir_dim_empresa() -> pd.DataFrame:
    empresas = pd.DataFrame(leer_json("_catalogos_comunes/empresas.json"))
    empresas = empresas.sort_values("empresa_id").reset_index(drop=True)

    empresas["alias"] = _generar_alias(len(empresas))

    return empresas[["empresa_id", "alias"]]


def construir_dim_periodo() -> pd.DataFrame:
    periodos = pd.DataFrame(
        leer_json("_catalogos_comunes/periodos_extendido.json")
    )

    return periodos.sort_values("pericodi").reset_index(drop=True)


def construir_dim_barra() -> pd.DataFrame:
    barras = pd.DataFrame(leer_json("_catalogos_comunes/barras.json"))

    return barras.sort_values("barrcodi").reset_index(drop=True)


def escribir(tabla: pd.DataFrame, nombre: str) -> None:
    CURATED.mkdir(parents=True, exist_ok=True)
    destino = CURATED / f"{nombre}.parquet"

    tabla.to_parquet(destino, index=False, compression="snappy")

    print(f"  {nombre:<28} {len(tabla):>9,} filas")


def main() -> None:
    print("Construyendo dimensiones...")
    escribir(construir_dim_empresa(), "dim_empresa")
    escribir(construir_dim_periodo(), "dim_periodo")
    escribir(construir_dim_barra(), "dim_barra")


if __name__ == "__main__":
    main()
