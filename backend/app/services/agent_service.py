import pandas as pd

from app.data.loader import cargar_datos_coes


class AgentService:

    def __init__(self):
        self.datos = cargar_datos_coes()

        self.periodos = self.datos["periodos"]
        self.empresas = self.datos["empresas"]
        self.evolucion = self.datos["evolucion_liquidaciones"]

        self.energia_transferencias = self.datos[
            "energia_transferencias"
        ]

        self.lscio_transferencias = self.datos[
            "lscio_transferencias"
        ]

        self.lscio_desglose = self.datos[
            "lscio_desglose"
        ]

        self.potencia_desglose = self.datos[
            "potencia_desglose"
        ]

        self.potencia_saldos = self.datos[
            "potencia_saldos"
        ]

        self.sstsct_desglose = self.datos[
            "sstsct_desglose"
        ]

    # ========================================================
    # RESUMEN DE EMPRESA
    # ========================================================

    def obtener_resumen_empresa(self, empresa_id: str, pericodi: int):
        """
        Obtiene el resumen económico de una empresa
        para un periodo determinado.
        """

        df = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi)
        ].copy()

        df["monto"] = pd.to_numeric(df["monto"], errors="coerce")

        if df.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    f"No se encontraron datos para "
                    f"{empresa_id} en el periodo {pericodi}."
                )
            }

        # ----------------------------------------------------
        # DATOS DEL PERIODO
        # ----------------------------------------------------

        periodo = self.periodos[
            self.periodos["pericodi"] == pericodi
        ]

        if periodo.empty:
            perinombre = df["perinombre"].iloc[0]
            estado = None
            version_vigente = None
        else:
            periodo_info = periodo.iloc[0]

            perinombre = periodo_info["perinombre"]
            estado = periodo_info["estado"]
            version_vigente = periodo_info["version_vigente"]

        # ----------------------------------------------------
        # RESULTADO TOTAL
        # ----------------------------------------------------

        resultado_total = df["monto"].sum()

        # ----------------------------------------------------
        # RESULTADO POR PROCESO
        # ----------------------------------------------------

        procesos = (
            df.groupby("proceso", as_index=False)["monto"]
            .sum()
            .sort_values("monto", ascending=False)
        )

        procesos_resultado = []

        for _, fila in procesos.iterrows():
            procesos_resultado.append({
                "proceso": fila["proceso"],
                "monto": float(fila["monto"])
            })

            # ----------------------------------------------------
        # COMPORTAMIENTO HISTÓRICO
        # ----------------------------------------------------

        historico_df = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ].copy()

        historico_df["monto"] = pd.to_numeric(
            historico_df["monto"],
            errors="coerce"
        )

        historico = (
            historico_df
            .groupby(
                ["pericodi", "perinombre"],
                as_index=False
            )["monto"]
            .sum()
            .sort_values("pericodi")
        )

        historico = historico[
            historico["pericodi"] <= pericodi
        ].tail(6)

        historico_resultado = []

        for _, fila in historico.iterrows():
            historico_resultado.append({
                "pericodi": int(fila["pericodi"]),
                "perinombre": fila["perinombre"],
                "monto": float(fila["monto"])
            })

        # ----------------------------------------------------
        # RESULTADO
        # ----------------------------------------------------

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "periodo": {
                "pericodi": int(pericodi),
                "perinombre": perinombre,
                "estado": estado,
                "version_vigente": version_vigente
            },
            "resultado_total": float(resultado_total),
            "cantidad_registros": len(df),
            "historico": historico_resultado,
            "procesos": procesos_resultado
        }

    # ========================================================
    # VARIACIÓN DE EMPRESA
    # ========================================================

    def obtener_variacion_empresa(self, empresa_id: str, pericodi: int):
        """
        Compara el resultado de una empresa entre el periodo
        seleccionado y el periodo inmediatamente anterior
        disponible para esa empresa.
        """

        # ----------------------------------------------------
        # PERIODOS DE LA EMPRESA
        # ----------------------------------------------------

        df_empresa = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ].copy()

        df_empresa["monto"] = pd.to_numeric(
            df_empresa["monto"],
            errors="coerce"
        )

        if df_empresa["monto"].isna().any():
            print("ADVERTENCIA: existen montos no numéricos.")

        if df_empresa.empty:
            return {
                "encontrado": False,
                "mensaje": f"No existen datos para {empresa_id}."
            }

        periodos_empresa = (
            df_empresa["pericodi"]
            .drop_duplicates()
            .sort_values()
            .tolist()
        )

        # ----------------------------------------------------
        # BUSCAR PERIODO ANTERIOR
        # ----------------------------------------------------

        periodos_anteriores = [
            p for p in periodos_empresa
            if p < pericodi
        ]

        if not periodos_anteriores:
            return {
                "encontrado": False,
                "mensaje": (
                    f"No existe un periodo anterior disponible "
                    f"para {empresa_id}."
                )
            }

        pericodi_anterior = max(periodos_anteriores)

        # ----------------------------------------------------
        # DATOS ACTUALES
        # ----------------------------------------------------

        actual = df_empresa[
            df_empresa["pericodi"] == pericodi
        ].copy()

        if actual.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    f"No existen datos para {empresa_id} "
                    f"en el periodo {pericodi}."
                )
            }

        # ----------------------------------------------------
        # DATOS ANTERIORES
        # ----------------------------------------------------

        anterior = df_empresa[
            df_empresa["pericodi"] == pericodi_anterior
        ].copy()

        # ----------------------------------------------------
        # TOTALES
        # ----------------------------------------------------

        monto_actual = actual["monto"].sum()
        monto_anterior = anterior["monto"].sum()

        variacion_abs = monto_actual - monto_anterior

        # Evitamos división entre cero
        if monto_anterior != 0:
            variacion_pct = (
                variacion_abs / abs(monto_anterior)
            ) * 100
        else:
            variacion_pct = None

        # ----------------------------------------------------
        # VARIACIÓN POR PROCESO
        # ----------------------------------------------------

        procesos_actual = (
            actual.groupby("proceso")["monto"]
            .sum()
        )

        procesos_anterior = (
            anterior.groupby("proceso")["monto"]
            .sum()
        )

        todos_los_procesos = sorted(
            set(procesos_actual.index)
            | set(procesos_anterior.index)
        )

        procesos_resultado = []

        for proceso in todos_los_procesos:

            monto_act = procesos_actual.get(proceso, 0)
            monto_ant = procesos_anterior.get(proceso, 0)

            variacion = monto_act - monto_ant

            if monto_ant != 0:
                porcentaje = (
                    variacion / abs(monto_ant)
                ) * 100
            else:
                porcentaje = None

            procesos_resultado.append({
                "proceso": proceso,
                "actual": float(monto_act),
                "anterior": float(monto_ant),
                "variacion": float(variacion),
                "variacion_pct": (
                    float(porcentaje)
                    if porcentaje is not None
                    else None
                )
            })

        # ----------------------------------------------------
        # NOMBRE DE PERIODOS
        # ----------------------------------------------------

        periodo_actual = self.periodos[
            self.periodos["pericodi"] == pericodi
        ]

        periodo_anterior = self.periodos[
            self.periodos["pericodi"] == pericodi_anterior
        ]

        nombre_actual = (
            periodo_actual["perinombre"].iloc[0]
            if not periodo_actual.empty
            else actual["perinombre"].iloc[0]
        )

        nombre_anterior = (
            periodo_anterior["perinombre"].iloc[0]
            if not periodo_anterior.empty
            else anterior["perinombre"].iloc[0]
        )

        # ----------------------------------------------------
        # RESULTADO
        # ----------------------------------------------------

        return {
            "encontrado": True,
            "empresa": empresa_id,

            "periodo_actual": {
                "pericodi": int(pericodi),
                "perinombre": nombre_actual
            },

            "periodo_anterior": {
                "pericodi": int(pericodi_anterior),
                "perinombre": nombre_anterior
            },

            "actual": float(monto_actual),
            "anterior": float(monto_anterior),

            "variacion": float(variacion_abs),

            "variacion_pct": (
                float(variacion_pct)
                if variacion_pct is not None
                else None
            ),

            "procesos": procesos_resultado
        }

    def obtener_desglose_variacion(self, empresa_id: str, pericodi_actual: int):
        # """
        # Obtiene el desglose de la variación económica
        # por proceso, valorización y concepto.
        # """

        # Buscar el periodo anterior disponible
        periodos_disponibles = (
            self.evolucion[
                self.evolucion["empresa_deudora"] == empresa_id
            ]["pericodi"]
            .dropna()
            .unique()
        )

        periodos_disponibles = sorted(
            [int(p) for p in periodos_disponibles]
        )

        anteriores = [
            p for p in periodos_disponibles
            if p < pericodi_actual
        ]

        if not anteriores:
            return {
                "encontrado": False,
                "mensaje": (
                    f"No existe un periodo anterior disponible "
                    f"para {empresa_id}."
                )
            }

        pericodi_anterior = max(anteriores)

        # Filtrar empresa y ambos periodos
        df = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (
                self.evolucion["pericodi"].isin(
                    [pericodi_actual, pericodi_anterior]
                )
            )
        ].copy()

        # Convertir monto a numérico
        df["monto"] = pd.to_numeric(
            df["monto"],
            errors="coerce"
        )

        # Agrupar por proceso, valorización y concepto
        agrupado = (
            df.groupby(
                [
                    "proceso",
                    "valorizacion",
                    "concepto",
                    "pericodi"
                ],
                as_index=False
            )["monto"]
            .sum()
        )

        # Separar periodo actual y anterior
        actual = agrupado[
            agrupado["pericodi"] == pericodi_actual
        ].drop(columns=["pericodi"])

        anterior = agrupado[
            agrupado["pericodi"] == pericodi_anterior
        ].drop(columns=["pericodi"])

        # Unir ambos periodos
        comparacion = actual.merge(
            anterior,
            on=["proceso", "valorizacion", "concepto"],
            how="outer",
            suffixes=("_actual", "_anterior")
        )

        comparacion["monto_actual"] = comparacion[
            "monto_actual"
        ].fillna(0)

        comparacion["monto_anterior"] = comparacion[
            "monto_anterior"
        ].fillna(0)

        comparacion["variacion"] = (
            comparacion["monto_actual"]
            - comparacion["monto_anterior"]
        )

        # Calcular porcentaje
        comparacion["variacion_pct"] = 0.0

        mask = comparacion["monto_anterior"] != 0

        comparacion.loc[mask, "variacion_pct"] = (
            comparacion.loc[mask, "variacion"]
            / comparacion.loc[mask, "monto_anterior"].abs()
        ) * 100

        # Ordenar por impacto absoluto
        comparacion["impacto_abs"] = (
            comparacion["variacion"].abs()
        )

        comparacion = comparacion.sort_values(
            "impacto_abs",
            ascending=False
        )

        # Construir resultado
        desglose = []

        for _, fila in comparacion.iterrows():
            desglose.append({
                "proceso": fila["proceso"],
                "valorizacion": fila["valorizacion"],
                "concepto": fila["concepto"],
                "actual": float(fila["monto_actual"]),
                "anterior": float(fila["monto_anterior"]),
                "variacion": float(fila["variacion"]),
                "variacion_pct": float(fila["variacion_pct"])
            })

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "periodo_actual": int(pericodi_actual),
            "periodo_anterior": int(pericodi_anterior),
            "desglose": desglose
        }

    def obtener_principales_impulsores(
        self,
        empresa_id: str,
        pericodi_actual: int,
        limite: int = 5
    ):
        """
        Identifica los principales movimientos que explican
        la variación de una liquidación.
        """

        resultado = self.obtener_desglose_variacion(
            empresa_id,
            pericodi_actual
        )

        if not resultado["encontrado"]:
            return resultado

        desglose = resultado["desglose"]

        if not desglose:
            return {
                "encontrado": False,
                "mensaje": "No existen movimientos para analizar."
            }

        # Convertir a DataFrame para facilitar el análisis
        df = pd.DataFrame(desglose)

        # Asegurar que los valores sean numéricos
        df["actual"] = pd.to_numeric(
            df["actual"],
            errors="coerce"
        )

        df["anterior"] = pd.to_numeric(
            df["anterior"],
            errors="coerce"
        )

        df["variacion"] = pd.to_numeric(
            df["variacion"],
            errors="coerce"
        )

        df["variacion_pct"] = pd.to_numeric(
            df["variacion_pct"],
            errors="coerce"
        )

        # Eliminar movimientos sin variación
        df = df[
            df["variacion"].fillna(0) != 0
        ].copy()

        if df.empty:
            return {
                "encontrado": True,
                "empresa": empresa_id,
                "periodo_actual": pericodi_actual,
                "movimientos": [],
                "principal_reduccion": None,
                "principal_incremento": None
            }

        # Impacto absoluto
        df["impacto_abs"] = df["variacion"].abs()

        # Orden general por impacto
        df = df.sort_values(
            "impacto_abs",
            ascending=False
        )

        # Principales movimientos
        principales = []

        for _, fila in df.head(limite).iterrows():
            principales.append({
                "proceso": fila["proceso"],
                "valorizacion": fila["valorizacion"],
                "concepto": fila["concepto"],
                "actual": float(fila["actual"]),
                "anterior": float(fila["anterior"]),
                "variacion": float(fila["variacion"]),
                "variacion_pct": float(fila["variacion_pct"])
            })

        # Principal reducción
        reducciones = df[
            df["variacion"] < 0
        ]

        if reducciones.empty:
            principal_reduccion = None
        else:
            fila = reducciones.sort_values(
                "variacion"
            ).iloc[0]

            principal_reduccion = {
                "proceso": fila["proceso"],
                "valorizacion": fila["valorizacion"],
                "concepto": fila["concepto"],
                "variacion": float(fila["variacion"]),
                "variacion_pct": float(fila["variacion_pct"])
            }

        # Principal incremento
        incrementos = df[
            df["variacion"] > 0
        ]

        if incrementos.empty:
            principal_incremento = None
        else:
            fila = incrementos.sort_values(
                "variacion",
                ascending=False
            ).iloc[0]

            principal_incremento = {
                "proceso": fila["proceso"],
                "valorizacion": fila["valorizacion"],
                "concepto": fila["concepto"],
                "variacion": float(fila["variacion"]),
                "variacion_pct": float(fila["variacion_pct"])
            }

        # Variación total
        variacion_total = df["variacion"].sum()

        # Impacto explicado por los principales movimientos
        impacto_principales = df.head(limite)[
            "variacion"
        ].sum()

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "periodo_actual": pericodi_actual,
            "periodo_anterior": resultado["periodo_anterior"],
            "variacion_total_movimientos": float(
                variacion_total
            ),
            "impacto_principales": float(
                impacto_principales
            ),
            "movimientos": principales,
            "principal_reduccion": principal_reduccion,
            "principal_incremento": principal_incremento
        }

    def obtener_soporte_lvta(
        self,
        empresa_id: str,
        pericodi_actual: int
    ):
        """
        Obtiene los datos intermedios de Energía Activa
        relacionados con una empresa y periodo.

        Este resultado representa trazabilidad/soporte
        del resultado de LVTA, no una causalidad confirmada.
        """

        df = self.energia_transferencias.copy()

        # Filtrar empresa y periodo
        df = df[
            (df["emprcodi"] == empresa_id)
            & (df["pericodi"] == pericodi_actual)
        ].copy()

        if df.empty:
            return {
                "encontrado": False,
                "empresa": empresa_id,
                "pericodi": pericodi_actual,
                "mensaje": (
                    "No se encontraron datos intermedios "
                    "de Energía Activa para la empresa y periodo."
                )
            }

        # Convertir monto a numérico
        df["vtotemtotal"] = pd.to_numeric(
            df["vtotemtotal"],
            errors="coerce"
        )

        registros = []

        for _, fila in df.iterrows():
            registros.append({
                "emprcodi": fila["emprcodi"],
                "emprruc": fila["emprruc"],
                "vtotemcodi": fila["vtotemcodi"],
                "version": fila["version"],
                "recanombre": fila["recanombre"],
                "vtotemtotal": float(
                    fila["vtotemtotal"]
                ) if pd.notna(fila["vtotemtotal"]) else None,
                "pericodi": int(fila["pericodi"]),
                "perinombre": fila["perinombre"],
                "periodo_preliminar": fila.get(
                    "periodo_preliminar",
                    None
                )
            })

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": int(pericodi_actual),
            "dataset_origen": (
                "reportes_intermedios/"
                "energia_activa/"
                "transferencias_por_empresa.json"
            ),
            "cantidad_registros": len(registros),
            "registros": registros
        }

    def validar_trazabilidad_lvta(
        self,
        empresa_id,
        pericodi_actual
    ):
        variacion = self.obtener_variacion_empresa(
            empresa_id,
            pericodi_actual
        )

        if not variacion.get("encontrado"):
            return {
                "encontrado": False,
                "mensaje": "No se encontró información de variación."
            }

        pericodi_anterior = variacion["periodo_anterior"]["pericodi"]

        # ---------------------------------------------------------
        # 1. Obtener resultado LVTA del periodo actual
        # ---------------------------------------------------------

        resultado_lvta_actual = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi_actual)
            & (self.evolucion["proceso"] == "LVTA")
        ].copy()

        # ---------------------------------------------------------
        # 2. Obtener resultado LVTA del periodo anterior
        # ---------------------------------------------------------

        resultado_lvta_anterior = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi_anterior)
            & (self.evolucion["proceso"] == "LVTA")
        ].copy()

        if resultado_lvta_actual.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró resultado LVTA "
                    "para el periodo actual."
                )
            }

        if resultado_lvta_anterior.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró resultado LVTA "
                    "para el periodo anterior."
                )
            }

        # ---------------------------------------------------------
        # 3. Convertir montos a valores numéricos
        # ---------------------------------------------------------

        resultado_lvta_actual["monto"] = pd.to_numeric(
            resultado_lvta_actual["monto"],
            errors="coerce"
        )

        resultado_lvta_anterior["monto"] = pd.to_numeric(
            resultado_lvta_anterior["monto"],
            errors="coerce"
        )

        # ---------------------------------------------------------
        # 4. Total LVTA por periodo
        # ---------------------------------------------------------

        valor_resultado_actual = float(
            resultado_lvta_actual["monto"].sum()
        )

        valor_resultado_anterior = float(
            resultado_lvta_anterior["monto"].sum()
        )
        # ---------------------------------------------------------
        # 5. Obtener soporte LVTA
        # ---------------------------------------------------------

        soporte_actual = self.obtener_soporte_lvta(
            empresa_id,
            pericodi_actual
        )

        soporte_anterior = self.obtener_soporte_lvta(
            empresa_id,
            pericodi_anterior
        )

        if not soporte_actual.get("encontrado"):
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró soporte LVTA "
                    "para el periodo actual."
                )
            }

        if not soporte_anterior.get("encontrado"):
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró soporte LVTA "
                    "para el periodo anterior."
                )
            }

        # ---------------------------------------------------------
        # 6. Valores del soporte
        # ---------------------------------------------------------

        soporte_valor_actual = float(
            sum(
                pd.to_numeric(
                    registro["vtotemtotal"],
                    errors="coerce"
                )
                for registro in soporte_actual["registros"]
            )
        )

        soporte_valor_anterior = float(
            sum(
                pd.to_numeric(
                    registro["vtotemtotal"],
                    errors="coerce"
                )
                for registro in soporte_anterior["registros"]
            )
        )

        # ---------------------------------------------------------
        # 7. Comparar resultado contra soporte
        # ---------------------------------------------------------

        diferencia_actual = (
            valor_resultado_actual
            - soporte_valor_actual
        )

        diferencia_anterior = (
            valor_resultado_anterior
            - soporte_valor_anterior
        )

        tolerancia = 0.01

        coincide_actual = (
            abs(diferencia_actual) <= tolerancia
        )

        coincide_anterior = (
            abs(diferencia_anterior) <= tolerancia
        )

        # ---------------------------------------------------------
        # 8. Determinar estado de trazabilidad
        # ---------------------------------------------------------

        # La trazabilidad informa si el resultado de liquidación
        # coincide con el soporte intermedio.
        #
        # Una diferencia de trazabilidad NO implica por sí sola
        # un bloqueo de cierre.
        #
        # El periodo actual tiene prioridad.
        # El periodo anterior se conserva únicamente como
        # antecedente histórico.

        if coincide_actual:

            estado = "OK"
            nivel = "NORMAL"

        else:

            estado = "OBSERVACION"
            nivel = "MEDIO"

        # ---------------------------------------------------------
        # 9. Retornar diagnóstico
        # ---------------------------------------------------------

        return {
            "encontrado": True,
            "empresa": empresa_id,

            "periodo_actual": pericodi_actual,
            "periodo_anterior": pericodi_anterior,

            "lvta": {
                "actual": valor_resultado_actual,
                "anterior": valor_resultado_anterior,
                "variacion": (
                    valor_resultado_actual
                    - valor_resultado_anterior
                )
            },

            "soporte_lvta": {
                "actual": soporte_valor_actual,
                "anterior": soporte_valor_anterior,
                "variacion": (
                    soporte_valor_actual
                    - soporte_valor_anterior
                )
            },

            "evidencia": {
                "dataset_origen": soporte_actual["dataset_origen"],


                "periodo_actual": {
                    "pericodi": pericodi_actual,
                    "perinombre": soporte_actual["registros"][0]["perinombre"],
                    "version": soporte_actual["registros"][0].get("version"),
                    "recanombre": soporte_actual["registros"][0].get("recanombre"),
                    "periodo_preliminar": soporte_actual["registros"][0].get(
                        "periodo_preliminar"
                    )
                },

                "periodo_anterior": {
                    "pericodi": pericodi_anterior,
                    "perinombre": soporte_anterior["registros"][0]["perinombre"],
                    "version": soporte_anterior["registros"][0].get("version"),
                    "recanombre": soporte_anterior["registros"][0].get("recanombre"),
                    "periodo_preliminar": soporte_anterior["registros"][0].get(
                        "periodo_preliminar"
                    )
                }


            },


            "validacion": {
                "estado": estado,
                "nivel": nivel,

                "periodo_actual": {
                    "resultado": valor_resultado_actual,
                    "soporte": soporte_valor_actual,
                    "diferencia": diferencia_actual,
                    "coincide": coincide_actual,
                    "estado": (
                        "OK"
                        if coincide_actual
                        else "DISCREPANCIA"
                    )
                },

                "periodo_anterior": {
                    "resultado": valor_resultado_anterior,
                    "soporte": soporte_valor_anterior,
                    "diferencia": diferencia_anterior,
                    "coincide": coincide_anterior,
                    "estado": (
                        "OK"
                        if coincide_anterior
                        else "DISCREPANCIA"
                    )
                },

                "tolerancia": tolerancia
            }
        }

    def obtener_causas_variacion_lvta(
        self,
        empresa_id: str,
        pericodi_actual: int,
        limite: int = 5
    ):
        """
        Explica la variación de LVTA entre el periodo actual
        y el periodo anterior, descomponiéndola por
        valorización y concepto.

        El resultado representa factores relacionados con
        la variación observada y no una causalidad física
        confirmada.
        """

        variacion = self.obtener_variacion_empresa(
            empresa_id,
            pericodi_actual
        )

        if not variacion.get("encontrado"):
            return {
                "encontrado": False,
                "empresa": empresa_id,
                "pericodi": pericodi_actual,
                "mensaje": (
                    "No se encontró información de variación."
                )
            }

        pericodi_anterior = variacion[
            "periodo_anterior"
        ]["pericodi"]

        # ---------------------------------------------------------
        # 1. Resultado LVTA actual
        # ---------------------------------------------------------

        actual = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi_actual)
            & (self.evolucion["proceso"] == "LVTA")
        ].copy()

        # ---------------------------------------------------------
        # 2. Resultado LVTA anterior
        # ---------------------------------------------------------

        anterior = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi_anterior)
            & (self.evolucion["proceso"] == "LVTA")
        ].copy()

        if actual.empty and anterior.empty:
            return {
                "encontrado": False,
                "empresa": empresa_id,
                "pericodi": pericodi_actual,
                "mensaje": (
                    "No se encontraron registros LVTA "
                    "para los periodos comparados."
                )
            }

        # ---------------------------------------------------------
        # 3. Convertir montos
        # ---------------------------------------------------------

        actual["monto"] = pd.to_numeric(
            actual["monto"],
            errors="coerce"
        ).fillna(0)

        anterior["monto"] = pd.to_numeric(
            anterior["monto"],
            errors="coerce"
        ).fillna(0)

        # ---------------------------------------------------------
        # 4. Agrupar por valorización y concepto
        # ---------------------------------------------------------

        columnas = [
            "valorizacion",
            "concepto"
        ]

        actual_agrupado = (
            actual
            .groupby(columnas, dropna=False)["monto"]
            .sum()
            .reset_index()
            .rename(columns={"monto": "actual"})
        )

        anterior_agrupado = (
            anterior
            .groupby(columnas, dropna=False)["monto"]
            .sum()
            .reset_index()
            .rename(columns={"monto": "anterior"})
        )

        # ---------------------------------------------------------
        # 5. Unir ambos periodos
        # ---------------------------------------------------------

        movimientos = pd.merge(
            actual_agrupado,
            anterior_agrupado,
            on=columnas,
            how="outer"
        )

        movimientos["actual"] = (
            movimientos["actual"]
            .fillna(0)
        )

        movimientos["anterior"] = (
            movimientos["anterior"]
            .fillna(0)
        )

        # ---------------------------------------------------------
        # 6. Calcular variación
        # ---------------------------------------------------------

        movimientos["variacion"] = (
            movimientos["actual"]
            - movimientos["anterior"]
        )

        def calcular_variacion_pct(fila):
            anterior_valor = fila["anterior"]
            variacion_valor = fila["variacion"]

            if anterior_valor == 0:
                if variacion_valor == 0:
                    return 0.0
                return None

            return (
                variacion_valor
                / abs(anterior_valor)
            ) * 100

        movimientos["variacion_pct"] = (
            movimientos.apply(
                calcular_variacion_pct,
                axis=1
            )
        )

        # ---------------------------------------------------------
        # 7. Ordenar por impacto absoluto
        # ---------------------------------------------------------

        movimientos["impacto_abs"] = (
            movimientos["variacion"]
            .abs()
        )

        movimientos = movimientos.sort_values(
            "impacto_abs",
            ascending=False
        )

        # ---------------------------------------------------------
        # 8. Limitar principales movimientos
        # ---------------------------------------------------------

        principales = movimientos.head(limite)

        registros = []

        for _, fila in principales.iterrows():

            registros.append({
                "valorizacion": fila["valorizacion"],
                "concepto": fila["concepto"],
                "actual": float(fila["actual"]),
                "anterior": float(fila["anterior"]),
                "variacion": float(fila["variacion"]),
                "variacion_pct": (
                    float(fila["variacion_pct"])
                    if pd.notna(fila["variacion_pct"])
                    else None
                ),
                "tipo": (
                    "INCREMENTO"
                    if fila["variacion"] > 0
                    else "REDUCCION"
                    if fila["variacion"] < 0
                    else "SIN_CAMBIO"
                )
            })

        # ---------------------------------------------------------
        # 9. Totales
        # ---------------------------------------------------------

        valor_actual = float(
            actual["monto"].sum()
        )

        valor_anterior = float(
            anterior["monto"].sum()
        )

        variacion_total = (
            valor_actual
            - valor_anterior
        )

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "proceso": "LVTA",
            "periodo_actual": {
                "pericodi": pericodi_actual,
                "perinombre": (
                    actual["perinombre"].iloc[0]
                    if not actual.empty
                    else None
                )
            },
            "periodo_anterior": {
                "pericodi": pericodi_anterior,
                "perinombre": (
                    anterior["perinombre"].iloc[0]
                    if not anterior.empty
                    else None
                )
            },
            "resumen": {
                "actual": valor_actual,
                "anterior": valor_anterior,
                "variacion": variacion_total
            },
            "principales_movimientos": registros,
            "nota": (
                "Los movimientos identificados representan "
                "factores relacionados con la variación "
                "observada en LVTA y no constituyen por sí "
                "solos una causalidad física confirmada."
            )
        }

    def validar_integridad_lscio(
        self,
        empresa_id,
        pericodi
    ):
        # ---------------------------------------------------------
        # 1. Obtener transferencia total LSCIO
        # ---------------------------------------------------------

        transferencia = self.lscio_transferencias[
            (self.lscio_transferencias["emprcodi"] == empresa_id)
            & (self.lscio_transferencias["pericodi"] == pericodi)
        ].copy()

        # ---------------------------------------------------------
        # 2. Obtener desglose LSCIO por mecanismo
        # ---------------------------------------------------------

        desglose = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (self.lscio_desglose["pericodi"] == pericodi)
        ].copy()

        # ---------------------------------------------------------
        # 3. Validar existencia de información
        # ---------------------------------------------------------

        if transferencia.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró transferencia LSCIO "
                    "para la empresa y periodo."
                )
            }

        if desglose.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró desglose LSCIO "
                    "para la empresa y periodo."
                )
            }

        # ---------------------------------------------------------
        # 4. Convertir montos a valores numéricos
        # ---------------------------------------------------------

        transferencia["monto_total"] = pd.to_numeric(
            transferencia["monto_total"],
            errors="coerce"
        )

        desglose["monto"] = pd.to_numeric(
            desglose["monto"],
            errors="coerce"
        )

        # ---------------------------------------------------------
        # 5. Obtener total de transferencia
        # ---------------------------------------------------------

        monto_transferencia = float(
            transferencia["monto_total"].sum()
        )

        # ---------------------------------------------------------
        # 6. Obtener total desde el desglose
        # ---------------------------------------------------------

        monto_desglose = float(
            desglose["monto"].sum()
        )

        # ---------------------------------------------------------
        # 7. Calcular diferencia
        # ---------------------------------------------------------

        diferencia = (
            monto_transferencia
            - monto_desglose
        )

        tolerancia = 0.01

        coincide = (
            abs(diferencia) <= tolerancia
        )

        # ---------------------------------------------------------
        # 8. Determinar estado
        # ---------------------------------------------------------

        if coincide:
            estado = "OK"
            nivel = "NORMAL"
        else:
            estado = "REVISAR"
            nivel = "ALTO"

        # ---------------------------------------------------------
        # 9. Obtener desglose por mecanismo
        # ---------------------------------------------------------

        mecanismos = (
            desglose
            .groupby(
                "mecanismo",
                as_index=False
            )["monto"]
            .sum()
            .sort_values(
                "monto",
                ascending=False
            )
        )

        detalle_mecanismos = []

        for _, fila in mecanismos.iterrows():
            detalle_mecanismos.append(
                {
                    "mecanismo": str(
                        fila["mecanismo"]
                    ),
                    "monto": float(fila["monto"])
                }
            )

        # ---------------------------------------------------------
        # 10. Retornar resultado
        # ---------------------------------------------------------

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": pericodi,

            "transferencia": {
                "monto_total": monto_transferencia,
                "cantidad_registros": len(transferencia)
            },

            "desglose": {
                "monto_total": monto_desglose,
                "cantidad_registros": len(desglose),
                "mecanismos": detalle_mecanismos
            },

            "validacion": {
                "regla": (
                    "Transferencia LSCIO = "
                    "SUM(desglose por mecanismo)"
                ),
                "estado": estado,
                "nivel": nivel,
                "diferencia": diferencia,
                "coincide": coincide,
                "tolerancia": tolerancia
            }
        }

    def obtener_causas_variacion_lscio(
        self,
        empresa_id,
        pericodi_actual
    ):
        # """
        # Explica la variación de LSCIO entre el periodo actual
        # y el periodo anterior, utilizando el desglose por mecanismo.
        # """

        # -----------------------------------------------------
        # 1. Obtener periodo anterior
        # -----------------------------------------------------

        periodos_empresa = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ]

        periodos_disponibles = sorted(
            periodos_empresa["pericodi"].unique()
        )

        periodos_anteriores = [
            p for p in periodos_disponibles
            if p < pericodi_actual
        ]

        if not periodos_anteriores:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe un periodo anterior "
                    "para realizar la comparación."
                )
            }

        pericodi_anterior = max(periodos_anteriores)

        # -----------------------------------------------------
        # 2. Obtener desglose LSCIO actual
        # -----------------------------------------------------

        detalle_actual = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi_actual
            )
        ].copy()

        # -----------------------------------------------------
        # 3. Obtener desglose LSCIO anterior
        # -----------------------------------------------------

        detalle_anterior = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi_anterior
            )
        ].copy()

        # -----------------------------------------------------
        # 4. Validar existencia
        # -----------------------------------------------------

        if detalle_actual.empty and detalle_anterior.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe desglose LSCIO "
                    "para los periodos seleccionados."
                )
            }

        # -----------------------------------------------------
        # 5. Convertir monto a numérico
        # -----------------------------------------------------

        detalle_actual["monto"] = pd.to_numeric(
            detalle_actual["monto"],
            errors="coerce"
        )

        detalle_anterior["monto"] = pd.to_numeric(
            detalle_anterior["monto"],
            errors="coerce"
        )

        # Eliminar registros cuyo monto no pueda convertirse
        detalle_actual = detalle_actual.dropna(
            subset=["monto"]
        )

        detalle_anterior = detalle_anterior.dropna(
            subset=["monto"]
        )

        # -----------------------------------------------------
        # 6. Agrupar por mecanismo
        # -----------------------------------------------------

        actual_mecanismos = (
            detalle_actual
            .groupby("mecanismo", as_index=False)["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "actual"
                }
            )
        )

        anterior_mecanismos = (
            detalle_anterior
            .groupby("mecanismo", as_index=False)["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "anterior"
                }
            )
        )

        # -----------------------------------------------------
        # 6. Unir mecanismos de ambos periodos
        # -----------------------------------------------------

        mecanismos = pd.merge(
            actual_mecanismos,
            anterior_mecanismos,
            on="mecanismo",
            how="outer"
        )

        mecanismos["actual"] = mecanismos[
            "actual"
        ].fillna(0)

        mecanismos["anterior"] = mecanismos[
            "anterior"
        ].fillna(0)

        # -----------------------------------------------------
        # 7. Calcular variación
        # -----------------------------------------------------

        mecanismos["variacion"] = (
            mecanismos["actual"]
            - mecanismos["anterior"]
        )

        mecanismos["variacion_pct"] = mecanismos.apply(
            lambda fila: (
                (
                    fila["variacion"]
                    / abs(fila["anterior"])
                ) * 100
                if fila["anterior"] != 0
                else None
            ),
            axis=1
        )

        # -----------------------------------------------------
        # 8. Ordenar por impacto absoluto
        # -----------------------------------------------------

        mecanismos["impacto"] = (
            mecanismos["variacion"]
            .abs()
        )

        mecanismos = mecanismos.sort_values(
            by="impacto",
            ascending=False
        )

        # -----------------------------------------------------
        # 9. Totales
        # -----------------------------------------------------

        total_actual = detalle_actual["monto"].sum()

        total_anterior = detalle_anterior["monto"].sum()

        variacion_total = (
            total_actual
            - total_anterior
        )

        variacion_pct = (
            (
                variacion_total
                / abs(total_anterior)
            ) * 100
            if total_anterior != 0
            else None
        )

        # -----------------------------------------------------
        # 10. Convertir a respuesta JSON
        # -----------------------------------------------------

        movimientos = []

        for _, fila in mecanismos.iterrows():

            movimientos.append(
                {
                    "mecanismo": fila["mecanismo"],
                    "actual": float(
                        fila["actual"]
                    ),
                    "anterior": float(
                        fila["anterior"]
                    ),
                    "variacion": float(
                        fila["variacion"]
                    ),
                    "variacion_pct": (
                        float(
                            fila["variacion_pct"]
                        )
                        if pd.notna(
                            fila["variacion_pct"]
                        )
                        else None
                    )
                }
            )

        # -----------------------------------------------------
        # 11. Principal incremento y reducción
        # -----------------------------------------------------

        incrementos = [
            movimiento
            for movimiento in movimientos
            if movimiento["variacion"] > 0
        ]

        reducciones = [
            movimiento
            for movimiento in movimientos
            if movimiento["variacion"] < 0
        ]

        principal_incremento = (
            max(
                incrementos,
                key=lambda x: x["variacion"]
            )
            if incrementos
            else None
        )

        principal_reduccion = (
            min(
                reducciones,
                key=lambda x: x["variacion"]
            )
            if reducciones
            else None
        )

        return {
            "encontrado": True,

            "proceso": "LSCIO",

            "periodo_actual": {
                "pericodi": int(pericodi_actual)
            },

            "periodo_anterior": {
                "pericodi": int(pericodi_anterior)
            },

            "resumen": {
                "actual": float(
                    total_actual
                ),
                "anterior": float(
                    total_anterior
                ),
                "variacion": float(
                    variacion_total
                ),
                "variacion_pct": (
                    float(
                        variacion_pct
                    )
                    if variacion_pct is not None
                    else None
                )
            },

            "principal_incremento": (
                principal_incremento
            ),

            "principal_reduccion": (
                principal_reduccion
            ),

            "mecanismos": movimientos
        }

    def validar_reconstruccion_lscio(
        self,
        empresa_id,
        pericodi
    ):
        # """
        # Valida que el total del desglose LSCIO
        # pueda reconstruirse mediante la suma de sus mecanismos.
        # """

        detalle = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi
            )
        ].copy()

        if detalle.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe desglose LSCIO "
                    "para el periodo seleccionado."
                )
            }

        # Convertir monto a numérico
        detalle["monto"] = pd.to_numeric(
            detalle["monto"],
            errors="coerce"
        )

        detalle = detalle.dropna(
            subset=["monto"]
        )

        # Total del detalle
        total_detalle = detalle["monto"].sum()

        # Total reconstruido por mecanismo
        total_mecanismos = (
            detalle
            .groupby("mecanismo")["monto"]
            .sum()
            .sum()
        )

        diferencia = (
            total_detalle
            - total_mecanismos
        )

        estado = (
            "OK"
            if abs(diferencia) <= 0.01
            else "REVISAR"
        )

        mecanismos = (
            detalle
            .groupby("mecanismo", as_index=False)["monto"]
            .sum()
        )

        movimientos = []

        for _, fila in mecanismos.iterrows():

            movimientos.append(
                {
                    "mecanismo": str(
                        fila["mecanismo"]
                    ),
                    "monto": float(
                        fila["monto"]
                    )
                }
            )

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": int(pericodi),

            "estado": estado,

            "total_detalle": float(
                total_detalle
            ),

            "total_mecanismos": float(
                total_mecanismos
            ),

            "diferencia": float(
                diferencia
            ),

            "tolerancia": 0.01,

            "mecanismos": movimientos
        }

    def obtener_causas_concepto_lscio(
        self,
        empresa_id,
        pericodi_actual
    ):
        """
        Explica la variación de LSCIO entre el periodo actual
        y el periodo anterior, bajando del mecanismo al concepto.
        """

        # -----------------------------------------------------
        # 1. Obtener periodo anterior
        # -----------------------------------------------------

        periodos_empresa = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ]

        periodos_disponibles = sorted(
            periodos_empresa["pericodi"].unique()
        )

        periodos_anteriores = [
            p for p in periodos_disponibles
            if p < pericodi_actual
        ]

        if not periodos_anteriores:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe un periodo anterior "
                    "para realizar la comparación."
                )
            }

        pericodi_anterior = max(
            periodos_anteriores
        )

        # -----------------------------------------------------
        # 2. Obtener detalle actual
        # -----------------------------------------------------

        detalle_actual = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi_actual
            )
        ].copy()

        # -----------------------------------------------------
        # 3. Obtener detalle anterior
        # -----------------------------------------------------

        detalle_anterior = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi_anterior
            )
        ].copy()

        # -----------------------------------------------------
        # 4. Validar existencia
        # -----------------------------------------------------

        if detalle_actual.empty and detalle_anterior.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe desglose LSCIO "
                    "para los periodos seleccionados."
                )
            }

        # -----------------------------------------------------
        # 5. Convertir monto
        # -----------------------------------------------------

        detalle_actual["monto"] = pd.to_numeric(
            detalle_actual["monto"],
            errors="coerce"
        )

        detalle_anterior["monto"] = pd.to_numeric(
            detalle_anterior["monto"],
            errors="coerce"
        )

        detalle_actual = detalle_actual.dropna(
            subset=["monto"]
        )

        detalle_anterior = detalle_anterior.dropna(
            subset=["monto"]
        )

        # -----------------------------------------------------
        # 6. Agrupar por mecanismo + concepto
        # -----------------------------------------------------

        actual_conceptos = (
            detalle_actual
            .groupby(
                ["mecanismo", "concepto"],
                as_index=False
            )["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "actual"
                }
            )
        )

        anterior_conceptos = (
            detalle_anterior
            .groupby(
                ["mecanismo", "concepto"],
                as_index=False
            )["monto"]
            .sum()
            .rename(
                columns={
                    "monto": "anterior"
                }
            )
        )

        # -----------------------------------------------------
        # 7. Unir ambos periodos
        # -----------------------------------------------------

        conceptos = pd.merge(
            actual_conceptos,
            anterior_conceptos,
            on=[
                "mecanismo",
                "concepto"
            ],
            how="outer"
        )

        conceptos["actual"] = conceptos[
            "actual"
        ].fillna(0)

        conceptos["anterior"] = conceptos[
            "anterior"
        ].fillna(0)

        # -----------------------------------------------------
        # 8. Calcular variación
        # -----------------------------------------------------

        conceptos["variacion"] = (
            conceptos["actual"]
            - conceptos["anterior"]
        )

        conceptos["variacion_pct"] = conceptos.apply(
            lambda fila: (
                (
                    fila["variacion"]
                    / abs(fila["anterior"])
                ) * 100
                if fila["anterior"] != 0
                else None
            ),
            axis=1
        )

        conceptos["impacto"] = (
            conceptos["variacion"]
            .abs()
        )

        conceptos = conceptos.sort_values(
            by="impacto",
            ascending=False
        )

        # -----------------------------------------------------
        # 9. Convertir a respuesta JSON
        # -----------------------------------------------------

        movimientos = []

        for _, fila in conceptos.iterrows():

            movimientos.append(
                {
                    "mecanismo": str(
                        fila["mecanismo"]
                    ),

                    "concepto": str(
                        fila["concepto"]
                    ),

                    "actual": float(
                        fila["actual"]
                    ),

                    "anterior": float(
                        fila["anterior"]
                    ),

                    "variacion": float(
                        fila["variacion"]
                    ),

                    "variacion_pct": (
                        float(
                            fila["variacion_pct"]
                        )
                        if pd.notna(
                            fila["variacion_pct"]
                        )
                        else None
                    )
                }
            )

        # -----------------------------------------------------
        # 10. Agrupar conceptos por mecanismo
        # -----------------------------------------------------

        mecanismos = {}

        for movimiento in movimientos:

            mecanismo = movimiento[
                "mecanismo"
            ]

            if mecanismo not in mecanismos:
                mecanismos[mecanismo] = []

            mecanismos[mecanismo].append(
                {
                    "concepto": movimiento[
                        "concepto"
                    ],
                    "actual": movimiento[
                        "actual"
                    ],
                    "anterior": movimiento[
                        "anterior"
                    ],
                    "variacion": movimiento[
                        "variacion"
                    ],
                    "variacion_pct": movimiento[
                        "variacion_pct"
                    ]
                }
            )

        # -----------------------------------------------------
        # 11. Retornar resultado
        # -----------------------------------------------------

        return {
            "encontrado": True,

            "proceso": "LSCIO",

            "periodo_actual": {
                "pericodi": int(
                    pericodi_actual
                )
            },

            "periodo_anterior": {
                "pericodi": int(
                    pericodi_anterior
                )
            },

            "mecanismos": mecanismos,

            "movimientos": movimientos
        }

    def validar_reconstruccion_conceptos_lscio(
        self,
        empresa_id,
        pericodi
    ):
        """
        Valida que cada mecanismo LSCIO pueda reconstruirse
        mediante la suma de sus conceptos.
        """

        # -----------------------------------------------------
        # 1. Obtener detalle
        # -----------------------------------------------------

        detalle = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi
            )
        ].copy()

        if detalle.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No existe desglose LSCIO "
                    "para el periodo seleccionado."
                )
            }

        # -----------------------------------------------------
        # 2. Convertir monto
        # -----------------------------------------------------

        detalle["monto"] = pd.to_numeric(
            detalle["monto"],
            errors="coerce"
        )

        detalle = detalle.dropna(
            subset=["monto"]
        )

        # -----------------------------------------------------
        # 3. Total por mecanismo
        # -----------------------------------------------------

        totales_mecanismo = (
            detalle
            .groupby("mecanismo")["monto"]
            .sum()
        )

        # -----------------------------------------------------
        # 4. Total por mecanismo + concepto
        # -----------------------------------------------------

        conceptos = (
            detalle
            .groupby(
                [
                    "mecanismo",
                    "concepto"
                ]
            )["monto"]
            .sum()
        )

        # -----------------------------------------------------
        # 5. Validar reconstrucción
        # -----------------------------------------------------

        resultados = []

        for mecanismo in totales_mecanismo.index:

            total_mecanismo = float(
                totales_mecanismo[
                    mecanismo
                ]
            )

            total_conceptos = float(
                conceptos[
                    mecanismo
                ].sum()
            )

            diferencia = (
                total_mecanismo
                - total_conceptos
            )

            estado = (
                "OK"
                if abs(diferencia) <= 0.01
                else "REVISAR"
            )

            cantidad_conceptos = int(
                (
                    detalle[
                        detalle["mecanismo"]
                        == mecanismo
                    ]["concepto"]
                    .nunique()
                )
            )

            resultados.append(
                {
                    "mecanismo": str(
                        mecanismo
                    ),
                    "total_mecanismo": (
                        total_mecanismo
                    ),
                    "total_conceptos": (
                        total_conceptos
                    ),
                    "diferencia": float(
                        diferencia
                    ),
                    "cantidad_conceptos": (
                        cantidad_conceptos
                    ),
                    "estado": estado
                }
            )

        # -----------------------------------------------------
        # 6. Estado global
        # -----------------------------------------------------

        estado_global = (
            "OK"
            if all(
                item["estado"] == "OK"
                for item in resultados
            )
            else "REVISAR"
        )

        return {
            "encontrado": True,

            "empresa": empresa_id,

            "pericodi": int(
                pericodi
            ),

            "estado": estado_global,

            "mecanismos": resultados
        }

    def obtener_evidencia_concepto_lscio(
        self,
        empresa_id,
        pericodi,
        mecanismo,
        concepto
    ):
        """
        Obtiene los registros originales que componen
        un concepto específico de LSCIO y valida
        que su suma coincida con el importe del concepto.
        """

        # -----------------------------------------------------
        # 1. Filtrar registros
        # -----------------------------------------------------

        detalle = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (
                self.lscio_desglose["pericodi"]
                == pericodi
            )
            & (
                self.lscio_desglose["mecanismo"]
                == mecanismo
            )
            & (
                self.lscio_desglose["concepto"]
                == concepto
            )
        ].copy()

        # -----------------------------------------------------
        # 2. Validar existencia
        # -----------------------------------------------------

        if detalle.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontraron registros "
                    "para el concepto seleccionado."
                )
            }

        # -----------------------------------------------------
        # 3. Convertir monto
        # -----------------------------------------------------

        detalle["monto"] = pd.to_numeric(
            detalle["monto"],
            errors="coerce"
        )

        detalle = detalle.dropna(
            subset=["monto"]
        )

        # -----------------------------------------------------
        # 4. Calcular total
        # -----------------------------------------------------

        total = detalle["monto"].sum()

        cantidad_registros = len(
            detalle
        )

        # -----------------------------------------------------
        # 5. Obtener registros originales
        # -----------------------------------------------------

        registros = []

        for _, fila in detalle.iterrows():

            registro = {}

            for columna in detalle.columns:

                valor = fila[columna]

                if pd.isna(valor):
                    registro[columna] = None

                elif columna == "monto":
                    registro[columna] = float(
                        valor
                    )

                elif hasattr(valor, "item"):
                    registro[columna] = valor.item()

                else:
                    registro[columna] = valor

            registros.append(
                registro
            )

        # -----------------------------------------------------
        # 6. Validación
        # -----------------------------------------------------

        total_registros = sum(
            registro["monto"]
            for registro in registros
        )

        diferencia = (
            total
            - total_registros
        )

        estado = (
            "OK"
            if abs(diferencia) <= 0.01
            else "REVISAR"
        )

        # -----------------------------------------------------
        # 7. Respuesta
        # -----------------------------------------------------

        return {
            "encontrado": True,

            "empresa": empresa_id,

            "pericodi": int(
                pericodi
            ),

            "proceso": "LSCIO",

            "mecanismo": str(
                mecanismo
            ),

            "concepto": str(
                concepto
            ),

            "resumen": {
                "cantidad_registros": (
                    cantidad_registros
                ),
                "total": float(
                    total
                ),
                "total_registros": float(
                    total_registros
                ),
                "diferencia": float(
                    diferencia
                ),
                "estado": estado
            },

            "registros": registros
        }

    def obtener_explicacion_lscio(
        self,
        empresa_id,
        pericodi_actual,
        limite_conceptos=5
    ):
        """
        Construye una explicación consolidada de la variación
        de LSCIO, desde mecanismo hasta concepto y evidencia.
        """

        # -----------------------------------------------------
        # 1. Obtener variación por mecanismo
        # -----------------------------------------------------

        causas_mecanismos = (
            self.obtener_causas_variacion_lscio(
                empresa_id,
                pericodi_actual
            )
        )

        if not causas_mecanismos.get(
            "encontrado"
        ):
            return causas_mecanismos

        # -----------------------------------------------------
        # 2. Obtener variación por concepto
        # -----------------------------------------------------

        causas_conceptos = (
            self.obtener_causas_concepto_lscio(
                empresa_id,
                pericodi_actual
            )
        )

        if not causas_conceptos.get(
            "encontrado"
        ):
            return causas_conceptos

        # -----------------------------------------------------
        # 3. Seleccionar principales conceptos
        # -----------------------------------------------------

        movimientos = (
            causas_conceptos.get(
                "movimientos",
                []
            )
        )

        principales = sorted(
            movimientos,
            key=lambda x: abs(
                x["variacion"]
            ),
            reverse=True
        )[:limite_conceptos]

        # -----------------------------------------------------
        # 4. Incorporar evidencia
        # -----------------------------------------------------

        conceptos_explicativos = []

        for movimiento in principales:

            evidencia = (
                self.obtener_evidencia_concepto_lscio(
                    empresa_id,
                    pericodi_actual,
                    movimiento["mecanismo"],
                    movimiento["concepto"]
                )
            )

            conceptos_explicativos.append(
                {
                    "mecanismo": movimiento[
                        "mecanismo"
                    ],

                    "concepto": movimiento[
                        "concepto"
                    ],

                    "actual": movimiento[
                        "actual"
                    ],

                    "anterior": movimiento[
                        "anterior"
                    ],

                    "variacion": movimiento[
                        "variacion"
                    ],

                    "variacion_pct": movimiento[
                        "variacion_pct"
                    ],

                    "evidencia": evidencia
                }
            )

        # -----------------------------------------------------
        # 5. Respuesta consolidada
        # -----------------------------------------------------

        return {
            "encontrado": True,

            "empresa": empresa_id,

            "proceso": "LSCIO",

            "periodo_actual": (
                causas_mecanismos[
                    "periodo_actual"
                ]
            ),

            "periodo_anterior": (
                causas_mecanismos[
                    "periodo_anterior"
                ]
            ),

            "resumen": (
                causas_mecanismos[
                    "resumen"
                ]
            ),

            "mecanismos": (
                causas_mecanismos[
                    "mecanismos"
                ]
            ),

            "principales_conceptos": (
                conceptos_explicativos
            )
        }

    def inspeccionar_potencia(
        self,
        empresa_id,
        pericodi
    ):
        detalle = self.potencia_desglose[
            (self.potencia_desglose["emprcodi"] == empresa_id)
            & (self.potencia_desglose["pericodi"] == pericodi)
        ].copy()

        if detalle.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró desglose de Potencia "
                    "para la empresa y periodo."
                )
            }

        detalle["monto"] = pd.to_numeric(
            detalle["monto"],
            errors="coerce"
        )

        resumen = (
            detalle
            .groupby(
                ["valorizacion"],
                as_index=False
            )["monto"]
            .sum()
        )

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": pericodi,
            "cantidad_registros": len(detalle),
            "total": float(detalle["monto"].sum()),
            "valorizaciones": [
                {
                    "valorizacion": fila["valorizacion"],
                    "monto": float(fila["monto"])
                }
                for _, fila in resumen.iterrows()
            ],
            "detalle": detalle[
                [
                    "emprcodi",
                    "valorizacion",
                    "concepto",
                    "monto",
                    "pericodi",
                    "perinombre",
                    "periodo_preliminar"
                ]
            ].to_dict(
                orient="records"
            )
        }

    def validar_trazabilidad_lvtp(
        self,
        empresa_id,
        pericodi
    ):
        """
        Valida la trazabilidad del resultado LVTP
        frente al concepto de compensación del
        reporte intermedio de Potencia.

        La relación validada es:

        LVTP = - Compensación a Transmisoras
        por Ingreso Tarifario
        """

        # =====================================================
        # RESULTADO LVTP EN LA LIQUIDACIÓN
        # =====================================================

        liquidacion = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi)
            & (self.evolucion["proceso"] == "LVTP")
        ].copy()

        if liquidacion.empty:
            return {
                "encontrado": False,
                "empresa": empresa_id,
                "pericodi": pericodi,
                "mensaje": (
                    "No se encontró resultado LVTP "
                    "para la empresa y periodo."
                )
            }

        liquidacion["monto"] = pd.to_numeric(
            liquidacion["monto"],
            errors="coerce"
        )

        resultado_lvTP = liquidacion["monto"].sum()

        # =====================================================
        # SOPORTE INTERMEDIO DE POTENCIA
        # =====================================================

        soporte = self.potencia_desglose[
            (self.potencia_desglose["emprcodi"] == empresa_id)
            & (self.potencia_desglose["pericodi"] == pericodi)
            & (
                self.potencia_desglose["valorizacion"]
                == "COMPENSACIÓN A TRANSMISORAS POR INGRESO TARIFARIO"
            )
        ].copy()

        if soporte.empty:
            return {
                "encontrado": False,
                "empresa": empresa_id,
                "pericodi": pericodi,
                "resultado_lvta": float(resultado_lvTP),
                "mensaje": (
                    "Se encontró el resultado LVTP, "
                    "pero no se encontró el soporte de "
                    "Compensación a Transmisoras por "
                    "Ingreso Tarifario."
                )
            }

        soporte["monto"] = pd.to_numeric(
            soporte["monto"],
            errors="coerce"
        )

        monto_soporte = soporte["monto"].sum()

        # =====================================================
        # VALIDACIÓN
        # =====================================================

        esperado = -monto_soporte

        diferencia = resultado_lvTP - esperado

        tolerancia = 0.01

        coincide = abs(diferencia) <= tolerancia

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": pericodi,

            "resultado_liquidacion": float(
                resultado_lvTP
            ),

            "soporte_potencia": {
                "valorizacion": (
                    "COMPENSACIÓN A TRANSMISORAS "
                    "POR INGRESO TARIFARIO"
                ),
                "monto": float(
                    monto_soporte
                )
            },

            "relacion_validada": (
                "LVTP = - Compensación a "
                "Transmisoras por Ingreso Tarifario"
            ),

            "esperado": float(
                esperado
            ),

            "diferencia": float(
                diferencia
            ),

            "tolerancia": tolerancia,

            "estado": (
                "OK"
                if coincide
                else "REVISAR"
            ),

            "nivel": (
                "BAJO"
                if coincide
                else "MEDIO"
            ),

            "cantidad_registros_soporte": len(
                soporte
            )
        }

    def obtener_trazabilidad_empresa(
        self,
        empresa_id,
        pericodi
    ):
        """
        Construye la trazabilidad disponible de la liquidación
        de una empresa y periodo.

        La trazabilidad sigue el flujo:

        LIQUIDACIÓN
            ↓
        PROCESO
            ↓
        SOPORTE INTERMEDIO
            ↓
        DETALLE

        Representa relación y evidencia disponible
        en los datasets del hackathon.
        """

        trazabilidades = {}

        # =====================================================
        # LVTA
        # =====================================================

        lvta = self.validar_trazabilidad_lvta(
            empresa_id,
            pericodi
        )

        validacion_lvta = lvta.get(
            "validacion",
            {}
        )

        trazabilidades["LVTA"] = {
            "encontrado": lvta.get(
                "encontrado"
            ),

            "tipo": "TRAZABILIDAD",

            "resultado": validacion_lvta.get(
                "periodo_actual",
                {}
            ).get(
                "resultado"
            ),

            "soporte": validacion_lvta.get(
                "periodo_actual",
                {}
            ).get(
                "soporte"
            ),

            "validacion": validacion_lvta
        }

        # =====================================================
        # LVTP
        # =====================================================

        lvtp = self.validar_trazabilidad_lvtp(
            empresa_id,
            pericodi
        )

        trazabilidades["LVTP"] = {
            "encontrado": lvtp.get(
                "encontrado"
            ),

            "tipo": "TRAZABILIDAD",

            "resultado": lvtp.get(
                "resultado_liquidacion"
            ),

            "soporte": lvtp.get(
                "soporte_potencia"
            ),

            "relacion_validada": lvtp.get(
                "relacion_validada"
            ),

            "esperado": lvtp.get(
                "esperado"
            ),

            "diferencia": lvtp.get(
                "diferencia"
            ),

            "estado": lvtp.get(
                "estado"
            ),

            "nivel": lvtp.get(
                "nivel"
            )
        }

        # =====================================================
        # LSCIO
        # =====================================================

        lscio = self.validar_reconstruccion_lscio(
            empresa_id,
            pericodi
        )

        if lscio.get("encontrado"):

            causas_lscio = (
                self.obtener_causas_concepto_lscio(
                    empresa_id,
                    pericodi
                )
            )

            trazabilidades["LSCIO"] = {
                "encontrado": True,

                "tipo": "RECONSTRUCCION",

                "resultado": lscio.get(
                    "total_detalle"
                ),

                "mecanismos": lscio.get(
                    "mecanismos",
                    []
                ),

                "principales_conceptos": (
                    causas_lscio.get(
                        "movimientos",
                        []
                    )[:5]
                ),

                "estado": lscio.get(
                    "estado"
                )
            }

        else:

            trazabilidades["LSCIO"] = {
                "encontrado": False,

                "tipo": "NO_DISPONIBLE",

                "mensaje": lscio.get(
                    "mensaje",
                    "No existe desglose LSCIO "
                    "para el periodo seleccionado."
                )
            }

        # =====================================================
        # SST-SCT
        # =====================================================

        sstsct = self.inspeccionar_sstsct(
            empresa_id,
            pericodi
        )

        trazabilidades["SST-SCT"] = {
            "encontrado": sstsct.get(
                "encontrado"
            ),

            "tipo": "SOPORTE",

            "resultado": sstsct.get(
                "total"
            ),

            "valorizaciones": sstsct.get(
                "valorizaciones",
                []
            ),

            "cantidad_registros": sstsct.get(
                "cantidad_registros"
            )
        }

        # =====================================================
        # RESULTADO
        # =====================================================

        return {
            "encontrado": True,

            "empresa": empresa_id,

            "pericodi": pericodi,

            "nivel": "PROCESO",

            "trazabilidad": trazabilidades
        }

    def validar_trazabilidad_potencia(
        self,
        empresa_id,
        pericodi
    ):
        resultado = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi)
            & (self.evolucion["proceso"] == "LVTP")
            & (
                self.evolucion["valorizacion"]
                == "COMPENSACIÓN A TRANSMISORAS POR INGRESO TARIFARIO"
            )
        ].copy()

        soporte = self.potencia_desglose[
            (self.potencia_desglose["emprcodi"] == empresa_id)
            & (self.potencia_desglose["pericodi"] == pericodi)
            & (
                self.potencia_desglose["valorizacion"]
                == "COMPENSACIÓN A TRANSMISORAS POR INGRESO TARIFARIO"
            )
        ].copy()

        if resultado.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró resultado LVTP "
                    "de compensación por ingreso tarifario "
                    "para la empresa y periodo."
                )
            }

        if soporte.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró soporte de Potencia "
                    "de compensación por ingreso tarifario "
                    "para la empresa y periodo."
                )
            }

        resultado["monto"] = pd.to_numeric(
            resultado["monto"],
            errors="coerce"
        )

        soporte["monto"] = pd.to_numeric(
            soporte["monto"],
            errors="coerce"
        )

        monto_resultado = float(
            resultado["monto"].sum()
        )

        monto_soporte = float(
            soporte["monto"].sum()
        )

        monto_soporte_ajustado = -monto_soporte

        diferencia = (
            monto_resultado
            - monto_soporte_ajustado
        )

        tolerancia = 0.01

        coincide = (
            abs(diferencia) <= tolerancia
        )

        if coincide:
            estado = "OK"
            nivel = "NORMAL"
        else:
            estado = "REVISAR"
            nivel = "MEDIO"

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": pericodi,

            "resultado_lvtp": {
                "valorizacion": (
                    "COMPENSACIÓN A TRANSMISORAS "
                    "POR INGRESO TARIFARIO"
                ),
                "monto": monto_resultado,
                "cantidad_registros": len(resultado)
            },

            "soporte_potencia": {
                "valorizacion": (
                    "COMPENSACIÓN A TRANSMISORAS "
                    "POR INGRESO TARIFARIO"
                ),
                "monto_original": monto_soporte,
                "monto_ajustado": monto_soporte_ajustado,
                "cantidad_registros": len(soporte)
            },

            "validacion": {
                "regla_id": "REGLA-POTENCIA-001",
                "regla": (
                    "Resultado LVTP = "
                    "- SUM(desglose de Potencia)"
                ),
                "estado": estado,
                "nivel": nivel,
                "diferencia": diferencia,
                "coincide": coincide,
                "tolerancia": tolerancia
            }
        }

    def inspeccionar_sstsct(
        self,
        empresa_id,
        pericodi
    ):
        detalle = self.sstsct_desglose[
            (self.sstsct_desglose["emprcodi"] == empresa_id)
            & (self.sstsct_desglose["pericodi"] == pericodi)
        ].copy()

        if detalle.empty:
            return {
                "encontrado": False,
                "mensaje": (
                    "No se encontró desglose SST-SCT "
                    "para la empresa y periodo."
                )
            }

        detalle["monto"] = pd.to_numeric(
            detalle["monto"],
            errors="coerce"
        )

        resumen = (
            detalle
            .groupby(
                ["valorizacion"],
                as_index=False
            )["monto"]
            .sum()
        )

        return {
            "encontrado": True,
            "empresa": empresa_id,
            "pericodi": pericodi,
            "cantidad_registros": len(detalle),
            "total": float(
                detalle["monto"].sum()
            ),
            "valorizaciones": [
                {
                    "valorizacion": fila["valorizacion"],
                    "monto": float(fila["monto"])
                }
                for _, fila in resumen.iterrows()
            ],
            "detalle": detalle[
                [
                    "emprcodi",
                    "valorizacion",
                    "concepto",
                    "monto",
                    "pericodi",
                    "perinombre",
                    "periodo_preliminar"
                ]
            ].to_dict(
                orient="records"
            )
        }

    def obtener_explicacion_empresa(
        self,
        empresa_id: str,
        pericodi_actual: int
    ):
        """
        Construye una explicación consolidada de la liquidación
        de una empresa para un periodo determinado.

        Integra:
        - Resumen económico
        - Variación respecto al periodo anterior
        - Principales impulsores
        - Explicación específica por proceso
        """

        resumen = self.obtener_resumen_empresa(
            empresa_id,
            pericodi_actual
        )

        if not resumen.get("encontrado"):
            return resumen

        variacion = self.obtener_variacion_empresa(
            empresa_id,
            pericodi_actual
        )

        impulsores = self.obtener_principales_impulsores(
            empresa_id,
            pericodi_actual
        )

        # =====================================================
        # EXPLICACIONES POR PROCESO
        # =====================================================

        explicaciones = {}

        # -----------------------------------------------------
        # LVTA
        # -----------------------------------------------------

        lvta = self.obtener_causas_variacion_lvta(
            empresa_id,
            pericodi_actual
        )

        trazabilidad_lvta = self.validar_trazabilidad_lvta(
            empresa_id,
            pericodi_actual
        )

        explicaciones["LVTA"] = {
            "encontrado": lvta.get("encontrado"),

            "resumen": lvta.get(
                "resumen"
            ),

            "movimientos": lvta.get(
                "principales_movimientos",
                []
            ),

            "trazabilidad": {
                "encontrado": trazabilidad_lvta.get(
                    "encontrado"
                ),

                "soporte_lvta": trazabilidad_lvta.get(
                    "soporte_lvta"
                ),

                "evidencia": trazabilidad_lvta.get(
                    "evidencia"
                ),

                "validacion": trazabilidad_lvta.get(
                    "validacion"
                )
            },

            "nota": lvta.get(
                "nota"
            )
        }

        # -----------------------------------------------------
        # LSCIO
        # -----------------------------------------------------

        lscio = self.obtener_explicacion_lscio(
            empresa_id,
            pericodi_actual
        )

        explicaciones["LSCIO"] = {
            "encontrado": lscio.get("encontrado"),
            "resumen": lscio.get("resumen"),
            "mecanismos": lscio.get(
                "mecanismos",
                []
            ),
            "principales_conceptos": lscio.get(
                "principales_conceptos",
                []
            )
        }

        # -----------------------------------------------------
        # LVTP
        # -----------------------------------------------------

        potencia = self.inspeccionar_potencia(
            empresa_id,
            pericodi_actual
        )

        explicaciones["LVTP"] = {
            "encontrado": potencia.get("encontrado"),
            "resultado": potencia
        }

        # -----------------------------------------------------
        # SST-SCT
        # -----------------------------------------------------

        sstsct = self.inspeccionar_sstsct(
            empresa_id,
            pericodi_actual
        )

        explicaciones["SST-SCT"] = {
            "encontrado": sstsct.get("encontrado"),
            "resultado": sstsct
        }

        # =====================================================
        # RESULTADO CONSOLIDADO
        # =====================================================

        return {
            "encontrado": True,

            "empresa": empresa_id,

            "periodo": resumen.get(
                "periodo"
            ),

            "resultado": {
                "total": resumen.get(
                    "resultado_total"
                ),
                "cantidad_registros": resumen.get(
                    "cantidad_registros"
                ),
                "procesos": resumen.get(
                    "procesos",
                    []
                )
            },

            "variacion": {
                "encontrado": variacion.get(
                    "encontrado"
                ),
                "periodo_anterior": variacion.get(
                    "periodo_anterior"
                ),
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

            "explicaciones": explicaciones
        }

    def obtener_contexto_agente(self, empresa_id, pericodi):
        """
        Obtiene contexto físico y de mercado relacionado
        con la empresa y el periodo seleccionado.
        """

        periodos = self.datos["periodos"]
        puntos = self.datos["puntos_entrega"]
        entregas = self.datos["entregas"]
        retiros = self.datos["retiros"]
        costos = self.datos["costos_marginales_diario"]

        # --------------------------------------------------
        # PERIODOS
        # --------------------------------------------------

        periodo_actual = periodos[
            periodos["pericodi"] == pericodi
        ]

        if periodo_actual.empty:
            return {
                "encontrado": False,
                "mensaje": f"No se encontró el periodo {pericodi}."
            }

        periodos_anteriores = periodos[
            periodos["pericodi"] < pericodi
        ].sort_values("pericodi")

        if periodos_anteriores.empty:
            return {
                "encontrado": False,
                "mensaje": "No existe un periodo anterior para comparar."
            }

        periodo_anterior = periodos_anteriores.iloc[-1]
        pericodi_anterior = int(periodo_anterior["pericodi"])

        # --------------------------------------------------
        # PUNTOS DE ENTREGA DE LA EMPRESA
        # --------------------------------------------------

        puntos_empresa = puntos[
            puntos["emprcodi"] == empresa_id
        ].copy()

        codigos_entrega = set(
            puntos_empresa["codentcodi"].tolist()
        )

        barras_empresa = set(
            puntos_empresa["barrcodi"].tolist()
        )

        # --------------------------------------------------
        # ENTREGAS
        # --------------------------------------------------

        entregas_actual = entregas[
            (entregas["pericodi"] == pericodi) &
            (entregas["codentcodi"].isin(codigos_entrega))
        ].copy()

        entregas_anterior = entregas[
            (entregas["pericodi"] == pericodi_anterior) &
            (entregas["codentcodi"].isin(codigos_entrega))
        ].copy()

        # Convertir valores físicos a numérico
        entregas_actual["valor"] = pd.to_numeric(
            entregas_actual["valor"],
            errors="coerce"
        ).fillna(0)

        entregas_anterior["valor"] = pd.to_numeric(
            entregas_anterior["valor"],
            errors="coerce"
        ).fillna(0)

        total_entregas_actual = float(
            entregas_actual["valor"].sum()
        )

        total_entregas_anterior = float(
            entregas_anterior["valor"].sum()
        )

        # --------------------------------------------------
        # RETIROS
        # --------------------------------------------------

        retiros_actual = retiros[
            (retiros["pericodi"] == pericodi) &
            (retiros["generador_id"] == empresa_id)
        ].copy()

        retiros_anterior = retiros[
            (retiros["pericodi"] == pericodi_anterior) &
            (retiros["generador_id"] == empresa_id)
        ].copy()

        # Convertir valores físicos a numérico
        retiros_actual["valor"] = pd.to_numeric(
            retiros_actual["valor"],
            errors="coerce"
        ).fillna(0)

        retiros_anterior["valor"] = pd.to_numeric(
            retiros_anterior["valor"],
            errors="coerce"
        ).fillna(0)

        total_retiros_actual = float(
            retiros_actual["valor"].sum()
        )

        total_retiros_anterior = float(
            retiros_anterior["valor"].sum()
        )

        # --------------------------------------------------
        # FUNCIÓN DE VARIACIÓN
        # --------------------------------------------------

        def calcular_variacion(actual, anterior):
            variacion = actual - anterior

            if anterior == 0:
                variacion_pct = None
            else:
                variacion_pct = (
                    variacion / abs(anterior)
                ) * 100

            return {
                "actual": actual,
                "anterior": anterior,
                "variacion": variacion,
                "variacion_pct": variacion_pct
            }

        # --------------------------------------------------
        # COSTOS MARGINALES
        # --------------------------------------------------

            # --------------------------------------------------
        # COSTOS MARGINALES
        # --------------------------------------------------

        costos_actual = costos[
            (costos["pericodi"] == pericodi) &
            (costos["barrcodi"].isin(barras_empresa))
        ].copy()

        costos_anterior = costos[
            (costos["pericodi"] == pericodi_anterior) &
            (costos["barrcodi"].isin(barras_empresa))
        ].copy()

        # Convertir costos marginales a numérico
        costos_actual["promedio"] = pd.to_numeric(
            costos_actual["promedio"],
            errors="coerce"
        )

        costos_anterior["promedio"] = pd.to_numeric(
            costos_anterior["promedio"],
            errors="coerce"
        )

        costos_actual = costos_actual.dropna(
            subset=["promedio"]
        )

        costos_anterior = costos_anterior.dropna(
            subset=["promedio"]
        )

        # Promedios y extremos del periodo actual
        if costos_actual.empty:
            cm_promedio_actual = None
            cm_minimo_actual = None
            cm_maximo_actual = None
        else:
            cm_promedio_actual = float(
                costos_actual["promedio"].mean()
            )
            cm_minimo_actual = float(
                costos_actual["promedio"].min()
            )
            cm_maximo_actual = float(
                costos_actual["promedio"].max()
            )

        # Promedio del periodo anterior
        if costos_anterior.empty:
            cm_promedio_anterior = None
        else:
            cm_promedio_anterior = float(
                costos_anterior["promedio"].mean()
            )

        # Variación del costo marginal promedio
        if (
            cm_promedio_actual is not None and
            cm_promedio_anterior is not None
        ):
            variacion_cm = calcular_variacion(
                cm_promedio_actual,
                cm_promedio_anterior
            )
        else:
            variacion_cm = {
                "actual": cm_promedio_actual,
                "anterior": cm_promedio_anterior,
                "variacion": None,
                "variacion_pct": None
            }

        # --------------------------------------------------
        # OPERACIÓN
        # --------------------------------------------------

        dias_entrega = int(
            entregas_actual["dia"].nunique()
        )

        dias_retiro = int(
            retiros_actual["dia"].nunique()
        )

        # --------------------------------------------------
        # RESPUESTA
        # --------------------------------------------------

        return {
            "encontrado": True,
            "empresa": empresa_id,

            "periodo": {
                "actual": {
                    "pericodi": pericodi,
                    "perinombre": periodo_actual.iloc[0]["perinombre"]
                },
                "anterior": {
                    "pericodi": pericodi_anterior,
                    "perinombre": periodo_anterior["perinombre"]
                }
            },

            "energia": {
                "entregas": calcular_variacion(
                    total_entregas_actual,
                    total_entregas_anterior
                ),
                "retiros": calcular_variacion(
                    total_retiros_actual,
                    total_retiros_anterior
                )
            },

            "mercado": {
                "promedio": variacion_cm,
                "minimo": cm_minimo_actual,
                "maximo": cm_maximo_actual
            },

            "operacion": {
                "puntos_entrega": len(puntos_empresa),
                "dias_entrega": dias_entrega,
                "dias_retiro": dias_retiro
            },

            "nota": (
                "Contexto relacionado; no implica causalidad económica."
            )
        }

