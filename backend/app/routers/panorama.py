from fastapi import APIRouter, HTTPException
import pandas as pd

from app.analysis import calcular_score_relevancia
from app.data.loader import cargar_datos_coes

router = APIRouter(tags=["panorama"])

datos_coes = cargar_datos_coes()


@router.get("/radar/{fecha}")
def radar(fecha: int):

    df = datos_coes["evolucion_liquidaciones"].copy()
    periodos = datos_coes["periodos"].copy()

    df["monto"] = pd.to_numeric(
        df["monto"],
        errors="coerce"
    )

    df = df.dropna(
        subset=["monto"]
    )

    # =========================================================
    # PERIODO ACTUAL
    # =========================================================

    periodo_actual = periodos[
        periodos["pericodi"] == fecha
    ]

    if periodo_actual.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No existe el periodo {fecha}."
        )

    periodo_actual = periodo_actual.iloc[0]

    # =========================================================
    # PERIODO ANTERIOR
    # =========================================================

    periodos_ordenados = (
        periodos
        .sort_values("pericodi")
        .reset_index(drop=True)
    )

    posicion_actual = periodos_ordenados.index[
        periodos_ordenados["pericodi"] == fecha
    ][0]

    if posicion_actual == 0:
        pericodi_anterior = None
        periodo_anterior = None
    else:
        periodo_anterior = periodos_ordenados.iloc[
            posicion_actual - 1
        ]

        pericodi_anterior = int(
            periodo_anterior["pericodi"]
        )

    # =========================================================
    # DATOS DEL PERIODO ACTUAL
    # =========================================================

    actual = df[
        df["pericodi"] == fecha
    ].copy()

    if actual.empty:
        return {
            "fecha": fecha,
            "periodo": periodo_actual["perinombre"],
            "estado": periodo_actual["estado"],
            "version_vigente": periodo_actual["version_vigente"],
            "periodo_anterior": (
                periodo_anterior["perinombre"]
                if periodo_anterior is not None
                else None
            ),
            "total_agentes": 0,
            "total_alertas": 0,
            "agentes_analizados": [],
            "alertas": []
        }

    # =========================================================
    # AGRUPACIÓN ACTUAL
    # =========================================================

    actual_empresa = (
        actual
        .groupby(
            "empresa_deudora",
            as_index=False
        )["monto"]
        .sum()
        .rename(
            columns={
                "monto": "monto_actual"
            }
        )
    )

    # =========================================================
    # AGRUPACIÓN ANTERIOR
    # =========================================================

    if pericodi_anterior is not None:

        anterior = df[
            df["pericodi"] == pericodi_anterior
        ].copy()

        anterior_empresa = (
            anterior
            .groupby(
                "empresa_deudora",
                as_index=False
            )["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "monto_anterior"
                }
            )
        )

    else:

        anterior_empresa = pd.DataFrame(
            columns=[
                "empresa_deudora",
                "monto_anterior"
            ]
        )

    # =========================================================
    # CRUCE ACTUAL VS ANTERIOR
    # =========================================================

    comparacion = actual_empresa.merge(
        anterior_empresa,
        on="empresa_deudora",
        how="left"
    )

    comparacion["monto_anterior"] = (
        comparacion["monto_anterior"]
        .fillna(0)
    )

    comparacion["variacion_absoluta"] = (
        comparacion["monto_actual"]
        - comparacion["monto_anterior"]
    )

    comparacion["variacion_porcentual"] = None

    for indice, fila in comparacion.iterrows():

        monto_anterior = float(
            fila["monto_anterior"]
        )

        variacion_absoluta = float(
            fila["variacion_absoluta"]
        )

        if monto_anterior != 0:

            comparacion.at[
                indice,
                "variacion_porcentual"
            ] = (
                variacion_absoluta
                / abs(monto_anterior)
                * 100
            )

    # =========================================================
    # PRINCIPAL PROCESO POR EMPRESA
    # =========================================================

    if pericodi_anterior is not None:

        detalle_actual = (
            actual
            .groupby(
                [
                    "empresa_deudora",
                    "proceso"
                ],
                as_index=False
            )["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "actual"
                }
            )
        )

        detalle_anterior = (
            anterior
            .groupby(
                [
                    "empresa_deudora",
                    "proceso"
                ],
                as_index=False
            )["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "anterior"
                }
            )
        )

        detalle = detalle_actual.merge(
            detalle_anterior,
            on=[
                "empresa_deudora",
                "proceso"
            ],
            how="outer"
        )

        detalle["actual"] = (
            detalle["actual"]
            .fillna(0)
        )

        detalle["anterior"] = (
            detalle["anterior"]
            .fillna(0)
        )

        detalle["variacion"] = (
            detalle["actual"]
            - detalle["anterior"]
        )

    else:

        detalle = pd.DataFrame()

    # =========================================================
    # PRIORIZACIÓN
    # =========================================================

    max_variacion = (
        comparacion["variacion_absoluta"]
        .abs()
        .max()
    )

    if not max_variacion or pd.isna(max_variacion):
        max_variacion = 1

    resultados = []

    for _, fila in comparacion.iterrows():

        empresa = fila["empresa_deudora"]

        variacion_abs = float(
            fila["variacion_absoluta"]
        )

        variacion_pct = fila[
            "variacion_porcentual"
        ]

        if pd.notna(variacion_pct):
            variacion_pct = float(
                variacion_pct
            )

        principal_factor = None

        if not detalle.empty:

            empresa_detalle = detalle[
                detalle["empresa_deudora"]
                == empresa
            ].copy()

            if not empresa_detalle.empty:

                principal = (
                    empresa_detalle
                    .assign(
                        impacto=lambda x:
                        x["variacion"].abs()
                    )
                    .sort_values(
                        "impacto",
                        ascending=False
                    )
                    .iloc[0]
                )

                principal_factor = {
                    "concepto":
                        principal["proceso"],
                    "variacion":
                        float(
                            principal["variacion"]
                        )
                }

                resultado_score = calcular_score_relevancia(
                    variacion_pct if variacion_pct is not None else 0,
                    variacion_abs,
                    principal_factor
                )

                score = resultado_score["score"]
                nivel = resultado_score["nivel"]

        resultados.append({
            "agente_id": empresa,
            "agente": empresa,
            "periodo":
                periodo_actual["perinombre"],

            "variacion_porcentual":
                variacion_pct,

            "variacion_absoluta":
                variacion_abs,

            "score":
                score,

            "nivel":
                nivel,

            "score_historico":
                None,

            "clasificacion_historica":
                None,

            "z_score":
                None,

            "principal_factor":
                (
                    principal_factor["concepto"]
                    if principal_factor
                    else None
                ),

            "variacion_principal_factor":
                (
                    principal_factor["variacion"]
                    if principal_factor
                    else 0
                )
        })

    # =========================================================
    # ORDENAR POR RELEVANCIA
    # =========================================================

    resultados = sorted(
        resultados,
        key=lambda x: x["score"],
        reverse=True
    )

    alertas_relevantes = [
        item
        for item in resultados
        if item["score"] >= 60
    ]

    return {
        "fecha": fecha,

        "periodo":
            periodo_actual["perinombre"],

        "estado":
            periodo_actual["estado"],

        "version_vigente":
            periodo_actual["version_vigente"],

        "periodo_anterior":
            (
                periodo_anterior["perinombre"]
                if periodo_anterior is not None
                else None
            ),

        "total_agentes":
            len(resultados),

        "total_alertas":
            len(alertas_relevantes),

        "agentes_analizados":
            resultados,

        "alertas":
            alertas_relevantes
    }
