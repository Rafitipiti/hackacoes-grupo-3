import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";


function construirWaterfall(analisis) {

    const factores = analisis.principales_factores;

    let acumulado = analisis.comparacion.monto_anterior;

    const datos = [
        {
            concepto: "Anterior",
            base: 0,
            variacion: analisis.comparacion.monto_anterior,
            tipo: "total"
        }
    ];

    factores.forEach((factor) => {

        const variacion = factor.variacion;

        if (variacion >= 0) {

            datos.push({
                concepto: factor.concepto,
                base: acumulado,
                variacion: variacion,
                tipo: "positivo"
            });

        } else {

            datos.push({
                concepto: factor.concepto,
                base: acumulado + variacion,
                variacion: Math.abs(variacion),
                tipo: "negativo"
            });

        }

        acumulado += variacion;

    });

    datos.push({
        concepto: "Actual",
        base: 0,
        variacion: analisis.comparacion.monto_actual,
        tipo: "total"
    });

    return datos;
}


function App() {

    const [radar, setRadar] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    const [paginaRadar, setPaginaRadar] = useState(1);

    const [agenteSeleccionado, setAgenteSeleccionado] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [analisis, setAnalisis] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [evidencia, setEvidencia] = useState(null);
    const [preguntaSeleccionada, setPreguntaSeleccionada] = useState(null);
    const [preguntaLibre, setPreguntaLibre] = useState("");
    const [respuestaAsistente, setRespuestaAsistente] = useState(null);
    const [asistenteAbierto, setAsistenteAbierto] = useState(false);

    const [mensajesChat, setMensajesChat] = useState([]);
    const [ultimaIntencion, setUltimaIntencion] = useState(null);
    const [ultimaRespuesta, setUltimaRespuesta] = useState(null);

    // ==========================================
    // MODO AGENTE
    // ==========================================
    const [modoActual, setModoActual] = useState(null);

    const [resumenAgente, setResumenAgente] = useState(null);
    const [loadingResumenAgente, setLoadingResumenAgente] = useState(false);

    const [explicacionAgente, setExplicacionAgente] = useState(null);
    const [contextoAgente, setContextoAgente] = useState(null);
    const [loadingExplicacionAgente, setLoadingExplicacionAgente] = useState(false);

    const [empresaAgente, setEmpresaAgente] = useState(null);
    const [pericodiAgente, setPericodiAgente] = useState(null);

    const [seccionAgente, setSeccionAgente] = useState("SELECCION");
    const [seccionAnalista, setSeccionAnalista] = useState("C1");

    const mostrarAsistente =
        (
            modoActual === "agente" &&
            ["A1", "A3", "A4"].includes(seccionAgente)
        )
        ||
        (
            modoActual === "analista" &&
            agenteSeleccionado
        );

    const [fecha, setFecha] = useState("");
    const [periodos, setPeriodos] = useState([]);

    const [empresas, setEmpresas] = useState([]);

    const agentesPorPagina = 10;

    useEffect(() => {

        if (fecha) {
            setPaginaRadar(1);
            cargarRadar();
        }

    }, [fecha]);


    useEffect(() => {

        if (
            agenteSeleccionado?.agente_id &&
            radar?.agentes_analizados
        ) {
            analizarAgente(agenteSeleccionado.agente_id);
        }

    }, [fecha]);

    useEffect(() => {
        if (
            modoActual === "agente" &&
            empresaAgente &&
            fecha
        ) {
            setPericodiAgente(fecha);
            cargarResumenAgente(
                empresaAgente,
                fecha
            );
        }
    }, [fecha, modoActual, empresaAgente]);


    useEffect(() => {
        cargarPeriodos();
        cargarEmpresas();
    }, []);


    async function cargarPeriodos() {

        try {

            const response = await axios.get(
                `${API_URL}/periodos`
            );

            const periodosDisponibles = response.data.periodos;

            const periodosOrdenados = [
                ...periodosDisponibles
            ].sort(
                (a, b) =>
                    b.pericodi - a.pericodi
            );

            setPeriodos(
                periodosOrdenados
            );

            if (periodosOrdenados.length > 0) {
                setFecha(
                    periodosOrdenados[0].pericodi
                );
            }
        } catch (err) {

            console.error(
                "Error cargando periodos:",
                err
            );

        }
    }

    async function cargarEmpresas() {

        try {

            const response = await axios.get(
                `${API_URL}/empresas`
            );

            console.log("EMPRESAS API:", response.data);

            setEmpresas(
                response.data.empresas
            );

        } catch (err) {

            console.error(
                "Error cargando empresas:",
                err
            );

        }
    }

    function aliasDeEmpresa(empresaId) {
        return (
            empresas.find(
                (empresa) => empresa.empresa_id === empresaId
            )?.alias ?? empresaId
        );
    }

    async function cargarRadar() {

        try {

            setLoading(true);

            const response = await axios.get(
                `${API_URL}/radar/${fecha}`
            );

            setRadar(response.data);
            setError(null);

        } catch (err) {

            console.error(err);

            setError(
                "No se pudo conectar con el backend de COES Liquidaciones 360."
            );

        } finally {

            setLoading(false);

        }
    }

    async function cargarResumenAgente(
        empresa = empresaAgente,
        periodo = fecha
    ) {
        try {
            setLoadingResumenAgente(true);
            setError(null);

            const response = await axios.get(
                `${API_URL}/agente/resumen/${empresa}/${periodo}`
            );

            setResumenAgente(response.data);
        } catch (err) {
            console.error("Error cargando resumen del agente:", err);

            setResumenAgente(null);

            setError(
                err.response?.data?.detail ||
                "No se pudo cargar el resumen de la liquidación."
            );
        } finally {
            setLoadingResumenAgente(false);
        }
    }

    async function cargarExplicacionAgente() {
        try {
            setLoadingExplicacionAgente(true);
            setError(null);

            const [resumenResponse, explicacionResponse] =
                await Promise.all([
                    axios.get(
                        `${API_URL}/agente/resumen/${empresaAgente}/${pericodiAgente}`
                    ),
                    axios.get(
                        `${API_URL}/agente/explicacion/${empresaAgente}/${pericodiAgente}`
                    )
                ]);

            setAnalisis(
                resumenResponse.data
            );

            setDetalle(
                resumenResponse.data.impulsores?.movimientos || []
            );

            setExplicacionAgente(
                explicacionResponse.data
            );

        } catch (err) {
            console.error(
                "Error cargando explicación del agente:",
                err
            );

            setAnalisis(null);
            setDetalle([]);
            setExplicacionAgente(null);

            setError(
                err.response?.data?.detail ||
                "No se pudo cargar la explicación de la liquidación."
            );
        } finally {
            setLoadingExplicacionAgente(false);
        }
    }

    async function cargarContextoAgente() {

        try {

            setError(null);

            const response = await axios.get(
                `${API_URL}/agente/contexto/${empresaAgente}/${pericodiAgente}`
            );

            setContextoAgente(response.data);

        } catch (err) {

            console.error(
                "Error cargando contexto del agente:",
                err
            );

            setContextoAgente(null);

            setError(
                err.response?.data?.detail ||
                "No se pudo cargar el contexto físico y de mercado."
            );
        }
    }

    async function entrarA3() {
        setSeccionAgente("A3");

        await cargarExplicacionAgente();
    }

    function entrarModoAgente() {
        setModoActual("agente");
        setSeccionAgente("A1");

        setAgenteSeleccionado(null);
        setDetalle(null);
        setAnalisis(null);
        setError(null);
    }

    function entrarModoAnalista() {
        setModoActual("analista");
        setSeccionAnalista("C1");

        setResumenAgente(null);
        setError(null);
    }

    async function analizarAgente(agenteId) {

        try {

            setLoadingDetalle(true);
            setError(null);

            console.log("=== INICIO ANALISIS ===");
            console.log("Empresa recibida:", agenteId);
            console.log("Periodo:", fecha);

            const agenteRadar =
                radar?.agentes_analizados?.find(
                    (item) =>
                        item.agente_id === agenteId
                );

            console.log(
                "Empresa encontrada en radar:",
                agenteRadar
            );

            setAgenteSeleccionado(
                agenteRadar
            );

            const response = await axios.get(
                `${API_URL}/agente/resumen/${agenteId}/${fecha}`
            );

            console.log(
                "Resumen empresa:",
                response.data
            );

            setAnalisis(
                response.data
            );

            setDetalle(
                response.data.impulsores?.movimientos || []
            );


            console.log(
                "=== HISTÓRICO C2 ==="
            );

            console.log(
                "Histórico empresa:",
                response.data?.resultado?.historico
            );

            setAnalisis(
                response.data
            );

            setDetalle(
                response.data.impulsores?.movimientos || []
            );


            const pericodiContexto =
                response.data?.periodo?.pericodi;

            console.log(
                "Pericodi para contexto:",
                pericodiContexto
            );

            const contextoResponse = await axios.get(
                `${API_URL}/agente/contexto/${agenteId}/${pericodiContexto}`
            );

            console.log(
                "=== CONTEXTO C2 ==="
            );

            console.log(
                "URL contexto:",
                `${API_URL}/agente/contexto/${agenteId}/${pericodiContexto}`
            );

            console.log(
                "Respuesta contexto:",
                contextoResponse
            );

            console.log(
                "DATA contexto:",
                contextoResponse.data
            );



            setContextoAgente(
                contextoResponse.data
            );

            const explicacionResponse = await axios.get(
                `${API_URL}/agente/explicacion/${agenteId}/${pericodiContexto}`
            );

            console.log(
                "=== EXPLICACIÓN C2 ==="
            );

            console.log(
                "URL explicacion:",
                `${API_URL}/agente/explicacion/${agenteId}/${pericodiContexto}`
            );

            console.log(
                "DATA explicacion:",
                explicacionResponse.data
            );

            setExplicacionAgente(
                explicacionResponse.data
            );

        } catch (err) {

            console.error(
                "=== ERROR EN ANALISIS ==="
            );

            console.error(err);

            let mensaje =
                "Error desconocido.";

            if (err.response) {

                mensaje =
                    `Error del backend (${err.response.status}): ` +
                    `${err.response.data?.detail || "Sin detalle"}`;

            } else if (err.request) {

                mensaje =
                    "No se recibió respuesta del backend. " +
                    "Verifica que FastAPI esté ejecutándose.";

            } else {

                mensaje =
                    err.message;
            }

            setError(
                `No se pudo abrir el análisis de ${agenteId}. ${mensaje}`
            );

        } finally {

            setLoadingDetalle(false);

        }
    }


    const detectarIntencion = (pregunta, contexto = null) => {
        const texto = pregunta
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        // SALUDOS
        if (
            texto === "hola" ||
            texto === "buenas" ||
            texto === "buenos dias" ||
            texto === "buenas tardes" ||
            texto === "buenas noches"
        ) {
            return "saludo";
        }


        // DESPEDIDAS
        if (
            texto === "gracias" ||
            texto === "muchas gracias" ||
            texto === "gracias bye" ||
            texto === "gracias adios" ||
            texto === "bye" ||
            texto === "adios" ||
            texto === "hasta luego" ||
            texto === "nos vemos" ||
            texto.includes("gracias") && texto.includes("bye") ||
            texto.includes("gracias") && texto.includes("adios")
        ) {
            return "despedida";
        }


        // PRIORIDAD DE REVISIÓN
        if (
            texto.includes("revisar") ||
            texto.includes("revision") ||
            texto.includes("que hago") ||
            texto.includes("que debo") ||
            texto.includes("donde revisar") ||
            texto.includes("por donde empiezo") ||
            texto.includes("que revisa")
        ) {
            return "revisar";
        }

        // PRINCIPAL FACTOR
        if (
            texto.includes("principal factor") ||
            texto.includes("mayor factor") ||
            texto.includes("factor explica") ||
            texto.includes("factor influyo") ||
            texto.includes("mas influyo") ||
            texto.includes("mas influyente") ||
            texto.includes("mayor impacto") ||
            texto.includes("factor tuvo mayor") ||
            texto.includes("factor con mayor") ||
            texto.includes("concepto explica") ||
            texto.includes("concepto influyo") ||
            texto.includes("concepto que mas") ||
            texto.includes("que concepto") ||
            texto.includes("y cual fue el principal") ||
            texto.includes("y cual fue el factor") ||
            texto.includes("y cual es el principal") ||
            texto.includes("y cual fue")
        ) {
            return "principal_factor";
        }


        // EXPLICACIÓN DE COMPONENTE DEL SCORE
        if (
            texto.includes("por que el impacto economico tiene") ||
            texto.includes("por que la variacion porcentual tiene") ||
            texto.includes("por que el factor principal tiene") ||
            texto.includes("por que el comportamiento historico tiene") ||
            texto.includes("por que la variacion tiene") ||
            texto.includes("por que el impacto tiene") ||
            texto.includes("por que el factor tiene") ||
            texto.includes("por que el historico tiene") ||
            texto.includes("por que obtuvo") ||
            texto.includes("como obtuvo") ||
            texto.includes("como se calculo el impacto") ||
            texto.includes("como se calculo la variacion") ||
            texto.includes("como se calculo el factor") ||
            texto.includes("como se calculo el historico") ||
            texto.includes("como se calcula el impacto") ||
            texto.includes("como se calcula la variacion") ||
            texto.includes("como se calcula el factor") ||
            texto.includes("como se calcula el historico")
        ) {
            return "explicar_componente_score";
        }

        // COMPORTAMIENTO HISTÓRICO
        if (
            texto.includes("normal") ||
            texto.includes("habitual") ||
            texto.includes("esperado") ||
            texto.includes("esperada") ||
            texto.includes("historico") ||
            texto.includes("comportamiento") ||
            texto.includes("desviacion") ||
            texto.includes("fuera de lo normal") ||
            texto.includes("dentro de lo normal") ||
            texto.includes("dentro de lo esperado") ||
            texto.includes("historial")
        ) {
            return "comportamiento";
        }


        // COMPENSACIÓN DEL CAMBIO
        if (
            texto.includes("compenso") ||
            texto.includes("compensaron") ||
            texto.includes("compensaba") ||
            texto.includes("compensando") ||
            texto.includes("que concepto compenso") ||
            texto.includes("que factor compenso") ||
            texto.includes("que compenso") ||
            texto.includes("que redujo el aumento") ||
            texto.includes("que redujo la variacion")
        ) {
            return "compensacion";
        }





        // PESOS DEL SCORE
        if (
            texto.includes("cuanto pesa") ||
            texto.includes("cuanto porcentaje") ||
            texto.includes("que porcentaje") ||
            texto.includes("que peso tiene") ||
            texto.includes("que componente tiene mayor peso") ||
            texto.includes("cual componente tiene mayor peso") ||
            texto.includes("que componente pesa mas") ||
            texto.includes("cual componente pesa mas") ||
            texto.includes("peso del impacto") ||
            texto.includes("peso de la variacion") ||
            texto.includes("peso del factor") ||
            texto.includes("peso del historico") ||
            texto.includes("peso tiene cada") ||
            texto.includes("porcentaje aporta cada")
        ) {
            return "pesos_score";
        }


        // COMPONENTE QUE MÁS APORTÓ AL SCORE
        if (
            texto.includes("que componente aporto mas") ||
            texto.includes("que componente aporta mas") ||
            texto.includes("que componente contribuyo mas") ||
            texto.includes("que componente contribuye mas") ||
            texto.includes("que componente tuvo mayor aporte") ||
            texto.includes("que componente tiene mayor aporte") ||
            texto.includes("que aporto mas al score") ||
            texto.includes("que aporta mas al score") ||
            texto.includes("que componente peso mas") ||
            texto.includes("que componente tiene mas peso")
        ) {
            return "componente_score";
        }


        // EXPLICACIÓN DEL SCORE
        if (
            texto.includes("por que tiene ese score") ||
            texto.includes("por que tiene ese puntaje") ||
            texto.includes("como se calcula el score") ||
            texto.includes("como se calcula el puntaje") ||
            texto.includes("por que obtuvo ese score") ||
            texto.includes("por que obtuvo ese puntaje") ||
            texto.includes("que explica el score") ||
            texto.includes("que explica el puntaje") ||
            texto.includes("como se obtuvo el score") ||
            texto.includes("como se obtuvo el puntaje")
        ) {
            return "explicar_score";
        }

        // SIGNIFICANCIA DEL MONTO
        if (
            texto.includes("monto es significativo") ||
            texto.includes("monto significativo") ||
            texto.includes("monto es importante") ||
            texto.includes("monto importante") ||
            texto.includes("impacto es significativo") ||
            texto.includes("impacto significativo") ||
            texto.includes("impacto es importante") ||
            texto.includes("impacto importante") ||
            texto.includes("es significativo") ||
            texto.includes("es importante")
        ) {
            return "significancia";
        }


        // MACHINE LEARNING
        if (
            texto.includes("machine learning") ||
            texto.includes("ml") ||
            texto.includes("anomalia") ||
            texto.includes("anómalo") ||
            texto.includes("anormal")
        ) {
            return "ml";
        }


        // ¿POR QUÉ CAMBIÓ?
        if (
            texto.includes("por que") ||
            texto.includes("porque") ||
            texto.includes("que paso") ||
            texto.includes("cambio") ||
            texto.includes("aumento") ||
            texto.includes("subio") ||
            texto.includes("bajo") ||
            texto.includes("disminuyo") ||
            texto.includes("origino") ||
            texto.includes("causo") ||
            texto.includes("causa del cambio") ||
            texto.includes("razon del cambio") ||
            texto.includes("motivo del cambio") ||
            texto.includes("que genero") ||
            texto.includes("variacion")
        ) {
            return "por_que_cambio";
        }


        // SEGUIMIENTO CONTEXTUAL
        if (
            texto === "y eso" ||
            texto === "y ese" ||
            texto === "y esa" ||
            texto === "y el" ||
            texto === "y la" ||
            texto.includes("y eso") ||
            texto.includes("y ese") ||
            texto.includes("y esa") ||
            texto.includes("y que significa eso") ||
            texto.includes("y que significa") ||
            texto.includes("que significa eso")
        ) {
            if (contexto === "por_que_cambio") {
                return "principal_factor";
            }

            if (contexto === "principal_factor") {
                return "compensacion";
            }

            if (contexto === "compensacion") {
                return "principal_factor";
            }

            return "seguimiento";
        }


        return "desconocida";
    };



    const obtenerRespuestaAsistente = (
        intencion,
        analisis,
        pregunta = ""
    ) => {


        const ml = analisis?.ml;

        if (
            intencion === "saludo" ||
            intencion === "despedida"
        ) {
            // Estas intenciones no requieren información de liquidación.
        } else if (!analisis) {
            return {
                titulo: "Sin información",
                tipo: "desconocida",
                mensaje:
                    "No hay información suficiente para responder la consulta."
            };
        }

        const comparacion = analisis?.comparacion;
        const factores = analisis?.principales_factores || [];
        const historico = analisis?.comportamiento_historico;
        const recomendacion = analisis?.recomendacion_revision;


        //console.log("RELEVANCIA:", analisis.relevancia);

        switch (intencion) {

            case "por_que_cambio": {

                const variacionAgente =
                    analisis?.variacion;

                const impulsoresAgente =
                    analisis?.impulsores;

                const movimientos =
                    impulsoresAgente?.movimientos || [];

                const variacionTotal =
                    variacionAgente?.variacion || 0;

                const variacionPct =
                    variacionAgente?.variacion_pct || 0;

                let mensaje =
                    `La liquidación ${variacionTotal >= 0
                        ? "aumentó"
                        : "disminuyó"
                    } en S/ ${Math.abs(variacionTotal)
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    } (${variacionPct >= 0 ? "+" : ""
                    }${variacionPct.toFixed(2)}%) respecto al periodo anterior.`;

                if (movimientos.length > 0) {

                    const principal =
                        [...movimientos]
                            .sort(
                                (a, b) =>
                                    Math.abs(b.variacion || 0) -
                                    Math.abs(a.variacion || 0)
                            )[0];

                    if (principal?.proceso) {

                        mensaje +=
                            ` El principal movimiento corresponde a ${principal.proceso
                            }`;

                        if (principal.valorizacion) {
                            mensaje +=
                                ` · ${principal.valorizacion}`;
                        }

                        mensaje +=
                            `, con una variación de ${(principal.variacion || 0) >= 0
                                ? "+"
                                : "-"
                            }S/ ${Math.abs(principal.variacion || 0)
                                .toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            }`;

                        if (principal.variacion_pct !== undefined) {
                            mensaje +=
                                ` (${principal.variacion_pct >= 0
                                    ? "+"
                                    : ""
                                }${principal.variacion_pct.toFixed(2)}%)`;
                        }

                        mensaje += ".";
                    }
                }

                mensaje +=
                    " Estos movimientos permiten orientar la revisión, pero no constituyen por sí solos una causalidad física confirmada.";

                return {
                    titulo: "¿Por qué cambió?",
                    tipo: "analisis",
                    mensaje
                };
            }

            case "compensacion": {
                const factoresNegativos = factores.filter(
                    (factor) => factor.variacion < 0
                );

                if (factoresNegativos.length === 0) {
                    return {
                        titulo: "Conceptos que compensaron",
                        tipo: "compensacion",
                        mensaje:
                            "No se identificaron conceptos con variación negativa que hayan compensado el cambio del periodo."
                    };
                }

                const principalCompensador = factoresNegativos[0];

                return {
                    titulo: "Conceptos que compensaron",
                    tipo: "compensacion",
                    mensaje:
                        `El concepto que más compensó la variación fue ${principalCompensador.concepto
                        }, con una variación de -S/ ${Math.abs(
                            principalCompensador.variacion
                        ).toLocaleString("es-PE", {
                            minimumFractionDigits: 2
                        })}.`
                };
            }


            case "explicar_componente_score": {
                const relevancia = analisis?.relevancia;

                if (!relevancia) {
                    return {
                        titulo: "Explicación del componente",
                        tipo: "score",
                        mensaje:
                            "No existe información suficiente para explicar el puntaje del componente."
                    };
                }

                const detalle = relevancia.detalle_componentes;

                if (!detalle) {
                    return {
                        titulo: "Explicación del componente",
                        tipo: "score",
                        mensaje:
                            "El detalle de los componentes todavía no está disponible."
                    };
                }

                const textoPregunta = pregunta
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");

                let componente = null;

                if (textoPregunta.includes("impacto")) {
                    componente = detalle.impacto_economico;
                } else if (textoPregunta.includes("variacion")) {
                    componente = detalle.variacion;
                } else if (textoPregunta.includes("factor")) {
                    componente = detalle.factor_principal;
                } else if (
                    textoPregunta.includes("historico") ||
                    textoPregunta.includes("comportamiento")
                ) {
                    componente = detalle.comportamiento_historico;
                }

                if (!componente) {
                    return {
                        titulo: "Explicación del componente",
                        tipo: "score",
                        mensaje:
                            "Indica qué componente quieres analizar: variación, impacto económico, factor principal o comportamiento histórico."
                    };
                }

                let criterio = "";

                if (componente === detalle.impacto_economico) {
                    const valor = Math.abs(componente.valor);

                    if (valor >= 2000000) {
                        criterio = "el impacto económico es igual o superior a S/ 2,000,000";
                    } else if (valor >= 1000000) {
                        criterio = "el impacto económico se encuentra entre S/ 1,000,000 y menos de S/ 2,000,000";
                    } else if (valor >= 500000) {
                        criterio = "el impacto económico se encuentra entre S/ 500,000 y menos de S/ 1,000,000";
                    } else if (valor >= 250000) {
                        criterio = "el impacto económico se encuentra entre S/ 250,000 y menos de S/ 500,000";
                    } else if (valor >= 100000) {
                        criterio = "el impacto económico se encuentra entre S/ 100,000 y menos de S/ 250,000";
                    } else if (valor >= 50000) {
                        criterio = "el impacto económico se encuentra entre S/ 50,000 y menos de S/ 100,000";
                    } else {
                        criterio = "el impacto económico es menor a S/ 50,000";
                    }
                }

                if (componente === detalle.variacion) {
                    const valor = Math.abs(componente.valor);

                    if (valor >= 40) {
                        criterio = "la variación absoluta es igual o superior al 40%";
                    } else if (valor >= 25) {
                        criterio = "la variación absoluta se encuentra entre 25% y menos de 40%";
                    } else if (valor >= 15) {
                        criterio = "la variación absoluta se encuentra entre 15% y menos de 25%";
                    } else if (valor >= 10) {
                        criterio = "la variación absoluta se encuentra entre 10% y menos de 15%";
                    } else if (valor >= 5) {
                        criterio = "la variación absoluta se encuentra entre 5% y menos de 10%";
                    } else {
                        criterio = "la variación absoluta es menor al 5%";
                    }
                }


                if (componente === detalle.factor_principal) {
                    const valor = Math.abs(componente.valor);

                    if (valor >= 2000000) {
                        criterio = "la variación del factor principal es igual o superior a S/ 2,000,000";
                    } else if (valor >= 1000000) {
                        criterio = "la variación del factor principal se encuentra entre S/ 1,000,000 y menos de S/ 2,000,000";
                    } else if (valor >= 500000) {
                        criterio = "la variación del factor principal se encuentra entre S/ 500,000 y menos de S/ 1,000,000";
                    } else if (valor >= 250000) {
                        criterio = "la variación del factor principal se encuentra entre S/ 250,000 y menos de S/ 500,000";
                    } else if (valor >= 100000) {
                        criterio = "la variación del factor principal se encuentra entre S/ 100,000 y menos de S/ 250,000";
                    } else if (valor >= 50000) {
                        criterio = "la variación del factor principal se encuentra entre S/ 50,000 y menos de S/ 100,000";
                    } else {
                        criterio = "la variación del factor principal es menor a S/ 50,000";
                    }
                }


                if (componente === detalle.comportamiento_historico) {
                    const valor = Math.abs(componente.valor);

                    if (valor >= 3) {
                        criterio =
                            "el Z-Score tiene una desviación absoluta igual o superior a 3, lo que corresponde a un comportamiento excepcional";
                    } else if (valor >= 2) {
                        criterio =
                            "el Z-Score tiene una desviación absoluta entre 2 y menos de 3, lo que corresponde a un comportamiento relevante";
                    } else if (valor >= 1) {
                        criterio =
                            "el Z-Score tiene una desviación absoluta entre 1 y menos de 2, lo que corresponde a un comportamiento moderado";
                    } else {
                        criterio =
                            "el Z-Score tiene una desviación absoluta menor a 1, lo que corresponde a un comportamiento normal";
                    }
                }


                return {
                    titulo: "Explicación del componente",
                    tipo: "score",
                    mensaje:
                        `El componente obtuvo ${componente.puntaje}/100 porque ${criterio}. Su peso dentro del score final es ${componente.peso}% y su aporte ponderado es de ${componente.aporte} puntos.`
                };
            }


            case "pesos_score": {
                return {
                    titulo: "Pesos del score de relevancia",
                    tipo: "score",
                    mensaje:
                        "El score se distribuye en cuatro componentes: variación 25%, impacto económico 35%, factor principal 20% y comportamiento histórico 20%. El impacto económico tiene el mayor peso porque representa la magnitud económica de la variación identificada."
                };
            }


            case "componente_score": {
                const relevancia = analisis?.relevancia;

                if (!relevancia) {
                    return {
                        titulo: "Principal aporte al score",
                        tipo: "score",
                        mensaje:
                            "No existe información suficiente para determinar qué componente aportó más al score."
                    };
                }

                const componentes = [
                    {
                        nombre: "Variación",
                        score: relevancia.score_variacion,
                        peso: 0.25
                    },
                    {
                        nombre: "Impacto económico",
                        score: relevancia.score_impacto,
                        peso: 0.35
                    },
                    {
                        nombre: "Factor principal",
                        score: relevancia.score_factor,
                        peso: 0.20
                    },
                    {
                        nombre: "Comportamiento histórico",
                        score: relevancia.score_historico,
                        peso: 0.20
                    }
                ];

                const aportes = componentes.map((componente) => ({
                    ...componente,
                    aporte: componente.score * componente.peso
                }));

                const principal = aportes.reduce(
                    (max, componente) =>
                        componente.aporte > max.aporte ? componente : max
                );

                return {
                    titulo: "Principal aporte al score",
                    tipo: "score",
                    mensaje:
                        `El componente que más aportó al score fue ${principal.nombre
                        }, con un puntaje de ${principal.score
                        }/100 y un aporte ponderado de ${principal.aporte.toFixed(2)
                        } puntos al score final.`
                };
            }


            case "explicar_score": {
                const relevancia = analisis?.relevancia;

                if (!relevancia) {
                    return {
                        titulo: "Explicación del score",
                        tipo: "score",
                        mensaje:
                            "No existe información suficiente para explicar el score de relevancia."
                    };
                }

                const score = relevancia.score;

                return {
                    titulo: "Explicación del score de relevancia",
                    tipo: "score",
                    mensaje:
                        `El score de ${score}/100 se obtiene combinando cuatro componentes: variación (${relevancia.score_variacion}/100, 25%), impacto económico (${relevancia.score_impacto}/100, 35%), factor principal (${relevancia.score_factor}/100, 20%) y comportamiento histórico (${relevancia.score_historico}/100, 20%). El resultado refleja la relevancia global de la variación identificada.`
                };
            }


            case "significancia": {
                const score = analisis?.relevancia?.score;
                const nivel = analisis?.relevancia?.nivel;

                if (score === undefined || !nivel) {
                    return {
                        titulo: "Significancia del impacto",
                        tipo: "significancia",
                        mensaje:
                            "No existe suficiente información para evaluar la significancia del impacto."
                    };
                }

                let interpretacion = "";

                if (nivel === "CRÍTICO") {
                    interpretacion =
                        "El impacto es crítico y debería priorizarse su revisión.";
                } else if (nivel === "ALTO") {
                    interpretacion =
                        "El impacto es alto y se recomienda una revisión prioritaria.";
                } else if (nivel === "MEDIO") {
                    interpretacion =
                        "El impacto tiene una relevancia media y conviene revisar los principales factores.";
                } else if (nivel === "BAJO") {
                    interpretacion =
                        "El impacto presenta una relevancia baja respecto a los criterios evaluados.";
                } else {
                    interpretacion =
                        "El impacto se encuentra dentro de un nivel normal de relevancia.";
                }

                return {
                    titulo: "Significancia del impacto",
                    tipo: "significancia",
                    mensaje:
                        `El impacto de la liquidación tiene un score de relevancia de ${score}/100 y se clasifica como ${nivel}. ${interpretacion}`
                };
            }


            case "principal_factor": {

                const impulsoresAgente =
                    analisis?.impulsores;

                const movimientos =
                    impulsoresAgente?.movimientos || [];

                if (movimientos.length === 0) {
                    return {
                        titulo: "Principal factor",
                        tipo: "factor",
                        mensaje:
                            "No se identificaron movimientos suficientes para determinar un principal factor para el periodo seleccionado."
                    };
                }

                const principal =
                    [...movimientos]
                        .sort(
                            (a, b) =>
                                Math.abs(b.variacion || 0) -
                                Math.abs(a.variacion || 0)
                        )[0];

                if (!principal?.proceso) {
                    return {
                        titulo: "Principal factor",
                        tipo: "factor",
                        mensaje:
                            "No se pudo determinar el principal factor para el periodo seleccionado."
                    };
                }

                const variacionPrincipal =
                    principal.variacion || 0;

                let mensaje =
                    `El principal factor identificado corresponde a ${principal.proceso
                    }`;

                if (principal.valorizacion) {
                    mensaje +=
                        ` · ${principal.valorizacion}`;
                }

                mensaje +=
                    `, con una variación de ${variacionPrincipal >= 0
                        ? "+"
                        : "-"
                    }S/ ${Math.abs(variacionPrincipal)
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    }`;

                if (principal.variacion_pct !== undefined) {
                    mensaje +=
                        ` (${principal.variacion_pct >= 0
                            ? "+"
                            : ""
                        }${principal.variacion_pct.toFixed(2)}%)`;
                }

                mensaje +=
                    ". Este resultado permite priorizar la revisión, pero no implica por sí solo una causalidad física confirmada.";

                return {
                    titulo: "Principal factor",
                    tipo: "factor",
                    mensaje
                };
            }

            case "comportamiento": {

                const historicoAgente =
                    analisis?.resultado?.historico || [];

                if (historicoAgente.length < 2) {
                    return {
                        titulo: "¿Es un comportamiento normal?",
                        tipo: "historico",
                        mensaje:
                            "No existe suficiente información histórica para evaluar el comportamiento."
                    };
                }

                const valoresHistoricos =
                    historicoAgente
                        .map(p => ({
                            periodo: p.perinombre,
                            valor: Number(p.monto || 0)
                        }))
                        .filter(p => Number.isFinite(p.valor));

                if (valoresHistoricos.length < 2) {
                    return {
                        titulo: "¿Es un comportamiento normal?",
                        tipo: "historico",
                        mensaje:
                            "No existe suficiente información histórica para evaluar el comportamiento."
                    };
                }

                const valorActual =
                    Number(
                        resumenAgente?.resultado?.total ??
                        analisis?.resultado?.total ??
                        0
                    );

                const minimo =
                    Math.min(
                        ...valoresHistoricos.map(p => p.valor)
                    );

                const maximo =
                    Math.max(
                        ...valoresHistoricos.map(p => p.valor)
                    );

                const periodoMinimo =
                    valoresHistoricos.find(
                        p => p.valor === minimo
                    )?.periodo;

                const periodoMaximo =
                    valoresHistoricos.find(
                        p => p.valor === maximo
                    )?.periodo;

                const dentroDelRango =
                    valorActual >= minimo &&
                    valorActual <= maximo;

                const mensaje =
                    `El resultado actual es S/ ${valorActual
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    }. ` +
                    `${dentroDelRango
                        ? "Se encuentra dentro del rango observado"
                        : "Se encuentra fuera del rango observado"
                    } en los periodos históricos disponibles, entre S/ ${minimo
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    } y S/ ${maximo
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    }. ` +
                    `El mínimo corresponde a ${periodoMinimo} y el máximo a ${periodoMaximo}. ` +
                    `${dentroDelRango
                        ? "Por ello, no se observa por sí solo un comportamiento fuera del histórico disponible."
                        : "Por ello, conviene revisar los principales factores que explican esta desviación."
                    }`;

                return {
                    titulo: "¿Es un comportamiento normal?",
                    tipo: "historico",
                    mensaje
                };
            }

            case "revisar": {

                const movimientos =
                    analisis?.impulsores?.movimientos || [];

                const cierre =
                    analisis?.cierre;

                const motivo =
                    cierre?.motivos?.[0];

                if (motivo) {

                    let mensaje =
                        `La primera revisión recomendada es ${motivo.proceso || "el proceso identificado"
                        }.`;

                    if (motivo.titulo) {
                        mensaje +=
                            ` Se identificó: ${motivo.titulo}.`;
                    }

                    if (motivo.accion) {
                        mensaje +=
                            ` Acción sugerida: ${motivo.accion}`;
                    }

                    return {
                        titulo: "¿Qué debería revisar primero?",
                        tipo: "revision",
                        mensaje
                    };
                }

                if (movimientos.length > 0) {

                    const principal =
                        [...movimientos]
                            .sort(
                                (a, b) =>
                                    Math.abs(b.variacion || 0) -
                                    Math.abs(a.variacion || 0)
                            )[0];

                    let mensaje =
                        "No existen bloqueos para el cierre. ";

                    if (principal?.proceso) {

                        mensaje +=
                            `Como primera revisión, conviene revisar ${principal.proceso}`;

                        if (principal.valorizacion) {
                            mensaje +=
                                ` · ${principal.valorizacion}`;
                        }

                        mensaje +=
                            `, ya que presenta el mayor movimiento identificado, con una variación de ${(principal.variacion || 0) >= 0
                                ? "+"
                                : "-"
                            }S/ ${Math.abs(principal.variacion || 0)
                                .toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            }`;

                        if (principal.variacion_pct !== undefined) {
                            mensaje +=
                                ` (${principal.variacion_pct >= 0
                                    ? "+"
                                    : ""
                                }${principal.variacion_pct.toFixed(2)}%)`;
                        }

                        mensaje += ".";
                    }

                    mensaje +=
                        " La prioridad de revisión no implica que exista un bloqueo para el cierre.";

                    return {
                        titulo: "¿Qué debería revisar primero?",
                        tipo: "revision",
                        mensaje
                    };
                }

                return {
                    titulo: "¿Qué debería revisar primero?",
                    tipo: "revision",
                    mensaje:
                        "Las validaciones disponibles no presentan bloqueos. Se recomienda continuar con la revisión final de la liquidación antes del cierre."
                };
            }

            case "saludo":
                return {
                    titulo: "Asistente de Liquidaciones",
                    tipo: "saludo",
                    mensaje:
                        "¡Hola! Puedo ayudarte a analizar la liquidación del periodo seleccionado."
                };


            case "despedida":
                return {
                    titulo: "Asistente de Liquidaciones",
                    tipo: "saludo",
                    mensaje:
                        "¡Con gusto! Ha sido un placer ayudarte con el análisis de la liquidación. 👋"
                };


            case "seguimiento": {
                return {
                    titulo: "Seguimiento de la consulta",
                    tipo: "seguimiento",
                    mensaje:
                        "Puedo continuar con el análisis de la liquidación. Puedes preguntarme por el principal factor, los conceptos que compensaron la variación o el comportamiento histórico."
                };
            }


            case "ml": {
                if (!ml || !ml.disponible) {
                    return {
                        titulo: "Análisis mediante Machine Learning",
                        tipo: "score",
                        mensaje:
                            "No existe información suficiente para generar una señal mediante Machine Learning para este periodo."
                    };
                }

                return {
                    titulo: "Análisis mediante Machine Learning",
                    tipo: "score",
                    mensaje:
                        ml.es_anomalia
                            ? `El modelo de Machine Learning identifica este periodo como un comportamiento potencialmente inusual respecto al historial del agente. El score de anomalía obtenido fue ${ml.score_anomalia}. Esta señal debe analizarse junto con el score de relevancia y los factores identificados.`
                            : `El modelo de Machine Learning no identifica este periodo como un comportamiento potencialmente inusual respecto al historial del agente. El score de anomalía obtenido fue ${ml.score_anomalia}.`
                };
            }

            default:
                return {
                    titulo: "Consulta no identificada",
                    tipo: "desconocida",
                    mensaje:
                        "No pude identificar la consulta. Puedes preguntarme por la variación, los factores, el comportamiento histórico o qué deberías revisar primero."
                };
        }
    };


    const seleccionarIntencion = (intencion) => {

        const contextoBase =
            modoActual === "analista"
                ? analisis
                : resumenAgente;

        const resultado = contextoBase?.resultado;
        const variacion = contextoBase?.variacion;
        const impulsores = contextoBase?.impulsores || {};
        const cierre = contextoBase?.cierre;

        let titulo = "";
        let mensaje = "";

        switch (intencion) {

            case "por_que_cambio": {

                titulo = "¿Por qué cambió?";

                const movimientos =
                    impulsores?.movimientos || [];

                const variacionTotal =
                    variacion?.variacion || 0;

                const variacionPct =
                    variacion?.variacion_pct || 0;

                mensaje =
                    `La liquidación ${variacionTotal >= 0
                        ? "aumentó"
                        : "disminuyó"
                    } en S/ ${Math.abs(variacionTotal)
                        .toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                    } (${variacionPct >= 0 ? "+" : ""
                    }${variacionPct.toFixed(2)}%) respecto al periodo anterior.`;

                if (movimientos.length > 0) {

                    const principal =
                        [...movimientos]
                            .sort(
                                (a, b) =>
                                    Math.abs(b.variacion || 0) -
                                    Math.abs(a.variacion || 0)
                            )[0];

                    if (principal?.proceso) {

                        mensaje +=
                            ` El principal movimiento corresponde a ${principal.proceso
                            }`;

                        if (principal.valorizacion) {
                            mensaje +=
                                ` · ${principal.valorizacion}`;
                        }

                        mensaje +=
                            `, con una variación de ${(principal.variacion || 0) >= 0
                                ? "+"
                                : "-"
                            }S/ ${Math.abs(principal.variacion || 0)
                                .toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            }`;

                        if (principal.variacion_pct !== undefined) {
                            mensaje +=
                                ` (${principal.variacion_pct >= 0
                                    ? "+"
                                    : ""
                                }${principal.variacion_pct.toFixed(2)}%)`;
                        }

                        mensaje += ".";
                    }
                }

                mensaje +=
                    " Estos movimientos permiten orientar la revisión, pero no constituyen por sí solos una causalidad física confirmada.";

                break;
            }


            case "principal_factor": {

                titulo = "Principal factor";

                const movimientos =
                    impulsores?.movimientos || [];

                if (movimientos.length > 0) {

                    const principal =
                        [...movimientos]
                            .sort(
                                (a, b) =>
                                    Math.abs(b.variacion || 0) -
                                    Math.abs(a.variacion || 0)
                            )[0];

                    if (principal?.proceso) {

                        const variacionPrincipal =
                            principal.variacion || 0;

                        mensaje =
                            `El principal factor identificado corresponde a ${principal.proceso
                            }`;

                        if (principal.valorizacion) {
                            mensaje +=
                                ` · ${principal.valorizacion}`;
                        }

                        mensaje +=
                            `, con una variación de ${variacionPrincipal >= 0
                                ? "+"
                                : "-"
                            }S/ ${Math.abs(variacionPrincipal)
                                .toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            }`;

                        if (principal.variacion_pct !== undefined) {
                            mensaje +=
                                ` (${principal.variacion_pct >= 0
                                    ? "+"
                                    : ""
                                }${principal.variacion_pct.toFixed(2)}%)`;
                        }

                        mensaje += ".";
                    }

                } else {

                    mensaje =
                        "No se identificaron movimientos suficientes para determinar un principal factor en el periodo seleccionado.";
                }

                mensaje +=
                    " Este resultado permite priorizar la revisión, pero no implica por sí solo una causalidad física confirmada.";

                break;
            }

            case "comportamiento": {

                titulo = "¿Es un comportamiento normal?";

                const historico =
                    resultado?.historico || [];

                const actual =
                    resultado?.total || 0;

                if (historico.length >= 2) {

                    const valores =
                        historico.map(item => item.monto || 0);

                    const minimo =
                        Math.min(...valores);

                    const maximo =
                        Math.max(...valores);

                    const periodoMinimo =
                        historico.find(
                            item => item.monto === minimo
                        );

                    const periodoMaximo =
                        historico.find(
                            item => item.monto === maximo
                        );

                    const dentroDelRango =
                        actual >= minimo &&
                        actual <= maximo;

                    mensaje =
                        `El resultado actual es S/ ${actual.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })
                        }. `;

                    if (dentroDelRango) {

                        mensaje +=
                            `Se encuentra dentro del rango observado en los periodos históricos disponibles, entre S/ ${minimo.toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                            } y S/ ${maximo.toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                            }. `;

                        if (periodoMinimo?.perinombre && periodoMaximo?.perinombre) {
                            mensaje +=
                                `El mínimo corresponde a ${periodoMinimo.perinombre} y el máximo a ${periodoMaximo.perinombre}. `;
                        }

                        mensaje +=
                            "Por ello, no se observa por sí solo un comportamiento fuera del histórico disponible.";

                    } else {

                        mensaje +=
                            `Se encuentra fuera del rango histórico observado, cuyo intervalo va de S/ ${minimo.toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                            } a S/ ${maximo.toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                            }. `;

                        mensaje +=
                            "Esto sugiere un comportamiento que requiere revisión contextual.";
                    }

                } else {

                    mensaje =
                        "No existe suficiente histórico disponible para determinar si el comportamiento se encuentra dentro del patrón observado.";
                }

                break;
            }


            case "revisar": {

                titulo = "¿Qué debería revisar primero?";

                const movimientos =
                    impulsores?.movimientos || [];

                const motivo =
                    cierre?.motivos?.[0];

                if (motivo) {

                    mensaje =
                        `La primera revisión recomendada es ${motivo.proceso || "el proceso identificado"
                        }.`;

                    if (motivo.titulo) {
                        mensaje +=
                            ` Se identificó: ${motivo.titulo}.`;
                    }

                    if (motivo.accion) {
                        mensaje +=
                            ` Acción sugerida: ${motivo.accion}`;
                    }

                } else if (movimientos.length > 0) {

                    const principal =
                        [...movimientos]
                            .sort(
                                (a, b) =>
                                    Math.abs(b.variacion || 0) -
                                    Math.abs(a.variacion || 0)
                            )[0];

                    mensaje =
                        "No existen bloqueos para el cierre. ";

                    if (principal?.proceso) {

                        mensaje +=
                            `Como primera revisión, conviene revisar ${principal.proceso
                            }`;

                        if (principal.valorizacion) {
                            mensaje +=
                                ` · ${principal.valorizacion}`;
                        }

                        mensaje +=
                            `, ya que presenta el mayor movimiento identificado, con una variación de ${(principal.variacion || 0) >= 0
                                ? "+"
                                : "-"
                            }S/ ${Math.abs(principal.variacion || 0)
                                .toLocaleString("es-PE", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })
                            }`;

                        if (principal.variacion_pct !== undefined) {
                            mensaje +=
                                ` (${principal.variacion_pct >= 0
                                    ? "+"
                                    : ""
                                }${principal.variacion_pct.toFixed(2)}%)`;
                        }

                        mensaje += ".";
                    }

                    mensaje +=
                        " La prioridad de revisión no implica que exista un bloqueo para el cierre.";

                } else {

                    mensaje =
                        "Las validaciones disponibles no presentan bloqueos. Se recomienda continuar con la revisión final de la liquidación antes del cierre.";
                }

                break;
            }

            default: {

                titulo = "Sin información";

                mensaje =
                    "No hay información suficiente para responder la consulta.";

                break;
            }
        }


        const pregunta = {
            por_que_cambio: "¿Por qué cambió?",
            principal_factor: "¿Cuál fue el principal factor?",
            comportamiento: "¿Es un comportamiento normal?",
            revisar: "¿Qué debería revisar primero?"
        };


        const respuesta = {
            titulo,
            tipo: "analisis",
            mensaje
        };


        setMensajesChat((mensajes) => [
            ...mensajes,
            {
                tipo: "usuario",
                mensaje: pregunta[intencion]
            },
            {
                tipo: "asistente",
                mensaje: respuesta.mensaje,
                titulo: respuesta.titulo
            }
        ]);


        setPreguntaSeleccionada(intencion);
        setRespuestaAsistente(respuesta);
        setUltimaIntencion(intencion);
        setUltimaRespuesta(respuesta);
    };



    function volverRadar() {

        setAgenteSeleccionado(null);
        setDetalle(null);
        setAnalisis(null);
        setError(null);

    }

    const agentesAnalizados =
        radar?.agentes_analizados || [];

    const alertas =
        radar?.alertas || [];

    const alertasRelevantes =
        alertas;

    const variacionPromedio =
        agentesAnalizados.length > 0
            ? agentesAnalizados.reduce(
                (total, item) =>
                    total + item.variacion_porcentual,
                0
            ) / agentesAnalizados.length
            : 0;



    const agentesRadar =
        radar?.agentes_analizados || [];

    const totalPaginasRadar = Math.ceil(
        agentesRadar.length / agentesPorPagina
    );

    const indiceInicioRadar =
        (paginaRadar - 1) * agentesPorPagina;

    const agentesRadarPagina =
        agentesRadar.slice(
            indiceInicioRadar,
            indiceInicioRadar + agentesPorPagina
        );

    const trazabilidadLVTA =
        explicacionAgente
            ?.explicaciones
            ?.LVTA
            ?.trazabilidad;

    const historicoEmpresa =
        analisis?.resultado?.historico || [];

    return (

        <div className="app">

            <header className="header">

                <div className="header-title">

                    <h1>
                        COES Liquidaciones 360
                    </h1>

                    <p>
                        Consulta - Analiza - Explica - Decide.
                    </p>

                </div>


                <div className="periodo">

                    <span>
                        Periodo analizado
                    </span>

                    <select
                        value={fecha || ""}
                        onChange={(e) =>
                            setFecha(Number(e.target.value))
                        }
                    >
                        {periodos.map((periodo) => (
                            <option
                                key={periodo.pericodi}
                                value={periodo.pericodi}
                            >
                                {periodo.perinombre}
                                {" · "}
                                {periodo.estado}
                                {" · "}
                                {periodo.version_vigente}
                            </option>
                        ))}
                    </select>

                </div>

            </header>



            <main className="container">

                {error && (

                    <div className="message error">

                        <div>
                            {error}
                        </div>

                        {modoActual === "agente" && (

                            <button
                                className="error-back-button"
                                onClick={() => {
                                    setError(null);
                                    setResumenAgente(null);
                                    setModoActual(null);
                                }}
                            >
                                ← Volver a seleccionar empresa
                            </button>

                        )}

                    </div>

                )}

                {!modoActual && (

                    <div className="mode-home">

                        <div className="mode-home-intro">

                            <h2>
                                ¿Cómo quieres investigar?
                            </h2>

                        </div>


                        <div className="mode-home-grid">


                            {/* MODO AGENTE */}

                            <div className="mode-home-card agent-mode-card">

                                <div className="mode-home-icon">
                                    👤
                                </div>

                                <span className="mode-home-label">
                                    MODO AGENTE
                                </span>

                                <h3>
                                    Mi liquidación
                                </h3>

                                <p>
                                    Entiende qué cambió en tu liquidación,
                                    por qué cambió y si puedes avanzar al cierre.
                                </p>

                                <div className="periodo">

                                    <label htmlFor="empresa-agente" className="empresa-agente-css">
                                        Empresa:
                                    </label>

                                    <select
                                        id="empresa-agente"
                                        value={empresaAgente || ""}
                                        onChange={(e) =>
                                            setEmpresaAgente(e.target.value)
                                        }
                                    >
                                        <option value="">
                                            Selecciona una empresa
                                        </option>

                                        {empresas.map((empresa) => (
                                            <option
                                                key={empresa.empresa_id}
                                                value={empresa.empresa_id}
                                            >
                                                {empresa.alias ?? empresa.empresa_id}
                                            </option>
                                        ))}
                                    </select>

                                </div>


                                <div className="mode-home-flow">

                                    <span>
                                        ¿Qué pasó?
                                    </span>

                                    <span>→</span>

                                    <span>
                                        ¿Por qué cambió?
                                    </span>

                                    <span>→</span>

                                    <span>
                                        ¿Puedo cerrar?
                                    </span>

                                </div>


                                <button
                                    className="mode-home-button agent-home-button"
                                    disabled={!empresaAgente}
                                    onClick={async () => {

                                        setPericodiAgente(fecha);

                                        setModoActual("agente");

                                        setSeccionAgente("A1");

                                        await cargarResumenAgente(
                                            empresaAgente,
                                            fecha
                                        );

                                    }}
                                >
                                    Analizar mi liquidación →
                                </button>

                            </div>


                            {/* ANALISTA COES */}

                            <div className="mode-home-card analyst-mode-card">

                                <div className="mode-home-icon">
                                    🔎
                                </div>

                                <span className="mode-home-label">
                                    ANALISTA COES
                                </span>

                                <h3>
                                    Visión de mercado
                                </h3>

                                <p>
                                    Explora el comportamiento del mercado,
                                    procesos, empresas, variaciones y evidencia.
                                </p>


                                <div className="mode-home-flow">

                                    <span>
                                        ¿Qué pasa?
                                    </span>

                                    <span>→</span>

                                    <span>
                                        ¿Dónde está el cambio?
                                    </span>

                                    <span>→</span>

                                    <span>
                                        ¿Qué lo explica?
                                    </span>

                                </div>


                                <button
                                    className="mode-home-button analyst-home-button"
                                    onClick={entrarModoAnalista}
                                >
                                    Explorar mercado →
                                </button>

                            </div>


                        </div>

                    </div>

                )}

                {modoActual === "analista" && !agenteSeleccionado && (

                    <>

                        <section className="intro">

                            <div>

                                <h2>
                                    Panel de Liquidaciones
                                </h2>

                                <p>
                                    Visualiza variaciones relevantes
                                    y prioriza los casos que requieren análisis.
                                </p>

                            </div>
                            <div className="agent-toolbar">
                                <button
                                    onClick={() => {
                                        setModoActual(null);
                                        setSeccionAgente("SELECCION");
                                        setEmpresaAgente(null);
                                        setPericodiAgente(null);
                                        setResumenAgente(null);
                                        setExplicacionAgente(null);
                                        setContextoAgente(null);
                                    }}
                                >
                                    Inicio
                                </button>

                                <button onClick={cargarRadar}>
                                    Actualizar
                                </button>
                            </div>
                        </section>

                        {loading && (

                            <div className="message">
                                Cargando información...
                            </div>

                        )}

                        {!loading && !error && radar && (

                            <>

                                <section className="cards">

                                    <div className="card">

                                        <span>
                                            Total agentes
                                        </span>

                                        <strong>
                                            {agentesAnalizados.length}
                                        </strong>

                                        <small>
                                            Agentes analizados
                                        </small>

                                    </div>

                                    <div className="card">

                                        <span>
                                            Alertas relevantes
                                        </span>

                                        <strong>
                                            {alertasRelevantes.length}
                                        </strong>

                                        <small>
                                            Score ≥ 60
                                        </small>

                                    </div>

                                    <div className="card">

                                        <span>
                                            Variación promedio
                                        </span>

                                        <strong>
                                            {variacionPromedio.toFixed(1)}%
                                        </strong>

                                        <small>
                                            Frente al periodo anterior
                                        </small>

                                    </div>

                                    <div className="card highlight">

                                        <span>
                                            Estado del radar
                                        </span>

                                        <strong>
                                            {alertasRelevantes.length > 0
                                                ? "REVISAR"
                                                : "NORMAL"}
                                        </strong>

                                        <small>
                                            Priorización automática
                                        </small>

                                    </div>

                                </section>

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                Radar de Liquidaciones
                                            </h2>

                                            <p>
                                                Prioriza automáticamente los agentes que requieren mayor atención y muestra los factores que explican su variación.
                                            </p>

                                        </div>

                                        <div className="badge">

                                            {radar.total_agentes} agentes

                                        </div>

                                    </div>

                                    <div className="table-container">

                                        <table>

                                            <thead>

                                                <tr>

                                                    <th>
                                                        Agente
                                                    </th>

                                                    <th>
                                                        Variación %
                                                    </th>

                                                    <th>
                                                        Impacto económico
                                                    </th>

                                                    <th>
                                                        Relevancia
                                                    </th>

                                                    <th>
                                                        Nivel
                                                    </th>
                                                    {/* 
                                                    <th>
                                                        Histórico
                                                    </th>
                                                    */}

                                                    <th>Principal factor</th>

                                                    <th>
                                                        Acción
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>

                                                {agentesRadarPagina.map(
                                                    (item) => (

                                                        <tr key={item.agente_id}>

                                                            <td>
                                                                <div className="agent-cell">

                                                                    <strong>
                                                                        {aliasDeEmpresa(item.agente)}
                                                                    </strong>

                                                                    <span>
                                                                        {item.agente_id}
                                                                    </span>

                                                                </div>
                                                            </td>

                                                            <td>

                                                                <span
                                                                    className={
                                                                        item.variacion_porcentual >= 0
                                                                            ? "positive"
                                                                            : "negative"
                                                                    }
                                                                >

                                                                    {item.variacion_porcentual >= 0
                                                                        ? "+"
                                                                        : ""}

                                                                    {item.variacion_porcentual.toFixed(2)}
                                                                    %

                                                                </span>

                                                            </td>

                                                            <td>

                                                                S/{" "}

                                                                {item.variacion_absoluta.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                    }
                                                                )}

                                                            </td>

                                                            <td>
                                                                <div className="score-cell">
                                                                    <strong>
                                                                        {item.score}
                                                                    </strong>
                                                                    <span>/100</span>
                                                                </div>
                                                            </td>


                                                            <td>
                                                                <span
                                                                    className={`relevance-badge relevance-${item.nivel.toLowerCase()}`}
                                                                >
                                                                    {item.nivel}
                                                                </span>
                                                            </td>

                                                            {/* 
                                                            <td>
                                                                <div className="radar-historical">
                                                                    <strong
                                                                        className={`historical-badge historical-badge-${(
                                                                            item.clasificacion_historica || "nd"
                                                                        ).toLowerCase()}`}
                                                                    >
                                                                        {item.clasificacion_historica || "N/D"}
                                                                    </strong>

                                                                    {item.z_score !== undefined && (
                                                                        <small>
                                                                            Z: {item.z_score >= 0 ? "+" : ""}
                                                                            {Number(item.z_score).toFixed(2)}
                                                                        </small>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            */}

                                                            <td>
                                                                <div className="principal-factor-cell">

                                                                    <strong>
                                                                        {item.principal_factor || "Sin factor"}
                                                                    </strong>

                                                                    {item.principal_factor && (
                                                                        <span
                                                                            className={
                                                                                item.variacion_principal_factor >= 0
                                                                                    ? "factor-positive"
                                                                                    : "factor-negative"
                                                                            }
                                                                        >
                                                                            {item.variacion_principal_factor >= 0
                                                                                ? "+"
                                                                                : "-"}
                                                                            S/{" "}
                                                                            {Math.abs(
                                                                                item.variacion_principal_factor
                                                                            ).toLocaleString("es-PE", {
                                                                                minimumFractionDigits: 2
                                                                            })}
                                                                        </span>
                                                                    )}

                                                                </div>
                                                            </td>


                                                            <td>

                                                                <button
                                                                    className="analyze-button"
                                                                    onClick={() =>
                                                                        analizarAgente(
                                                                            item.agente_id
                                                                        )
                                                                    }
                                                                >
                                                                    Analizar
                                                                </button>

                                                            </td>

                                                        </tr>

                                                    )
                                                )}

                                            </tbody>

                                        </table>

                                        {totalPaginasRadar > 1 && (
                                            <div className="radar-pagination">

                                                <button
                                                    onClick={() =>
                                                        setPaginaRadar(
                                                            (pagina) => pagina - 1
                                                        )
                                                    }
                                                    disabled={paginaRadar === 1}
                                                >
                                                    ← Anterior
                                                </button>

                                                <span>
                                                    Página {paginaRadar} de {totalPaginasRadar}
                                                </span>

                                                <button
                                                    onClick={() =>
                                                        setPaginaRadar(
                                                            (pagina) => pagina + 1
                                                        )
                                                    }
                                                    disabled={
                                                        paginaRadar === totalPaginasRadar
                                                    }
                                                >
                                                    Siguiente →
                                                </button>

                                            </div>
                                        )}


                                    </div>

                                </section>


                            </>

                        )}

                    </>

                )}

                {modoActual === "analista" && agenteSeleccionado && (
                    <section className="detail-view">

                        {loadingDetalle && (

                            <div className="message">
                                Analizando liquidación...
                            </div>

                        )}

                        {!loadingDetalle && analisis && (

                            <>

                                {/* ===================================================== */}
                                {/* C2 · EMPRESA */}
                                {/* ===================================================== */}

                                <div className="detail-header">

                                    <div>

                                        <span className="detail-label">
                                            🔎 ANALISTA COES · C2 EMPRESA
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(
                                                agenteSeleccionado?.agente_id ||
                                                    analisis.empresa
                                            )}
                                        </h2>

                                        <p>
                                            {analisis.periodo?.perinombre}
                                            {" · "}
                                            {analisis.periodo?.estado}
                                            {" · "}
                                            {analisis.periodo?.version_vigente}
                                        </p>

                                        <div className="review-score">

                                            <span className="review-score-label">
                                                Score de revisión
                                            </span>

                                            <strong>
                                                {agenteSeleccionado?.score ?? 0}
                                                <small> / 100</small>
                                            </strong>

                                            <span
                                                className={
                                                    agenteSeleccionado?.clasificacion === "ALTO"
                                                        ? "review-score-high"
                                                        : agenteSeleccionado?.clasificacion === "MEDIO"
                                                            ? "review-score-medium"
                                                            : "review-score-low"
                                                }
                                            >
                                                {agenteSeleccionado?.clasificacion || "BAJO"}
                                            </span>

                                        </div>

                                    </div>

                                    <button

                                        onClick={volverRadar}
                                    >
                                        Volver al Radar
                                    </button>

                                </div>


                                {/* ===================================================== */}
                                {/* RESULTADO */}
                                {/* ===================================================== */}

                                <section className="cards detail-cards">

                                    <div className="card">

                                        <span>
                                            Resultado de liquidación
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {Number(
                                                analisis.resultado?.total || 0
                                            ).toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2
                                                }
                                            )}
                                        </strong>

                                        <small>
                                            {analisis.resultado?.cantidad_registros || 0}
                                            {" registros"}
                                        </small>

                                    </div>


                                    <div className="card">

                                        <span>
                                            Periodo anterior
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {Number(
                                                analisis.variacion?.anterior || 0
                                            ).toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2
                                                }
                                            )}
                                        </strong>

                                        <small>
                                            {analisis.variacion
                                                ?.periodo_anterior
                                                ?.perinombre || "—"}
                                        </small>

                                    </div>


                                    <div className="card">

                                        <span>
                                            Variación
                                        </span>

                                        <strong
                                            className={
                                                Number(
                                                    analisis.variacion?.variacion || 0
                                                ) > 0
                                                    ? "negative"
                                                    : Number(
                                                        analisis.variacion?.variacion || 0
                                                    ) < 0
                                                        ? "positive"
                                                        : ""
                                            }
                                        >

                                            {Number(
                                                analisis.variacion?.variacion || 0
                                            ) >= 0
                                                ? "↑"
                                                : "↓"}

                                            {" S/ "}

                                            {Math.abs(
                                                Number(
                                                    analisis.variacion?.variacion || 0
                                                )
                                            ).toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2
                                                }
                                            )}

                                        </strong>

                                        <small
                                            className={
                                                Number(
                                                    analisis.variacion?.variacion || 0
                                                ) > 0
                                                    ? "negative"
                                                    : Number(
                                                        analisis.variacion?.variacion || 0
                                                    ) < 0
                                                        ? "positive"
                                                        : ""
                                            }
                                        >
                                            {analisis.variacion?.variacion_pct !== null &&
                                                analisis.variacion?.variacion_pct !== undefined
                                                ? `${analisis.variacion.variacion_pct >= 0
                                                    ? "+"
                                                    : ""
                                                }${Number(
                                                    analisis.variacion.variacion_pct
                                                ).toFixed(2)}%`
                                                : "Sin porcentaje"}
                                        </small>

                                    </div>


                                    <div className="card">

                                        <span>
                                            Estado de validación
                                        </span>

                                        <strong
                                            className={
                                                analisis.cierre?.estado?.codigo === "OK"
                                                    ? "positive"
                                                    : "negative"
                                            }
                                        >
                                            {analisis.cierre?.estado?.titulo ||
                                                "Sin validar"}
                                        </strong>

                                        <small>
                                            {
                                                (
                                                    analisis.cierre?.motivos || []
                                                ).filter(
                                                    (motivo) =>
                                                        motivo.regla_id === "REGLA-LVTA-001" &&
                                                        motivo.nivel === "MEDIO"
                                                ).length
                                            }{" "}
                                            {
                                                (
                                                    (
                                                        analisis.cierre?.motivos || []
                                                    ).filter(
                                                        (motivo) =>
                                                            motivo.regla_id === "REGLA-LVTA-001" &&
                                                            motivo.nivel === "MEDIO"
                                                    ).length
                                                ) === 1
                                                    ? "observación"
                                                    : "observaciones"
                                            }
                                            {" · "}
                                            {
                                                analisis.cierre?.resumen?.reglas_revisar ?? 0
                                            }{" "}
                                            {
                                                (
                                                    analisis.cierre?.resumen?.reglas_revisar ?? 0
                                                ) === 1
                                                    ? "bloqueo"
                                                    : "bloqueos"
                                            }
                                        </small>

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* ¿QUÉ ESTÁ PASANDO? */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                ¿Qué está pasando?
                                            </h2>

                                            <p>
                                                Principales movimientos de la liquidación
                                                frente al periodo anterior.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="table-container">

                                        <table>

                                            <thead>

                                                <tr>

                                                    <th>
                                                        Proceso
                                                    </th>

                                                    <th>
                                                        Periodo anterior
                                                    </th>

                                                    <th>
                                                        Periodo actual
                                                    </th>

                                                    <th>
                                                        Variación
                                                    </th>

                                                </tr>

                                            </thead>


                                            <tbody>

                                                {[...(analisis?.variacion?.procesos || [])]
                                                    .sort(
                                                        (a, b) =>
                                                            Math.abs(b.variacion || 0) -
                                                            Math.abs(a.variacion || 0)
                                                    )
                                                    .map((proceso) => (

                                                        <tr
                                                            key={proceso.proceso}
                                                        >

                                                            <td>

                                                                <strong>
                                                                    {proceso.proceso}
                                                                </strong>

                                                            </td>


                                                            <td>

                                                                S/{" "}
                                                                {Number(
                                                                    proceso.anterior || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}

                                                            </td>


                                                            <td>

                                                                S/{" "}
                                                                {Number(
                                                                    proceso.actual || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}

                                                            </td>


                                                            <td>

                                                                <span
                                                                    className={
                                                                        Number(
                                                                            proceso.variacion || 0
                                                                        ) >= 0
                                                                            ? "positive"
                                                                            : "negative"
                                                                    }
                                                                >

                                                                    {Number(
                                                                        proceso.variacion || 0
                                                                    ) >= 0
                                                                        ? "+"
                                                                        : "-"
                                                                    }

                                                                    S/{" "}

                                                                    {Math.abs(
                                                                        Number(
                                                                            proceso.variacion || 0
                                                                        )
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2
                                                                        }
                                                                    )}

                                                                </span>

                                                            </td>

                                                        </tr>

                                                    )
                                                    )}

                                            </tbody>

                                        </table>

                                    </div>

                                    <div className="comparison-chart">

                                        <div className="comparison-chart-header">

                                            <span>
                                                Comparación visual
                                            </span>

                                            <small>
                                                Periodo anterior vs periodo actual
                                            </small>

                                        </div>

                                        {analisis.variacion?.procesos?.map(
                                            (proceso) => {

                                                const anterior =
                                                    Number(
                                                        proceso.anterior || 0
                                                    );

                                                const actual =
                                                    Number(
                                                        proceso.actual || 0
                                                    );

                                                const maximo =
                                                    Math.max(
                                                        Math.abs(anterior),
                                                        Math.abs(actual),
                                                        1
                                                    );

                                                const anchoAnterior =
                                                    (
                                                        Math.abs(anterior) /
                                                        maximo
                                                    ) * 100;

                                                const anchoActual =
                                                    (
                                                        Math.abs(actual) /
                                                        maximo
                                                    ) * 100;

                                                return (
                                                    <div
                                                        className="comparison-chart-row"
                                                        key={`chart-${proceso.proceso}`}
                                                    >

                                                        <div className="comparison-chart-process">
                                                            <strong>
                                                                {proceso.proceso}
                                                            </strong>
                                                        </div>

                                                        <div className="comparison-chart-bars">

                                                            <div className="comparison-bar-line">

                                                                <span className="comparison-bar-label">
                                                                    Anterior
                                                                </span>

                                                                <div className="comparison-bar-track">

                                                                    <div
                                                                        className="comparison-bar previous"
                                                                        style={{
                                                                            width: `${anchoAnterior}%`
                                                                        }}
                                                                    />

                                                                </div>

                                                                <span className="comparison-bar-value">
                                                                    S/{" "}
                                                                    {anterior.toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </span>

                                                            </div>


                                                            <div className="comparison-bar-line">

                                                                <span className="comparison-bar-label">
                                                                    Actual
                                                                </span>

                                                                <div className="comparison-bar-track">

                                                                    <div
                                                                        className={
                                                                            `comparison-bar ${actual >= anterior
                                                                                ? "current-positive"
                                                                                : "current-negative"
                                                                            }`
                                                                        }
                                                                        style={{
                                                                            width: `${anchoActual}%`
                                                                        }}
                                                                    />

                                                                </div>

                                                                <span className="comparison-bar-value">
                                                                    S/{" "}
                                                                    {actual.toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </span>

                                                            </div>

                                                        </div>

                                                    </div>
                                                );
                                            }
                                        )}

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* PRINCIPALES MOVIMIENTOS */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                Principales movimientos
                                            </h2>

                                            <p>
                                                Conceptos que explican la variación
                                                observada en la liquidación.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="factor-section">

                                        {detalle.length > 0 ? (

                                            detalle.map(
                                                (movimiento, index) => (

                                                    <div
                                                        className="factor"
                                                        key={`${movimiento.proceso}-${movimiento.concepto}-${index}`}
                                                    >

                                                        <div>

                                                            <div className="factor-title">

                                                                <strong>
                                                                    {movimiento.proceso}
                                                                </strong>

                                                            </div>

                                                            <small>
                                                                {movimiento.concepto}
                                                            </small>

                                                            {movimiento.valorizacion && (

                                                                <small>
                                                                    {movimiento.valorizacion}
                                                                </small>

                                                            )}

                                                        </div>


                                                        <div className="factor-right">

                                                            <strong
                                                                className={
                                                                    Number(
                                                                        movimiento.variacion || 0
                                                                    ) >= 0
                                                                        ? "factor-positive"
                                                                        : "factor-negative"
                                                                }
                                                            >

                                                                {Number(
                                                                    movimiento.variacion || 0
                                                                ) >= 0
                                                                    ? "+"
                                                                    : "-"}

                                                                S/{" "}

                                                                {Math.abs(
                                                                    Number(
                                                                        movimiento.variacion || 0
                                                                    )
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}

                                                            </strong>

                                                        </div>

                                                    </div>

                                                )
                                            )

                                        ) : (

                                            <div className="message">
                                                No se encontraron movimientos
                                                relevantes para este periodo.
                                            </div>

                                        )}

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* ¿QUÉ EXPLICA EL CAMBIO? */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                ¿Qué explica el cambio?
                                            </h2>

                                            <p>
                                                Factores relacionados con la variación observada
                                                en la liquidación.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="message">

                                        <p>
                                            El principal movimiento asociado a la variación de la
                                            liquidación es{" "}
                                            <strong>
                                                {analisis.impulsores
                                                    ?.principal_incremento
                                                    ?.proceso ||
                                                    "Sin incremento"}
                                            </strong>
                                            , con un incremento de{" "}
                                            <strong>
                                                +S/{" "}
                                                {analisis.impulsores
                                                    ?.principal_incremento
                                                    ? Math.abs(
                                                        Number(
                                                            analisis.impulsores
                                                                .principal_incremento
                                                                .variacion || 0
                                                        )
                                                    ).toLocaleString(
                                                        "es-PE",
                                                        {
                                                            minimumFractionDigits: 2
                                                        }
                                                    )
                                                    : "0.00"}
                                            </strong>
                                            {" "}frente al periodo anterior.
                                        </p>


                                        <p>

                                            Este movimiento concentra aproximadamente{" "}

                                            <strong>
                                                {(
                                                    analisis.variacion?.variacion !== undefined &&
                                                        analisis.impulsores?.principal_incremento
                                                            ?.variacion !== undefined
                                                        ? (
                                                            Math.abs(
                                                                Number(
                                                                    analisis.impulsores
                                                                        .principal_incremento
                                                                        .variacion
                                                                )
                                                            ) /
                                                            Math.abs(
                                                                Number(
                                                                    analisis.variacion?.variacion
                                                                )
                                                            )
                                                        ) * 100
                                                        : 0
                                                ).toFixed(2)}
                                                %
                                            </strong>

                                            {" "}de la variación total y permite orientar la
                                            revisión hacia el proceso identificado.

                                        </p>

                                        <p>

                                            <strong>
                                                Nota:
                                            </strong>{" "}
                                            Los movimientos identificados representan factores
                                            relacionados con la variación observada y no
                                            constituyen por sí solos una causalidad física
                                            confirmada.

                                        </p>

                                    </div>

                                    <div className="historical-chart">

                                        <div className="historical-chart-header">

                                            <div>
                                                <span>
                                                    📈 Comportamiento histórico
                                                </span>

                                                <small>
                                                    Últimos 6 períodos
                                                </small>
                                            </div>

                                        </div>

                                        <div className="historical-chart-body">

                                            {historicoEmpresa.map(
                                                (periodo) => {

                                                    const monto =
                                                        Number(
                                                            periodo.monto || 0
                                                        );

                                                    const maximo =
                                                        Math.max(
                                                            ...historicoEmpresa.map(
                                                                (item) =>
                                                                    Math.abs(
                                                                        Number(
                                                                            item.monto || 0
                                                                        )
                                                                    )
                                                            ),
                                                            1
                                                        );

                                                    const altura =
                                                        (
                                                            Math.abs(monto) /
                                                            maximo
                                                        ) * 100;

                                                    return (
                                                        <div
                                                            className="historical-column"
                                                            key={periodo.pericodi}
                                                        >

                                                            <div className="historical-value">
                                                                S/{" "}
                                                                {monto.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        maximumFractionDigits: 0
                                                                    }
                                                                )}
                                                            </div>

                                                            <div className="historical-bar-container">

                                                                <div
                                                                    className="historical-bar"
                                                                    style={{
                                                                        height: `${altura}%`
                                                                    }}
                                                                />

                                                            </div>

                                                            <div className="historical-label">
                                                                {periodo.perinombre
                                                                    ?.replace(
                                                                        "2026.",
                                                                        ""
                                                                    )}
                                                            </div>

                                                        </div>
                                                    );
                                                }
                                            )}

                                        </div>

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* CONTEXTO FÍSICO Y OPERATIVO */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                Contexto físico y operativo
                                            </h2>

                                            <p>
                                                Comportamiento físico observado durante el periodo.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="cards detail-cards">

                                        <div className="card">

                                            <span>
                                                Entregas
                                            </span>

                                            <strong>
                                                {Number(
                                                    contextoAgente?.energia?.entregas?.actual || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                        </div>


                                        <div className="card">

                                            <span>
                                                Retiros
                                            </span>

                                            <strong>
                                                {Number(
                                                    contextoAgente?.energia?.retiros?.actual || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                        </div>


                                        <div className="card">

                                            <span>
                                                Variación entregas
                                            </span>

                                            <strong
                                                className={
                                                    Number(
                                                        contextoAgente?.energia?.entregas?.variacion || 0
                                                    ) >= 0
                                                        ? "positive"
                                                        : "negative"
                                                }
                                            >
                                                {Number(
                                                    contextoAgente?.energia?.entregas?.variacion || 0
                                                ) >= 0
                                                    ? "↑"
                                                    : "↓"}
                                                {" "}
                                                {Math.abs(
                                                    Number(
                                                        contextoAgente?.energia?.entregas?.variacion || 0
                                                    )
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                        </div>


                                        <div className="card">

                                            <span>
                                                CM promedio
                                            </span>

                                            <strong>
                                                {Number(
                                                    contextoAgente?.mercado?.promedio?.actual || 0
                                                ).toFixed(4)}
                                            </strong>

                                        </div>


                                        <div className="card">

                                            <span>
                                                Variación CM
                                            </span>

                                            <strong
                                                className={
                                                    Number(
                                                        contextoAgente?.mercado?.promedio?.variacion_pct || 0
                                                    ) >= 0
                                                        ? "positive"
                                                        : "negative"
                                                }
                                            >
                                                {Number(
                                                    contextoAgente?.mercado?.promedio?.variacion_pct || 0
                                                ) >= 0
                                                    ? "↑"
                                                    : "↓"}
                                                {" "}
                                                {Math.abs(
                                                    Number(
                                                        contextoAgente?.mercado?.promedio?.variacion_pct || 0
                                                    )
                                                ).toFixed(2)}
                                                %
                                            </strong>

                                        </div>

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* INTEGRIDAD */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                Validación
                                            </h2>

                                            <p>
                                                Estado de las reglas de integridad
                                                aplicadas a la empresa.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="table-container">

                                        <table>

                                            <thead>

                                                <tr>

                                                    <th>
                                                        Reglaaaa
                                                    </th>

                                                    <th>
                                                        Categoría
                                                    </th>

                                                    <th>
                                                        Estado
                                                    </th>

                                                    <th>
                                                        Diferencia
                                                    </th>

                                                </tr>

                                            </thead>


                                            <tbody>

                                                {[
                                                    {
                                                        regla_id: "REGLA-LVTA-001",
                                                        categoria: "Energía Activa"
                                                    },
                                                    {
                                                        regla_id: "REGLA-LSCIO-001",
                                                        categoria: "LSCIO"
                                                    },
                                                    {
                                                        regla_id: "REGLA-POTENCIA-001",
                                                        categoria: "Potencia"
                                                    }
                                                ].map((regla) => {

                                                    const motivo = (analisis.cierre?.motivos || []).find(
                                                        (item) => item.regla_id === regla.regla_id
                                                    );

                                                    return (
                                                        <tr key={regla.regla_id}>

                                                            <td>
                                                                <strong>
                                                                    {regla.regla_id}
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {regla.categoria}
                                                            </td>

                                                            <td>

                                                                <span
                                                                    className={
                                                                        motivo
                                                                            ? "negative"
                                                                            : "positive"
                                                                    }
                                                                >
                                                                    {motivo
                                                                        ? "🟡 OBSERVACIÓN"
                                                                        : "🟢 OK"}
                                                                </span>

                                                            </td>

                                                            <td>

                                                                {motivo?.diferencia || "—"}

                                                            </td>

                                                        </tr>
                                                    );
                                                })}

                                            </tbody>

                                        </table>

                                    </div>

                                    {/* ===================================================== */}
                                    {/* DETALLE DE OBSERVACIONES */}
                                    {/* ===================================================== */}

                                    {(analisis.cierre?.motivos || []).map((motivo) => (

                                        <div
                                            key={`detalle-${motivo.regla_id}`}
                                            className="message"
                                        >

                                            <strong>
                                                {motivo.titulo}
                                            </strong>

                                            <p>
                                                {motivo.mensaje}
                                            </p>

                                            <p>
                                                <strong>
                                                    Acción recomendada:
                                                </strong>{" "}
                                                {motivo.accion}
                                            </p>

                                        </div>

                                    ))}


                                    <div className="message">

                                        <strong>
                                            {analisis.cierre?.estado?.titulo ||
                                                "Estado de cierre"}
                                        </strong>

                                        <br />

                                        {analisis.cierre?.estado?.mensaje ||
                                            "No hay información adicional."}

                                    </div>

                                </section>


                                {/* ===================================================== */}
                                {/* TRAZABILIDAD */}
                                {/* ===================================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                Trazabilidad
                                            </h2>

                                            <p>
                                                Relación entre el resultado de liquidación
                                                y la información de soporte utilizada.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="cards detail-cards">

                                        <div className="card">

                                            <span>
                                                Resultado LVTA
                                            </span>

                                            <strong>
                                                S/{" "}
                                                {Number(
                                                    trazabilidadLVTA
                                                        ?.validacion
                                                        ?.periodo_actual
                                                        ?.resultado || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                            <small>
                                                Evolución de liquidaciones
                                            </small>

                                        </div>


                                        <div className="card">

                                            <span>
                                                Soporte Energía Activa
                                            </span>

                                            <strong>
                                                S/{" "}
                                                {Number(
                                                    trazabilidadLVTA
                                                        ?.validacion
                                                        ?.periodo_actual
                                                        ?.soporte || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                            <small>
                                                Intermedios / Energía Activa
                                            </small>

                                        </div>


                                        <div className="card">

                                            <span>
                                                Diferencia
                                            </span>

                                            <strong
                                                className={
                                                    Math.abs(
                                                        Number(
                                                            trazabilidadLVTA
                                                                ?.validacion
                                                                ?.periodo_actual
                                                                ?.diferencia || 0
                                                        )
                                                    ) > 0.01
                                                        ? "negative"
                                                        : "positive"
                                                }
                                            >
                                                S/{" "}
                                                {Math.abs(
                                                    Number(
                                                        trazabilidadLVTA
                                                            ?.validacion
                                                            ?.periodo_actual
                                                            ?.diferencia || 0
                                                    )
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                            <small>
                                                Tolerancia: S/ 0.01
                                            </small>

                                        </div>

                                    </div>


                                    <div className="message">

                                        <p>
                                            <strong>
                                                Resultado
                                            </strong>
                                            {" → "}
                                            Evolución de liquidaciones
                                        </p>

                                        <p>
                                            <strong>
                                                Soporte
                                            </strong>
                                            {" → "}
                                            Intermedios / Energía Activa
                                        </p>

                                        <p>
                                            <strong>
                                                Versión
                                            </strong>
                                            {" → "}
                                            {analisis.periodo?.version_vigente || "—"}
                                        </p>

                                    </div>

                                </section>


                            </>

                        )}

                    </section>

                )}


                {modoActual === "agente" && (
                    <section className="agent-mode-view">

                        {/* =========================================================
                                A1 · RESULTADO Y VARIACIÓN
                            ========================================================= */}

                        {seccionAgente === "A1" && resumenAgente && (
                            <div className="agent-section">

                                <div className="agent-section-header">

                                    <div>
                                        <div className="agent-kicker">
                                            👤 MODO AGENTE · A1 RESULTADO Y VARIACIÓN
                                        </div>

                                        <h2>{aliasDeEmpresa(empresaAgente)}</h2>

                                        <p>
                                            {resumenAgente.periodo?.perinombre}
                                            {" · "}
                                            {resumenAgente.periodo?.estado}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setModoActual(null);
                                            setSeccionAgente("SELECCION");
                                            setEmpresaAgente(null);
                                            setPericodiAgente(null);
                                            setResumenAgente(null);
                                            setExplicacionAgente(null);
                                            setContextoAgente(null);
                                        }}
                                    >
                                        Inicio
                                    </button>

                                </div>


                                {/* =====================================================
                                        RESULTADO PRINCIPAL
                                    ===================================================== */}

                                <section className="agent-result-section">

                                    <h3>¿CÓMO SALIÓ MI LIQUIDACIÓN?</h3>

                                    <div className="agent-main-result">

                                        <div className="agent-main-result-value">
                                            S/{" "}
                                            {resumenAgente.resultado?.total?.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                }
                                            )}
                                        </div>

                                        <div className="agent-main-result-variation">

                                            <strong
                                                className={
                                                    resumenAgente.variacion?.variacion > 0
                                                        ? "agent-variation-unfavorable"
                                                        : resumenAgente.variacion?.variacion < 0
                                                            ? "agent-variation-favorable"
                                                            : "agent-variation-neutral"
                                                }
                                            >
                                                {resumenAgente.variacion?.variacion > 0
                                                    ? "↑"
                                                    : resumenAgente.variacion?.variacion < 0
                                                        ? "↓"
                                                        : "→"}{" "}
                                                S/{" "}
                                                {Math.abs(
                                                    resumenAgente.variacion?.variacion || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>

                                            <span
                                                className={
                                                    resumenAgente.variacion?.variacion > 0
                                                        ? "agent-variation-unfavorable"
                                                        : resumenAgente.variacion?.variacion < 0
                                                            ? "agent-variation-favorable"
                                                            : "agent-variation-neutral"
                                                }
                                            >
                                                {resumenAgente.variacion?.variacion_pct >= 0
                                                    ? "+"
                                                    : ""}
                                                {resumenAgente.variacion?.variacion_pct?.toFixed(2)}
                                                %
                                            </span>

                                        </div>

                                    </div>

                                    <div className="agent-result-previous">

                                        vs.{" "}
                                        {resumenAgente.variacion?.periodo_anterior?.perinombre}
                                        {" · "}
                                        S/{" "}
                                        {resumenAgente.variacion?.anterior?.toLocaleString(
                                            "es-PE",
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            }
                                        )}

                                    </div>

                                </section>


                                {/* =====================================================
                                        RESULTADO POR PROCESO
                                    ===================================================== */}

                                <section className="agent-process-section">

                                    <h3>RESULTADO POR PROCESO</h3>

                                    <div className="agent-process-list">

                                        {resumenAgente.resultado?.procesos?.map(
                                            (proceso) => (

                                                <div
                                                    className="agent-process-row"
                                                    key={proceso.proceso}
                                                >

                                                    <div>
                                                        <strong>
                                                            {proceso.proceso}
                                                        </strong>

                                                        <span>
                                                            {proceso.proceso === "LVTA"
                                                                ? "Energía Activa"
                                                                : proceso.proceso === "LSCIO"
                                                                    ? "Servicios Complementarios"
                                                                    : "Potencia"}
                                                        </span>
                                                    </div>

                                                    <strong>
                                                        S/{" "}
                                                        {proceso.monto?.toLocaleString(
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


                                {/* =====================================================
                                        ¿QUÉ CAMBIÓ?
                                    ===================================================== */}

                                <section className="agent-variation-section">

                                    <h3>¿QUÉ CAMBIÓ?</h3>

                                    <div className="agent-variation-table">

                                        <div className="agent-variation-header">

                                            <span>PROCESO</span>
                                            <span className="agent-variation-number">
                                                {resumenAgente.variacion?.periodo_anterior?.perinombre}
                                            </span>
                                            <span className="agent-variation-number">
                                                {resumenAgente.periodo?.perinombre}
                                            </span>
                                            <span className="agent-variation-number">VARIACIÓN</span>

                                        </div>


                                        {[...(resumenAgente.variacion?.procesos || [])]
                                            .sort(
                                                (a, b) =>
                                                    Math.abs(b.variacion || 0) -
                                                    Math.abs(a.variacion || 0)
                                            )
                                            .map((proceso) => {

                                                const aumento =
                                                    proceso.variacion > 0;

                                                return (
                                                    <div
                                                        className="agent-variation-row"
                                                        key={proceso.proceso}
                                                    >

                                                        <div>
                                                            <strong>
                                                                {proceso.proceso}
                                                            </strong>

                                                            <span>
                                                                {proceso.proceso === "LVTA"
                                                                    ? "Energía Activa"
                                                                    : proceso.proceso === "LSCIO"
                                                                        ? "Servicios Complementarios"
                                                                        : "Potencia"}
                                                            </span>
                                                        </div>

                                                        <span className="agent-variation-number">
                                                            S/{" "}
                                                            {proceso.anterior?.toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </span>

                                                        <span className="agent-variation-number">
                                                            S/{" "}
                                                            {proceso.actual?.toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </span>

                                                        <strong
                                                            className={
                                                                `agent-variation-number ${aumento
                                                                    ? "variation-increase"
                                                                    : "variation-decrease"
                                                                }`
                                                            }
                                                        >
                                                            {aumento ? "↑" : "↓"}{" "}
                                                            S/{" "}
                                                            {Math.abs(
                                                                proceso.variacion || 0
                                                            ).toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}

                                                            <small>
                                                                {" "}
                                                                ({aumento ? "+" : ""}
                                                                {proceso.variacion_pct?.toFixed(2)}
                                                                %)
                                                            </small>

                                                        </strong>

                                                    </div>
                                                );
                                            }
                                            )}

                                    </div>

                                </section>


                                {/* =====================================================
                                        PRINCIPALES MOVIMIENTOS
                                    ===================================================== */}

                                <section className="agent-movements-section">

                                    <h3>PRINCIPALES MOVIMIENTOS</h3>

                                    <div className="agent-movements-grid">

                                        <div className="agent-movement-card increase">

                                            <span>Principal incremento</span>

                                            <strong>
                                                {resumenAgente.impulsores?.principal_incremento?.proceso}
                                            </strong>

                                            <p>
                                                {resumenAgente.impulsores?.principal_incremento?.valorizacion}
                                            </p>

                                            <b>
                                                + S/{" "}
                                                {Math.abs(
                                                    resumenAgente.impulsores?.principal_incremento?.variacion || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </b>

                                        </div>


                                        <div className="agent-movement-card decrease">

                                            <span>Principal reducción</span>

                                            <strong>
                                                {resumenAgente.impulsores?.principal_reduccion?.proceso}
                                            </strong>

                                            <p>
                                                {resumenAgente.impulsores?.principal_reduccion?.valorizacion}
                                            </p>

                                            <b>
                                                - S/{" "}
                                                {Math.abs(
                                                    resumenAgente.impulsores?.principal_reduccion?.variacion || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </b>

                                        </div>

                                    </div>



                                </section>


                                {/* =====================================================
                                        SIGUIENTE PASO
                                    ===================================================== */}

                                <div className="agent-back-summary">

                                    <button
                                        className="agent-next-button"
                                        onClick={entrarA3}
                                    >
                                        Ver explicación →
                                    </button>

                                </div>

                            </div>
                        )}

                        {seccionAgente === "A2" && (
                            <>
                                {/* ==========================================
                                    A2 · ¿QUÉ CAMBIÓ?
                                ========================================== */}

                                <div className="agent-header">

                                    <div>
                                        <span className="section-label">
                                            👤 MODO AGENTE · A2 ¿QUÉ CAMBIÓ?
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(resumenAgente.empresa)}
                                        </h2>

                                        <p>
                                            {resumenAgente.variacion.periodo_anterior?.perinombre}
                                            {" → "}
                                            {resumenAgente.periodo.perinombre}
                                        </p>
                                    </div>

                                    <button
                                        className="back-button"
                                        onClick={() => setSeccionAgente("A1")}
                                    >
                                        ← Resumen
                                    </button>

                                </div>


                                {/* ==========================================
                                    COMPARACIÓN PRINCIPAL
                                ========================================== */}

                                <section className="agent-comparison">

                                    <div className="comparison-period">

                                        <span>
                                            {resumenAgente.variacion.periodo_anterior?.perinombre}
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {resumenAgente.variacion.anterior.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                }
                                            )}
                                        </strong>

                                    </div>


                                    <div className="comparison-arrow">
                                        →
                                    </div>


                                    <div className="comparison-period current">

                                        <span>
                                            {resumenAgente.periodo.perinombre}
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {resumenAgente.variacion.actual.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2
                                                }
                                            )}
                                        </strong>

                                    </div>

                                </section>


                                {/* ==========================================
                                    VARIACIÓN NETA
                                ========================================== */}

                                <section className="variation-highlight">

                                    <span>
                                        Variación neta
                                    </span>

                                    <strong>
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
                                    </strong>

                                    <small>
                                        {resumenAgente.variacion.variacion_pct >= 0
                                            ? "+"
                                            : ""}
                                        {resumenAgente.variacion.variacion_pct.toFixed(2)}
                                        %
                                    </small>

                                </section>


                                {/* ==========================================
                                    CAMBIO POR PROCESO
                                ========================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <span className="section-label">
                                                DESCOMPOSICIÓN
                                            </span>

                                            <h3>
                                                ¿Dónde estuvo el cambio?
                                            </h3>

                                            <p>
                                                Comparación de cada proceso frente al periodo anterior.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="process-change-list">

                                        {resumenAgente.variacion.procesos.map(
                                            (proceso) => (

                                                <div
                                                    className="process-change-row"
                                                    key={proceso.proceso}
                                                >

                                                    <div className="process-change-name">

                                                        <strong>
                                                            {proceso.proceso}
                                                        </strong>

                                                        <span>
                                                            {proceso.proceso === "LVTA"
                                                                ? "Energía Activa"
                                                                : proceso.proceso === "LSCIO"
                                                                    ? "Servicios Complementarios"
                                                                    : proceso.proceso === "LVTP"
                                                                        ? "Potencia"
                                                                        : proceso.proceso}
                                                        </span>

                                                    </div>


                                                    <div className="process-change-values">

                                                        <span>
                                                            S/{" "}
                                                            {proceso.actual.toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </span>

                                                        <span>
                                                            {proceso.variacion >= 0
                                                                ? "+"
                                                                : "-"}
                                                            S/{" "}
                                                            {Math.abs(
                                                                proceso.variacion
                                                            ).toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </span>

                                                        <strong
                                                            className={
                                                                proceso.variacion >= 0
                                                                    ? "positive"
                                                                    : "negative"
                                                            }
                                                        >
                                                            {proceso.variacion_pct >= 0
                                                                ? "+"
                                                                : ""}
                                                            {proceso.variacion_pct.toFixed(2)}
                                                            %
                                                        </strong>

                                                    </div>

                                                </div>

                                            )
                                        )}

                                    </div>

                                </section>


                                {/* ==========================================
                                    PRINCIPALES MOVIMIENTOS
                                ========================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <span className="section-label">
                                                PRINCIPALES MOVIMIENTOS
                                            </span>

                                            <h3>
                                                ¿Qué explica la variación?
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
                                                        S/{" "}
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
                                                <p>
                                                    No identificado
                                                </p>
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

                                                        -
                                                        S/{" "}
                                                        {Math.abs(
                                                            resumenAgente.impulsores
                                                                .principal_reduccion.variacion
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}

                                                    </span>
                                                </>
                                            ) : (
                                                <p>
                                                    No identificado
                                                </p>
                                            )}

                                        </div>

                                    </div>

                                </section>


                                {/* ==========================================
                                    WATERFALL
                                ========================================== */}

                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <span className="section-label">
                                                WATERFALL DE VARIACIÓN
                                            </span>

                                            <h3>
                                                Del periodo anterior al actual
                                            </h3>

                                            <p>
                                                Cómo los movimientos de cada proceso explican
                                                el cambio neto de la liquidación.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="waterfall-placeholder">

                                        <div className="waterfall-line">

                                            <div className="waterfall-item">

                                                <span>
                                                    {resumenAgente.variacion.periodo_anterior?.perinombre}
                                                </span>

                                                <strong>
                                                    S/{" "}
                                                    {resumenAgente.variacion.anterior.toLocaleString(
                                                        "es-PE",
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        }
                                                    )}
                                                </strong>

                                            </div>


                                            {resumenAgente.variacion.procesos.map(
                                                (proceso) => (

                                                    <div
                                                        className={
                                                            proceso.variacion >= 0
                                                                ? "waterfall-item positive-item"
                                                                : "waterfall-item negative-item"
                                                        }
                                                        key={`wf-${proceso.proceso}`}
                                                    >

                                                        <span>
                                                            {proceso.proceso}
                                                        </span>

                                                        <strong>
                                                            {proceso.variacion >= 0
                                                                ? "+"
                                                                : "-"}
                                                            S/{" "}
                                                            {Math.abs(
                                                                proceso.variacion
                                                            ).toLocaleString(
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


                                            <div className="waterfall-item current-item">

                                                <span>
                                                    {resumenAgente.periodo.perinombre}
                                                </span>

                                                <strong>
                                                    S/{" "}
                                                    {resumenAgente.variacion.actual.toLocaleString(
                                                        "es-PE",
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        }
                                                    )}
                                                </strong>

                                            </div>

                                        </div>

                                    </div>

                                </section>


                                {/* ==========================================
                                    SIGUIENTE PASO
                                ========================================== */}

                                <section className="agent-next-step">

                                    <div>

                                        <span className="section-label">
                                            SIGUIENTE PASO
                                        </span>

                                        <h3>
                                            ¿Por qué cambió?
                                        </h3>

                                        <p>
                                            Profundiza en los procesos y conceptos que explican
                                            la variación de tu liquidación.
                                        </p>

                                    </div>

                                    <button
                                        onClick={entrarA3}
                                    >
                                        ¿Por qué cambió? →
                                    </button>

                                </section>

                            </>
                        )}


                        {seccionAgente === "A3" && analisis && (
                            <>

                                <div className="agent-header">

                                    <div>

                                        <span className="section-label">
                                            MODO AGENTE · A3 ¿POR QUÉ CAMBIÓ?
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(empresaAgente)}
                                        </h2>

                                        <p>
                                            {resumenAgente?.periodo?.perinombre} ·
                                            explicación de la variación
                                        </p>

                                    </div>

                                    <div className="agent-back-summary">

                                        <button
                                            className="secondary-button"
                                            onClick={() => setSeccionAgente("A1")}
                                        >
                                            ← Volver al resumen
                                        </button>

                                    </div>

                                </div>


                                {/* VARIACIÓN POR PROCESO */}

                                <div className="agent-table-card">

                                    <div className="table-section-header">

                                        <div>

                                            <span className="section-label">
                                                ¿QUÉ EXPLICA LA VARIACIÓN?
                                            </span>

                                            <h3>
                                                Procesos que movieron el resultado
                                            </h3>

                                        </div>

                                    </div>


                                    <div className="agent-table-wrapper">

                                        <table className="agent-data-table">

                                            <thead>

                                                <tr>

                                                    <th>
                                                        Proceso
                                                    </th>

                                                    <th>
                                                        Variación
                                                    </th>

                                                    <th>
                                                        %
                                                    </th>

                                                </tr>

                                            </thead>


                                            <tbody>

                                                {(
                                                    resumenAgente?.variacion?.procesos || []
                                                ).map((proceso) => {

                                                    const variacion =
                                                        Number(
                                                            proceso.variacion || 0
                                                        );

                                                    const aumento =
                                                        variacion >= 0;

                                                    return (

                                                        <tr key={proceso.proceso}>

                                                            <td>
                                                                <strong>
                                                                    {proceso.proceso}
                                                                </strong>
                                                            </td>

                                                            <td
                                                                className={
                                                                    aumento
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                {aumento ? "🟢 ↑" : "🔴 ↓"}{" "}
                                                                S/{" "}
                                                                {Math.abs(
                                                                    variacion
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                            <td
                                                                className={
                                                                    aumento
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                {aumento ? "+" : ""}
                                                                {Number(
                                                                    proceso.variacion_pct || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                                %
                                                            </td>

                                                        </tr>

                                                    );

                                                })}


                                                {/* TOTAL */}

                                                <tr className="table-total-row">

                                                    <td>
                                                        <strong>TOTAL</strong>
                                                    </td>

                                                    <td
                                                        className={
                                                            Number(
                                                                analisis.variacion?.variacion || 0
                                                            ) >= 0
                                                                ? "positive"
                                                                : "negative"
                                                        }
                                                    >
                                                        <strong>
                                                            {Number(
                                                                analisis.variacion?.variacion || 0
                                                            ) >= 0
                                                                ? "🟢 ↑"
                                                                : "🔴 ↓"}
                                                            {" S/ "}
                                                            {Math.abs(
                                                                Number(
                                                                    analisis.variacion?.variacion || 0
                                                                )
                                                            ).toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2
                                                                }
                                                            )}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {analisis.variacion?.variacion_pct !== null &&
                                                            analisis.variacion?.variacion_pct !== undefined
                                                            ? `${Number(
                                                                analisis.variacion.variacion_pct
                                                            ) >= 0
                                                                ? "+"
                                                                : ""
                                                            }${Number(
                                                                analisis.variacion.variacion_pct
                                                            ).toFixed(2)}%`
                                                            : "—"}
                                                    </td>

                                                </tr>

                                            </tbody>

                                        </table>

                                    </div>

                                </div>


                                {/* LSCIO */}

                                {(() => {

                                    const lscio =
                                        (
                                            resumenAgente?.variacion?.procesos || []
                                        ).find(
                                            (item) =>
                                                item.proceso === "LSCIO"
                                        );

                                    const aumento =
                                        Number(
                                            lscio?.variacion || 0
                                        ) >= 0;

                                    return (

                                        <div className="agent-table-card">

                                            <div className="table-section-header">

                                                <div>

                                                    <span className="section-label">
                                                        LSCIO · DETALLE
                                                    </span>

                                                    <h3>

                                                        {aumento
                                                            ? "🟢 ↑"
                                                            : "🔴 ↓"}{" "}
                                                        S/{" "}
                                                        {Math.abs(
                                                            Number(
                                                                lscio?.variacion || 0
                                                            )
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}

                                                    </h3>

                                                    <p className="table-section-description">
                                                        Principales movimientos del reporte intermedio.
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="agent-table-wrapper">

                                                <table className="agent-data-table">

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                Mecanismo
                                                            </th>

                                                            <th>
                                                                Periodo anterior
                                                            </th>

                                                            <th>
                                                                Periodo actual
                                                            </th>

                                                            <th>
                                                                Variación
                                                            </th>

                                                            <th>
                                                                %
                                                            </th>

                                                        </tr>

                                                    </thead>


                                                    <tbody>

                                                        {(
                                                            explicacionAgente
                                                                ?.explicaciones
                                                                ?.LSCIO
                                                                ?.mecanismos || []
                                                        ).map((mecanismo) => {

                                                            const variacion =
                                                                Number(
                                                                    mecanismo.variacion || 0
                                                                );

                                                            return (

                                                                <tr
                                                                    key={
                                                                        mecanismo.mecanismo
                                                                    }
                                                                >

                                                                    <td>

                                                                        <strong>
                                                                            {
                                                                                mecanismo.mecanismo
                                                                            }
                                                                        </strong>

                                                                    </td>

                                                                    <td>

                                                                        S/{" "}
                                                                        {Number(
                                                                            mecanismo.anterior || 0
                                                                        ).toLocaleString(
                                                                            "es-PE",
                                                                            {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            }
                                                                        )}

                                                                    </td>

                                                                    <td>

                                                                        S/{" "}
                                                                        {Number(
                                                                            mecanismo.actual || 0
                                                                        ).toLocaleString(
                                                                            "es-PE",
                                                                            {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            }
                                                                        )}

                                                                    </td>

                                                                    <td>

                                                                        {variacion >= 0
                                                                            ? "+"
                                                                            : "-"}
                                                                        S/{" "}
                                                                        {Math.abs(
                                                                            variacion
                                                                        ).toLocaleString(
                                                                            "es-PE",
                                                                            {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            }
                                                                        )}

                                                                    </td>

                                                                    <td>

                                                                        {variacion >= 0
                                                                            ? "+"
                                                                            : ""}
                                                                        {Number(
                                                                            mecanismo.variacion_pct || 0
                                                                        ).toLocaleString(
                                                                            "es-PE",
                                                                            {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            }
                                                                        )}
                                                                        %

                                                                    </td>

                                                                </tr>

                                                            );

                                                        })}

                                                    </tbody>

                                                </table>

                                            </div>

                                        </div>

                                    );

                                })()}


                                {/* LVTA */}

                                {(() => {

                                    const lvta =
                                        (
                                            resumenAgente?.variacion?.procesos || []
                                        ).find(
                                            (item) =>
                                                item.proceso === "LVTA"
                                        );

                                    const trazabilidad =
                                        explicacionAgente
                                            ?.explicaciones
                                            ?.LVTA
                                            ?.trazabilidad;

                                    return (

                                        <div className="agent-table-card">

                                            <div className="table-section-header">

                                                <div>

                                                    <span className="section-label">
                                                        LVTA · TRAZABILIDAD
                                                    </span>

                                                    <h3
                                                        className={
                                                            Number(
                                                                lvta?.variacion || 0
                                                            ) >= 0
                                                                ? "table-highlight-positive"
                                                                : "table-highlight-negative"
                                                        }
                                                    >
                                                        {Number(
                                                            lvta?.variacion || 0
                                                        ) >= 0
                                                            ? "🟢 ↑"
                                                            : "🔴 ↓"}{" "}
                                                        S/{" "}
                                                        {Math.abs(
                                                            Number(
                                                                lvta?.variacion || 0
                                                            )
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}
                                                    </h3>

                                                    <p className="table-section-description">
                                                        Resultado frente al soporte de Energía Activa.
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="agent-table-wrapper">

                                                <table className="agent-data-table">

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                Indicador
                                                            </th>

                                                            <th>
                                                                Periodo anterior
                                                            </th>

                                                            <th>
                                                                Periodo actual
                                                            </th>

                                                        </tr>

                                                    </thead>


                                                    <tbody>

                                                        <tr>

                                                            <td>
                                                                <strong>
                                                                    Resultado LVTA
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                S/{" "}
                                                                {Number(
                                                                    trazabilidad
                                                                        ?.validacion
                                                                        ?.periodo_anterior
                                                                        ?.resultado || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                            <td>
                                                                S/{" "}
                                                                {Number(
                                                                    trazabilidad
                                                                        ?.validacion
                                                                        ?.periodo_actual
                                                                        ?.resultado || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                        </tr>


                                                        <tr>

                                                            <td>
                                                                <strong>
                                                                    Soporte Energía Activa
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                S/{" "}
                                                                {Number(
                                                                    trazabilidad
                                                                        ?.validacion
                                                                        ?.periodo_anterior
                                                                        ?.soporte || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                            <td>
                                                                S/{" "}
                                                                {Number(
                                                                    trazabilidad
                                                                        ?.validacion
                                                                        ?.periodo_actual
                                                                        ?.soporte || 0
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                        </tr>


                                                        <tr>
                                                            <td>
                                                                <strong>
                                                                    Diferencia
                                                                </strong>
                                                            </td>

                                                            <td
                                                                className={
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_anterior
                                                                            ?.diferencia ?? 0
                                                                    ) >= 0
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                {Number(
                                                                    trazabilidad
                                                                        ?.validacion
                                                                        ?.periodo_anterior
                                                                        ?.diferencia ?? 0
                                                                ) >= 0
                                                                    ? "🟢 +S/ "
                                                                    : "🔴 -S/ "}

                                                                {Math.abs(
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_anterior
                                                                            ?.diferencia ?? 0
                                                                    )
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>

                                                            <td
                                                                className={
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_actual
                                                                            ?.diferencia ?? 0
                                                                    ) >= 0
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                {Math.abs(
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_actual
                                                                            ?.diferencia ?? 0
                                                                    )
                                                                ) < 0.005
                                                                    ? "🟢 +S/ "
                                                                    : Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_actual
                                                                            ?.diferencia ?? 0
                                                                    ) >= 0
                                                                        ? "🟢 +S/ "
                                                                        : "🔴 -S/ "}

                                                                {Math.abs(
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_actual
                                                                            ?.diferencia ?? 0
                                                                    )
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}
                                                            </td>
                                                        </tr>

                                                    </tbody>

                                                </table>

                                            </div>


                                            {Math.abs(
                                                Number(
                                                    trazabilidad
                                                        ?.validacion
                                                        ?.periodo_actual
                                                        ?.diferencia || 0
                                                )
                                            ) < 0.005 ? (

                                                <div className="traceability-inline-alert traceability-ok">

                                                    <span>
                                                        🟢
                                                    </span>

                                                    <div>

                                                        <strong>
                                                            Trazabilidad conforme
                                                        </strong>

                                                        <p>

                                                            Para{" "}
                                                            {resumenAgente?.periodo?.perinombre},
                                                            el resultado LVTA coincide con el soporte de
                                                            Energía Activa. Diferencia de{" "}

                                                            <strong>
                                                                S/ 0.00
                                                            </strong>.

                                                        </p>

                                                        <small>

                                                            Fuente:{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.dataset_origen}

                                                            {" "}· Versión{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.periodo_actual
                                                                ?.version}

                                                            {" "}·{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.periodo_actual
                                                                ?.recanombre}

                                                        </small>

                                                    </div>

                                                </div>

                                            ) : (

                                                <div className="traceability-inline-alert">

                                                    <span>
                                                        ⚠️
                                                    </span>

                                                    <div>

                                                        <strong>
                                                            Trazabilidad requiere revisión
                                                        </strong>

                                                        <p>

                                                            Para{" "}
                                                            {resumenAgente?.periodo?.perinombre},
                                                            el resultado LVTA presenta una
                                                            diferencia de{" "}

                                                            <strong>

                                                                S/{" "}
                                                                {Math.abs(
                                                                    Number(
                                                                        trazabilidad
                                                                            ?.validacion
                                                                            ?.periodo_actual
                                                                            ?.diferencia || 0
                                                                    )
                                                                ).toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2
                                                                    }
                                                                )}

                                                            </strong>

                                                            {" "}respecto al soporte de
                                                            Energía Activa.

                                                        </p>

                                                        <small>

                                                            Fuente:{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.dataset_origen}

                                                            {" "}· Versión{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.periodo_actual
                                                                ?.version}

                                                            {" "}·{" "}
                                                            {trazabilidad
                                                                ?.evidencia
                                                                ?.periodo_actual
                                                                ?.recanombre}

                                                        </small>

                                                    </div>

                                                </div>

                                            )}

                                        </div>

                                    );

                                })()}


                                {/* LVTP */}

                                {(() => {

                                    const lvtp =
                                        (
                                            resumenAgente?.variacion?.procesos || []
                                        ).find(
                                            (item) =>
                                                item.proceso === "LVTP"
                                        );

                                    const movimientosLVTP =
                                        (
                                            resumenAgente
                                                ?.impulsores
                                                ?.movimientos || []
                                        ).filter(
                                            (movimiento) =>
                                                movimiento.proceso === "LVTP"
                                        );


                                    const totalLVTP =
                                        Number(
                                            lvtp?.variacion || 0
                                        );

                                    const sumaMovimientosLVTP =
                                        movimientosLVTP.reduce(
                                            (total, movimiento) =>
                                                total +
                                                Number(
                                                    movimiento.variacion || 0
                                                ),
                                            0
                                        );

                                    const otrosLVTP =
                                        totalLVTP -
                                        sumaMovimientosLVTP;


                                    return (

                                        <div className="agent-table-card">

                                            <div className="table-section-header">

                                                <div>

                                                    <span className="section-label">
                                                        LVTP · DETALLE
                                                    </span>

                                                    <h3
                                                        className={
                                                            totalLVTP >= 0
                                                                ? "table-highlight-positive"
                                                                : "table-highlight-negative"
                                                        }
                                                    >

                                                        {totalLVTP >= 0
                                                            ? "🟢 ↑"
                                                            : "🔴 ↓"}{" "}
                                                        S/{" "}
                                                        {Math.abs(
                                                            totalLVTP
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}

                                                    </h3>

                                                    <p className="table-section-description">
                                                        Principales conceptos que explican la variación.
                                                    </p>

                                                </div>

                                            </div>


                                            <div className="agent-table-wrapper">

                                                <table className="agent-data-table">

                                                    <thead>

                                                        <tr>

                                                            <th>
                                                                Concepto
                                                            </th>

                                                            <th>
                                                                Periodo anterior
                                                            </th>

                                                            <th>
                                                                Periodo actual
                                                            </th>

                                                            <th>
                                                                Variación
                                                            </th>

                                                            <th>
                                                                %
                                                            </th>

                                                        </tr>

                                                    </thead>


                                                    <tbody>

                                                        {movimientosLVTP.map(
                                                            (movimiento) => {

                                                                const variacion =
                                                                    Number(
                                                                        movimiento.variacion || 0
                                                                    );

                                                                return (

                                                                    <tr
                                                                        key={
                                                                            movimiento.concepto
                                                                        }
                                                                    >

                                                                        <td>

                                                                            <strong>
                                                                                {
                                                                                    movimiento.concepto
                                                                                }
                                                                            </strong>

                                                                        </td>

                                                                        <td>

                                                                            S/{" "}
                                                                            {Number(
                                                                                movimiento.anterior || 0
                                                                            ).toLocaleString(
                                                                                "es-PE",
                                                                                {
                                                                                    minimumFractionDigits: 2,
                                                                                    maximumFractionDigits: 2
                                                                                }
                                                                            )}

                                                                        </td>

                                                                        <td>

                                                                            S/{" "}
                                                                            {Number(
                                                                                movimiento.actual || 0
                                                                            ).toLocaleString(
                                                                                "es-PE",
                                                                                {
                                                                                    minimumFractionDigits: 2,
                                                                                    maximumFractionDigits: 2
                                                                                }
                                                                            )}

                                                                        </td>

                                                                        <td
                                                                            className={
                                                                                variacion >= 0
                                                                                    ? "table-positive"
                                                                                    : "table-negative"
                                                                            }
                                                                        >

                                                                            {variacion >= 0
                                                                                ? "🟢 ↑"
                                                                                : "🔴 ↓"}{" "}
                                                                            S/{" "}
                                                                            {Math.abs(
                                                                                variacion
                                                                            ).toLocaleString(
                                                                                "es-PE",
                                                                                {
                                                                                    minimumFractionDigits: 2,
                                                                                    maximumFractionDigits: 2
                                                                                }
                                                                            )}

                                                                        </td>

                                                                        <td
                                                                            className={
                                                                                variacion >= 0
                                                                                    ? "table-positive"
                                                                                    : "table-negative"
                                                                            }
                                                                        >

                                                                            {variacion >= 0
                                                                                ? "+"
                                                                                : ""}

                                                                            {Number(
                                                                                movimiento.variacion_pct || 0
                                                                            ).toLocaleString(
                                                                                "es-PE",
                                                                                {
                                                                                    minimumFractionDigits: 2,
                                                                                    maximumFractionDigits: 2
                                                                                }
                                                                            )}

                                                                            %

                                                                        </td>

                                                                    </tr>

                                                                );

                                                            }
                                                        )}


                                                        {/* OTROS */}

                                                        {Math.abs(otrosLVTP) > 0.005 && (

                                                            <tr>

                                                                <td>

                                                                    <strong>
                                                                        Otros conceptos
                                                                    </strong>

                                                                </td>

                                                                <td>
                                                                    S/{" "}
                                                                    {(
                                                                        Number(lvtp?.anterior || 0) -
                                                                        movimientosLVTP.reduce(
                                                                            (total, movimiento) =>
                                                                                total +
                                                                                Number(movimiento.anterior || 0),
                                                                            0
                                                                        )
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </td>

                                                                <td>
                                                                    S/{" "}
                                                                    {(
                                                                        Number(lvtp?.actual || 0) -
                                                                        movimientosLVTP.reduce(
                                                                            (total, movimiento) =>
                                                                                total +
                                                                                Number(movimiento.actual || 0),
                                                                            0
                                                                        )
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </td>

                                                                <td
                                                                    className={
                                                                        otrosLVTP >= 0
                                                                            ? "table-positive"
                                                                            : "table-negative"
                                                                    }
                                                                >

                                                                    {otrosLVTP >= 0
                                                                        ? "🟢 ↑"
                                                                        : "🔴 ↓"}{" "}
                                                                    S/{" "}
                                                                    {Math.abs(
                                                                        otrosLVTP
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}

                                                                </td>

                                                                <td
                                                                    className={
                                                                        otrosLVTP >= 0
                                                                            ? "table-positive"
                                                                            : "table-negative"
                                                                    }
                                                                >
                                                                    {otrosLVTP !== 0
                                                                        ? (
                                                                            (
                                                                                otrosLVTP /
                                                                                Math.abs(
                                                                                    Number(lvtp?.anterior || 0) -
                                                                                    movimientosLVTP.reduce(
                                                                                        (total, movimiento) =>
                                                                                            total +
                                                                                            Number(movimiento.anterior || 0),
                                                                                        0
                                                                                    )
                                                                                )
                                                                            ) * 100
                                                                        ).toLocaleString(
                                                                            "es-PE",
                                                                            {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            }
                                                                        )
                                                                        : "0.00"
                                                                    }%
                                                                </td>

                                                            </tr>

                                                        )}


                                                        {/* TOTAL */}

                                                        <tr className="table-total-row">

                                                            <td>
                                                                <strong>
                                                                    TOTAL LVTP
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    S/{" "}
                                                                    {Number(
                                                                        lvtp?.anterior || 0
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    S/{" "}
                                                                    {Number(
                                                                        lvtp?.actual || 0
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </strong>
                                                            </td>

                                                            <td
                                                                className={
                                                                    totalLVTP >= 0
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                <strong>
                                                                    {totalLVTP >= 0
                                                                        ? "🟢 ↑"
                                                                        : "🔴 ↓"}{" "}
                                                                    S/{" "}
                                                                    {Math.abs(
                                                                        totalLVTP
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </strong>
                                                            </td>

                                                            <td
                                                                className={
                                                                    totalLVTP >= 0
                                                                        ? "table-positive"
                                                                        : "table-negative"
                                                                }
                                                            >
                                                                <strong>
                                                                    {totalLVTP > 0
                                                                        ? "+"
                                                                        : ""}
                                                                    {Number(
                                                                        lvtp?.variacion_pct || 0
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                    %
                                                                </strong>
                                                            </td>

                                                        </tr>

                                                    </tbody>

                                                </table>

                                            </div>

                                        </div>

                                    );

                                })()}


                                {/* CONTEXTO */}

                                <div className="agent-back-summary">

                                    <button
                                        className="primary-button"
                                        onClick={async () => {
                                            setSeccionAgente("A4");
                                            await cargarContextoAgente();
                                        }}
                                    >
                                        Ver contexto →
                                    </button>

                                </div>

                            </>
                        )}

                        {seccionAgente === "A4" && (
                            <section className="agent-section">

                                <div className="agent-header">
                                    <div>

                                        <span className="section-label">
                                            👤 MODO AGENTE · A4 VALIDACIÓN Y CIERRE
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(resumenAgente?.empresa)}
                                        </h2>

                                        <p>
                                            {resumenAgente?.periodo?.perinombre}
                                            {" · "}
                                            Validación y decisión
                                        </p>

                                    </div>

                                    <button
                                        className="secondary-button"
                                        onClick={() => setSeccionAgente("A3")}
                                    >
                                        ← ¿Por qué cambió?
                                    </button>

                                </div>


                                <div className="explanation-intro">

                                    <span className="section-label">
                                        VALIDACIÓN Y CIERRE
                                    </span>

                                    <h2>
                                        ¿Puedo cerrar esta liquidación?
                                    </h2>

                                </div>


                                {resumenAgente?.cierre && (
                                    <>

                                        {/* =========================================
                                            ESTADO
                                        ========================================== */}

                                        <div className="closure-status-compact">

                                            <span className="closure-status-icon">
                                                {resumenAgente.cierre.estado?.icono}
                                            </span>

                                            <div>

                                                <strong>
                                                    {resumenAgente.cierre.estado?.titulo}
                                                </strong>

                                                <span>
                                                    {
                                                        (
                                                            resumenAgente.cierre?.motivos || []
                                                        ).filter(
                                                            (motivo) =>
                                                                motivo.regla_id === "REGLA-LVTA-001" &&
                                                                motivo.nivel === "MEDIO"
                                                        ).length
                                                    }{" "}
                                                    {
                                                        (
                                                            (
                                                                resumenAgente.cierre?.motivos || []
                                                            ).filter(
                                                                (motivo) =>
                                                                    motivo.regla_id === "REGLA-LVTA-001" &&
                                                                    motivo.nivel === "MEDIO"
                                                            ).length
                                                        ) === 1
                                                            ? "observación"
                                                            : "observaciones"
                                                    }
                                                    {" · "}
                                                    {
                                                        resumenAgente.cierre?.resumen?.reglas_revisar ?? 0
                                                    }{" "}
                                                    {
                                                        (
                                                            resumenAgente.cierre?.resumen?.reglas_revisar ?? 0
                                                        ) === 1
                                                            ? "bloqueo"
                                                            : "bloqueos"
                                                    }
                                                </span>
                                            </div>

                                        </div>


                                        {/* =========================================
                                            VALIDACIONES
                                        ========================================== */}

                                        <div className="validation-section">

                                            <span className="section-label">
                                                VALIDACIONES
                                            </span>

                                            <h3>
                                                Reglas ejecutadas
                                            </h3>


                                            <div className="validation-table">

                                                <div className="validation-table-header">

                                                    <span>
                                                        REGLA
                                                    </span>

                                                    <span>
                                                        VALIDACIÓN
                                                    </span>

                                                    <span>
                                                        ESTADO
                                                    </span>

                                                    <span>
                                                        RESULTADO
                                                    </span>

                                                </div>


                                                {[
                                                    {
                                                        id: "REGLA-LVTA-001",
                                                        nombre: "Energía Activa"
                                                    },
                                                    {
                                                        id: "REGLA-LSCIO-001",
                                                        nombre: "Reconstrucción LSCIO"
                                                    },
                                                    {
                                                        id: "REGLA-POTENCIA-001",
                                                        nombre: "Trazabilidad Potencia"
                                                    }
                                                ].map((regla) => {

                                                    const motivo = resumenAgente.cierre?.motivos?.find(
                                                        (item) =>
                                                            item.regla_id === regla.id
                                                    );

                                                    const requiereRevision =
                                                        Boolean(motivo);

                                                    const esObservacion =
                                                        motivo?.nivel === "MEDIO" &&
                                                        regla.id === "REGLA-LVTA-001";

                                                    return (
                                                        <div
                                                            className={
                                                                requiereRevision
                                                                    ? (
                                                                        esObservacion
                                                                            ? "validation-table-row observation"
                                                                            : "validation-table-row review"
                                                                    )
                                                                    : "validation-table-row"
                                                            }
                                                            key={regla.id}
                                                        >
                                                            <span className="validation-rule">
                                                                {regla.id}
                                                            </span>

                                                            <span>
                                                                {regla.nombre}
                                                            </span>

                                                            <span>
                                                                <strong
                                                                    className={
                                                                        requiereRevision
                                                                            ? (
                                                                                esObservacion
                                                                                    ? "validation-badge observation"
                                                                                    : "validation-badge review"
                                                                            )
                                                                            : "validation-badge ok"
                                                                    }
                                                                >
                                                                    {requiereRevision
                                                                        ? (
                                                                            esObservacion
                                                                                ? "🟡 OBSERVACIÓN"
                                                                                : "🔴 REVISAR"
                                                                        )
                                                                        : "🟢 OK"}
                                                                </strong>
                                                            </span>

                                                            <span>
                                                                {requiereRevision &&
                                                                    motivo?.diferencia
                                                                    ? (
                                                                        <>
                                                                            {motivo.diferencia}
                                                                        </>
                                                                    )
                                                                    : "—"}
                                                            </span>
                                                        </div>
                                                    );
                                                })}

                                            </div>

                                        </div>


                                        {/* =========================================
                                            CONTEXTO
                                        ========================================== */}

                                        <section className="context-section">
                                            <h3>CONTEXTO RELACIONADO</h3>

                                            <div className="context-data-grid">

                                                {/* ENERGÍA */}
                                                <div className="context-data-card">
                                                    <div className="context-data-icon">⚡</div>

                                                    <div>
                                                        <strong>ENERGÍA</strong>

                                                        <div className="context-data-values">

                                                            <div>
                                                                <span>Entregas</span>
                                                                <strong>
                                                                    {contextoAgente?.energia?.entregas?.actual != null
                                                                        ? contextoAgente.energia.entregas.actual.toFixed(2)
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Retiros</span>
                                                                <strong>
                                                                    {contextoAgente?.energia?.retiros?.actual != null
                                                                        ? contextoAgente.energia.retiros.actual.toFixed(2)
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Variación entregas</span>
                                                                <strong className={
                                                                    contextoAgente?.energia?.entregas?.variacion < 0
                                                                        ? "context-negative"
                                                                        : "context-positive"
                                                                }>
                                                                    {contextoAgente?.energia?.entregas?.variacion != null
                                                                        ? `${contextoAgente.energia.entregas.variacion > 0 ? "↑" : contextoAgente.energia.entregas.variacion < 0 ? "↓" : "→"} ${Math.abs(contextoAgente.energia.entregas.variacion).toFixed(2)}`
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>


                                                {/* MERCADO */}
                                                <div className="context-data-card">
                                                    <div className="context-data-icon">📈</div>

                                                    <div>
                                                        <strong>MERCADO</strong>

                                                        <div className="context-data-values">

                                                            <div>
                                                                <span>CM promedio</span>
                                                                <strong>
                                                                    {contextoAgente?.mercado?.promedio?.actual != null
                                                                        ? contextoAgente.mercado.promedio.actual.toFixed(4)
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Variación</span>
                                                                <strong className={
                                                                    contextoAgente?.mercado?.promedio?.variacion > 0
                                                                        ? "context-positive"
                                                                        : "context-negative"
                                                                }>
                                                                    {contextoAgente?.mercado?.promedio?.variacion_pct != null
                                                                        ? `${contextoAgente.mercado.promedio.variacion_pct > 0 ? "↑" : "↓"} ${Math.abs(contextoAgente.mercado.promedio.variacion_pct).toFixed(2)}%`
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Mínimo</span>
                                                                <strong>
                                                                    {contextoAgente?.mercado?.minimo != null
                                                                        ? contextoAgente.mercado.minimo.toFixed(4)
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Máximo</span>
                                                                <strong>
                                                                    {contextoAgente?.mercado?.maximo != null
                                                                        ? contextoAgente.mercado.maximo.toFixed(4)
                                                                        : "—"}
                                                                </strong>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>


                                                {/* OPERACIÓN */}
                                                <div className="context-data-card">
                                                    <div className="context-data-icon">🏭</div>

                                                    <div>
                                                        <strong>OPERACIÓN</strong>

                                                        <div className="context-data-values">

                                                            <div>
                                                                <span>Puntos de entrega</span>
                                                                <strong>
                                                                    {contextoAgente?.operacion?.puntos_entrega ?? "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Días con entregas</span>
                                                                <strong>
                                                                    {contextoAgente?.operacion?.dias_entrega ?? "—"}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Días con retiros</span>
                                                                <strong>
                                                                    {contextoAgente?.operacion?.dias_retiro ?? "—"}
                                                                </strong>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>

                                            </div>

                                        </section>


                                        {/* =========================================
                                            TRAZABILIDAD
                                        ========================================== */}

                                        <div className="traceability-summary">

                                            <div className="traceability-summary-header">

                                                <div>

                                                    <span className="section-label">
                                                        TRAZABILIDAD
                                                    </span>

                                                    <h3>
                                                        Resultado → procesos → fuentes
                                                    </h3>

                                                </div>

                                                <span className="traceability-period">
                                                    {resumenAgente?.periodo?.perinombre}
                                                    {" · "}
                                                    {resumenAgente?.periodo?.version_vigente}
                                                </span>

                                            </div>


                                            <div className="traceability-visual">

                                                <div className="traceability-node">

                                                    <span>
                                                        LIQUIDACIÓN
                                                    </span>

                                                    <strong>
                                                        S/{" "}
                                                        {Number(
                                                            resumenAgente?.resultado?.total || 0
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            }
                                                        )}
                                                    </strong>

                                                </div>


                                                <div className="traceability-connector">
                                                    →
                                                </div>


                                                <div className="traceability-node">

                                                    <span>
                                                        PROCESOS
                                                    </span>

                                                    <div className="traceability-process-list">

                                                        {resumenAgente?.resultado?.procesos?.map(
                                                            (proceso, index) => (
                                                                <div
                                                                    key={`${proceso.proceso}-${index}`}
                                                                >

                                                                    <span>
                                                                        {proceso.proceso}
                                                                    </span>

                                                                    <strong>
                                                                        S/{" "}
                                                                        {Number(
                                                                            proceso.monto
                                                                        ).toLocaleString(
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

                                                </div>


                                                <div className="traceability-connector">
                                                    →
                                                </div>


                                                <div className="traceability-node">

                                                    <span>
                                                        FUENTES
                                                    </span>

                                                    <div className="traceability-source-list">

                                                        <span>
                                                            📊 Evolución
                                                        </span>

                                                        <span>
                                                            ⚡ Intermedios
                                                        </span>

                                                        <span>
                                                            📅 Revisión 01
                                                        </span>

                                                    </div>

                                                </div>

                                            </div>

                                        </div>


                                        {/* =========================================
                                            ACCIÓN
                                        ========================================== */}

                                        <div className="closure-action-final">

                                            <span className="closure-action-final-icon">
                                                {resumenAgente.cierre.motivos?.length > 0
                                                    ? "⚠️"
                                                    : "🟢"}
                                            </span>

                                            <div>

                                                <span className="section-label">
                                                    {resumenAgente.cierre.motivos?.length > 0
                                                        ? "ACCIÓN ANTES DEL CIERRE"
                                                        : "ESTADO DE CIERRE"}
                                                </span>

                                                {resumenAgente.cierre.motivos?.length > 0 ? (

                                                    resumenAgente.cierre.motivos.map(
                                                        (motivo, index) => (
                                                            <div
                                                                key={`${motivo.regla_id}-${index}`}
                                                            >

                                                                <strong>
                                                                    {motivo.proceso}
                                                                    {" · "}
                                                                    {motivo.titulo}
                                                                </strong>

                                                                <p>
                                                                    {motivo.accion}
                                                                </p>

                                                            </div>
                                                        )
                                                    )

                                                ) : (

                                                    <p>
                                                        No hay acciones pendientes antes del cierre.
                                                    </p>

                                                )}

                                            </div>

                                        </div>


                                        <div className="agent-back-summary">

                                            <button
                                                className="secondary-button"
                                                onClick={() => setSeccionAgente("A1")}
                                            >
                                                ← Volver al resumen
                                            </button>

                                        </div>

                                    </>
                                )}

                            </section>
                        )}


                        {seccionAgente === "A5" && (
                            <section className="agent-section">

                                <div className="agent-header">
                                    <div>
                                        <span className="section-label">
                                            👤 MODO AGENTE · A5 ¿PUEDO CONFIAR?
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(resumenAgente?.empresa)}
                                        </h2>

                                        <p>
                                            {resumenAgente?.periodo?.perinombre}
                                            {" · "}
                                            Validación de integridad
                                        </p>
                                    </div>

                                    <button
                                        className="secondary-button"
                                        onClick={() => setSeccionAgente("A4")}
                                    >
                                        ← Contexto
                                    </button>
                                </div>

                                <div className="explanation-intro">

                                    <span className="section-label">
                                        INTEGRIDAD
                                    </span>

                                    <h2>
                                        ¿Puedo confiar en el resultado?
                                    </h2>

                                    <p>
                                        Se verifican reglas de consistencia entre la liquidación
                                        y las fuentes de soporte disponibles.
                                    </p>

                                </div>

                                {resumenAgente?.integridad && (
                                    <>
                                        <div className="integrity-status-card">

                                            <div className="integrity-status-icon">
                                                {resumenAgente.integridad.estado?.nivel === "ALTO"
                                                    ? "🔴"
                                                    : resumenAgente.integridad.estado?.codigo === "OK"
                                                        ? "🟢"
                                                        : "🟡"}
                                            </div>

                                            <div>
                                                <span className="section-label">
                                                    ESTADO DE INTEGRIDAD
                                                </span>

                                                <h2>
                                                    {resumenAgente.integridad.estado?.titulo}
                                                </h2>

                                                <p>
                                                    {resumenAgente.integridad.estado?.mensaje}
                                                </p>
                                            </div>

                                        </div>

                                        <div className="integrity-metrics">

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Reglas ejecutadas
                                                </span>

                                                <strong>
                                                    {
                                                        resumenAgente.integridad.metricas
                                                            ?.reglas_ejecutadas
                                                    }
                                                </strong>

                                                <small>
                                                    Validaciones realizadas
                                                </small>
                                            </div>

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Validaciones OK
                                                </span>

                                                <strong className="integrity-ok">
                                                    {
                                                        resumenAgente.integridad.metricas
                                                            ?.reglas_ok
                                                    }
                                                </strong>

                                                <small>
                                                    Consistentes
                                                </small>
                                            </div>

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Requieren revisión
                                                </span>

                                                <strong className="integrity-review">
                                                    {
                                                        resumenAgente.integridad.metricas
                                                            ?.reglas_revisar
                                                    }
                                                </strong>

                                                <small>
                                                    Validaciones pendientes
                                                </small>
                                            </div>

                                        </div>

                                        <div className="integrity-rules">

                                            <span className="section-label">
                                                VALIDACIONES
                                            </span>

                                            <h3>
                                                ¿Qué se verificó?
                                            </h3>

                                            {resumenAgente.integridad.alertas?.map(
                                                (alerta, index) => (
                                                    <div
                                                        className="integrity-alert"
                                                        key={`${alerta.regla_id}-${index}`}
                                                    >

                                                        <div className="integrity-alert-icon">
                                                            {alerta.nivel === "ALTO"
                                                                ? "🔴"
                                                                : "🟡"}
                                                        </div>

                                                        <div className="integrity-alert-content">

                                                            <div className="integrity-alert-header">

                                                                <div>
                                                                    <span className="process-code">
                                                                        {alerta.regla_id}
                                                                    </span>

                                                                    <h4>
                                                                        {alerta.categoria}
                                                                    </h4>
                                                                </div>

                                                                <span className="integrity-level">
                                                                    {alerta.nivel}
                                                                </span>

                                                            </div>

                                                            <p>
                                                                Se identificó una diferencia
                                                                de{" "}
                                                                <strong>
                                                                    S/{" "}
                                                                    {Math.abs(
                                                                        Number(
                                                                            alerta.diferencia || 0
                                                                        )
                                                                    ).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
                                                                            maximumFractionDigits: 2
                                                                        }
                                                                    )}
                                                                </strong>
                                                                {" "}en la validación.
                                                            </p>

                                                        </div>

                                                    </div>
                                                )
                                            )}

                                            {resumenAgente.integridad.metricas
                                                ?.reglas_revisar === 0 && (
                                                    <div className="integrity-ok-card">

                                                        <span>
                                                            🟢
                                                        </span>

                                                        <div>
                                                            <strong>
                                                                No se identificaron discrepancias.
                                                            </strong>

                                                            <p>
                                                                Las validaciones ejecutadas son
                                                                consistentes con las fuentes de soporte.
                                                            </p>
                                                        </div>

                                                    </div>
                                                )}

                                        </div>

                                    </>
                                )}

                                <div className="integrity-note">

                                    <span>
                                        ℹ️
                                    </span>

                                    <div>
                                        <strong>
                                            ¿Qué significa esta validación?
                                        </strong>

                                        <p>
                                            Una validación de integridad permite comprobar la
                                            consistencia entre diferentes niveles de información.
                                            Una revisión pendiente no significa necesariamente
                                            que exista un error en la liquidación: indica que
                                            debe revisarse la trazabilidad correspondiente.
                                        </p>
                                    </div>

                                </div>

                                <div className="agent-next-step">

                                    <div>

                                        <span className="section-label">
                                            SIGUIENTE PASO
                                        </span>

                                        <h3>
                                            ¿De dónde proviene el resultado?
                                        </h3>

                                        <p>
                                            Consulta las fuentes y relaciones utilizadas para
                                            construir la liquidación.
                                        </p>

                                    </div>

                                    <button
                                        className="analyze-button"
                                        onClick={() => setSeccionAgente("A6")}
                                    >
                                        Ver trazabilidad →
                                    </button>

                                </div>

                            </section>
                        )}

                        {seccionAgente === "A6" && (
                            <section className="agent-section">

                                <div className="agent-header">
                                    <div>
                                        <span className="section-label">
                                            👤 MODO AGENTE · A6 TRAZABILIDAD
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(resumenAgente?.empresa)}
                                        </h2>

                                        <p>
                                            {resumenAgente?.periodo?.perinombre}
                                            {" · "}
                                            Fuentes y relaciones del resultado
                                        </p>
                                    </div>

                                    <button
                                        className="secondary-button"
                                        onClick={() => setSeccionAgente("A5")}
                                    >
                                        ← Integridad
                                    </button>
                                </div>

                                <div className="explanation-intro">

                                    <span className="section-label">
                                        TRAZABILIDAD
                                    </span>

                                    <h2>
                                        ¿De dónde proviene el resultado?
                                    </h2>

                                    <p>
                                        Consulta cómo se relaciona el resultado de la liquidación
                                        con sus fuentes de soporte.
                                    </p>

                                </div>

                                <div className="traceability-flow">

                                    <div className="traceability-step">
                                        <span className="traceability-number">
                                            1
                                        </span>

                                        <div>
                                            <span className="section-label">
                                                LIQUIDACIÓN
                                            </span>

                                            <h3>
                                                Resultado del periodo
                                            </h3>

                                            <strong>
                                                S/{" "}
                                                {Number(
                                                    resumenAgente?.resultado?.total || 0
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    }
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="traceability-arrow">
                                        ↓
                                    </div>

                                    <div className="traceability-step">
                                        <span className="traceability-number">
                                            2
                                        </span>

                                        <div>
                                            <span className="section-label">
                                                PROCESOS
                                            </span>

                                            <h3>
                                                Componentes de la liquidación
                                            </h3>

                                            <div className="traceability-processes">

                                                {resumenAgente?.resultado?.procesos?.map(
                                                    (proceso, index) => (
                                                        <div
                                                            className="traceability-process"
                                                            key={`${proceso.proceso}-${index}`}
                                                        >
                                                            <span>
                                                                {proceso.proceso}
                                                            </span>

                                                            <strong>
                                                                S/{" "}
                                                                {Number(
                                                                    proceso.monto
                                                                ).toLocaleString(
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
                                        </div>
                                    </div>

                                    <div className="traceability-arrow">
                                        ↓
                                    </div>

                                    <div className="traceability-step">
                                        <span className="traceability-number">
                                            3
                                        </span>

                                        <div>
                                            <span className="section-label">
                                                FUENTES DE SOPORTE
                                            </span>

                                            <h3>
                                                Información utilizada para validar
                                            </h3>

                                            <div className="source-list">

                                                <div className="source-item">

                                                    <span className="source-icon">
                                                        📊
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            Evolución de liquidaciones
                                                        </strong>

                                                        <span>
                                                            Resultado mensual por proceso,
                                                            valorización y concepto.
                                                        </span>
                                                    </div>

                                                </div>

                                                <div className="source-item">

                                                    <span className="source-icon">
                                                        ⚡
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            Reportes intermedios
                                                        </strong>

                                                        <span>
                                                            Soporte utilizado para contrastar
                                                            los resultados de los procesos.
                                                        </span>
                                                    </div>

                                                </div>

                                                <div className="source-item">

                                                    <span className="source-icon">
                                                        📅
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            Periodo y versión
                                                        </strong>

                                                        <span>
                                                            {resumenAgente?.periodo?.perinombre}
                                                            {" · "}
                                                            {
                                                                resumenAgente?.periodo
                                                                    ?.version_vigente
                                                            }
                                                        </span>
                                                    </div>

                                                </div>

                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <div className="traceability-alert">

                                    <span>
                                        ℹ️
                                    </span>

                                    <div>
                                        <strong>
                                            La trazabilidad permite reconstruir el resultado
                                        </strong>

                                        <p>
                                            Cada nivel permite avanzar desde el resultado de la
                                            liquidación hacia los procesos y las fuentes que
                                            sustentan su análisis.
                                        </p>
                                    </div>

                                </div>

                                <div className="agent-next-step">

                                    <div>

                                        <span className="section-label">
                                            SIGUIENTE PASO
                                        </span>

                                        <h3>
                                            ¿Qué debo hacer antes del cierre?
                                        </h3>

                                        <p>
                                            Revisa las señales encontradas y prioriza las acciones
                                            necesarias para completar tu revisión.
                                        </p>

                                    </div>

                                    <button
                                        className="analyze-button"
                                        onClick={() => setSeccionAgente("A7")}
                                    >
                                        Ver acciones de cierre →
                                    </button>

                                </div>

                            </section>
                        )}

                        {seccionAgente === "A7" && (
                            <section className="agent-section">

                                <div className="agent-header">
                                    <div>
                                        <span className="section-label">
                                            👤 MODO AGENTE · A7 CIERRE
                                        </span>

                                        <h2>
                                            {aliasDeEmpresa(resumenAgente?.empresa)}
                                        </h2>

                                        <p>
                                            {resumenAgente?.periodo?.perinombre}
                                            {" · "}
                                            Decisión de cierre
                                        </p>
                                    </div>

                                    <button
                                        className="secondary-button"
                                        onClick={() => setSeccionAgente("A6")}
                                    >
                                        ← Trazabilidad
                                    </button>
                                </div>

                                <div className="explanation-intro">

                                    <span className="section-label">
                                        CIERRE
                                    </span>

                                    <h2>
                                        ¿Qué debo hacer antes del cierre?
                                    </h2>

                                    <p>
                                        Revisa las señales identificadas y completa las acciones
                                        necesarias antes de considerar validada la liquidación.
                                    </p>

                                </div>

                                {resumenAgente?.cierre && (
                                    <>
                                        <div
                                            className={
                                                resumenAgente.cierre.estado?.nivel === "ALTO"
                                                    ? "closure-decision high"
                                                    : resumenAgente.cierre.estado?.codigo === "OK"
                                                        ? "closure-decision ok"
                                                        : "closure-decision review"
                                            }
                                        >

                                            <div className="closure-decision-icon">
                                                {resumenAgente.cierre.estado?.icono}
                                            </div>

                                            <div>

                                                <span className="section-label">
                                                    DECISIÓN DE CIERRE
                                                </span>

                                                <h2>
                                                    {resumenAgente.cierre.estado?.titulo}
                                                </h2>

                                                <p>
                                                    {resumenAgente.cierre.estado?.mensaje}
                                                </p>

                                            </div>

                                        </div>

                                        <div className="closure-metrics">

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Reglas ejecutadas
                                                </span>

                                                <strong>
                                                    {
                                                        resumenAgente.cierre.resumen
                                                            ?.reglas_ejecutadas
                                                    }
                                                </strong>

                                                <small>
                                                    Validaciones realizadas
                                                </small>
                                            </div>

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Validaciones OK
                                                </span>

                                                <strong className="integrity-ok">
                                                    {
                                                        resumenAgente.cierre.resumen
                                                            ?.reglas_ok
                                                    }
                                                </strong>

                                                <small>
                                                    Sin observaciones
                                                </small>
                                            </div>

                                            <div className="summary-card">
                                                <span className="summary-label">
                                                    Pendientes
                                                </span>

                                                <strong className="integrity-review">
                                                    {
                                                        resumenAgente.cierre.resumen
                                                            ?.reglas_revisar
                                                    }
                                                </strong>

                                                <small>
                                                    Requieren revisión
                                                </small>
                                            </div>

                                        </div>

                                        <div className="closure-actions">

                                            <span className="section-label">
                                                ACCIONES RECOMENDADAS
                                            </span>

                                            <h3>
                                                ¿Qué debo revisar?
                                            </h3>

                                            {resumenAgente.cierre.motivos?.length > 0 ? (
                                                resumenAgente.cierre.motivos.map(
                                                    (motivo, index) => (
                                                        <div
                                                            className="closure-action"
                                                            key={`${motivo.regla_id}-${index}`}
                                                        >

                                                            <div className="closure-action-icon">
                                                                {motivo.nivel === "ALTO"
                                                                    ? "🔴"
                                                                    : "🟡"}
                                                            </div>

                                                            <div className="closure-action-content">

                                                                <div className="closure-action-header">

                                                                    <div>
                                                                        <span className="process-code">
                                                                            {motivo.proceso}
                                                                        </span>

                                                                        <h4>
                                                                            {motivo.titulo}
                                                                        </h4>
                                                                    </div>

                                                                    <span
                                                                        className={
                                                                            motivo.nivel === "ALTO"
                                                                                ? "closure-level high"
                                                                                : "closure-level"
                                                                        }
                                                                    >
                                                                        {motivo.nivel}
                                                                    </span>

                                                                </div>

                                                                <p>
                                                                    {motivo.mensaje}
                                                                </p>

                                                                {motivo.diferencia && (
                                                                    <div className="closure-difference">
                                                                        Diferencia detectada:
                                                                        {" "}
                                                                        <strong>
                                                                            {motivo.diferencia}
                                                                        </strong>
                                                                    </div>
                                                                )}

                                                                <div className="closure-action-next">
                                                                    <strong>
                                                                        Acción recomendada
                                                                    </strong>

                                                                    <span>
                                                                        {motivo.accion}
                                                                    </span>
                                                                </div>

                                                            </div>

                                                        </div>
                                                    )
                                                )
                                            ) : (
                                                <div className="closure-ok-card">

                                                    <span>
                                                        🟢
                                                    </span>

                                                    <div>
                                                        <strong>
                                                            No hay acciones pendientes.
                                                        </strong>

                                                        <p>
                                                            Las validaciones ejecutadas no
                                                            identificaron observaciones que
                                                            requieran atención.
                                                        </p>
                                                    </div>

                                                </div>
                                            )}

                                        </div>

                                        <div className="closure-recommendation">

                                            <span className="closure-recommendation-icon">
                                                📌
                                            </span>

                                            <div>

                                                <span className="section-label">
                                                    RECOMENDACIÓN
                                                </span>

                                                <p>
                                                    {resumenAgente.cierre.recomendacion}
                                                </p>

                                            </div>

                                        </div>

                                        <div className="agent-final-card">

                                            <div>
                                                <span className="section-label">
                                                    RESUMEN
                                                </span>

                                                <h3>
                                                    {resumenAgente.cierre.estado?.nivel === "ALTO"
                                                        ? "La liquidación requiere atención antes del cierre."
                                                        : resumenAgente.cierre.estado?.codigo === "OK"
                                                            ? "La liquidación está lista para revisión de cierre."
                                                            : "La liquidación tiene observaciones pendientes."}
                                                </h3>

                                                <p>
                                                    Has recorrido el resultado, sus variaciones,
                                                    explicación, contexto, integridad y trazabilidad.
                                                </p>
                                            </div>

                                            <button
                                                className="secondary-button"
                                                onClick={() => setSeccionAgente("A1")}
                                            >
                                                ← Volver al resumen
                                            </button>

                                        </div>

                                    </>
                                )}

                            </section>
                        )}
                    </section>
                )}

                {/* =====================================================
                    ASISTENTE FLOTANTE
                ===================================================== */}

                {mostrarAsistente && !asistenteAbierto && (
                    <button
                        className="assistant-floating-button"
                        onClick={() => setAsistenteAbierto(true)}
                    >
                        💬
                        <span>Chat Asistente</span>
                    </button>
                )}

                {mostrarAsistente && asistenteAbierto && (

                    <div className="assistant-chat-window">

                        <div className="assistant-chat-header">

                            <div>
                                <span className="assistant-chat-label">
                                    ASISTENTE DE LIQUIDACIONES
                                </span>

                                <strong>
                                    Copiloto de análisis
                                </strong>
                            </div>

                            <button
                                className="assistant-chat-close"
                                onClick={() => setAsistenteAbierto(false)}
                            >
                                ×
                            </button>

                        </div>


                        <div className="assistant-chat-body">

                            {!respuestaAsistente && (
                                <div className="assistant-welcome">

                                    <div className="assistant-welcome-icon">
                                        💬
                                    </div>

                                    <strong>
                                        ¿Qué quieres analizar?
                                    </strong>

                                    <p>
                                        Puedo ayudarte a interpretar la
                                        liquidación del periodo seleccionado.
                                    </p>

                                </div>
                            )}

                            {mensajesChat.map((mensaje, index) => (
                                <div
                                    key={index}
                                    className={
                                        mensaje.tipo === "usuario"
                                            ? "assistant-message user"
                                            : "assistant-message assistant"
                                    }
                                >
                                    {mensaje.tipo === "asistente" && mensaje.titulo && (
                                        <strong>
                                            {mensaje.titulo}
                                        </strong>
                                    )}

                                    <p>
                                        {mensaje.mensaje}
                                    </p>
                                </div>
                            ))}

                            <div className="question-options">

                                <button
                                    onClick={() =>
                                        seleccionarIntencion("por_que_cambio")
                                    }
                                    className={
                                        preguntaSeleccionada === "por_que_cambio"
                                            ? "question-option selected"
                                            : "question-option"
                                    }
                                >
                                    ¿Por qué cambió?
                                </button>


                                <button
                                    onClick={() =>
                                        seleccionarIntencion("principal_factor")
                                    }
                                    className={
                                        preguntaSeleccionada === "principal_factor"
                                            ? "question-option selected"
                                            : "question-option"
                                    }
                                >
                                    ¿Principal factor?
                                </button>


                                <button
                                    onClick={() =>
                                        seleccionarIntencion("comportamiento")
                                    }
                                    className={
                                        preguntaSeleccionada === "comportamiento"
                                            ? "question-option selected"
                                            : "question-option"
                                    }
                                >
                                    ¿Es normal?
                                </button>


                                <button
                                    onClick={() =>
                                        seleccionarIntencion("revisar")
                                    }
                                    className={
                                        preguntaSeleccionada === "revisar"
                                            ? "question-option selected"
                                            : "question-option"
                                    }
                                >
                                    ¿Qué revisar?
                                </button>

                            </div>

                            <div className="assistant-chat-input">

                                <input
                                    type="text"
                                    value={preguntaLibre}
                                    onChange={(e) =>
                                        setPreguntaLibre(e.target.value)
                                    }
                                    placeholder="Escribe tu pregunta..."
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();

                                            if (preguntaLibre.trim()) {
                                                const intencion = detectarIntencion(
                                                    preguntaLibre,
                                                    ultimaIntencion
                                                );

                                                console.log("PREGUNTA:", preguntaLibre);
                                                console.log("ULTIMA INTENCION:", ultimaIntencion);
                                                console.log("INTENCION DETECTADA:", intencion);

                                                setUltimaIntencion(intencion);

                                                const contextoBase =
                                                    modoActual === "analista"
                                                        ? analisis
                                                        : resumenAgente;

                                                const contextoAsistente = {
                                                    ...contextoBase,
                                                    resultado: contextoBase?.resultado,
                                                    variacion: contextoBase?.variacion,
                                                    impulsores: contextoBase?.impulsores,
                                                    cierre: contextoBase?.cierre
                                                };

                                                console.log("=== CONTEXTO CHAT ===");
                                                console.log("MODO:", modoActual);
                                                console.log("EMPRESA:", empresaAgente);
                                                console.log("FECHA:", fecha);
                                                console.log("CONTEXTO CHAT:", contextoAsistente);
                                                console.log("VARIACION CHAT:", contextoAsistente?.variacion);
                                                console.log("RESULTADO CHAT:", contextoAsistente?.resultado);
                                                console.log("IMPULSORES CHAT:", contextoAsistente?.impulsores);

                                                const respuesta = obtenerRespuestaAsistente(
                                                    intencion,
                                                    contextoAsistente,
                                                    preguntaLibre
                                                );

                                                setMensajesChat((mensajes) => [
                                                    ...mensajes,
                                                    {
                                                        tipo: "usuario",
                                                        mensaje: preguntaLibre
                                                    },
                                                    {
                                                        tipo: "asistente",
                                                        mensaje: respuesta.mensaje,
                                                        titulo: respuesta.titulo
                                                    }
                                                ]);

                                                setPreguntaLibre("");
                                            }
                                        }
                                    }}
                                />

                                <button
                                    onClick={() => {

                                        if (!preguntaLibre.trim()) {
                                            return;
                                        }

                                        const intencion = detectarIntencion(
                                            preguntaLibre,
                                            ultimaIntencion
                                        );

                                        setUltimaIntencion(intencion);

                                        const contextoBase =
                                            modoActual === "analista"
                                                ? analisis
                                                : resumenAgente;

                                        const contextoAsistente = {
                                            ...contextoBase,
                                            resultado: contextoBase?.resultado,
                                            variacion: contextoBase?.variacion,
                                            impulsores: contextoBase?.impulsores,
                                            cierre: contextoBase?.cierre
                                        };

                                        console.log("=== CONTEXTO CHAT ===");
                                        console.log("MODO:", modoActual);
                                        console.log("EMPRESA:", empresaAgente);
                                        console.log("FECHA:", fecha);
                                        console.log("CONTEXTO CHAT:", contextoAsistente);
                                        console.log("VARIACION CHAT:", contextoAsistente?.variacion);
                                        console.log("RESULTADO CHAT:", contextoAsistente?.resultado);
                                        console.log("IMPULSORES CHAT:", contextoAsistente?.impulsores);

                                        const respuesta =
                                            obtenerRespuestaAsistente(
                                                intencion,
                                                contextoAsistente,
                                                preguntaLibre
                                            );

                                        setMensajesChat((mensajes) => [
                                            ...mensajes,
                                            {
                                                tipo: "usuario",
                                                mensaje: preguntaLibre
                                            },
                                            {
                                                tipo: "asistente",
                                                mensaje: respuesta.mensaje,
                                                titulo: respuesta.titulo
                                            }
                                        ]);

                                        setPreguntaLibre("");
                                    }}
                                >
                                    →
                                </button>

                            </div>

                        </div>

                    </div>
                )}

            </main>

            <footer>
                COES Liquidaciones 360 · HackCOES 2026
            </footer>

        </div >

    );
}

export default App;