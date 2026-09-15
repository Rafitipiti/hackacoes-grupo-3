import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException

from app.analysis import calcular_score_relevancia

from app.data.loader import cargar_datos_coes
from app.services.integrity_service import IntegrityService
from app.services.agent_service import AgentService


# =========================================================
# CONFIGURACIÓN
# =========================================================

app = FastAPI(
    title="COES Liquidaciones 360",
    description=(
        "API para consulta, análisis y detección "
        "de variaciones en liquidaciones."
    ),
    version="0.2.0"
)


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import revisiones

app.include_router(revisiones.router)

# =========================================================
# INICIO
# =========================================================


# =========================================================
# DATOS COES - SERVICIOS
# =========================================================

datos_coes = cargar_datos_coes()

integrity_service = IntegrityService(
    datos_coes
)

agent_service = AgentService()


@app.get("/")
def root():

    return {
        "sistema": "COES Liquidaciones 360",
        "estado": "operativo",
        "version": "0.2.0"
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "ok"
    }


@app.get("/periodos")
def obtener_periodos():

    periodos = datos_coes["periodos"]

    return {
        "periodos": periodos.to_dict(
            orient="records"
        )
    }


@app.get("/empresas")
def obtener_empresas():

    empresas = datos_coes["empresas"]

    return {
        "empresas": empresas.to_dict(
            orient="records"
        )
    }

# =========================================================
# RADAR DE VARIACIONES
# =========================================================


@app.get("/radar/{fecha}")
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


# =========================================================
# FUNCIONES AUXILIARES
# =========================================================

def pd_periodo_actual(fecha: str):

    return pd.to_datetime(
        fecha
    ).strftime("%Y-%m-%d")


def pd_periodo_anterior(fecha: str):

    fecha_dt = pd.to_datetime(fecha)

    anterior = (
        fecha_dt
        - pd.DateOffset(months=1)
    )

    return anterior.strftime(
        "%Y-%m-%d"
    )


# =========================================================
# MODO AGENTE - INTEGRIDAD
# =========================================================

@app.get(
    "/agente/integridad/{empresa_id}/{pericodi}"
)
def integridad_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = integrity_service.generar_resumen_integridad(
        empresa_id,
        pericodi
    )

    return resultado


# =========================================================
# MODO AGENTE - RESUMEN
# =========================================================

@app.get(
    "/agente/resumen/{empresa_id}/{pericodi}"
)
def resumen_agente(
    empresa_id: str,
    pericodi: int
):

    resumen = agent_service.obtener_resumen_empresa(
        empresa_id,
        pericodi
    )

    if not resumen.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resumen.get(
                "mensaje",
                "No se encontró información."
            )
        )

    variacion = agent_service.obtener_variacion_empresa(
        empresa_id,
        pericodi
    )

    impulsores = agent_service.obtener_principales_impulsores(
        empresa_id,
        pericodi
    )

    integridad = integrity_service.generar_resumen_integridad(
        empresa_id,
        pericodi
    )

    cierre = integrity_service.generar_estado_cierre(
        empresa_id,
        pericodi
    )

    return {
        "empresa": empresa_id,
        "periodo": resumen["periodo"],

        "resultado": {
            "total": resumen["resultado_total"],
            "cantidad_registros": resumen["cantidad_registros"],
            "procesos": resumen["procesos"],
            "historico": resumen.get("historico", [])
        },

        "variacion": {
            "encontrado": variacion.get("encontrado"),
            "periodo_anterior": (
                variacion.get("periodo_anterior")
            ),
            "actual": variacion.get("actual"),
            "anterior": variacion.get("anterior"),
            "variacion": variacion.get("variacion"),
            "variacion_pct": variacion.get(
                "variacion_pct"
            ),
            "procesos": variacion.get(
                "procesos",
                []
            )
        },

        "impulsores": {
            "encontrado": impulsores.get(
                "encontrado"
            ),
            "variacion_total": impulsores.get(
                "variacion_total_movimientos"
            ),
            "impacto_principales": impulsores.get(
                "impacto_principales"
            ),
            "principal_reduccion": impulsores.get(
                "principal_reduccion"
            ),
            "principal_incremento": impulsores.get(
                "principal_incremento"
            ),
            "movimientos": impulsores.get(
                "movimientos",
                []
            )
        },

        "integridad": integridad,
        "cierre": cierre
    }


@app.get("/agente/explicacion/{empresa_id}/{pericodi}")
def explicacion_agente(empresa_id: str, pericodi: int):
    return agent_service.obtener_explicacion_empresa(
        empresa_id,
        pericodi
    )

# =========================================================
# MODO AGENTE - ¿QUÉ CAMBIÓ?
# =========================================================


@app.get(
    "/agente/cambios/{empresa_id}/{pericodi}"
)
def cambios_agente(
    empresa_id: str,
    pericodi: int
):

    variacion = agent_service.obtener_variacion_empresa(
        empresa_id,
        pericodi
    )

    if not variacion.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=variacion.get(
                "mensaje",
                "No se encontró información de variación."
            )
        )

    impulsores = agent_service.obtener_principales_impulsores(
        empresa_id,
        pericodi
    )

    return {
        "empresa": empresa_id,

        "periodo_actual": variacion.get(
            "periodo_actual"
        ),

        "periodo_anterior": variacion.get(
            "periodo_anterior"
        ),

        "resumen": {
            "actual": variacion.get(
                "actual"
            ),
            "anterior": variacion.get(
                "anterior"
            ),
            "variacion": variacion.get(
                "variacion"
            ),
            "variacion_pct": variacion.get(
                "variacion_pct"
            )
        },

        "procesos": variacion.get(
            "procesos",
            []
        ),

        "impulsores": {
            "variacion_total": impulsores.get(
                "variacion_total_movimientos"
            ),
            "impacto_principales": impulsores.get(
                "impacto_principales"
            ),
            "principal_reduccion": impulsores.get(
                "principal_reduccion"
            ),
            "principal_incremento": impulsores.get(
                "principal_incremento"
            )
        },

        "movimientos": impulsores.get(
            "movimientos",
            []
        )
    }

# =========================================================
# MODO AGENTE - TRAZABILIDAD LVTA
# =========================================================


@app.get(
    "/agente/trazabilidad-lvta/{empresa_id}/{pericodi}"
)
def trazabilidad_lvta_agente(
    empresa_id: str,
    pericodi: int
):
    resultado = agent_service.validar_trazabilidad_lvta(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información de trazabilidad LVTA."
            )
        )

    return resultado

# =========================================================
# MODO AGENTE - ¿POR QUÉ CAMBIÓ? - LSCIO
# =========================================================


@app.get(
    "/agente/causas/{empresa_id}/{pericodi}"
)
def causas_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = agent_service.obtener_causas_variacion_lscio(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información de causas."
            )
        )

    return resultado

# =========================================================
# MODO AGENTE - INTEGRIDAD LSCIO
# =========================================================


@app.get(
    "/agente/integridad-lscio/{empresa_id}/{pericodi}"
)
def integridad_lscio_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = agent_service.validar_reconstruccion_lscio(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información LSCIO."
            )
        )

    return resultado

# =========================================================
# MODO AGENTE - ¿POR QUÉ CAMBIÓ? - LSCIO - CONCEPTOS
# =========================================================


@app.get(
    "/agente/causas-concepto/{empresa_id}/{pericodi}"
)
def causas_concepto_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = agent_service.obtener_causas_concepto_lscio(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información de conceptos LSCIO."
            )
        )

    return resultado


# =========================================================
# MODO AGENTE - INTEGRIDAD LSCIO - CONCEPTOS
# =========================================================

@app.get(
    "/agente/integridad-lscio-conceptos/{empresa_id}/{pericodi}"
)
def integridad_lscio_conceptos_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = (
        agent_service
        .validar_reconstruccion_conceptos_lscio(
            empresa_id,
            pericodi
        )
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información LSCIO."
            )
        )

    return resultado


# =========================================================
# MODO AGENTE - EVIDENCIA LSCIO
# =========================================================

@app.get(
    "/agente/evidencia-lscio/{empresa_id}/{pericodi}"
)
def evidencia_lscio_agente(
    empresa_id: str,
    pericodi: int,
    mecanismo: str,
    concepto: str
):

    resultado = (
        agent_service
        .obtener_evidencia_concepto_lscio(
            empresa_id,
            pericodi,
            mecanismo,
            concepto
        )
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró evidencia LSCIO."
            )
        )

    return resultado


# =========================================================
# MODO AGENTE - EXPLICACIÓN LSCIO
# =========================================================

@app.get(
    "/agente/explicacion-lscio/{empresa_id}/{pericodi}"
)
def explicacion_lscio_agente(
    empresa_id: str,
    pericodi: int
):

    resultado = (
        agent_service
        .obtener_explicacion_lscio(
            empresa_id,
            pericodi
        )
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información para explicar LSCIO."
            )
        )

    return resultado


# =========================================================
# MODO AGENTE - ¿POR QUÉ CAMBIÓ? - LVTA
# =========================================================

@app.get(
    "/agente/causas-lvta/{empresa_id}/{pericodi}"
)
def causas_lvta_agente(
    empresa_id: str,
    pericodi: int
):
    resultado = agent_service.obtener_causas_variacion_lvta(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información de causas LVTA."
            )
        )

    return resultado

# =========================================================
# MODO AGENTE - EXPLICACIÓN COMPLETA LSCIO
# =========================================================


@app.get(
    "/agente/explicacion-lscio/{empresa_id}/{pericodi}"
)
def explicacion_lscio_agente(
    empresa_id: str,
    pericodi: int
):
    resultado = agent_service.obtener_explicacion_lscio(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail=resultado.get(
                "mensaje",
                "No se encontró información de explicación LSCIO."
            )
        )

    return resultado


@app.get(
    "/agente/cierre/{empresa_id}/{pericodi}"
)
def cierre_agente(
    empresa_id: str,
    pericodi: int
):
    resultado = integrity_service.generar_estado_cierre(
        empresa_id,
        pericodi
    )

    return resultado


@app.get(
    "/agente/trazabilidad/{empresa_id}/{pericodi}"
)
def trazabilidad_agente(
    empresa_id: str,
    pericodi: int
):
    resultado = agent_service.obtener_trazabilidad_empresa(
        empresa_id,
        pericodi
    )

    if not resultado.get("encontrado"):
        raise HTTPException(
            status_code=404,
            detail="No se encontró información de trazabilidad."
        )

    return resultado


@app.get("/agente/contexto/{empresa_id}/{pericodi}")
def contexto_agente(empresa_id: str, pericodi: int):

    return agent_service.obtener_contexto_agente(
        empresa_id,
        pericodi
    )
