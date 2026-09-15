import pandas as pd


class IntegrityService:

    def __init__(self, datos):
        self.datos = datos

        self.evolucion = datos[
            "evolucion_liquidaciones"
        ]

        self.energia_transferencias = datos[
            "energia_transferencias"
        ]

        self.lscio_transferencias = datos[
            "lscio_transferencias"
        ]

        self.lscio_desglose = datos[
            "lscio_desglose"
        ]

        self.potencia_desglose = datos[
            "potencia_desglose"
        ]

    # ==========================================================
    # REGLA-LVTA-001
    # Resultado LVTA vs soporte de Energía Activa
    # ==========================================================

    def validar_lvta(
        self,
        empresa_id,
        pericodi
    ):

        # =====================================================
        # 1. OBTENER PERIODOS DISPONIBLES
        # =====================================================

        periodos_empresa = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ]

        periodos_disponibles = sorted(
            periodos_empresa["pericodi"].unique()
        )

        periodos_anteriores = [
            p
            for p in periodos_disponibles
            if p < pericodi
        ]

        if not periodos_anteriores:
            return {
                "encontrado": False,
                "regla_id": "REGLA-LVTA-001",
                "mensaje": (
                    "No existe un periodo anterior "
                    "para validar la trazabilidad LVTA."
                )
            }

        pericodi_anterior = max(
            periodos_anteriores
        )

        # =====================================================
        # 2. FUNCIÓN INTERNA PARA OBTENER Y COMPARAR LVTA
        # =====================================================

        def validar_periodo(
            pericodi_validar
        ):

            resultado = self.evolucion[
                (self.evolucion["empresa_deudora"] == empresa_id)
                & (
                    self.evolucion["pericodi"]
                    == pericodi_validar
                )
                & (
                    self.evolucion["proceso"]
                    == "LVTA"
                )
            ].copy()

            soporte = self.energia_transferencias[
                (self.energia_transferencias["emprcodi"] == empresa_id)
                & (
                    self.energia_transferencias["pericodi"]
                    == pericodi_validar
                )
            ].copy()

            if resultado.empty:
                return {
                    "encontrado": False,
                    "mensaje": (
                        "No se encontró resultado LVTA "
                        "para el periodo."
                    )
                }

            if soporte.empty:
                return {
                    "encontrado": False,
                    "mensaje": (
                        "No se encontró soporte de "
                        "Energía Activa para el periodo."
                    )
                }

            resultado["monto"] = pd.to_numeric(
                resultado["monto"],
                errors="coerce"
            )

            soporte["vtotemtotal"] = pd.to_numeric(
                soporte["vtotemtotal"],
                errors="coerce"
            )

            monto_resultado = float(
                resultado["monto"].sum()
            )

            monto_soporte = float(
                soporte["vtotemtotal"].sum()
            )

            diferencia = (
                monto_resultado
                - monto_soporte
            )

            tolerancia = 0.01

            coincide = (
                abs(diferencia) <= tolerancia
            )

            return {
                "encontrado": True,

                "resultado": monto_resultado,

                "soporte": monto_soporte,

                "diferencia": diferencia,

                "tolerancia": tolerancia,

                "coincide": coincide,

                "estado": (
                    "OK"
                    if coincide
                    else "DISCREPANCIA"
                ),

                "cantidad_registros_resultado": (
                    len(resultado)
                ),

                "cantidad_registros_soporte": (
                    len(soporte)
                )
            }

        # =====================================================
        # 3. VALIDAR PERIODO ACTUAL
        # =====================================================

        actual = validar_periodo(
            pericodi
        )

        if not actual.get("encontrado"):
            return {
                "encontrado": False,
                "regla_id": "REGLA-LVTA-001",
                "mensaje": actual.get(
                    "mensaje",
                    "No se pudo validar el periodo actual."
                )
            }

        # =====================================================
        # 4. VALIDAR PERIODO ANTERIOR
        # =====================================================

        anterior = validar_periodo(
            pericodi_anterior
        )

        if not anterior.get("encontrado"):
            return {
                "encontrado": False,
                "regla_id": "REGLA-LVTA-001",
                "mensaje": anterior.get(
                    "mensaje",
                    "No se pudo validar el periodo anterior."
                )
            }

        # =====================================================
        # 5. DETERMINAR ESTADO DE TRAZABILIDAD
        # =====================================================

        coincide_actual = actual["coincide"]

        coincide_anterior = anterior["coincide"]

        # La validación de trazabilidad informa si el
        # resultado LVTA coincide con su soporte.
        #
        # Una diferencia en la trazabilidad se registra
        # como OBSERVACION y no constituye por sí sola
        # un bloqueo automático del cierre.
        #
        # El periodo actual tiene prioridad.
        # El periodo anterior se conserva como antecedente
        # histórico y no determina por sí solo el estado actual.

        if coincide_actual:

            estado = "OK"
            nivel = "NORMAL"

        else:

            estado = "OBSERVACION"
            nivel = "MEDIO"

        # =====================================================
        # 6. RETORNAR RESULTADO
        # =====================================================

        return {
            "encontrado": True,

            "regla_id": "REGLA-LVTA-001",

            "categoria": "TRAZABILIDAD",

            "empresa": empresa_id,

            "pericodi": pericodi,

            "resultado": {
                "proceso": "LVTA",

                "monto": actual["resultado"],

                "cantidad_registros": (
                    actual[
                        "cantidad_registros_resultado"
                    ]
                )
            },

            "soporte": {
                "dataset": "data/curated/energia_transferencias.parquet",

                "monto": actual["soporte"],

                "cantidad_registros": (
                    actual[
                        "cantidad_registros_soporte"
                    ]
                )
            },

            "validacion": {
                "regla": (
                    "Resultado LVTA = "
                    "Transferencia de Energía Activa"
                ),

                "estado": estado,

                "nivel": nivel,

                "diferencia": actual["diferencia"],

                "tolerancia": actual["tolerancia"],

                "coincide": coincide_actual,

                "antecedente_historico": {
                    "existe_discrepancia": not coincide_anterior,
                    "diferencia": anterior["diferencia"],
                    "pericodi": pericodi_anterior
                },

                "periodo_actual": {
                    "pericodi": pericodi,

                    "resultado": actual["resultado"],

                    "soporte": actual["soporte"],

                    "diferencia": actual["diferencia"],

                    "coincide": coincide_actual,

                    "estado": actual["estado"]
                },

                "periodo_anterior": {
                    "pericodi": pericodi_anterior,

                    "resultado": anterior["resultado"],

                    "soporte": anterior["soporte"],

                    "diferencia": anterior["diferencia"],

                    "coincide": coincide_anterior,

                    "estado": anterior["estado"]
                }
            }
        }

    # ==========================================================
    # REGLA-LSCIO-001
    # Transferencia LSCIO vs desglose por mecanismo
    # ==========================================================

    def validar_lscio(
        self,
        empresa_id,
        pericodi
    ):

        transferencia = self.lscio_transferencias[
            (self.lscio_transferencias["emprcodi"] == empresa_id)
            & (self.lscio_transferencias["pericodi"] == pericodi)
        ].copy()

        desglose = self.lscio_desglose[
            (self.lscio_desglose["emprcodi"] == empresa_id)
            & (self.lscio_desglose["pericodi"] == pericodi)
        ].copy()

        if transferencia.empty:
            return {
                "encontrado": False,
                "regla_id": "REGLA-LSCIO-001",
                "mensaje": (
                    "No se encontró transferencia LSCIO "
                    "para la empresa y periodo."
                )
            }

        if desglose.empty:
            return {
                "encontrado": False,
                "regla_id": "REGLA-LSCIO-001",
                "mensaje": (
                    "No se encontró desglose LSCIO "
                    "para la empresa y periodo."
                )
            }

        transferencia["monto_total"] = pd.to_numeric(
            transferencia["monto_total"],
            errors="coerce"
        )

        desglose["monto"] = pd.to_numeric(
            desglose["monto"],
            errors="coerce"
        )

        monto_transferencia = float(
            transferencia["monto_total"].sum()
        )

        monto_desglose = float(
            desglose["monto"].sum()
        )

        diferencia = (
            monto_transferencia
            - monto_desglose
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
            nivel = "ALTO"

        return {
            "encontrado": True,
            "regla_id": "REGLA-LSCIO-001",
            "categoria": "INTEGRIDAD",
            "empresa": empresa_id,
            "pericodi": pericodi,

            "transferencia": {
                "monto": monto_transferencia,
                "cantidad_registros": len(transferencia)
            },

            "desglose": {
                "monto": monto_desglose,
                "cantidad_registros": len(desglose)
            },

            "validacion": {
                "regla": (
                    "Transferencia LSCIO = "
                    "SUM(desglose por mecanismo)"
                ),
                "estado": estado,
                "nivel": nivel,
                "diferencia": diferencia,
                "tolerancia": tolerancia,
                "coincide": coincide
            }
        }

    # ==========================================================
    # REGLA-POTENCIA-001
    # Resultado LVTP vs soporte de compensación
    # ==========================================================

    def validar_potencia(
        self,
        empresa_id,
        pericodi
    ):

        valorizacion_objetivo = (
            "COMPENSACIÓN A TRANSMISORAS "
            "POR INGRESO TARIFARIO"
        )

        resultado = self.evolucion[
            (self.evolucion["empresa_deudora"] == empresa_id)
            & (self.evolucion["pericodi"] == pericodi)
            & (self.evolucion["proceso"] == "LVTP")
            & (
                self.evolucion["valorizacion"]
                == valorizacion_objetivo
            )
        ].copy()

        soporte = self.potencia_desglose[
            (self.potencia_desglose["emprcodi"] == empresa_id)
            & (self.potencia_desglose["pericodi"] == pericodi)
            & (
                self.potencia_desglose["valorizacion"]
                == valorizacion_objetivo
            )
        ].copy()

        if resultado.empty:
            return {
                "encontrado": False,
                "regla_id": "REGLA-POTENCIA-001",
                "mensaje": (
                    "No se encontró resultado LVTP "
                    "de compensación por ingreso tarifario."
                )
            }

        if soporte.empty:
            return {
                "encontrado": False,
                "regla_id": "REGLA-POTENCIA-001",
                "mensaje": (
                    "No se encontró soporte de Potencia "
                    "de compensación por ingreso tarifario."
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

        monto_soporte_ajustado = (
            -monto_soporte
        )

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
            "regla_id": "REGLA-POTENCIA-001",
            "categoria": "TRAZABILIDAD",
            "empresa": empresa_id,
            "pericodi": pericodi,

            "resultado": {
                "proceso": "LVTP",
                "valorizacion": valorizacion_objetivo,
                "monto": monto_resultado,
                "cantidad_registros": len(resultado)
            },

            "soporte": {
                "dataset": "data/curated/potencia_desglose.parquet",
                "monto_original": monto_soporte,
                "monto_ajustado": monto_soporte_ajustado,
                "cantidad_registros": len(soporte)
            },

            "validacion": {
                "regla": (
                    "Resultado LVTP = "
                    "- SUM(desglose de Potencia)"
                ),
                "estado": estado,
                "nivel": nivel,
                "diferencia": diferencia,
                "tolerancia": tolerancia,
                "coincide": coincide
            }
        }

    # ==========================================================
    # VALIDACIÓN COMPLETA
    # ==========================================================

    def validar_empresa_periodo(
        self,
        empresa_id,
        pericodi
    ):

        resultados = []

        resultados.append(
            self.validar_lvta(
                empresa_id,
                pericodi
            )
        )

        resultados.append(
            self.validar_lscio(
                empresa_id,
                pericodi
            )
        )

        resultados.append(
            self.validar_potencia(
                empresa_id,
                pericodi
            )
        )

        validaciones_ejecutadas = [
            resultado
            for resultado in resultados
            if resultado.get("encontrado") is True
        ]

        cantidad_ok = sum(
            1
            for resultado in validaciones_ejecutadas
            if resultado["validacion"]["estado"] == "OK"
        )

        cantidad_revisar = sum(
            1
            for resultado in validaciones_ejecutadas
            if resultado["validacion"]["estado"] == "REVISAR"
        )

        cantidad_alto = sum(
            1
            for resultado in validaciones_ejecutadas
            if (
                resultado["validacion"]["estado"] == "REVISAR"
                and resultado["validacion"].get("nivel") == "ALTO"
            )
        )

        cantidad_medio = sum(
            1
            for resultado in validaciones_ejecutadas
            if (
                resultado["validacion"]["estado"] == "REVISAR"
                and resultado["validacion"].get("nivel") == "MEDIO"
            )
        )

        if cantidad_alto > 0:
            estado_global = "ATENCION"

        elif cantidad_revisar > 0:
            estado_global = "REVISAR"

        elif cantidad_ok > 0:
            estado_global = "OK"

        else:
            estado_global = "SIN_VALIDACIONES"

        return {
            "empresa": empresa_id,
            "pericodi": pericodi,

            "resumen": {
                "estado": estado_global,
                "reglas_ejecutadas": len(
                    validaciones_ejecutadas
                ),
                "reglas_ok": cantidad_ok,
                "reglas_revisar": cantidad_revisar,
                "reglas_alto": cantidad_alto,
                "reglas_medio": cantidad_medio
            },

            "reglas": resultados
        }

    def generar_estado_cierre(
        self,
        empresa_id,
        pericodi
    ):

        validacion = self.validar_empresa_periodo(
            empresa_id,
            pericodi
        )

        resumen = validacion["resumen"]
        reglas = validacion["reglas"]

        estado = resumen["estado"]

        # =====================================================
        # ESTADO OK
        # =====================================================

        if estado == "OK" and not any(
            regla.get("encontrado") is True
            and regla.get("validacion", {}).get("estado") == "OBSERVACION"
            for regla in reglas
        ):

            return {
                "empresa": empresa_id,
                "pericodi": pericodi,

                "estado": {
                    "codigo": "OK",
                    "nivel": "NORMAL",
                    "icono": "🟢",
                    "titulo": "Listo para revisión de cierre",
                    "mensaje": (
                        "Las validaciones disponibles "
                        "no presentan inconsistencias."
                    )
                },

                "resumen": {
                    "reglas_ejecutadas": resumen[
                        "reglas_ejecutadas"
                    ],
                    "reglas_ok": resumen[
                        "reglas_ok"
                    ],
                    "reglas_revisar": resumen[
                        "reglas_revisar"
                    ]
                },

                "motivos": [],

                "recomendacion": (
                    "Continuar con la revisión final "
                    "de la liquidación antes del cierre."
                )
            }

        # =====================================================
        # SIN VALIDACIONES
        # =====================================================

        if estado == "SIN_VALIDACIONES":

            return {
                "empresa": empresa_id,
                "pericodi": pericodi,

                "estado": {
                    "codigo": "SIN_VALIDACIONES",
                    "nivel": "SIN_DATOS",
                    "icono": "⚪",
                    "titulo": "Validación no disponible",
                    "mensaje": (
                        "No existen suficientes validaciones "
                        "disponibles para evaluar el cierre."
                    )
                },

                "resumen": {
                    "reglas_ejecutadas": 0,
                    "reglas_ok": 0,
                    "reglas_revisar": 0
                },

                "motivos": [],

                "recomendacion": (
                    "Revisar la disponibilidad de los "
                    "datos antes de considerar el cierre."
                )
            }

        # =====================================================
        # RECOLECTAR OBSERVACIONES
        # =====================================================

        motivos = []

        for regla in reglas:

            if regla.get("encontrado") is not True:
                continue

            validacion_regla = regla.get(
                "validacion",
                {}
            )

            if validacion_regla.get(
                "estado"
            ) not in (
                "REVISAR",
                "OBSERVACION"
            ):
                continue

            regla_id = regla.get(
                "regla_id",
                "REGLA-NO-DEFINIDA"
            )

            nivel = validacion_regla.get(
                "nivel",
                "MEDIO"
            )

            diferencia = validacion_regla.get(
                "diferencia"
            )

            if diferencia is not None:

                diferencia_abs = abs(
                    float(diferencia)
                )

                diferencia_formateada = (
                    f"S/ {diferencia_abs:,.2f}"
                )

            else:

                diferencia_formateada = None

            if regla_id == "REGLA-LVTA-001":

                motivo = {
                    "regla_id": regla_id,
                    "proceso": "LVTA",
                    "nivel": nivel,
                    "titulo": (
                        "Diferencia en trazabilidad "
                        "de Energía Activa"
                    ),
                    "mensaje": (
                        "El resultado de LVTA no coincide "
                        "con el soporte de Energía Activa."
                    ),
                    "diferencia": (
                        diferencia_formateada
                    ),
                    "accion": (
                        "Revisar la trazabilidad del "
                        "resultado LVTA y la versión "
                        "del soporte utilizado."
                    )
                }

                motivos.append(motivo)

            elif regla_id == "REGLA-LSCIO-001":

                motivo = {
                    "regla_id": regla_id,
                    "proceso": "LSCIO",
                    "nivel": nivel,
                    "titulo": (
                        "Diferencia en reconstrucción "
                        "de LSCIO"
                    ),
                    "mensaje": (
                        "La transferencia LSCIO no coincide "
                        "con el desglose por mecanismos."
                    ),
                    "diferencia": (
                        diferencia_formateada
                    ),
                    "accion": (
                        "Revisar el desglose de mecanismos "
                        "y sus conceptos asociados."
                    )
                }

                motivos.append(motivo)

            elif regla_id == "REGLA-POTENCIA-001":

                motivo = {
                    "regla_id": regla_id,
                    "proceso": "LVTP",
                    "nivel": nivel,
                    "titulo": (
                        "Diferencia en trazabilidad "
                        "de Potencia"
                    ),
                    "mensaje": (
                        "El resultado LVTP no coincide "
                        "con su soporte de Potencia."
                    ),
                    "diferencia": (
                        diferencia_formateada
                    ),
                    "accion": (
                        "Revisar la compensación a "
                        "transmisoras por ingreso tarifario."
                    )
                }

                motivos.append(motivo)

        # =====================================================
        # DETERMINAR ESTADO DE CIERRE
        # =====================================================

        # Las observaciones de trazabilidad no bloquean
        # automáticamente el cierre.
        #
        # Una discrepancia de LVTA se conserva como
        # observación y debe ser revisada, pero no se
        # interpreta por sí sola como una inconsistencia
        # que impida el cierre.
        #
        # Las demás reglas mantienen su capacidad de
        # generar atención hasta que sean evaluadas
        # específicamente.

        reglas_bloqueantes = []

        for regla in reglas:

            if regla.get("encontrado") is not True:
                continue

            validacion_regla = regla.get(
                "validacion",
                {}
            )

            estado_regla = validacion_regla.get(
                "estado"
            )

            regla_id = regla.get(
                "regla_id",
                "REGLA-NO-DEFINIDA"
            )

            # -------------------------------------------------
            # LVTA: observación no bloqueante
            # -------------------------------------------------

            if regla_id == "REGLA-LVTA-001":

                continue

            # -------------------------------------------------
            # Otras reglas: mantienen comportamiento actual
            # -------------------------------------------------

            if estado_regla == "REVISAR":

                reglas_bloqueantes.append(
                    validacion_regla
                )

        if reglas_bloqueantes:

            existe_alto = any(
                regla.get("nivel") == "ALTO"
                for regla in reglas_bloqueantes
            )

            if existe_alto:

                codigo_estado = "ATENCION"
                nivel_estado = "ALTO"
                icono = "🔴"
                titulo = "Atención antes del cierre"
                mensaje = (
                    "Se identificaron inconsistencias "
                    "que requieren revisión antes "
                    "del cierre."
                )

                recomendacion = (
                    "Revisar las inconsistencias "
                    "identificadas antes de considerar "
                    "el cierre."
                )

            else:

                codigo_estado = "REVISAR"
                nivel_estado = "MEDIO"
                icono = "🟡"
                titulo = "Revisión recomendada"
                mensaje = (
                    "Se identificaron observaciones "
                    "que requieren revisión."
                )

                recomendacion = (
                    "Revisar los procesos observados "
                    "antes del cierre."
                )

        else:

            codigo_estado = "OK"
            nivel_estado = "NORMAL"
            icono = "🟢"
            titulo = "Listo para revisión de cierre"
            mensaje = (
                "Las validaciones disponibles no "
                "presentan bloqueos para el cierre."
            )

            recomendacion = (
                "Continuar con la revisión final "
                "de la liquidación antes del cierre."
            )

        # =====================================================
        # RESULTADO
        # =====================================================

        return {
            "empresa": empresa_id,
            "pericodi": pericodi,

            "estado": {
                "codigo": codigo_estado,
                "nivel": nivel_estado,
                "icono": icono,
                "titulo": titulo,
                "mensaje": mensaje
            },

            "resumen": {
                "reglas_ejecutadas": resumen[
                    "reglas_ejecutadas"
                ],
                "reglas_ok": resumen[
                    "reglas_ok"
                ],
                "reglas_revisar": resumen[
                    "reglas_revisar"
                ],
                "reglas_alto": resumen[
                    "reglas_alto"
                ],
                "reglas_medio": resumen[
                    "reglas_medio"
                ]
            },

            "motivos": motivos,

            "recomendacion": recomendacion
        }

    # ==========================================================
    # RESUMEN DE INTEGRIDAD PARA EL USUARIO
    # ==========================================================

    def generar_resumen_integridad(
        self,
        empresa_id,
        pericodi
    ):

        resultado = self.validar_empresa_periodo(
            empresa_id,
            pericodi
        )

        resumen = resultado["resumen"]
        reglas = resultado["reglas"]

        estado_global = resumen["estado"]

        if estado_global == "OK":

            nivel_global = "NORMAL"

            titulo = "Integridad OK"

            mensaje = (
                "Las validaciones ejecutadas "
                "no presentan discrepancias."
            )

        elif estado_global == "REVISAR":

            nivel_global = "MEDIO"

            titulo = "Integridad: REVISAR"

            mensaje = (
                "Se identificaron una o más "
                "validaciones que requieren revisión."
            )

        elif estado_global == "ATENCION":

            nivel_global = "ALTO"

            titulo = "Integridad: ATENCIÓN"

            mensaje = (
                "Se identificaron inconsistencias "
                "de nivel alto que requieren revisión."
            )

        else:

            nivel_global = "N/A"

            titulo = "Sin validaciones"

            mensaje = (
                "No fue posible ejecutar "
                "validaciones de integridad."
            )

        alertas = []

        for regla in reglas:

            if not regla.get("encontrado"):
                continue

            validacion = regla.get(
                "validacion",
                {}
            )

            if validacion.get("estado") != "REVISAR":
                continue

            diferencia = validacion.get(
                "diferencia",
                0
            )

            alertas.append(
                {
                    "regla_id": regla.get(
                        "regla_id"
                    ),
                    "categoria": regla.get(
                        "categoria",
                        "INTEGRIDAD"
                    ),
                    "nivel": validacion.get(
                        "nivel",
                        "MEDIO"
                    ),
                    "diferencia": float(
                        diferencia
                    )
                }
            )

        return {
            "empresa": empresa_id,
            "pericodi": pericodi,

            "estado": {
                "codigo": estado_global,
                "nivel": nivel_global,
                "titulo": titulo,
                "mensaje": mensaje
            },

            "metricas": {
                "reglas_ejecutadas": resumen[
                    "reglas_ejecutadas"
                ],
                "reglas_ok": resumen[
                    "reglas_ok"
                ],
                "reglas_revisar": resumen[
                    "reglas_revisar"
                ]
            },

            "alertas": alertas
        }

