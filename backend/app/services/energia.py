"""Energía física por barra, día y empresa: entregas y retiros.

Las dos tablas crudas son grandes (retiros supera las 400 mil filas en
los 19 meses) y solo hace falta un mes a la vez. Se leen filtradas por
periodo, se llevan a un mismo esquema y se dejan en caché por mes:
Red y precios (mapa por capas) y el Simulador (energía de arranque de
una empresa) las comparten.

Atribución a empresa:
- una ENTREGA se registra por punto de entrega; `puntos_entrega` dice a
  que barra y a que empresa pertenece cada punto.
- un RETIRO ya trae la barra y el generador que lo respalda; la empresa
  responsable es ese generador.
"""

from functools import lru_cache

import pandas as pd

from app.data.loader import cargar_datos_coes, cargar_tabla_filtrada

COLUMNAS = ["barrcodi", "emprcodi", "dia", "entregas", "retiros"]


@lru_cache(maxsize=24)
def energia_por_dia(pericodi: int) -> pd.DataFrame:
    """Entregas y retiros (MWh) por barra, empresa y día de un mes."""
    puntos = cargar_datos_coes()["puntos_entrega"][["codentcodi", "barrcodi", "emprcodi"]]

    entregas = cargar_tabla_filtrada("entregas", [pericodi])
    entregas = (
        entregas.merge(puntos, on="codentcodi", how="inner")
        .groupby(["barrcodi", "emprcodi", "dia"])["valor"]
        .sum()
        .rename("entregas")
        .reset_index()
    )

    retiros = cargar_tabla_filtrada("retiros", [pericodi])
    retiros = (
        retiros.rename(columns={"generador_id": "emprcodi"})
        .groupby(["barrcodi", "emprcodi", "dia"])["valor"]
        .sum()
        .rename("retiros")
        .reset_index()
    )

    tabla = entregas.merge(retiros, on=["barrcodi", "emprcodi", "dia"], how="outer")
    tabla[["entregas", "retiros"]] = tabla[["entregas", "retiros"]].fillna(0.0)

    return tabla[COLUMNAS].sort_values(["barrcodi", "emprcodi", "dia"]).reset_index(drop=True)


def energia_mes(pericodi: int, empresa_id: str | None = None) -> pd.DataFrame:
    """Total del mes por barra (columnas barrcodi, entregas, retiros).

    Con `empresa_id` solo cuenta la energía de esa empresa; sin él, la de
    todo el sistema.
    """
    tabla = energia_por_dia(pericodi)

    if empresa_id is not None:
        tabla = tabla[tabla["emprcodi"] == empresa_id]

    return tabla.groupby("barrcodi")[["entregas", "retiros"]].sum().reset_index()


def energia_diaria_barra(barrcodi: int, pericodi: int, empresa_id: str | None = None) -> pd.DataFrame:
    """Serie diaria (dia, entregas, retiros) de una barra en un mes."""
    tabla = energia_por_dia(pericodi)
    tabla = tabla[tabla["barrcodi"] == barrcodi]

    if empresa_id is not None:
        tabla = tabla[tabla["emprcodi"] == empresa_id]

    return tabla.groupby("dia")[["entregas", "retiros"]].sum().reset_index()
