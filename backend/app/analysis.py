import pandas as pd
import numpy as np
from pathlib import Path


# =========================================================
# CONFIGURACIÓN
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "liquidaciones.csv"


# =========================================================
# CARGAR DATOS
# =========================================================

def cargar_datos():

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    df["fecha"] = pd.to_datetime(df["fecha"])

    return df


# =========================================================
# LIQUIDACIÓN TOTAL
# =========================================================

def obtener_liquidacion(
    agente_id: str,
    fecha: str
):

    df = cargar_datos()

    fecha = pd.to_datetime(fecha)

    resultado = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha)
    ]

    if resultado.empty:
        return None

    total = resultado["monto"].sum()

    return {
        "agente_id": agente_id,
        "fecha": fecha.strftime("%Y-%m-%d"),
        "liquidacion_total": round(float(total), 2),
        "cantidad_conceptos": int(len(resultado))
    }


# =========================================================
# DETALLE POR CONCEPTO
# =========================================================

def obtener_detalle_conceptos(
    agente_id: str,
    fecha: str
):

    df = cargar_datos()

    fecha = pd.to_datetime(fecha)

    resultado = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha)
    ]

    if resultado.empty:
        return []

    detalle = (
        resultado
        .groupby(
            [
                "concepto_id",
                "concepto",
                "categoria",
                "fuente",
                "documento_fuente"
            ],
            as_index=False
        )
        .agg(
            monto=("monto", "sum"),
            energia_mwh=("energia_mwh", "sum"),
            potencia_mw=("potencia_mw", "sum"),
            precio_mwh=("precio_mwh", "mean")
        )
    )

    detalle["monto"] = detalle["monto"].round(2)

    detalle["energia_mwh"] = detalle["energia_mwh"].round(2)
    detalle["potencia_mw"] = detalle["potencia_mw"].round(2)
    detalle["precio_mwh"] = detalle["precio_mwh"].round(2)

    return detalle.to_dict(orient="records")

# =========================================================
# COMPARACIÓN DE PERIODOS
# =========================================================


def comparar_periodos(
    agente_id: str,
    fecha_actual: str,
    fecha_anterior: str
):

    actual = obtener_liquidacion(
        agente_id,
        fecha_actual
    )

    anterior = obtener_liquidacion(
        agente_id,
        fecha_anterior
    )

    if actual is None or anterior is None:
        return None

    monto_actual = actual["liquidacion_total"]
    monto_anterior = anterior["liquidacion_total"]

    variacion_absoluta = (
        monto_actual - monto_anterior
    )

    if monto_anterior != 0:

        variacion_porcentual = (
            variacion_absoluta
            / monto_anterior
        ) * 100

    else:
        variacion_porcentual = 0

    return {

        "agente_id": agente_id,

        "periodo_anterior": fecha_anterior,
        "periodo_actual": fecha_actual,

        "monto_anterior": round(
            monto_anterior,
            2
        ),

        "monto_actual": round(
            monto_actual,
            2
        ),

        "variacion_absoluta": round(
            variacion_absoluta,
            2
        ),

        "variacion_porcentual": round(
            variacion_porcentual,
            2
        )
    }

# =========================================================
# ANÁLISIS DE PERIODO AÑO ANTERIOR
# =========================================================


def comparar_mismo_periodo_anterior(
    agente_id,
    fecha_actual
):

    fecha_actual = pd.to_datetime(fecha_actual)

    fecha_anio_anterior = fecha_actual.replace(
        year=fecha_actual.year - 1
    )

    df = cargar_datos()

    actual = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha_actual)
    ]

    anterior = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha_anio_anterior)
    ]

    if actual.empty or anterior.empty:
        return None

    monto_actual = actual["monto"].sum()
    monto_anterior = anterior["monto"].sum()

    variacion_absoluta = (
        monto_actual - monto_anterior
    )

    if monto_anterior != 0:

        variacion_porcentual = (
            variacion_absoluta
            / abs(monto_anterior)
        ) * 100

    else:
        variacion_porcentual = 0

    return {
        "fecha_actual": fecha_actual.strftime("%Y-%m-%d"),
        "fecha_comparacion": fecha_anio_anterior.strftime("%Y-%m-%d"),
        "monto_actual": round(monto_actual, 2),
        "monto_anterior": round(monto_anterior, 2),
        "variacion_absoluta": round(
            variacion_absoluta,
            2
        ),
        "variacion_porcentual": round(
            variacion_porcentual,
            2
        )
    }


def analizar_comportamiento_historico(
    agente_id,
    fecha_actual,
    meses_historicos=6
):

    fecha_actual = pd.to_datetime(fecha_actual)

    df = cargar_datos()

    # Filtrar únicamente el agente
    datos_agente = df[
        df["agente_id"] == agente_id
    ].copy()

    # Agrupar liquidación total por mes
    historico = (
        datos_agente
        .groupby("fecha", as_index=False)
        .agg(
            monto=("monto", "sum")
        )
        .sort_values("fecha")
    )

    # Periodos anteriores al periodo actual
    historico_anterior = historico[
        historico["fecha"] < fecha_actual
    ].tail(meses_historicos)

    if historico_anterior.empty:
        return None

    # Liquidación del periodo actual
    actual = historico[
        historico["fecha"] == fecha_actual
    ]

    if actual.empty:
        return None

    monto_actual = actual.iloc[0]["monto"]

    promedio_historico = (
        historico_anterior["monto"].mean()
    )

    desviacion_estandar = (
        historico_anterior["monto"].std()
    )

    desviacion_absoluta = (
        monto_actual - promedio_historico
    )

    if promedio_historico != 0:

        desviacion_porcentual = (
            desviacion_absoluta
            / abs(promedio_historico)
        ) * 100

        if desviacion_estandar != 0:
            z_score = (
                monto_actual - promedio_historico
            ) / desviacion_estandar
        else:
            z_score = 0

        z_score_abs = abs(z_score)

        if z_score_abs < 1:

            clasificacion_historica = "NORMAL"

        elif z_score_abs < 2:

            clasificacion_historica = "MODERADO"

        elif z_score_abs < 3:

            clasificacion_historica = "RELEVANTE"

        else:

            clasificacion_historica = "EXCEPCIONAL"

        if z_score > 0:
            direccion_historica = "por encima"

        elif z_score < 0:
            direccion_historica = "por debajo"
        else:
            direccion_historica = "en línea con"

        if clasificacion_historica == "NORMAL":

            interpretacion_historica = (
                f"La liquidación actual se encuentra dentro "
                f"del comportamiento habitual del agente. "
                f"El resultado está {direccion_historica} del "
                f"promedio histórico, con una desviación de "
                f"{abs(z_score):.2f} desviaciones estándar."
            )

        elif clasificacion_historica == "MODERADO":

            interpretacion_historica = (
                f"La liquidación actual presenta una desviación "
                f"moderada respecto al comportamiento histórico "
                f"del agente. El resultado está {direccion_historica} "
                f"del promedio histórico, con una desviación de "
                f"{abs(z_score):.2f} desviaciones estándar."
            )

        elif clasificacion_historica == "RELEVANTE":

            interpretacion_historica = (
                f"La liquidación actual presenta un comportamiento "
                f"relevante respecto a su histórico. El resultado "
                f"está {direccion_historica} del promedio histórico, "
                f"con una desviación de "
                f"{abs(z_score):.2f} desviaciones estándar. "
                f"Se recomienda revisar los factores que explican "
                f"la variación."
            )

        else:

            interpretacion_historica = (
                f"La liquidación actual presenta un comportamiento "
                f"excepcional respecto al histórico del agente. "
                f"El resultado está {direccion_historica} del promedio "
                f"histórico, con una desviación de "
                f"{abs(z_score):.2f} desviaciones estándar. "
                f"Se recomienda priorizar la revisión de los factores "
                f"que explican el cambio."
            )

    else:

        desviacion_porcentual = 0

    return {
        "periodo_actual": fecha_actual.strftime("%Y-%m-%d"),

        "periodos_analizados": len(
            historico_anterior
        ),

        "monto_actual": round(
            monto_actual,
            2
        ),

        "promedio_historico": round(
            promedio_historico,
            2
        ),

        "desviacion_absoluta": round(
            desviacion_absoluta,
            2
        ),

        "desviacion_porcentual": round(
            desviacion_porcentual,
            2
        ),

        "desviacion_estandar": round(
            desviacion_estandar,
            2
        ),

        "z_score": round(
            z_score,
            2
        ),

        "clasificacion_historica": clasificacion_historica,
        "interpretacion_historica": interpretacion_historica,

        "periodos_historicos": [
            {
                "fecha": row["fecha"].strftime("%Y-%m-%d"),
                "monto": round(row["monto"], 2)
            }
            for _, row in historico_anterior.iterrows()
        ]
    }


# =========================================================
# ANÁLISIS DE FACTORES
# =========================================================


def analizar_factores(
    agente_id: str,
    fecha_actual: str,
    fecha_anterior: str
):

    df = cargar_datos()

    fecha_actual = pd.to_datetime(fecha_actual)
    fecha_anterior = pd.to_datetime(fecha_anterior)

    actual = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha_actual)
    ]

    anterior = df[
        (df["agente_id"] == agente_id)
        & (df["fecha"] == fecha_anterior)
    ]

    if actual.empty or anterior.empty:
        return []

    actual = (
        actual
        .groupby("concepto", as_index=False)["monto"]
        .sum()
    )

    anterior = (
        anterior
        .groupby("concepto", as_index=False)["monto"]
        .sum()
    )

    comparacion = pd.merge(
        anterior,
        actual,
        on="concepto",
        how="outer",
        suffixes=("_anterior", "_actual")
    )

    comparacion = comparacion.fillna(0)

    comparacion["variacion"] = (
        comparacion["monto_actual"]
        - comparacion["monto_anterior"]
    )

    total_variacion = comparacion[
        "variacion"
    ].sum()

    if total_variacion != 0:

        comparacion["contribucion_pct"] = (
            comparacion["variacion"]
            / total_variacion
        ) * 100

    else:

        comparacion["contribucion_pct"] = 0

    comparacion = comparacion.sort_values(
        "variacion",
        key=abs,
        ascending=False
    )

    comparacion["monto_anterior"] = (
        comparacion["monto_anterior"].round(2)
    )

    comparacion["monto_actual"] = (
        comparacion["monto_actual"].round(2)
    )

    comparacion["variacion"] = (
        comparacion["variacion"].round(2)
    )

    comparacion["contribucion_pct"] = (
        comparacion["contribucion_pct"].round(2)
    )

    return comparacion.to_dict(
        orient="records"
    )


# =========================================================
# SCORE DE RELEVANCIA
# =========================================================

def calcular_score_relevancia(
    variacion_porcentual,
    impacto_economico,
    principal_factor,
    z_score=0
):
    """
    Calcula la relevancia de una variación considerando:

    1. Variación porcentual
    2. Impacto económico
    3. Magnitud del principal factor
    4. Comportamiento histórico

    Score final: 0 - 100
    """

    # ---------------------------------------------------------
    # 1. SCORE POR VARIACIÓN PORCENTUAL
    # ---------------------------------------------------------

    variacion_abs = abs(variacion_porcentual)

    if variacion_abs >= 40:
        score_variacion = 100
    elif variacion_abs >= 25:
        score_variacion = 80
    elif variacion_abs >= 15:
        score_variacion = 60
    elif variacion_abs >= 10:
        score_variacion = 45
    elif variacion_abs >= 5:
        score_variacion = 30
    else:
        score_variacion = 10

    # ---------------------------------------------------------
    # 2. SCORE POR IMPACTO ECONÓMICO
    # ---------------------------------------------------------

    impacto_abs = abs(impacto_economico)

    if impacto_abs >= 2_000_000:
        score_impacto = 100
    elif impacto_abs >= 1_000_000:
        score_impacto = 85
    elif impacto_abs >= 500_000:
        score_impacto = 70
    elif impacto_abs >= 250_000:
        score_impacto = 55
    elif impacto_abs >= 100_000:
        score_impacto = 40
    elif impacto_abs >= 50_000:
        score_impacto = 25
    else:
        score_impacto = 10

    # ---------------------------------------------------------
    # 3. SCORE POR PRINCIPAL FACTOR
    # ---------------------------------------------------------

    if principal_factor is None:
        score_factor = 10
    else:

        factor_abs = abs(
            principal_factor["variacion"]
        )

        if factor_abs >= 2_000_000:
            score_factor = 100
        elif factor_abs >= 1_000_000:
            score_factor = 85
        elif factor_abs >= 500_000:
            score_factor = 70
        elif factor_abs >= 250_000:
            score_factor = 55
        elif factor_abs >= 100_000:
            score_factor = 40
        elif factor_abs >= 50_000:
            score_factor = 25
        else:
            score_factor = 10

    # ---------------------------------------------------------
    # 4. SCORE FINAL
    # ---------------------------------------------------------

    # score = (
    #    score_variacion * 0.30
    #    + score_impacto * 0.40
    #    + score_factor * 0.30
    # )

    score_historico = calcular_score_historico(
        z_score
    )

    score = (
        score_variacion * 0.25
        + score_impacto * 0.35
        + score_factor * 0.20
    ) / 0.80

    score = round(score)

    # ---------------------------------------------------------
    # 5. NIVEL
    # ---------------------------------------------------------

    if score >= 80:
        nivel = "CRÍTICO"
    elif score >= 60:
        nivel = "ALTO"
    elif score >= 40:
        nivel = "MEDIO"
    elif score >= 20:
        nivel = "BAJO"
    else:
        nivel = "NORMAL"

    return {
        "score": score,
        "nivel": nivel,

        "score_variacion": score_variacion,
        "score_impacto": score_impacto,
        "score_factor": score_factor,
        "score_historico": score_historico,

        "detalle_componentes": {
            "variacion": {
                "puntaje": score_variacion,
                "peso": 25,
                "aporte": round(score_variacion * 0.25, 2),
                "valor": variacion_porcentual
            },
            "impacto_economico": {
                "puntaje": score_impacto,
                "peso": 35,
                "aporte": round(score_impacto * 0.35, 2),
                "valor": impacto_economico
            },
            "factor_principal": {
                "puntaje": score_factor,
                "peso": 20,
                "aporte": round(score_factor * 0.20, 2),
                "valor": (
                    principal_factor["variacion"]
                    if principal_factor
                    else 0
                )
            },
            "comportamiento_historico": {
                "puntaje": score_historico,
                "peso": 20,
                "aporte": round(score_historico * 0.20, 2),
                "valor": z_score
            }
        }
    }


def calcular_score_historico(z_score):
    """
    Convierte el Z-Score histórico en un puntaje de 0 a 100.

    Mientras más alejado esté el comportamiento actual
    del promedio histórico, mayor será la relevancia.
    """

    z_abs = abs(z_score)

    if z_abs >= 3:
        return 100

    elif z_abs >= 2:
        return 80

    elif z_abs >= 1:
        return 50

    else:
        return 10


# =========================================================
# ANÁLISIS COMPLETO
# =========================================================


def analizar_liquidacion(agente_id, fecha_actual, fecha_anterior):
    comparacion = comparar_periodos(
        agente_id,
        fecha_actual,
        fecha_anterior
    )

    if comparacion is None:
        return None

    factores = analizar_factores(
        agente_id,
        fecha_actual,
        fecha_anterior
    )

    comparacion_interanual = comparar_mismo_periodo_anterior(
        agente_id,
        fecha_actual
    )

    comportamiento_historico = analizar_comportamiento_historico(
        agente_id,
        fecha_actual,
        meses_historicos=6
    )

    # Interpretar comportamiento mensual vs interanual
    interpretacion_interanual = None

    if comparacion_interanual:

        variacion_mensual = comparacion["variacion_porcentual"]
        variacion_interanual = (
            comparacion_interanual["variacion_porcentual"]
        )

        diferencia_puntos = (
            abs(variacion_mensual)
            - abs(variacion_interanual)
        )

        direccion_mensual = (
            "incremento"
            if variacion_mensual > 0
            else "disminución"
            if variacion_mensual < 0
            else "variación prácticamente nula"
        )

        if (
            variacion_mensual > 0
            and variacion_interanual > 0
        ):

            if diferencia_puntos > 5:

                interpretacion_interanual = (
                    f"La liquidación presenta un {direccion_mensual} "
                    f"mensual de {variacion_mensual:.2f}%, frente a un "
                    f"{variacion_interanual:.2f}% en el mismo periodo "
                    f"del año anterior. El incremento mensual es "
                    f"{diferencia_puntos:.2f} puntos porcentuales "
                    f"superior al comportamiento interanual."
                )

            elif diferencia_puntos < -5:

                interpretacion_interanual = (
                    f"La liquidación presenta un {direccion_mensual} "
                    f"mensual de {variacion_mensual:.2f}%, frente a un "
                    f"{variacion_interanual:.2f}% en el mismo periodo "
                    f"del año anterior. El incremento mensual es "
                    f"{abs(diferencia_puntos):.2f} puntos porcentuales "
                    f"inferior al comportamiento interanual."
                )

            else:

                interpretacion_interanual = (
                    f"La liquidación presenta un {direccion_mensual} "
                    f"mensual de {variacion_mensual:.2f}% y un "
                    f"{variacion_interanual:.2f}% frente al mismo "
                    f"periodo del año anterior, mostrando un "
                    f"comportamiento relativamente consistente."
                )

        elif (
            variacion_mensual < 0
            and variacion_interanual < 0
        ):

            if diferencia_puntos > 5:

                interpretacion_interanual = (
                    f"La liquidación presenta una disminución mensual "
                    f"de {abs(variacion_mensual):.2f}%, frente a una "
                    f"disminución de {abs(variacion_interanual):.2f}% "
                    f"en el mismo periodo del año anterior. La caída "
                    f"mensual es {diferencia_puntos:.2f} puntos "
                    f"porcentuales más pronunciada."
                )

            elif diferencia_puntos < -5:

                interpretacion_interanual = (
                    f"La liquidación presenta una disminución mensual "
                    f"de {abs(variacion_mensual):.2f}%, frente a una "
                    f"disminución de {abs(variacion_interanual):.2f}% "
                    f"en el mismo periodo del año anterior. La caída "
                    f"mensual es {abs(diferencia_puntos):.2f} puntos "
                    f"porcentuales menos pronunciada."
                )

            else:

                interpretacion_interanual = (
                    f"La liquidación presenta una disminución mensual "
                    f"de {abs(variacion_mensual):.2f}% y una disminución "
                    f"de {abs(variacion_interanual):.2f}% frente al "
                    f"mismo periodo del año anterior, mostrando un "
                    f"comportamiento relativamente consistente."
                )

        else:

            interpretacion_interanual = (
                f"El comportamiento mensual ({variacion_mensual:+.2f}%) "
                f"difiere del observado frente al mismo periodo del "
                f"año anterior ({variacion_interanual:+.2f}%). "
                f"Esta diferencia sugiere revisar los factores que "
                f"explican el cambio."
            )

    # Ordenar factores por impacto absoluto
    factores_ordenados = sorted(
        factores,
        key=lambda x: abs(x["variacion"]),
        reverse=True
    )

    # Tomar los principales factores
    principales_factores = factores_ordenados[:5]

    # Identificar factores que aumentaron y disminuyeron
    factores_positivos = [
        f for f in factores_ordenados
        if f["variacion"] > 0
    ]

    factores_negativos = [
        f for f in factores_ordenados
        if f["variacion"] < 0
    ]

    # Principal factor positivo
    principal_positivo = (
        factores_positivos[0]
        if factores_positivos
        else None
    )

    # Principal factor negativo
    principal_negativo = (
        factores_negativos[0]
        if factores_negativos
        else None
    )

    variacion = comparacion["variacion_porcentual"]
    impacto = comparacion["variacion_absoluta"]

    # Generar explicación

    # Generar explicación
    if impacto > 0:
        direccion = "aumentó"
    elif impacto < 0:
        direccion = "disminuyó"
    else:
        direccion = "se mantuvo prácticamente sin cambios"

    explicacion = (
        f"La liquidación de {agente_id} {direccion} "
        f"un {abs(variacion):.2f}% respecto al periodo anterior, "
        f"representando un impacto económico de "
        f"S/ {abs(impacto):,.2f}."
    )

    if principal_positivo:
        if impacto > 0:
            explicacion += (
                f" El principal factor que impulsó el cambio fue "
                f"{principal_positivo['concepto']}, con una variación "
                f"positiva de S/ {abs(principal_positivo['variacion']):,.2f}."
            )
        else:
            explicacion += (
                f" El principal factor que contribuyó al incremento fue "
                f"{principal_positivo['concepto']}, con una variación "
                f"de S/ {abs(principal_positivo['variacion']):,.2f}, "
                f"aunque no fue suficiente para compensar los factores negativos."
            )

    if principal_negativo:
        if impacto > 0:
            explicacion += (
                f" Este incremento fue parcialmente compensado por "
                f"{principal_negativo['concepto']}, que presentó una "
                f"variación negativa de S/ {abs(principal_negativo['variacion']):,.2f}."
            )
        elif impacto < 0:
            explicacion += (
                f" La principal reducción estuvo asociada a "
                f"{principal_negativo['concepto']}, con una variación "
                f"negativa de S/ {abs(principal_negativo['variacion']):,.2f}."
            )

 # Generar recomendación de revisión
    recomendacion_revision = None

    if principales_factores:
        principal = principales_factores[0]

        recomendacion_revision = {
            "concepto": principal["concepto"],
            "variacion": principal["variacion"],
            "mensaje": (
                f"Se recomienda revisar primero el detalle de "
                f"{principal['concepto']}, debido a que presenta "
                f"el mayor impacto sobre la variación de la liquidación."
            )
        }

    return {
        "comparacion": comparacion,
        "comparacion_interanual": comparacion_interanual,
        "comportamiento_historico": comportamiento_historico,
        "interpretacion_interanual": interpretacion_interanual,

        "relevancia": calcular_score_relevancia(
            comparacion["variacion_porcentual"],
            comparacion["variacion_absoluta"],
            principales_factores[0] if principales_factores else None,
            comportamiento_historico["z_score"]
            if comportamiento_historico
            else 0
        ),

        "principales_factores": principales_factores,

        "factores_positivos": factores_positivos,

        "factores_negativos": factores_negativos,

        "explicacion": explicacion,

        "recomendacion_revision": recomendacion_revision
    }


# =========================================================
# PRUEBA
# =========================================================

if __name__ == "__main__":

    print("\n======================================")
    print(" COES LIQUIDACIONES 360")
    print(" MOTOR DE ANÁLISIS")
    print("======================================")

    agente = "AGE001"

    fecha_anterior = "2026-07-01"
    fecha_actual = "2026-08-01"

    resultado = analizar_liquidacion(
        agente,
        fecha_actual,
        fecha_anterior
    )

    print("\nRESULTADO DEL ANÁLISIS\n")

    print(resultado)
