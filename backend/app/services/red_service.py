"""Red y precios: barras del SEIN y costo marginal (spec portal-analitico, 9.2).

Las coordenadas vienen de data/coordenadas_barras.csv, que genera
`python -m scripts.estimar_coordenadas`. Son una estimacion por nombre
de barra, no una georreferencia oficial: la columna `metodo` lo dice
barra por barra y el portal lo declara en Calidad.
"""

from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
COORDENADAS = BASE_DIR.parent / "data" / "coordenadas_barras.csv"


class RedService:

    def __init__(self, datos):
        self.costos = datos["costos_marginales_diario"]
        self.periodos = datos["periodos"]
        self._coordenadas = None

    @property
    def coordenadas(self) -> pd.DataFrame:
        if self._coordenadas is None:
            if not COORDENADAS.exists():
                raise FileNotFoundError(
                    f"Falta {COORDENADAS}. Generalo con: "
                    f"python -m scripts.estimar_coordenadas"
                )
            self._coordenadas = pd.read_csv(COORDENADAS)
        return self._coordenadas

    def barras(self, pericodi: int) -> list[dict]:
        """Las barras con costo marginal en el periodo, con su ubicacion.

        Solo salen las que tienen dato en el mes: una barra sin costo
        marginal no puede pintarse por precio ni abrir una curva.
        """
        del_mes = self.costos[self.costos["pericodi"] == pericodi]

        if del_mes.empty:
            return []

        promedio = (
            del_mes.groupby("barrcodi")
            .agg(
                cmg_promedio=("promedio", "mean"),
                cmg_maximo=("promedio", "max"),
                cmg_minimo=("promedio", "min"),
                dias=("dia", "nunique"),
                origen=("origen", "first"),
            )
            .reset_index()
        )

        tabla = promedio.merge(self.coordenadas, on="barrcodi", how="left")

        # Una barra con costo pero sin fila de coordenadas (no deberia
        # pasar: el CSV sale de dim_barra) se marca nominal para no caerse.
        tabla["metodo"] = tabla["metodo"].fillna("nominal")
        tabla["lat"] = tabla["lat"].fillna(-12.0)
        tabla["lon"] = tabla["lon"].fillna(-75.0)

        tabla = tabla.sort_values("barrnombre")

        # dim_barra trae la tension como texto y a veces vacia; un NaN no
        # es JSON valido y tumba la respuesta entera.
        tabla["barrtension"] = tabla["barrtension"].astype(object).where(
            pd.notna(tabla["barrtension"]), None
        )

        return [
            {
                "barrcodi": int(f["barrcodi"]),
                "barrnombre": f["barrnombre"],
                "barrtension": f["barrtension"],
                "lat": round(float(f["lat"]), 4),
                "lon": round(float(f["lon"]), 4),
                "ubicacion_estimada": f["metodo"] != "nominal",
                "cmg_promedio": float(f["cmg_promedio"]),
                "cmg_maximo": float(f["cmg_maximo"]),
                "cmg_minimo": float(f["cmg_minimo"]),
                "dias": int(f["dias"]),
                "origen": f["origen"],
            }
            for f in tabla.to_dict(orient="records")
        ]

    def cmg_diario(self, barrcodi: int, pericodi: int) -> list[dict]:
        """Curva diaria del costo marginal de una barra en un periodo."""
        filas = self.costos[
            (self.costos["barrcodi"] == barrcodi)
            & (self.costos["pericodi"] == pericodi)
        ].sort_values("dia")

        return [
            {
                "dia": int(f["dia"]),
                "promedio": float(f["promedio"]),
                "revision": f["recanombre"],
                "origen": f["origen"],
            }
            for f in filas.to_dict(orient="records")
        ]

    def periodos_con_dato(self, barrcodi: int) -> list[int]:
        """En que periodos hay costo marginal para esta barra."""
        filas = self.costos[self.costos["barrcodi"] == barrcodi]

        return sorted(int(p) for p in filas["pericodi"].unique())
