"""Adjudica identidad real (RUC y razon social) a los codigos del kit.

No es una re-identificacion: no hay clave comun entre el welcome kit y el
padron real, asi que el alias de fantasia no guarda relacion con ninguna
empresa. Lo que hace esta regla es ADJUDICAR una identidad del padron a
cada codigo con liquidacion, de forma determinista.

Consecuencia, dicha sin rodeos: las cifras del portal son simuladas y
pasan a mostrarse bajo nombres de empresas que existen. Ese hecho se
documenta en la seccion "Calidad y trazabilidad" del portal, que es lo
unico capaz de desmentir una lectura falsa de una pantalla suelta.

Regla (spec 2026-09-15-portal-analitico-design, 3.2):

- Solo reciben identidad los codigos con alguna liquidacion en
  fact_evolucion. Los demas conservan solo su alias.
- Codigos ordenados por empresa_id, padron ordenado por RUC, emparejados
  por posicion. Misma entrada, misma salida.
- Un RUC no se asigna nunca a dos codigos.

Ejecutable como script para reescribir dim_empresa.parquet sobre la capa
curada ya versionada, sin necesitar el welcome kit en data/raw/:

    python -m scripts.identidad_empresa
"""

from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
PADRON = BASE_DIR / "data" / "padron_empresas.csv"
CURATED = BASE_DIR / "data" / "curated"


def leer_padron() -> pd.DataFrame:
    """El padron real, extraido con `python -m scripts.extraer_padron`."""
    if not PADRON.exists():
        raise FileNotFoundError(
            f"Falta {PADRON}. Generalo con: python -m scripts.extraer_padron"
        )

    padron = pd.read_csv(PADRON, dtype={"ruc": str})

    return padron.sort_values("ruc").reset_index(drop=True)


def asignar_identidad(
    empresas: pd.DataFrame,
    con_liquidacion: set[str],
    padron: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Devuelve empresa_id, alias, ruc y razon_social.

    `empresas` trae empresa_id y alias. Los codigos sin liquidacion salen
    con ruc y razon_social vacios (pd.NA), no con una identidad inventada.
    """
    if padron is None:
        padron = leer_padron()

    empresas = empresas.sort_values("empresa_id").reset_index(drop=True)

    elegibles = [
        codigo
        for codigo in empresas["empresa_id"]
        if codigo in con_liquidacion
    ]

    if len(elegibles) > len(padron):
        raise ValueError(
            f"{len(elegibles)} codigos con liquidacion y solo "
            f"{len(padron)} empresas en el padron."
        )

    # Emparejamiento por posicion: el i-esimo codigo con liquidacion recibe
    # la i-esima empresa del padron ordenado por RUC. Al recorrer ambas
    # listas en paralelo, ningun RUC se repite.
    asignacion = {
        codigo: (fila["ruc"], fila["razon_social"])
        for codigo, fila in zip(
            elegibles, padron.to_dict(orient="records"), strict=False
        )
    }

    empresas = empresas.copy()
    empresas["ruc"] = empresas["empresa_id"].map(
        lambda codigo: asignacion.get(codigo, (pd.NA, pd.NA))[0]
    )
    empresas["razon_social"] = empresas["empresa_id"].map(
        lambda codigo: asignacion.get(codigo, (pd.NA, pd.NA))[1]
    )

    return empresas[["empresa_id", "alias", "ruc", "razon_social"]]


def main() -> None:
    """Reescribe dim_empresa.parquet a partir de la capa curada."""
    destino = CURATED / "dim_empresa.parquet"

    empresas = pd.read_parquet(destino)[["empresa_id", "alias"]]
    evolucion = pd.read_parquet(
        CURATED / "fact_evolucion.parquet", columns=["empresa_deudora"]
    )

    con_liquidacion = set(evolucion["empresa_deudora"].unique())

    resultado = asignar_identidad(empresas, con_liquidacion)
    resultado.to_parquet(destino, index=False, compression="snappy")

    identificadas = int(resultado["ruc"].notna().sum())

    print(
        f"  dim_empresa  {len(resultado)} codigos, "
        f"{identificadas} con identidad real"
    )


if __name__ == "__main__":
    main()
