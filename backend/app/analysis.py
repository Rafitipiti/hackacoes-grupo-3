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
