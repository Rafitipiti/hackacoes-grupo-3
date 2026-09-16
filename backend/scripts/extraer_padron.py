"""Extrae el padron de empresas reales del libro de liquidaciones simuladas.

Se ejecuta una sola vez (el resultado queda versionado en
backend/data/padron_empresas.csv). Necesita openpyxl, que NO esta en
requirements.txt: el backend en produccion no lee xlsx y no tiene por que
cargar con la dependencia.

    pip install openpyxl
    python -m scripts.extraer_padron

El libro trae cada liquidacion con su deudora (`ruc`, `razonSocial`) y su
contraparte (`rucContraparte`, `razonSocialContraparte`). El padron es la
union de ambos lados: 87 empresas del COES con RUC y razon social reales.
"""

from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
LIBRO = (
    BASE_DIR.parent
    / "data"
    / "simulado_liquidaciones_COES_2024-09_2026-08.xlsx"
)
DESTINO = BASE_DIR / "data" / "padron_empresas.csv"

COLUMNAS = ["ruc", "razonSocial", "rucContraparte", "razonSocialContraparte"]


def construir_padron() -> pd.DataFrame:
    libro = pd.read_excel(LIBRO, usecols=COLUMNAS)

    deudoras = libro[["ruc", "razonSocial"]].rename(
        columns={"razonSocial": "razon_social"}
    )
    contrapartes = libro[["rucContraparte", "razonSocialContraparte"]].rename(
        columns={
            "rucContraparte": "ruc",
            "razonSocialContraparte": "razon_social",
        }
    )

    padron = pd.concat([deudoras, contrapartes], ignore_index=True).dropna()

    # El RUC llega como numero; el cero inicial no existe en los RUC
    # peruanos (todos empiezan en 1 o 2), pero se guarda como texto porque
    # es un identificador, no una cantidad.
    padron["ruc"] = padron["ruc"].astype("int64").astype(str)
    padron["razon_social"] = padron["razon_social"].str.strip()

    # Una misma empresa puede aparecer con la razon social escrita de dos
    # formas. Manda la primera por orden alfabetico, para que el resultado
    # no dependa del orden de las filas del libro.
    padron = padron.sort_values(["ruc", "razon_social"])
    padron = padron.drop_duplicates(subset="ruc", keep="first")

    return padron.reset_index(drop=True)


def main() -> None:
    padron = construir_padron()
    padron.to_csv(DESTINO, index=False, encoding="utf-8")

    print(f"{len(padron)} empresas -> {DESTINO.relative_to(BASE_DIR.parent)}")


if __name__ == "__main__":
    main()
