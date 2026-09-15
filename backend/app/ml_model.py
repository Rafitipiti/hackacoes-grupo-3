import pandas as pd
from sklearn.ensemble import IsolationForest


def entrenar_modelo(agente_id):
    """
    Entrena un modelo Isolation Forest para detectar
    comportamientos inusuales en las liquidaciones
    históricas de un agente.
    """

    # Cargar dataset
    df = pd.read_csv("liquidaciones.csv")

    # Filtrar agente
    df_agente = df[
        df["agente_id"] == agente_id
    ].copy()

    # Agrupar la liquidación total por periodo
    historico = (
        df_agente
        .groupby("fecha")["monto"]
        .sum()
        .reset_index()
        .sort_values("fecha")
    )

    # Característica utilizada por el modelo
    X = historico[["monto"]]

    # Crear modelo
    modelo = IsolationForest(
        contamination=0.15,
        random_state=42
    )

    # Entrenar
    modelo.fit(X)

    # Predecir anomalías
    historico["prediccion"] = modelo.predict(X)

    # Score de anomalía
    historico["score_anomalia"] = modelo.decision_function(X)

    # Convertir predicción
    historico["es_anomalia"] = (
        historico["prediccion"] == -1
    )

    return historico


def obtener_anomalia(agente_id, fecha):
    """
    Obtiene el resultado ML para un agente y periodo específico.
    """

    historico = entrenar_modelo(agente_id)

    resultado = historico[
        historico["fecha"] == fecha
    ]

    if resultado.empty:
        return {
            "disponible": False,
            "es_anomalia": False,
            "score_anomalia": None
        }

    fila = resultado.iloc[0]

    return {
        "disponible": True,
        "es_anomalia": bool(
            fila["es_anomalia"]
        ),
        "score_anomalia": round(
            float(fila["score_anomalia"]),
            4
        )
    }
