"""Proyecta el detalle de pagos y cobros de los meses que no lo traen.

El cruce bilateral (deudora -> acreedora, por proceso y valorizacion) solo
llega para los doce meses de 2025 y para julio 2026. Sin el, la seccion
Procesos queda vacia en enero-junio y agosto 2026 aunque la evolucion
mensual si tenga el total de cada empresa. Peticion del usuario
(2026-09-16): proyectar todo lo faltante.

Regla:

- Julio 2026 (el unico mes publicado con detalle) es la plantilla de
  ESTRUCTURA: quien le paga a quien, en que proceso y valorizacion.
- Para cada mes faltante, los pagos de una empresa se escalan por su
  propia actividad: |total del mes en la evolucion| / |total de julio|,
  proceso por proceso, acotado a [0.25, 4] para que una empresa sin
  actividad en julio no produzca ceros ni infinitos. Si no hay base, se
  usa el factor del sistema para ese proceso.
- Una variacion determinista de +-8 % por fila (semilla fija por mes)
  evita que los meses sean copias exactas.
- Solo se proyectan pagos de empresas que tienen liquidacion en el mes
  segun la evolucion; el resto no aparece.
- Las filas salen con origen "sintetico", el mismo valor con el que el
  portal marca los periodos proyectados, y se documentan en Calidad.

Escribe dos cosas: data/cruce_bilateral_proyectado.csv (carpeta data/
del repositorio, para que la proyeccion sea visible) y las mismas filas
anexadas a backend/data/curated/fact_bilateral.parquet, que es lo que la
API lee. Es idempotente: antes de anexar quita cualquier proyeccion
anterior.

    python -m scripts.proyectar_bilateral
"""

from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
CURATED = BASE_DIR / "data" / "curated"
DESTINO_CSV = BASE_DIR.parent / "data" / "cruce_bilateral_proyectado.csv"

SEED = 20260916
JITTER = 0.08
FACTOR_MIN, FACTOR_MAX = 0.25, 4.0
ORIGEN_PROYECTADO = "sintetico"


def _periodo_plantilla(bilateral: pd.DataFrame) -> int:
    """El ultimo mes publicado con detalle (hoy, julio 2026)."""
    reales = bilateral.loc[bilateral["origen"] == "real", "pericodi"]

    if reales.empty:
        raise ValueError("No hay ningun mes publicado en el cruce bilateral.")

    return int(reales.max())


def proyectar(
    bilateral: pd.DataFrame,
    evolucion: pd.DataFrame,
    periodos: pd.DataFrame,
) -> pd.DataFrame:
    """Devuelve solo las filas proyectadas (sin las existentes)."""
    plantilla_id = _periodo_plantilla(bilateral)
    plantilla = bilateral[bilateral["pericodi"] == plantilla_id]

    con_dato = set(int(p) for p in bilateral["pericodi"].unique())
    faltantes = [
        int(p) for p in periodos["pericodi"] if int(p) not in con_dato
    ]

    # Actividad por empresa, mes y proceso, y la del mes plantilla.
    actividad = (
        evolucion.groupby(["empresa_deudora", "pericodi", "proceso"])["monto"]
        .sum()
        .abs()
    )
    sistema = evolucion.groupby(["pericodi", "proceso"])["monto"].sum().abs()

    salida = []

    for pericodi in faltantes:
        fila_periodo = periodos[periodos["pericodi"] == pericodi].iloc[0]
        empresas_del_mes = set(
            evolucion.loc[evolucion["pericodi"] == pericodi, "empresa_deudora"]
        )

        mes = plantilla[plantilla["empresa_deudora"].isin(empresas_del_mes)].copy()

        if mes.empty:
            continue

        def factor(fila):
            clave = (fila["empresa_deudora"], pericodi, fila["proceso"])
            base = (fila["empresa_deudora"], plantilla_id, fila["proceso"])

            if clave in actividad.index and base in actividad.index and actividad[base] > 0:
                return float(np.clip(actividad[clave] / actividad[base], FACTOR_MIN, FACTOR_MAX))

            sis, sis_base = (pericodi, fila["proceso"]), (plantilla_id, fila["proceso"])
            if sis in sistema.index and sis_base in sistema.index and sistema[sis_base] > 0:
                return float(np.clip(sistema[sis] / sistema[sis_base], FACTOR_MIN, FACTOR_MAX))

            return 1.0

        factores = mes.apply(factor, axis=1).to_numpy()
        ruido = np.random.RandomState(SEED + pericodi).uniform(
            1 - JITTER, 1 + JITTER, size=len(mes)
        )

        mes["monto"] = (mes["monto"].to_numpy() * factores * ruido).round(6)
        mes["pericodi"] = pericodi
        mes["perinombre"] = fila_periodo["perinombre"]
        mes["perianiomes"] = fila_periodo["perianiomes"]
        mes["periodo_preliminar"] = bool(fila_periodo.get("estado") == "Abierto")
        mes["origen"] = ORIGEN_PROYECTADO

        salida.append(mes)

    if not salida:
        return plantilla.iloc[0:0]

    return pd.concat(salida, ignore_index=True)[list(bilateral.columns)]


def main() -> None:
    ruta_bilateral = CURATED / "fact_bilateral.parquet"

    bilateral = pd.read_parquet(ruta_bilateral)
    evolucion = pd.read_parquet(CURATED / "fact_evolucion.parquet")
    periodos = pd.read_parquet(CURATED / "dim_periodo.parquet")

    # Idempotente: se parte de lo que trae la fuente, sin proyecciones
    # anteriores. Las filas de la fuente son "real" o el "sintetico" del
    # kit; las nuestras se reconocen porque su periodo no existia antes.
    if DESTINO_CSV.exists():
        previas = pd.read_csv(DESTINO_CSV, usecols=["pericodi"])
        bilateral = bilateral[~bilateral["pericodi"].isin(previas["pericodi"].unique())]

    proyectadas = proyectar(bilateral, evolucion, periodos)

    DESTINO_CSV.parent.mkdir(parents=True, exist_ok=True)
    proyectadas.to_csv(DESTINO_CSV, index=False, encoding="utf-8")

    completo = pd.concat([bilateral, proyectadas], ignore_index=True)
    completo = completo.sort_values(["pericodi", "proceso", "empresa_deudora"]).reset_index(drop=True)
    completo.to_parquet(ruta_bilateral, index=False, compression="snappy")

    meses = sorted(int(p) for p in proyectadas["pericodi"].unique())
    print(
        f"  proyectadas {len(proyectadas):,} filas para {len(meses)} meses "
        f"{meses} -> {DESTINO_CSV.name}; fact_bilateral ahora {len(completo):,} filas"
    )


if __name__ == "__main__":
    main()
