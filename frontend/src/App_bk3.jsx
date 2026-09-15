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

const API_URL = "http://127.0.0.1:8000";


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

    const [fecha, setFecha] = useState("");

    const [periodos, setPeriodos] = useState([]);

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
        cargarPeriodos();
    }, []);


    async function cargarPeriodos() {

        try {

            const response = await axios.get(
                `${API_URL}/periodos`
            );

            const periodosDisponibles = response.data.periodos;

            setPeriodos(periodosDisponibles);

            if (periodosDisponibles.length > 0) {
                setFecha(periodosDisponibles[0]);
            }

        } catch (err) {

            console.error("Error cargando periodos:", err);

        }
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






    async function analizarAgente(agenteId) {

        try {

            setLoadingDetalle(true);
            setError(null);

            console.log("=== INICIO ANALISIS ===");
            console.log("Agente recibido:", agenteId);

            const agenteRadar = radar?.agentes_analizados?.find(
                (item) => item.agente_id === agenteId
            );

            console.log(
                "Agente encontrado en radar:",
                agenteRadar
            );

            setAgenteSeleccionado(agenteRadar);

            const [analisisResponse, detalleResponse] =
                await Promise.all([

                    axios.get(
                        `${API_URL}/analisis/${agenteId}/${fecha}`
                    ),

                    axios.get(
                        `${API_URL}/liquidaciones/${agenteId}/${fecha}/detalle`
                    )

                ]);

            setAnalisis(analisisResponse.data);
            setDetalle(detalleResponse.data.conceptos);

        } catch (err) {

            console.error("=== ERROR EN ANALISIS ===");
            console.error(err);

            let mensaje = "Error desconocido.";

            if (err.response) {

                mensaje =
                    `Error del backend (${err.response.status}): ` +
                    `${err.response.data?.detail || "Sin detalle"}`;

            } else if (err.request) {

                mensaje =
                    "No se recibió respuesta del backend. " +
                    "Verifica que FastAPI esté ejecutándose.";

            } else {

                mensaje = err.message;
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
            texto.includes("por donde empiezo")
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
                return "comportamiento";
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

        if (!analisis) {
            return {
                titulo: "Sin información",
                tipo: "desconocida",
                mensaje:
                    "No hay información suficiente para responder la consulta."
            };
        }

        const comparacion = analisis.comparacion;
        const factores = analisis.principales_factores || [];
        const historico = analisis.comportamiento_historico;
        const recomendacion = analisis.recomendacion_revision;


        //console.log("RELEVANCIA:", analisis.relevancia);

        switch (intencion) {
            case "por_que_cambio": {
                const factorPrincipal = factores[0];
                const segundoFactor = factores[1];

                let mensaje =
                    `La liquidación ${comparacion.variacion_porcentual >= 0
                        ? "aumentó"
                        : "disminuyó"
                    } un ${Math.abs(
                        comparacion.variacion_porcentual
                    ).toFixed(2)}%, equivalente a S/ ${Math.abs(
                        comparacion.variacion_absoluta
                    ).toLocaleString("es-PE", {
                        minimumFractionDigits: 2
                    })}.`;

                if (factorPrincipal) {
                    mensaje +=
                        ` El principal factor identificado fue ${factorPrincipal.concepto
                        }, con una variación de ${factorPrincipal.variacion >= 0 ? "+" : "-"
                        }S/ ${Math.abs(
                            factorPrincipal.variacion
                        ).toLocaleString("es-PE", {
                            minimumFractionDigits: 2
                        })}.`;
                }

                if (segundoFactor) {
                    mensaje +=
                        ` Este cambio fue ${segundoFactor.variacion < 0
                            ? "parcialmente compensado"
                            : "acompañado"
                        } por ${segundoFactor.concepto
                        }, con una variación de ${segundoFactor.variacion >= 0 ? "+" : "-"
                        }S/ ${Math.abs(
                            segundoFactor.variacion
                        ).toLocaleString("es-PE", {
                            minimumFractionDigits: 2
                        })}.`;
                }

                return {
                    titulo: "Análisis de la variación",
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
                const factorPrincipal = factores[0];

                if (!factorPrincipal) {
                    return {
                        titulo: "Principal factor identificado",
                        tipo: "factor",
                        mensaje:
                            "No se identificó un factor principal para el periodo seleccionado."
                    };
                }

                return {
                    titulo: "Principal factor identificado",
                    tipo: "factor",
                    mensaje:
                        `El principal factor que explica la variación es ${factorPrincipal.concepto
                        }, con un impacto de ${factorPrincipal.variacion >= 0 ? "+" : "-"
                        }S/ ${Math.abs(
                            factorPrincipal.variacion
                        ).toLocaleString("es-PE", {
                            minimumFractionDigits: 2
                        })}.`
                };
            }

            case "comportamiento": {
                if (!historico) {
                    return {
                        titulo: "Evaluación del comportamiento",
                        tipo: "historico",
                        mensaje:
                            "No existe suficiente información histórica para evaluar el comportamiento."
                    };
                }

                const zScore = Number(historico.z_score);
                const clasificacion = historico.clasificacion_historica;

                let conclusion = "";

                if (clasificacion === "NORMAL") {
                    conclusion =
                        "El comportamiento se encuentra dentro del rango esperado respecto a su historial.";
                } else if (clasificacion === "MODERADO") {
                    conclusion =
                        "Se observa una desviación moderada respecto a su comportamiento histórico y conviene revisar los principales factores.";
                } else if (clasificacion === "RELEVANTE") {
                    conclusion =
                        "La desviación es relevante respecto a su historial y se recomienda una revisión detallada.";
                } else if (clasificacion === "EXCEPCIONAL") {
                    conclusion =
                        "El comportamiento es excepcional respecto a su historial y debería priorizarse su revisión.";
                } else {
                    conclusion =
                        "Se recomienda revisar el comportamiento respecto a los periodos históricos disponibles.";
                }


                const conclusionML = ml?.disponible
                    ? ml.es_anomalia
                        ? ` Adicionalmente, el modelo de Machine Learning identifica una señal potencialmente inusual, con un score de anomalía de ${ml.score_anomalia}.`
                        : ` El modelo de Machine Learning no identifica una señal potencialmente inusual en este periodo, con un score de anomalía de ${ml.score_anomalia}.`
                    : "";

                return {
                    titulo: "Evaluación del comportamiento",
                    tipo: "historico",
                    mensaje:
                        `El comportamiento actual se clasifica como ${clasificacion
                        }, con un Z-Score de ${zScore >= 0 ? "+" : ""
                        }${zScore.toFixed(2)} respecto a los últimos ${historico.periodos_analizados
                        } periodos. ${conclusion}${conclusionML}`
                };

            }

            case "revisar": {
                if (!recomendacion) {
                    return {
                        titulo: "Prioridad de revisión",
                        tipo: "revision",
                        mensaje:
                            "No se identificó una prioridad específica de revisión."
                    };
                }

                const score = analisis?.relevancia?.score;
                const nivel = analisis?.relevancia?.nivel;
                const historico =
                    analisis?.comportamiento_historico?.clasificacion_historica;

                const impacto = Math.abs(recomendacion.variacion);

                return {
                    titulo: "Prioridad de revisión",
                    tipo: "revision",
                    mensaje:
                        `El score es ${nivel} (${score}/100). El sistema recomienda revisar primero ${recomendacion.concepto}, debido a su impacto de ${recomendacion.variacion >= 0 ? "+" : "-"
                        }S/ ${impacto.toLocaleString("es-PE", {
                            minimumFractionDigits: 2
                        })}. ${historico
                            ? `Aunque el comportamiento histórico es ${historico}, `
                            : ""
                        }este factor concentra la mayor contribución entre los conceptos analizados.`
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
        const respuesta = obtenerRespuestaAsistente(
            intencion,
            analisis
        );

        const pregunta = {
            por_que_cambio: "¿Por qué cambió?",
            principal_factor: "¿Cuál fue el principal factor?",
            comportamiento: "¿Es un comportamiento normal?",
            revisar: "¿Qué debería revisar primero?"
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


    return (

        <div className="app">

            <header className="header">

                <div>

                    <h1>
                        COES Liquidaciones 360
                    </h1>

                    <p>
                        Consulta. Analiza. Explica. Decide.
                    </p>

                </div>

                <div className="periodo">

                    <span>
                        Periodo analizado
                    </span>

                    <select
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                    >
                        {periodos.map((periodo) => (
                            <option
                                key={periodo}
                                value={periodo}
                            >
                                {new Date(periodo + "T00:00:00").toLocaleDateString(
                                    "es-PE",
                                    {
                                        month: "long",
                                        year: "numeric"
                                    }
                                )}
                            </option>
                        ))}
                    </select>

                </div>

            </header>

            <main className="container">

                {error && (

                    <div className="message error">
                        {error}
                    </div>

                )}

                {!agenteSeleccionado && (

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

                            <button onClick={cargarRadar}>
                                Actualizar
                            </button>

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

                                                    <th>
                                                        Histórico
                                                    </th>

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
                                                                        {item.agente}
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

                                <section className="insight">

                                    <div className="insight-icon">
                                        !
                                    </div>

                                    <div>

                                        <h3>
                                            ¿Qué está pasando?
                                        </h3>

                                        <p>

                                            El Radar identifica automáticamente
                                            variaciones relevantes entre periodos.
                                            Selecciona un agente para profundizar
                                            en los conceptos que explican su variación.

                                        </p>

                                    </div>

                                </section>

                            </>

                        )}

                    </>

                )}

                {agenteSeleccionado && (

                    <section className="detail-view">

                        <button
                            className="back-button"
                            onClick={volverRadar}
                        >
                            ← Volver al Radar
                        </button>

                        {loadingDetalle && (

                            <div className="message">
                                Analizando liquidación...
                            </div>

                        )}

                        {!loadingDetalle && analisis && detalle && (

                            <>

                                <div className="detail-header">

                                    <div>

                                        <span className="detail-label">
                                            Análisis de liquidación
                                        </span>


                                        <h2>
                                            {agenteSeleccionado?.agente}
                                        </h2>

                                        <small>
                                            {agenteSeleccionado?.agente_id}
                                        </small>


                                        <p>
                                            Periodo:{" "}
                                            {new Date(fecha + "T00:00:00").toLocaleDateString(
                                                "es-PE",
                                                {
                                                    month: "long",
                                                    year: "numeric"
                                                }
                                            )}
                                        </p>

                                    </div>

                                    <span
                                        className={`level ${analisis.relevancia.nivel.toLowerCase()}`}
                                    >
                                        {analisis.relevancia.nivel}
                                    </span>

                                </div>




                                <div className="relevance-card">

                                    <div className="relevance-header">

                                        <span className="relevance-icon">
                                            🎯
                                        </span>

                                        <div>
                                            <span className="relevance-label">
                                                RELEVANCIA DE LA LIQUIDACIÓN
                                            </span>

                                            <h3>
                                                Prioridad de análisis
                                            </h3>
                                        </div>

                                    </div>

                                    <div className="relevance-main">

                                        <div className="relevance-score">

                                            <strong>
                                                {analisis?.relevancia?.score}
                                            </strong>

                                            <span>
                                                /100
                                            </span>

                                        </div>

                                        <div
                                            className={`relevance-level relevance-${analisis?.relevancia?.nivel?.toLowerCase()}`}
                                        >
                                            {analisis?.relevancia?.nivel}
                                        </div>

                                    </div>



                                    <div className="relevance-breakdown">
                                        <div className="relevance-factor">
                                            <span>Variación</span>
                                            <strong>{analisis?.relevancia?.score_variacion}</strong>
                                            <small>25% del score</small>
                                        </div>

                                        <div className="relevance-factor">
                                            <span>Impacto económico</span>
                                            <strong>{analisis?.relevancia?.score_impacto}</strong>
                                            <small>35% del score</small>
                                        </div>

                                        <div className="relevance-factor">
                                            <span>Factor principal</span>
                                            <strong>{analisis?.relevancia?.score_factor}</strong>
                                            <small>20% del score</small>
                                        </div>

                                        <div className="relevance-factor">
                                            <span>Comportamiento histórico</span>
                                            <strong>{analisis?.relevancia?.score_historico}</strong>
                                            <small>20% del score</small>
                                        </div>
                                    </div>




                                    <div className="relevance-description">
                                        <p>
                                            El score combina la magnitud de la variación,
                                            el impacto económico, el principal factor identificado
                                            y el comportamiento histórico del agente.
                                        </p>
                                    </div>

                                </div>



                                <section className="cards detail-cards">


                                    <div className="card">

                                        <span>
                                            Periodo actual
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {analisis.comparacion.monto_actual.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                }
                                            )}
                                        </strong>

                                        <small>
                                            {new Date(
                                                analisis.comparacion.periodo_actual + "T00:00:00"
                                            ).toLocaleDateString("es-PE", {
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </small>

                                    </div>


                                    <div className="card">

                                        <span>
                                            Periodo anterior
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {analisis.comparacion.monto_anterior.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                }
                                            )}
                                        </strong>

                                        <small>
                                            {new Date(
                                                analisis.comparacion.periodo_anterior + "T00:00:00"
                                            ).toLocaleDateString("es-PE", {
                                                month: "long",
                                                year: "numeric"
                                            })}
                                        </small>

                                    </div>



                                    <div className="card">

                                        <span>
                                            Variación
                                        </span>

                                        <strong
                                            className={
                                                analisis.comparacion.variacion_absoluta >= 0
                                                    ? "positive"
                                                    : "negative"
                                            }
                                        >
                                            {analisis.comparacion.variacion_absoluta >= 0
                                                ? "+"
                                                : ""}

                                            {analisis.comparacion.variacion_porcentual.toFixed(
                                                2
                                            )}
                                            %
                                        </strong>

                                        <small>
                                            Variación porcentual
                                        </small>

                                    </div>

                                    <div className="card">

                                        <span>
                                            Impacto económico
                                        </span>

                                        <strong>
                                            S/{" "}
                                            {analisis.comparacion.variacion_absoluta.toLocaleString(
                                                "es-PE",
                                                {
                                                    minimumFractionDigits: 2,
                                                }
                                            )}
                                        </strong>

                                        <small>
                                            Cambio absoluto
                                        </small>

                                    </div>


                                    <div className="card">

                                        <span>
                                            Variación interanual
                                        </span>

                                        <strong
                                            className={
                                                analisis.comparacion_interanual?.variacion_porcentual >= 0
                                                    ? "positive"
                                                    : "negative"
                                            }
                                        >
                                            {analisis.comparacion_interanual?.variacion_porcentual >= 0
                                                ? "+"
                                                : "-"}
                                            {Math.abs(
                                                analisis.comparacion_interanual?.variacion_porcentual || 0
                                            ).toFixed(2)}
                                            %
                                        </strong>

                                        <small>
                                            vs.{" "}
                                            {analisis.comparacion_interanual?.fecha_comparacion}
                                        </small>

                                    </div>


                                </section>





                                <section className="panel">

                                    <div className="panel-header">

                                        <div>

                                            <h2>
                                                ¿Qué cambió?
                                            </h2>

                                            <p>
                                                Comparación de conceptos entre ambos periodos.
                                            </p>

                                        </div>

                                    </div>

                                    <div className="table-container">

                                        <table>

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

                                                </tr>

                                            </thead>

                                            <tbody>

                                                {analisis.principales_factores.map(
                                                    (factor) => (

                                                        <tr key={factor.concepto}>

                                                            <td>
                                                                <strong>
                                                                    {factor.concepto}
                                                                </strong>
                                                            </td>

                                                            <td>

                                                                S/{" "}
                                                                {factor.monto_anterior.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                    }
                                                                )}

                                                            </td>

                                                            <td>

                                                                S/{" "}
                                                                {factor.monto_actual.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                    }
                                                                )}

                                                            </td>

                                                            <td>

                                                                <span
                                                                    className={
                                                                        factor.variacion >= 0
                                                                            ? "positive"
                                                                            : "negative"
                                                                    }
                                                                >

                                                                    {factor.variacion >= 0
                                                                        ? "+"
                                                                        : ""}

                                                                    S/{" "}
                                                                    {factor.variacion.toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2,
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




                                    <div className="waterfall-section">

                                        <div className="waterfall-header">

                                            <div>
                                                <h3>
                                                    ¿Qué conceptos explican la variación?
                                                </h3>

                                                <p>
                                                    Evolución de la liquidación desde el periodo anterior
                                                    hasta el periodo actual.
                                                </p>
                                            </div>

                                        </div>

                                        <div className="waterfall-chart">

                                            <ResponsiveContainer width="100%" height={380}>

                                                <BarChart
                                                    data={construirWaterfall(analisis)}
                                                    margin={{
                                                        top: 20,
                                                        right: 30,
                                                        left: 20,
                                                        bottom: 60
                                                    }}
                                                >

                                                    <CartesianGrid
                                                        strokeDasharray="3 3"
                                                        vertical={false}
                                                    />

                                                    <XAxis
                                                        dataKey="concepto"
                                                        angle={-25}
                                                        textAnchor="end"
                                                        height={80}
                                                    />

                                                    <YAxis
                                                        tickFormatter={(value) =>
                                                            `S/ ${(value / 1000000).toFixed(1)}M`
                                                        }
                                                    />

                                                    <Tooltip
                                                        formatter={(value, name) => {

                                                            if (name === "variacion") {
                                                                return [
                                                                    `S/ ${Number(value).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2
                                                                        }
                                                                    )}`,
                                                                    "Monto"
                                                                ];
                                                            }

                                                            return [value, name];

                                                        }}
                                                    />

                                                    <Bar
                                                        dataKey="base"
                                                        stackId="waterfall"
                                                        fill="transparent"
                                                    />

                                                    <Bar
                                                        dataKey="variacion"
                                                        stackId="waterfall"
                                                        radius={[5, 5, 0, 0]}
                                                    >

                                                        {construirWaterfall(analisis).map(
                                                            (entry, index) => (

                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={
                                                                        entry.tipo === "positivo"
                                                                            ? "#16a34a"
                                                                            : entry.tipo === "negativo"
                                                                                ? "#dc2626"
                                                                                : "#2563eb"
                                                                    }
                                                                />

                                                            )
                                                        )}

                                                    </Bar>

                                                </BarChart>

                                            </ResponsiveContainer>

                                        </div>

                                    </div>

                                    <div className="waterfall-insights">

                                        <div className="waterfall-insight positive-insight">

                                            <span>
                                                Principal impulsor
                                            </span>

                                            <strong>
                                                {
                                                    analisis.factores_positivos?.length
                                                        ? analisis.factores_positivos[0].concepto
                                                        : "Sin incremento"
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    analisis.factores_positivos?.length
                                                        ? `+S/ ${analisis.factores_positivos[0].variacion.toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2
                                                            }
                                                        )}`
                                                        : "-"
                                                }
                                            </small>

                                        </div>


                                        <div className="waterfall-insight negative-insight">

                                            <span>
                                                Principal compensador
                                            </span>

                                            <strong>
                                                {
                                                    analisis.factores_negativos?.length
                                                        ? analisis.factores_negativos[0].concepto
                                                        : "Sin disminuciones"
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    analisis.factores_negativos?.length
                                                        ? `-S/ ${Math.abs(
                                                            analisis.factores_negativos[0].variacion
                                                        ).toLocaleString(
                                                            "es-PE",
                                                            {
                                                                minimumFractionDigits: 2
                                                            }
                                                        )}`
                                                        : "-"
                                                }
                                            </small>

                                        </div>


                                        <div className="waterfall-insight total-insight">

                                            <span>
                                                Resultado neto
                                            </span>

                                            <strong>
                                                {
                                                    analisis.comparacion.variacion_absoluta >= 0
                                                        ? "+"
                                                        : "-"
                                                }

                                                S/{" "}

                                                {Math.abs(
                                                    analisis.comparacion.variacion_absoluta
                                                ).toLocaleString(
                                                    "es-PE",
                                                    {
                                                        minimumFractionDigits: 2
                                                    }
                                                )}

                                            </strong>

                                            <small>
                                                Variación total
                                            </small>

                                        </div>

                                    </div>




                                    <div className="factor-section">

                                        <h3>
                                            Principales factores del cambio
                                        </h3>

                                        {analisis.principales_factores.map((factor) => {

                                            const esPrincipal =
                                                factor === analisis.principales_factores[0];

                                            const evidenciaFactor = detalle.find(
                                                (item) =>
                                                    item.concepto === factor.concepto
                                            );

                                            return (

                                                <div
                                                    className="factor"
                                                    key={factor.concepto}
                                                >

                                                    <div>


                                                        <div className="factor-title">

                                                            <strong>
                                                                {factor.concepto}
                                                            </strong>

                                                            {esPrincipal && (
                                                                <span className="principal-factor-badge">
                                                                    ★ Principal impulsor
                                                                </span>
                                                            )}

                                                        </div>



                                                        <small>

                                                            S/{" "}
                                                            {factor.monto_anterior.toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2
                                                                }
                                                            )}

                                                            {" → "}

                                                            S/{" "}
                                                            {factor.monto_actual.toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2
                                                                }
                                                            )}

                                                        </small>

                                                    </div>

                                                    <div className="factor-right">

                                                        <strong
                                                            className={
                                                                factor.variacion >= 0
                                                                    ? "factor-positive"
                                                                    : "factor-negative"
                                                            }
                                                        >

                                                            {factor.variacion >= 0
                                                                ? "+"
                                                                : "-"}S/{" "}

                                                            {Math.abs(
                                                                factor.variacion
                                                            ).toLocaleString(
                                                                "es-PE",
                                                                {
                                                                    minimumFractionDigits: 2
                                                                }
                                                            )}

                                                        </strong>

                                                        {evidenciaFactor && (

                                                            <button
                                                                className="factor-evidence-button"
                                                                onClick={() =>
                                                                    setEvidencia({
                                                                        ...evidenciaFactor,
                                                                        agente:
                                                                            agenteSeleccionado?.agente,
                                                                        agente_id:
                                                                            agenteSeleccionado?.agente_id,
                                                                        periodo: fecha
                                                                    })
                                                                }
                                                            >
                                                                Ver evidencia
                                                            </button>

                                                        )}

                                                    </div>

                                                </div>

                                            );

                                        })}

                                    </div>


                                </section>



                                <section className="explanation">



                                    {!asistenteAbierto && (
                                        <button
                                            className="assistant-floating-button"
                                            onClick={() => setAsistenteAbierto(true)}
                                        >
                                            💬
                                            <span>Asistente</span>
                                        </button>
                                    )}

                                    {asistenteAbierto && (
                                        <div className="assistant-chat-window">

                                            <div className="assistant-chat-header">
                                                <div>
                                                    <span className="assistant-chat-label">
                                                        ASISTENTE DE LIQUIDACIONES
                                                    </span>
                                                    <strong>Copiloto de análisis</strong>
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
                                                                ? "chat-message chat-message-user"
                                                                : "chat-message chat-message-assistant"
                                                        }
                                                    >
                                                        {mensaje.tipo === "asistente" && (
                                                            <div className="chat-message-label">
                                                                🤖 Asistente
                                                            </div>
                                                        )}

                                                        <p>{mensaje.mensaje}</p>
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

                                            </div>

                                            <div className="assistant-chat-input">

                                                <input
                                                    type="text"
                                                    value={preguntaLibre}
                                                    onChange={(e) =>
                                                        setPreguntaLibre(e.target.value)
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key === "Enter" &&
                                                            preguntaLibre.trim()
                                                        ) {
                                                            const intencion =
                                                                detectarIntencion(
                                                                    preguntaLibre,
                                                                    ultimaIntencion
                                                                );

                                                            const respuesta =
                                                                obtenerRespuestaAsistente(
                                                                    intencion,
                                                                    analisis,
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

                                                            setPreguntaSeleccionada(intencion);
                                                            setRespuestaAsistente(respuesta);
                                                            setUltimaIntencion(intencion);
                                                            setUltimaRespuesta(respuesta);
                                                            setPreguntaLibre("");
                                                        }
                                                    }}
                                                    placeholder="Escribe una pregunta..."
                                                />

                                                <button
                                                    onClick={() => {
                                                        const intencion =
                                                            detectarIntencion(
                                                                preguntaLibre,
                                                                ultimaIntencion
                                                            );

                                                        const respuesta =
                                                            obtenerRespuestaAsistente(
                                                                intencion,
                                                                analisis,
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

                                                        setPreguntaSeleccionada(intencion);
                                                        setRespuestaAsistente(respuesta);
                                                        setUltimaIntencion(intencion);
                                                        setUltimaRespuesta(respuesta);
                                                        setPreguntaLibre("");
                                                    }}
                                                >
                                                    →
                                                </button>

                                            </div>

                                        </div>
                                    )}











                                    <div className="explanation-header">

                                        <div className="insight-icon">
                                            ?
                                        </div>

                                        <div>

                                            <h2>
                                                ¿Por qué cambió la liquidación?
                                            </h2>

                                            <p>
                                                Explicación basada en los factores
                                                calculados por el sistema.
                                            </p>

                                        </div>

                                    </div>

                                    <div className="explanation-content">

                                        <div className="explanation-main">

                                            <p>
                                                {analisis.explicacion}
                                            </p>

                                        </div>




                                        {analisis.recomendacion_revision && (

                                            <div className="review-priority">

                                                <div className="review-priority-header">

                                                    <span className="review-priority-icon">
                                                        🔎
                                                    </span>

                                                    <div>
                                                        <span className="review-priority-label">
                                                            PRIORIDAD DE REVISIÓN
                                                        </span>

                                                        <h3>
                                                            {analisis.recomendacion_revision.concepto}
                                                        </h3>
                                                    </div>

                                                </div>

                                                <div className="review-priority-content">

                                                    <div>
                                                        <span>Impacto identificado</span>

                                                        <strong
                                                            className={
                                                                analisis.recomendacion_revision.variacion >= 0
                                                                    ? "factor-positive"
                                                                    : "factor-negative"
                                                            }
                                                        >
                                                            {analisis.recomendacion_revision.variacion >= 0
                                                                ? "+"
                                                                : "-"}
                                                            S/{" "}
                                                            {Math.abs(
                                                                analisis.recomendacion_revision.variacion
                                                            ).toLocaleString("es-PE", {
                                                                minimumFractionDigits: 2
                                                            })}
                                                        </strong>
                                                    </div>

                                                    <p>
                                                        {analisis.recomendacion_revision.mensaje}
                                                    </p>


                                                    <button
                                                        className="review-priority-button"
                                                        onClick={() => {

                                                            const evidenciaPrioridad = detalle.find(
                                                                (item) =>
                                                                    item.concepto ===
                                                                    analisis.recomendacion_revision.concepto
                                                            );

                                                            if (evidenciaPrioridad) {

                                                                setEvidencia({
                                                                    ...evidenciaPrioridad,
                                                                    agente: agenteSeleccionado?.agente,
                                                                    agente_id: agenteSeleccionado?.agente_id,
                                                                    periodo: fecha
                                                                });

                                                            }
                                                        }}
                                                    >
                                                        Ver detalle de{" "}
                                                        {analisis.recomendacion_revision.concepto}
                                                        {" →"}
                                                    </button>


                                                </div>

                                            </div>

                                        )}



                                        {analisis.interpretacion_interanual && (

                                            <div className="interannual-reading">

                                                <div className="interannual-reading-header">

                                                    <span className="interannual-reading-icon">
                                                        📊
                                                    </span>

                                                    <div>
                                                        <span className="interannual-reading-label">
                                                            LECTURA DEL COMPORTAMIENTO
                                                        </span>

                                                        <h3>
                                                            Comparación mensual vs. interanual
                                                        </h3>
                                                    </div>

                                                </div>

                                                <div className="comparison-reference-grid">

                                                    <div className="comparison-reference">

                                                        <span>
                                                            Vs. periodo anterior
                                                        </span>

                                                        <strong
                                                            className={
                                                                analisis.comparacion.variacion_porcentual >= 0
                                                                    ? "positive"
                                                                    : "negative"
                                                            }
                                                        >
                                                            {analisis.comparacion.variacion_porcentual >= 0
                                                                ? "+"
                                                                : "-"}
                                                            {Math.abs(
                                                                analisis.comparacion.variacion_porcentual
                                                            ).toFixed(2)}
                                                            %
                                                        </strong>

                                                        <small>
                                                            {analisis.comparacion.fecha_anterior}
                                                        </small>

                                                    </div>

                                                    <div className="comparison-reference">

                                                        <span>
                                                            Vs. mismo periodo del año anterior
                                                        </span>

                                                        <strong
                                                            className={
                                                                analisis.comparacion_interanual
                                                                    ?.variacion_porcentual >= 0
                                                                    ? "positive"
                                                                    : "negative"
                                                            }
                                                        >
                                                            {analisis.comparacion_interanual
                                                                ?.variacion_porcentual >= 0
                                                                ? "+"
                                                                : "-"}
                                                            {Math.abs(
                                                                analisis.comparacion_interanual
                                                                    ?.variacion_porcentual || 0
                                                            ).toFixed(2)}
                                                            %
                                                        </strong>

                                                        <small>
                                                            {analisis.comparacion_interanual
                                                                ?.fecha_comparacion}
                                                        </small>

                                                    </div>

                                                </div>

                                                <div className="interpretation-text">

                                                    <span>
                                                        Interpretación
                                                    </span>

                                                    <p>
                                                        {analisis.interpretacion_interanual}
                                                    </p>

                                                </div>

                                            </div>

                                        )}





                                        {analisis.comportamiento_historico && (

                                            <div className="historical-reading">

                                                <div className="historical-reading-header">

                                                    <span className="historical-reading-icon">
                                                        📈
                                                    </span>

                                                    <div>

                                                        <span className="historical-reading-label">
                                                            COMPORTAMIENTO HISTÓRICO
                                                        </span>

                                                        <h3>
                                                            Referencia de los últimos{" "}
                                                            {analisis.comportamiento_historico.periodos_analizados}{" "}
                                                            periodos
                                                        </h3>

                                                    </div>

                                                </div>

                                                <div className="historical-kpis">

                                                    <div className="historical-kpi">

                                                        <span>
                                                            Promedio histórico
                                                        </span>

                                                        <strong>
                                                            S/{" "}
                                                            {analisis.comportamiento_historico
                                                                .promedio_historico
                                                                .toLocaleString("es-PE", {
                                                                    minimumFractionDigits: 2
                                                                })}
                                                        </strong>

                                                    </div>

                                                    <div className="historical-kpi">

                                                        <span>
                                                            Periodo actual
                                                        </span>

                                                        <strong>
                                                            S/{" "}
                                                            {analisis.comportamiento_historico
                                                                .monto_actual
                                                                .toLocaleString("es-PE", {
                                                                    minimumFractionDigits: 2
                                                                })}
                                                        </strong>

                                                    </div>

                                                    <div className="historical-kpi">

                                                        <span>
                                                            Desviación histórica
                                                        </span>

                                                        <strong
                                                            className={
                                                                analisis.comportamiento_historico
                                                                    .desviacion_porcentual >= 0
                                                                    ? "positive"
                                                                    : "negative"
                                                            }
                                                        >
                                                            {analisis.comportamiento_historico
                                                                .desviacion_porcentual >= 0
                                                                ? "+"
                                                                : "-"}
                                                            {Math.abs(
                                                                analisis.comportamiento_historico
                                                                    .desviacion_porcentual
                                                            ).toFixed(2)}
                                                            %
                                                        </strong>

                                                    </div>



                                                    <div
                                                        className={`historical-classification historical-${analisis
                                                            .comportamiento_historico
                                                            .clasificacion_historica
                                                            .toLowerCase()}`}
                                                    >

                                                        <span>
                                                            Clasificación histórica
                                                        </span>

                                                        <strong>
                                                            {analisis
                                                                .comportamiento_historico
                                                                .clasificacion_historica}
                                                        </strong>

                                                        <small>
                                                            Z-Score:{" "}
                                                            {analisis
                                                                .comportamiento_historico
                                                                .z_score >= 0
                                                                ? "+"
                                                                : ""}
                                                            {analisis
                                                                .comportamiento_historico
                                                                .z_score
                                                                .toFixed(2)}
                                                        </small>

                                                    </div>


                                                    <div className="historical-interpretation">

                                                        <span>
                                                            Lectura histórica
                                                        </span>

                                                        <p>
                                                            {analisis
                                                                .comportamiento_historico
                                                                .interpretacion_historica}
                                                        </p>

                                                    </div>



                                                </div>



                                                <div className="historical-chart">

                                                    <span className="historical-chart-title">
                                                        Evolución de las liquidaciones
                                                    </span>

                                                    <ResponsiveContainer width="100%" height={260}>

                                                        <BarChart
                                                            data={
                                                                analisis.comportamiento_historico
                                                                    .periodos_historicos
                                                                    .map((item) => ({
                                                                        ...item,
                                                                        periodo: item.fecha.substring(0, 7),
                                                                    }))
                                                            }
                                                        >

                                                            <CartesianGrid strokeDasharray="3 3" />

                                                            <XAxis
                                                                dataKey="periodo"
                                                            />

                                                            <YAxis
                                                                tickFormatter={(value) =>
                                                                    `S/ ${(value / 1000000).toFixed(1)}M`
                                                                }
                                                            />

                                                            <Tooltip
                                                                formatter={(value) =>
                                                                    `S/ ${Number(value).toLocaleString(
                                                                        "es-PE",
                                                                        {
                                                                            minimumFractionDigits: 2
                                                                        }
                                                                    )}`
                                                                }
                                                            />

                                                            <Bar
                                                                dataKey="monto"
                                                                radius={[5, 5, 0, 0]}
                                                            />

                                                        </BarChart>

                                                    </ResponsiveContainer>

                                                </div>

                                            </div>

                                        )}




                                    </div>

                                </section>



                                <section className="traceability">

                                    <div>

                                        <h2>
                                            Trazabilidad
                                        </h2>

                                        <p>
                                            Información que sustenta la liquidación.
                                        </p>

                                    </div>


                                    <div className="traceability-grid">

                                        {detalle.map((item) => (

                                            <div className="trace-item" key={item.concepto_id}>

                                                <span>
                                                    Concepto
                                                </span>

                                                <strong>
                                                    {item.concepto}
                                                </strong>

                                                <small>
                                                    ID: {item.concepto_id}
                                                </small>

                                                <div className="trace-amount">
                                                    S/{" "}
                                                    {item.monto.toLocaleString(
                                                        "es-PE",
                                                        {
                                                            minimumFractionDigits: 2
                                                        }
                                                    )}
                                                </div>

                                                <div className="trace-source">

                                                    <span>
                                                        Fuente
                                                    </span>

                                                    <strong>
                                                        {item.fuente}
                                                    </strong>

                                                </div>

                                                <div className="trace-document">

                                                    <span>
                                                        Documento fuente
                                                    </span>

                                                    <strong>
                                                        {item.documento_fuente}
                                                    </strong>

                                                </div> <br></br>

                                                <button
                                                    className="evidence-button"
                                                    onClick={() =>
                                                        setEvidencia({
                                                            ...item,
                                                            agente: agenteSeleccionado?.agente,
                                                            agente_id: agenteSeleccionado?.agente_id,
                                                            periodo: fecha
                                                        })
                                                    }
                                                >
                                                    Ver evidencia
                                                </button>

                                            </div>

                                        ))}

                                    </div>


                                </section>



                                {evidencia && (

                                    <div className="evidence-overlay">

                                        <div className="evidence-modal">

                                            <div className="evidence-header">

                                                <div>

                                                    <span className="evidence-label">
                                                        EVIDENCIA DE LIQUIDACIÓN
                                                    </span>

                                                    <h2>
                                                        {evidencia.concepto}
                                                    </h2>

                                                </div>

                                                <button
                                                    className="evidence-close"
                                                    onClick={() => setEvidencia(null)}
                                                >
                                                    ×
                                                </button>

                                            </div>


                                            <div className="evidence-body">



                                                <div className="evidence-summary">

                                                    <div>
                                                        <span>Agente</span>
                                                        <strong>
                                                            {evidencia.agente}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Periodo</span>
                                                        <strong>
                                                            {fecha}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Concepto</span>
                                                        <strong>
                                                            {evidencia.concepto}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>ID Concepto</span>
                                                        <strong>
                                                            {evidencia.concepto_id}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Categoría</span>
                                                        <strong>
                                                            {evidencia.categoria}
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>Monto liquidado</span>
                                                        <strong>
                                                            S/{" "}
                                                            {evidencia.monto.toLocaleString(
                                                                "es-PE",
                                                                { minimumFractionDigits: 2 }
                                                            )}
                                                        </strong>
                                                    </div>

                                                </div>



                                                <div className="evidence-variables">

                                                    <h3>
                                                        Variables que sustentan el registro
                                                    </h3>

                                                    <div className="evidence-variable-grid">

                                                        <div className="evidence-variable">

                                                            <span>
                                                                Energía
                                                            </span>

                                                            <strong>
                                                                {evidencia.energia_mwh.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}{" "}
                                                                MWh
                                                            </strong>

                                                        </div>

                                                        <div className="evidence-variable">

                                                            <span>
                                                                Potencia
                                                            </span>

                                                            <strong>
                                                                {evidencia.potencia_mw.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}{" "}
                                                                MW
                                                            </strong>

                                                        </div>

                                                        <div className="evidence-variable">

                                                            <span>
                                                                Precio
                                                            </span>

                                                            <strong>
                                                                S/{" "}
                                                                {evidencia.precio_mwh.toLocaleString(
                                                                    "es-PE",
                                                                    {
                                                                        minimumFractionDigits: 2
                                                                    }
                                                                )}{" "}
                                                                / MWh
                                                            </strong>

                                                        </div>

                                                    </div>

                                                </div>


                                                <div className="evidence-source">

                                                    <h3>
                                                        Trazabilidad de la información
                                                    </h3>

                                                    <div className="evidence-row">

                                                        <span>
                                                            Fuente
                                                        </span>

                                                        <strong>
                                                            {evidencia.fuente}
                                                        </strong>

                                                    </div>

                                                    <div className="evidence-row">

                                                        <span>
                                                            Documento de respaldo
                                                        </span>

                                                        <strong>
                                                            {evidencia.documento_fuente}
                                                        </strong>

                                                    </div>

                                                </div>



                                            </div>


                                            <div className="evidence-footer">

                                                <button
                                                    className="evidence-close-button"
                                                    onClick={() => setEvidencia(null)}
                                                >
                                                    Cerrar
                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                )}








                            </>

                        )}

                    </section>

                )}

            </main>

            <footer>
                COES Liquidaciones 360 · MVP HackCOES 2026
            </footer>

        </div>

    );
}

export default App;