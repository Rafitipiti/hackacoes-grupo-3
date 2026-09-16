import pandas as pd
from fastapi import APIRouter, HTTPException

from app.data.loader import cargar_datos_coes
from app.services.agent_service import AgentService
from app.services.integrity_service import IntegrityService
from app.services.pagos_service import PagosService
from app.services.revision_service import RevisionService

router = APIRouter(tags=["empresa"])

datos_coes = cargar_datos_coes()
agent_service = AgentService()
integrity_service = IntegrityService(datos_coes)
revision_service = RevisionService(datos_coes)
pagos_service = PagosService(datos_coes)


@router.get("/empresa/pagos-cobros/{empresa_id}/{pericodi}")
def pagos_cobros(empresa_id: str, pericodi: int):
    """Cuanto paga y cuanto cobra la empresa en el mes, proceso por proceso."""
    resultado = pagos_service.pagos_cobros(empresa_id, pericodi)

    if resultado is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"{empresa_id} no aparece en ninguna transferencia bilateral."
            ),
        )

    return resultado


@router.get("/empresa/historico/{empresa_id}")
def historico_empresa(empresa_id: str):
    """La serie de los 20 periodos: total, procesos y recalculos.

    Alimenta la evolucion historica y la comparacion por proceso. Las dos
    vistas leen del mismo sitio para que la barra de un mes y el punto de
    ese mes en la linea no puedan discrepar.
    """
    serie = revision_service.serie_historica(empresa_id)

    if not serie:
        raise HTTPException(
            status_code=404,
            detail=f"No hay liquidaciones registradas para {empresa_id}.",
        )

    empresas = datos_coes["empresas"]
    ficha = empresas[empresas["empresa_id"] == empresa_id]

    identidad = {"alias": None, "ruc": None, "razon_social": None}

    if not ficha.empty:
        fila = ficha.iloc[0]
        identidad = {
            campo: (None if pd.isna(fila[campo]) else fila[campo])
            for campo in identidad
        }

    return {
        "empresa_id": empresa_id,
        **identidad,
        "periodos": serie,
    }


@router.get("/empresas/comparar/{pericodi}")
def comparar_empresas(pericodi: int):
    """Las empresas con liquidacion en el mes, lado a lado (spec 5.3)."""
    filas = revision_service.comparativa_de_periodo(pericodi)

    if not filas:
        raise HTTPException(
            status_code=404,
            detail=f"Ninguna empresa tiene liquidacion en el periodo {pericodi}.",
        )

    empresas = datos_coes["empresas"].set_index("empresa_id")

    for fila in filas:
        ficha = empresas.loc[fila["empresa_id"]] if fila["empresa_id"] in empresas.index else None

        for campo in ("alias", "ruc", "razon_social"):
            valor = ficha[campo] if ficha is not None else None
            fila[campo] = None if valor is None or pd.isna(valor) else valor

    periodo = datos_coes["periodos"]
    periodo = periodo[periodo["pericodi"] == pericodi]

    return {
        "pericodi": pericodi,
        "perinombre": periodo["perinombre"].iloc[0] if not periodo.empty else None,
        "empresas": filas,
    }


@router.get(
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

@router.get(
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


@router.get("/agente/explicacion/{empresa_id}/{pericodi}")
def explicacion_agente(empresa_id: str, pericodi: int):
    return agent_service.obtener_explicacion_empresa(
        empresa_id,
        pericodi
    )

# =========================================================
# MODO AGENTE - ¿QUÉ CAMBIÓ?
# =========================================================


@router.get(
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


@router.get(
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


@router.get(
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


@router.get(
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


@router.get(
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

@router.get(
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

@router.get(
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

@router.get(
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

@router.get(
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

@router.get(
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


@router.get(
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


@router.get("/agente/contexto/{empresa_id}/{pericodi}")
def contexto_agente(empresa_id: str, pericodi: int):

    return agent_service.obtener_contexto_agente(
        empresa_id,
        pericodi
    )
