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
    "Energía",
    "Hidroeléctrica",
    "Termoeléctrica",
    "Eólica",
]

SUFIJOS_ALIAS = [
    "Andina", "del Norte", "del Sur", "Pacífico", "Amazonas",
    "Central", "Altiplano", "Costa Verde", "Marañón", "Urubamba",
    "Cordillera", "del Oriente", "Pampas", "Titicaca", "Vilcanota",
    "Chira", "Santa", "Mantaro", "Rímac",
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


def a_float(serie: pd.Series) -> pd.Series:
    """El kit entrega los montos como texto. Aqui pasan a float64."""
    return pd.to_numeric(serie, errors="coerce").astype("float64")


def construir_fact_evolucion() -> pd.DataFrame:
    evolucion = pd.DataFrame(
        leer_json("liquidaciones/evolucion_mensual_extendido.json")
    )
    evolucion["monto"] = a_float(evolucion["monto"])

    return evolucion


def construir_fact_bilateral() -> pd.DataFrame:
    bilateral = pd.DataFrame(
        leer_json("liquidaciones/cruce_bilateral_extendido.json")
    )
    bilateral["monto"] = a_float(bilateral["monto"])

    return bilateral


def construir_fact_desglose() -> pd.DataFrame:
    """Unifica los tres desgloses por valorizacion en una sola tabla.

    LSCIO desglosa por 'mecanismo' en vez de 'valorizacion'; se renombra
    para que las tres fuentes compartan esquema.
    """
    fuentes = [
        (
            "LVTP",
            "reportes_intermedios/potencia/"
            "desglose_por_valorizacion_extendido.json",
            "valorizacion",
        ),
        (
            "SST-SCT",
            "reportes_intermedios/sstsct/"
            "desglose_por_valorizacion_extendido.json",
            "valorizacion",
        ),
        (
            "LSCIO",
            "reportes_intermedios/lscio/"
            "desglose_por_mecanismo_extendido.json",
            "mecanismo",
        ),
    ]

    partes = []

    for proceso, ruta, columna_valorizacion in fuentes:
        parte = pd.DataFrame(leer_json(ruta))
        parte = parte.rename(
            columns={columna_valorizacion: "valorizacion"}
        )
        parte["proceso"] = proceso
        partes.append(parte)

    desglose = pd.concat(partes, ignore_index=True)
    desglose["monto"] = a_float(desglose["monto"])

    return desglose


# clave de salida -> ruta en el kit crudo, columna de monto a convertir
TABLAS_SOPORTE = {
    "energia_transferencias": (
        "reportes_intermedios/energia_activa/"
        "transferencias_por_empresa_extendido.json",
        "vtotemtotal",
    ),
    "energia_saldos": (
        "reportes_intermedios/energia_activa/saldos_extendido.json",
        "saldo_total",
    ),
    "lscio_transferencias": (
        "reportes_intermedios/lscio/"
        "transferencias_por_empresa_extendido.json",
        "monto_total",
    ),
    "lscio_desglose": (
        "reportes_intermedios/lscio/"
        "desglose_por_mecanismo_extendido.json",
        "monto",
    ),
    "lscio_saldos": (
        "reportes_intermedios/lscio/saldos_extendido.json",
        "saldo_total",
    ),
    "potencia_desglose": (
        "reportes_intermedios/potencia/"
        "desglose_por_valorizacion_extendido.json",
        "monto",
    ),
    "potencia_saldos": (
        "reportes_intermedios/potencia/saldos_extendido.json",
        "saldo_total",
    ),
    "sstsct_desglose": (
        "reportes_intermedios/sstsct/"
        "desglose_por_valorizacion_extendido.json",
        "monto",
    ),
    "costos_marginales_diario": (
        "reportes_intermedios/costos_marginales/"
        "historico_diario_extendido.json",
        "promedio",
    ),
    "entregas": (
        "reportes_intermedios/entregas_retiros/"
        "entregas_historico_diario_extendido.json",
        "valor",
    ),
    "retiros": (
        "reportes_intermedios/entregas_retiros/"
        "retiros_historico_diario_extendido.json",
        "valor",
    ),
    "puntos_entrega": (
        "reportes_intermedios/entregas_retiros/puntos_entrega.json",
        None,
    ),
}


def construir_soporte(clave: str) -> pd.DataFrame:
    """Copia una tabla del kit convirtiendo su columna de monto a float."""
    ruta, columna_monto = TABLAS_SOPORTE[clave]

    tabla = pd.DataFrame(leer_json(ruta))

    if columna_monto and columna_monto in tabla.columns:
        tabla[columna_monto] = a_float(tabla[columna_monto])

    return tabla


def construir_fact_revisiones() -> pd.DataFrame:
    """Detalle del historial R0-R4 por proceso, empresa, periodo y valorizacion.

    Ojo: 'monto' es el monto restatado completo del mes, no el ajuste.
    Sumar montos de varias revisiones del mismo periodo es doble
    contabilidad. El ajuste es la diferencia contra la revision anterior.
    """
    revisiones = pd.DataFrame(
        leer_json("revisiones/revisiones_por_valorizacion.json")
    )
    revisiones["monto"] = a_float(revisiones["monto"])

    # emprruc es el RUC anonimizado del kit; no aporta y no debe viajar.
    return revisiones.drop(columns=["emprruc"], errors="ignore")


def construir_fact_revisiones_totales() -> pd.DataFrame:
    """Rollup del historial por proceso, empresa, periodo y revision."""
    totales = pd.DataFrame(leer_json("revisiones/revisiones_totales.json"))
    totales["monto_total"] = a_float(totales["monto_total"])

    return totales


def construir_fact_calendario() -> pd.DataFrame:
    """Aplana el calendario: una fila por (proceso, periodo, revision).

    El JSON trae una lista anidada 'revisiones' por cada par
    proceso-periodo; aqui se explota a filas.
    """
    crudo = leer_json("revisiones/calendario_publicaciones.json")

    filas = []

    for entrada in crudo:
        for revision in entrada["revisiones"]:
            filas.append(
                {
                    "proceso": entrada["proceso"],
                    "pericodi": entrada["pericodi"],
                    "perianiomes": entrada["perianiomes"],
                    "revision": revision["revision"],
                    "revision_nombre": revision["revision_nombre"],
                    "publicacion_pericodi": revision["publicacion_pericodi"],
                    "publicacion_perianiomes": revision[
                        "publicacion_perianiomes"
                    ],
                }
            )

    return pd.DataFrame(filas)


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

    print("Construyendo hechos de liquidacion...")
    escribir(construir_fact_evolucion(), "fact_evolucion")
    escribir(construir_fact_bilateral(), "fact_bilateral")
    escribir(construir_fact_desglose(), "fact_desglose")

    print("Construyendo tablas de soporte...")
    for clave in TABLAS_SOPORTE:
        escribir(construir_soporte(clave), clave)

    print("Construyendo revisiones...")
    escribir(construir_fact_revisiones(), "fact_revisiones")
    escribir(construir_fact_revisiones_totales(), "fact_revisiones_totales")
    escribir(construir_fact_calendario(), "fact_calendario")


if __name__ == "__main__":
    main()
