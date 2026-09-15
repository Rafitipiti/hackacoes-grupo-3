{
    modoActual === "agente" && (
        <section className="agent-mode-view">
            {seccionAgente === "A1" && (

                <div className="agent-header">
                    <div>
                        <span className="section-label">
                            👤 MODO AGENTE · A1 RESUMEN
                        </span>

                        <h2>
                            {resumenAgente?.empresa || empresaAgente}
                        </h2>

                        <p>
                            {resumenAgente?.periodo?.perinombre || "Cargando periodo..."}
                            {" · "}
                            {resumenAgente?.periodo?.estado || ""}
                        </p>
                    </div>

                    <button
                        className="back-button"
                        onClick={entrarModoAnalista}
                    >
                        ← Analista COES
                    </button>
                </div>

                            {loadingResumenAgente && (
                <div className="loading">
                    Cargando resumen de liquidación...
                </div>
            )}

            {!loadingResumenAgente && resumenAgente && (
                <>
                    {/* ==========================================
                                                                            RESUMEN PRINCIPAL
                                                                        ========================================== */}

                    <section className="summary-cards">

                        <div className="summary-card">
                            <span className="summary-label">
                                Resultado de liquidación
                            </span>

                            <strong>
                                S/{" "}
                                {resumenAgente.resultado.total.toLocaleString(
                                    "es-PE",
                                    {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }
                                )}
                            </strong>

                            <small>
                                {resumenAgente.resultado.cantidad_registros} registros
                            </small>
                        </div>

                        <div className="summary-card">
                            <span className="summary-label">
                                Variación
                            </span>

                            <strong>
                                {resumenAgente.variacion.variacion_pct >= 0
                                    ? "+"
                                    : ""}
                                {resumenAgente.variacion.variacion_pct.toFixed(2)}
                                %
                            </strong>

                            <small>
                                {resumenAgente.variacion.variacion >= 0
                                    ? "+"
                                    : "-"}
                                S/{" "}
                                {Math.abs(
                                    resumenAgente.variacion.variacion
                                ).toLocaleString(
                                    "es-PE",
                                    {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }
                                )}
                            </small>
                        </div>

                        <div className="summary-card">
                            <span className="summary-label">
                                Periodo anterior
                            </span>

                            <strong>
                                {resumenAgente.variacion.periodo_anterior?.perinombre ||
                                    "No disponible"}
                            </strong>

                            <small>
                                Comparación mensual
                            </small>
                        </div>

                        <div className="summary-card">
                            <span className="summary-label">
                                Estado de cierre
                            </span>

                            <strong>
                                {resumenAgente.cierre.estado.icono}{" "}
                                {resumenAgente.cierre.estado.titulo}
                            </strong>

                            <small>
                                {resumenAgente.cierre.estado.nivel}
                            </small>
                        </div>

                    </section>


                    {/* ==========================================
                                                                            RESULTADO POR PROCESO
                                                                        ========================================== */}

                    <section className="panel">

                        <div className="panel-header">
                            <div>
                                <span className="section-label">
                                    A1 · RESULTADO
                                </span>

                                <h3>
                                    ¿Cómo salió mi liquidación?
                                </h3>

                                <p>
                                    Resultado económico por proceso de valorización.
                                </p>
                            </div>
                        </div>

                        <div className="process-grid">

                            {resumenAgente.resultado.procesos.map(
                                (proceso) => (
                                    <div
                                        className="process-card"
                                        key={proceso.proceso}
                                    >
                                        <span className="process-code">
                                            {proceso.proceso}
                                        </span>

                                        <span className="process-name">
                                            {proceso.proceso === "LVTA"
                                                ? "Energía Activa"
                                                : proceso.proceso === "LSCIO"
                                                    ? "Servicios Complementarios"
                                                    : proceso.proceso === "LVTP"
                                                        ? "Potencia"
                                                        : proceso.proceso}
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {proceso.monto.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                }
                                            )}
                                        </strong>
                                    </div>
                                )
                            )}

                        </div>

                    </section>


                    {/* ==========================================
                                                                            PRINCIPALES CAMBIOS
                                                                        ========================================== */}

                    <section className="panel">

                        <div className="panel-header">
                            <div>
                                <span className="section-label">
                                    A1 · SEÑALES
                                </span>

                                <h3>
                                    ¿Qué está moviendo mi liquidación?
                                </h3>
                            </div>
                        </div>

                        <div className="change-grid">

                            <div className="change-card">
                                <span className="change-label">
                                    Principal incremento
                                </span>

                                {resumenAgente.impulsores.principal_incremento ? (
                                    <>
                                        <strong>
                                            {
                                                resumenAgente.impulsores
                                                    .principal_incremento.proceso
                                            }
                                        </strong>

                                        <p>
                                            {
                                                resumenAgente.impulsores
                                                    .principal_incremento.valorizacion
                                            }
                                        </p>

                                        <span className="change-value positive">
                                            +
                                            {resumenAgente.impulsores
                                                .principal_incremento.variacion.toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                        </span>
                                    </>
                                ) : (
                                    <p>No identificado</p>
                                )}
                            </div>


                            <div className="change-card">
                                <span className="change-label">
                                    Principal reducción
                                </span>

                                {resumenAgente.impulsores.principal_reduccion ? (
                                    <>
                                        <strong>
                                            {
                                                resumenAgente.impulsores
                                                    .principal_reduccion.proceso
                                            }
                                        </strong>

                                        <p>
                                            {
                                                resumenAgente.impulsores
                                                    .principal_reduccion.valorizacion
                                            }
                                        </p>

                                        <span className="change-value negative">
                                            {resumenAgente.impulsores
                                                .principal_reduccion.variacion.toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                        </span>
                                    </>
                                ) : (
                                    <p>No identificado</p>
                                )}
                            </div>

                        </div>

                    </section>


                    {/* ==========================================
                                                                            ESTADO DE CIERRE
                                                                        ========================================== */}

                    <section
                        className={
                            resumenAgente.cierre.estado.nivel === "ALTO"
                                ? "closure-card high"
                                : "closure-card"
                        }
                    >

                        <div className="closure-icon">
                            {resumenAgente.cierre.estado.icono}
                        </div>

                        <div>
                            <span className="section-label">
                                ESTADO DE CIERRE
                            </span>

                            <h3>
                                {resumenAgente.cierre.estado.titulo}
                            </h3>

                            <p>
                                {resumenAgente.cierre.estado.mensaje}
                            </p>

                            <strong>
                                {resumenAgente.cierre.recomendacion}
                            </strong>
                        </div>

                    </section>


                    {/* ==========================================
                                                                            PRÓXIMO PASO
                                                                        ========================================== */}

                    <section className="agent-next-step">

                        <div>
                            <span className="section-label">
                                SIGUIENTE PASO
                            </span>

                            <h3>
                                ¿Qué cambió?
                            </h3>

                            <p>
                                Revisa los principales movimientos de tu
                                liquidación frente al periodo anterior.
                            </p>
                        </div>

                        <button
                            className="analyze-button"
                            onClick={() => setSeccionAgente("A2")}
                        >
                            Ver cambios →
                        </button>

                    </section>

                </>
            )}
