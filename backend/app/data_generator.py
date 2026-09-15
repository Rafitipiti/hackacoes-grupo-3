import random
from pathlib import Path

import pandas as pd
import numpy as np


# =========================================================
# CONFIGURACIÓN
# =========================================================

SEED = 42

random.seed(SEED)
np.random.seed(SEED)


BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_FILE = BASE_DIR / "liquidaciones.csv"


# =========================================================
# DATOS MAESTROS
# =========================================================

AGENTES = [
    {
        "id": "AGE001",
        "nombre": "Generadora Andina",
        "tipo": "Generador"
    },
    {
        "id": "AGE002",
        "nombre": "Energía del Pacífico",
        "tipo": "Generador"
    },
    {
        "id": "AGE003",
        "nombre": "Comercializadora Nacional",
        "tipo": "Comercializador"
    },
    {
        "id": "AGE004",
        "nombre": "Empresa Eléctrica Norte",
        "tipo": "Generador"
    },
    {
        "id": "AGE005",
        "nombre": "Distribuidora Centro",
        "tipo": "Distribuidor"
    }
]


CONCEPTOS = [
    {
        "id": "CON001",
        "nombre": "Energía",
        "categoria": "Energía"
    },
    {
        "id": "CON002",
        "nombre": "Potencia",
        "categoria": "Potencia"
    },
    {
        "id": "CON003",
        "nombre": "Peajes",
        "categoria": "Transmisión"
    },
    {
        "id": "CON004",
        "nombre": "Servicios Complementarios",
        "categoria": "Servicios"
    },
    {
        "id": "CON005",
        "nombre": "Otros Conceptos",
        "categoria": "Otros"
    }
]


# =========================================================
# GENERAR DATOS
# =========================================================

def generar_liquidaciones():

    registros = []

    periodos = pd.date_range(
        start="2025-01-01",
        end="2026-08-01",
        freq="MS"
    )

    for periodo in periodos:

        for agente in AGENTES:

            for concepto in CONCEPTOS:

                # -----------------------------------------
                # MONTOS BASE
                # -----------------------------------------

                if concepto["nombre"] == "Energía":
                    base = random.uniform(
                        800000,
                        2500000
                    )

                elif concepto["nombre"] == "Potencia":
                    base = random.uniform(
                        300000,
                        1000000
                    )

                elif concepto["nombre"] == "Peajes":
                    base = random.uniform(
                        100000,
                        500000
                    )

                elif concepto["nombre"] == "Servicios Complementarios":
                    base = random.uniform(
                        50000,
                        250000
                    )

                else:
                    base = random.uniform(
                        20000,
                        150000
                    )

                # -----------------------------------------
                # VARIACIÓN NORMAL
                # -----------------------------------------

                variacion = np.random.normal(
                    1,
                    0.05
                )

                monto = base * variacion

                # -----------------------------------------
                # ANOMALÍAS CONTROLADAS
                # -----------------------------------------

                # CASO 1
                # Generadora Andina
                # Energía
                # Agosto 2026
                #
                # Incremento deliberado

                if (
                    agente["id"] == "AGE001"
                    and concepto["id"] == "CON001"
                    and periodo == pd.Timestamp("2026-08-01")
                ):

                    monto = 2500000

                # CASO 2
                # Energía del Pacífico
                # Potencia
                # Agosto 2026
                #
                # Incremento significativo

                if (
                    agente["id"] == "AGE002"
                    and concepto["id"] == "CON002"
                    and periodo == pd.Timestamp("2026-08-01")
                ):

                    monto = 1100000

                # CASO 3
                # Empresa Eléctrica Norte
                # Peajes
                # Agosto 2026
                #
                # Reducción importante

                if (
                    agente["id"] == "AGE004"
                    and concepto["id"] == "CON003"
                    and periodo == pd.Timestamp("2026-08-01")
                ):

                    monto = 50000

                # -----------------------------------------
                # VARIABLES OPERATIVAS
                # -----------------------------------------

                energia_mwh = random.uniform(
                    5000,
                    50000
                )

                potencia_mw = random.uniform(
                    50,
                    500
                )

                precio_mwh = random.uniform(
                    80,
                    250
                )

                # -----------------------------------------
                # REGISTRO
                # -----------------------------------------

                registros.append({

                    "fecha": periodo.date(),

                    "agente_id": agente["id"],
                    "agente": agente["nombre"],
                    "tipo_agente": agente["tipo"],

                    "concepto_id": concepto["id"],
                    "concepto": concepto["nombre"],
                    "categoria": concepto["categoria"],

                    "monto": round(
                        monto,
                        2
                    ),

                    "energia_mwh": round(
                        energia_mwh,
                        2
                    ),

                    "potencia_mw": round(
                        potencia_mw,
                        2
                    ),

                    "precio_mwh": round(
                        precio_mwh,
                        2
                    ),

                    "fuente": "COES - Dataset Sintético",

                    "documento_fuente": (
                        f"LIQ-"
                        f"{periodo.strftime('%Y%m')}-"
                        f"{agente['id']}-"
                        f"{concepto['id']}"
                    )
                })

    return pd.DataFrame(registros)


# =========================================================
# EJECUTAR
# =========================================================

if __name__ == "__main__":

    df = generar_liquidaciones()

    print("\n==========================================")
    print(" COES LIQUIDACIONES 360")
    print(" GENERADOR DE DATOS SINTÉTICOS")
    print("==========================================")

    print(
        f"\nRegistros generados: "
        f"{len(df):,}"
    )

    print("\nAnomalías controladas:")

    print(
        "\nAGE001 - Energía - Agosto 2026:"
    )

    print(
        df[
            (df["agente_id"] == "AGE001")
            & (df["concepto_id"] == "CON001")
            & (df["fecha"] == "2026-08-01")
        ][
            [
                "agente",
                "concepto",
                "fecha",
                "monto"
            ]
        ]
    )

    print(
        "\nAGE002 - Potencia - Agosto 2026:"
    )

    print(
        df[
            (df["agente_id"] == "AGE002")
            & (df["concepto_id"] == "CON002")
            & (df["fecha"] == "2026-08-01")
        ][
            [
                "agente",
                "concepto",
                "fecha",
                "monto"
            ]
        ]
    )

    print(
        "\nAGE004 - Peajes - Agosto 2026:"
    )

    print(
        df[
            (df["agente_id"] == "AGE004")
            & (df["concepto_id"] == "CON003")
            & (df["fecha"] == "2026-08-01")
        ][
            [
                "agente",
                "concepto",
                "fecha",
                "monto"
            ]
        ]
    )

    # -----------------------------------------
    # GUARDAR
    # -----------------------------------------

    df.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8-sig"
    )

    print(
        f"\nArchivo generado correctamente:"
    )

    print(OUTPUT_FILE)
