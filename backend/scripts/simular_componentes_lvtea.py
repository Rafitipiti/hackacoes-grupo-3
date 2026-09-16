"""Desglosa la liquidacion de Energia Activa (LVTEA) en sus tres componentes.

La fuente trae Energia Activa como una sola fila por empresa, mes y
revision ("Transferencias de Energia Activa"). Para la publicacion mensual
(spec, seccion 11) hace falta el desglose que si tienen los demas procesos:
que parte es valorizacion de entregas, que parte valorizacion de retiros y
que parte ingreso tarifario y rentas por congestion. El usuario pidio
simularlo para la presentacion.

Regla, determinista (semilla fija por empresa y mes):

- Entregas y Retiros son las dos puntas de la energia: entregas suma,
  retiros resta. Su tamano relativo sale de un "factor de actividad" fijo
  por empresa y mes en [1.15, 2.6] veces el monto neto, de modo que una
  empresa netamente compradora tenga retiros grandes y entregas chicas, y
  al reves.
- Ingreso tarifario y rentas por congestion es una fraccion pequena del
  bruto, en [-4 %, +6 %].
- Los tres componentes SUMAN EXACTAMENTE el monto de la fila original en
  cada revision: la ultima componente cierra la diferencia, asi que el
  total del proceso no cambia en ninguna cadena R0..Rn.
- Entre revisiones del mismo mes la particion se mueve poco (+-3 % en
  cada cuota) para que el detalle de un recalculo tenga algo que explicar.

Escribe data/componentes_lvtea.csv (carpeta data/ del repositorio).

    python -m scripts.simular_componentes_lvtea
"""

from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
CURATED = BASE_DIR / "data" / "curated"
DESTINO = BASE_DIR.parent / "data" / "componentes_lvtea.csv"

SEED = 20260916

COMPONENTES = [
    "Valorización de Entregas",
    "Valorización de Retiros",
    "Ingreso Tarifario y Rentas por Congestión",
]


def _semilla(empresa: str, pericodi: int) -> int:
    return (SEED + int(empresa.split("_")[-1]) * 1_000 + int(pericodi)) % (2**31 - 1)


def simular(revisiones: pd.DataFrame) -> pd.DataFrame:
    lvta = revisiones[revisiones["proceso"] == "LVTA"].copy()

    filas = []

    for (empresa, pericodi), grupo in lvta.groupby(["emprcodi", "pericodi"]):
        rng = np.random.RandomState(_semilla(empresa, pericodi))
        actividad = rng.uniform(1.15, 2.6)          # bruto / |neto|
        cuota_it = rng.uniform(-0.04, 0.06)          # ingreso tarifario sobre el bruto

        for fila in grupo.sort_values("revision").to_dict(orient="records"):
            neto = float(fila["monto"])
            bruto = abs(neto) * actividad

            # Pequeno movimiento por revision, distinto para cada una.
            jitter = rng.uniform(-0.03, 0.03, size=2)
            ingreso = bruto * (cuota_it + jitter[0] * 0.5)

            # Entregas y retiros se reparten el resto respetando el signo del
            # neto: si la empresa cobra, entregas > retiros; si paga, al reves.
            resto = neto - ingreso
            mayor = (bruto + abs(resto)) / 2 * (1 + jitter[1])
            menor = mayor - abs(resto)

            if resto >= 0:
                entregas, retiros = mayor, -menor
            else:
                entregas, retiros = menor, -mayor

            # La ultima componente cierra para que la suma sea exacta.
            ingreso = neto - entregas - retiros

            for etiqueta, monto in zip(COMPONENTES, (entregas, retiros, ingreso)):
                filas.append({
                    "proceso": "LVTA",
                    "emprcodi": empresa,
                    "pericodi": int(pericodi),
                    "revision": int(fila["revision"]),
                    "publicacion_pericodi": int(fila["publicacion_pericodi"]),
                    "componente": etiqueta,
                    "monto": round(float(monto), 6),
                    "origen": fila["origen"],
                })

    return pd.DataFrame(filas)


def main() -> None:
    revisiones = pd.read_parquet(CURATED / "fact_revisiones.parquet")
    tabla = simular(revisiones)

    # Verificacion: cada (empresa, mes, revision) suma el monto original.
    control = tabla.groupby(["emprcodi", "pericodi", "revision"])["monto"].sum()
    original = (
        revisiones[revisiones["proceso"] == "LVTA"]
        .groupby(["emprcodi", "pericodi", "revision"])["monto"].sum()
    )
    diferencia = (control - original.reindex(control.index)).abs().max()
    if diferencia > 1e-3:
        raise ValueError(f"Las componentes no cuadran con el total: {diferencia}")

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    tabla.to_csv(DESTINO, index=False, encoding="utf-8")

    print(f"  {len(tabla):,} filas -> {DESTINO.name} (cuadra al centavo)")


if __name__ == "__main__":
    main()
