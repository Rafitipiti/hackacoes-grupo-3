// Asistente del portal: reglas por intencion sobre los datos vivos.
//
// No hay modelo de lenguaje ni servicio externo: cada intencion es un par
// (patrones, respuesta). La respuesta puede consultar la API con el periodo
// y la empresa de la cabecera, y puede pedir una accion (ir a una seccion,
// elegir una empresa). Suficiente para las preguntas que se hacen en una
// presentacion, sin elevar la complejidad del portal.
//
// Forma de una respuesta:
//   { titulo?, texto?, items?: [{ etiqueta, valor, nota?, tono?, proceso? }],
//     sugerencias?: string[], accion?: { tipo: "ir", seccion } }
// `items` se pinta como renglones con la cifra a la derecha; `tono` es
// "pos" | "neg" | "neutro" y solo colorea la cifra.

import { obtenerRadar, obtenerResumenAgente } from "../api/agente.js";
import { obtenerComparativa } from "../api/empresa.js";
import { obtenerPublicacion } from "../api/publicacion.js";
import { obtenerBarras } from "../api/red.js";
import { nombreEmpresa } from "./empresa.js";
import { numero, porcentaje, soles, solesCortos } from "./formato.js";
import { NOMBRE_PROCESO, etiquetaProceso } from "./procesos.js";

export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const tono = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "neutro");
const conSigno = (v) => `${v >= 0 ? "+" : "−"}${soles(Math.abs(v))}`;

// ------------------------------------------------------------------ glosario

const GLOSARIO = [
  {
    patrones: [/\b(que es|que significa|explica).*(lvtea|lvta|energia activa)/, /^lvtea\??$/],
    titulo: "LVTEA · Energía Activa",
    texto: "Valorización de las Transferencias de Energía Activa: liquida la energía que cada empresa inyectó o retiró frente a lo contratado. Es el proceso de mayor monto y el que más mueve el mes.",
    sugerencias: ["¿Qué es LVTP?", "¿Cuáles son los procesos?"],
  },
  {
    patrones: [/\b(que es|que significa|explica).*(lvtp|potencia)/, /^lvtp\??$/],
    titulo: "LVTP · Potencia",
    texto: "Valorización de las Transferencias de Potencia: remunera la capacidad disponible y reparte el peaje por conexión y la compensación a transmisoras por ingreso tarifario.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(lscio|servicios complementarios)/, /^lscio\??$/],
    titulo: "LSCIO · Servicios Complementarios",
    texto: "Servicios Complementarios e Inflexibilidad Operativa: regulación de frecuencia, reserva y sobrecostos de operar unidades fuera de su despacho económico.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(sst|sct|secundarios)/, /^sst-?sct\??$/],
    titulo: "SST-SCT · Sistemas Secundarios de Transmisión",
    texto: "Asigna a generadores y usuarios el pago de los sistemas secundarios y complementarios de transmisión, por criterio de uso y por ingreso tarifario.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(r0|r1|r2|revision|recalculo)/, /\bque (es|son) (las )?revisiones/],
    titulo: "R0, R1, R2… las revisiones",
    texto: "R0 es la liquidación del mes; R1, R2… son recálculos posteriores del mismo mes. Cada revisión restata el mes completo, por eso el ajuste es la diferencia contra la versión anterior, no la suma de montos.",
    sugerencias: ["¿Qué salió en la publicación?", "¿Qué es el monto restatado?"],
  },
  {
    patrones: [/\b(que es|que significa|explica).*(publicacion)/],
    titulo: "La publicación mensual",
    texto: "Cada mes el COES publica la liquidación del mes (R0) más recálculos de meses anteriores. En Panorama cada uno es una tarjeta comparada con su base.",
    accionSugerida: "panorama",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(monto restatado|restatado)/],
    titulo: "Monto restatado",
    texto: "Es el importe completo del mes en su última revisión. No es un ajuste: para saber cuánto cambió hay que restarle la revisión anterior.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(efecto neto|recalculos)/],
    titulo: "Efecto neto de recálculos",
    texto: "La suma de los ajustes entre revisiones consecutivas de un mes: cuánto movieron, en total, las revisiones posteriores a la liquidación original.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(costo marginal|cmg)/],
    titulo: "Costo marginal",
    texto: "El precio de la energía en cada barra del sistema, hora a hora. En Red y precios lo ves por barra y por día, y puedes comparar periodos.",
    sugerencias: ["¿Cuál es el costo marginal?", "Llévame a Red y precios"],
  },
  {
    patrones: [/\b(que es|que significa|explica).*(barra)\b/],
    titulo: "Barra",
    texto: "Un punto de la red eléctrica (una subestación o nivel de tensión) donde se mide el costo marginal. El mapa las pinta según su precio promedio del mes.",
  },
  {
    patrones: [/\b(que es|que significa|explica).*(cci)\b/],
    titulo: "CCI",
    texto: "Código de Cuenta Interbancario, de 20 dígitos: identifica una cuenta para transferencias entre bancos. Se guarda en la ficha de Contactos.",
  },
  {
    patrones: [/\b(que es|de que trata|para que sirve) (esta )?(pagina|portal|web|aplicacion)/, /\bque hace (esta pagina|el portal)/],
    titulo: "Liquidaciones 360",
    texto: "Consolida las liquidaciones del COES en un solo lugar: qué salió cada mes, qué cambió para cada empresa y por qué, con trazabilidad hasta el soporte. Elige publicación y empresa arriba a la derecha.",
    sugerencias: ["!info"],
  },
];

// ----------------------------------------------------------------- secciones

const SECCIONES = [
  { id: "panorama", claves: ["panorama", "inicio", "resumen del sector"], texto: "El mes en un vistazo, la publicación mensual por proceso y el radar de empresas." },
  { id: "mi-empresa", claves: ["mi empresa", "empresa"], texto: "Cómo salió la liquidación de la empresa elegida, qué la movió y si cuadra con su soporte." },
  { id: "evolucion", claves: ["evolucion", "historico", "historia"], texto: "La serie de 20 meses de la empresa, total o por proceso." },
  { id: "procesos", claves: ["procesos", "pagos", "cobros"], texto: "Cuánto paga y cuánto cobra la empresa en cada proceso, y a quién." },
  { id: "comparador", claves: ["comparador", "comparar empresas"], texto: "Varias empresas lado a lado en el mismo mes." },
  { id: "revisiones", claves: ["revisiones", "ciclo"], texto: "Cómo evoluciona una liquidación entre publicaciones." },
  { id: "red", claves: ["red", "precios", "mapa", "costo marginal", "barras"], texto: "Mapa de barras y costo marginal por periodo." },
  { id: "contactos", claves: ["contactos", "ficha", "cuentas"], texto: "Ficha de contacto y cuentas por empresa." },
  { id: "apis", claves: ["api", "apis", "descargas", "descargar", "exportar"], texto: "Consulta y exporta los datos." },
  { id: "calidad", claves: ["calidad", "trazabilidad", "limites"], texto: "Reglas de integridad y límites del dato." },
];

const NOMBRE_SECCION = {
  panorama: "Panorama", "mi-empresa": "Mi empresa", evolucion: "Evolución histórica", procesos: "Procesos",
  comparador: "Comparador", revisiones: "Ciclo y revisiones", red: "Red y precios", contactos: "Contactos",
  apis: "APIs y descargas", calidad: "Calidad y trazabilidad",
};

function buscarEmpresa(texto, ctx) {
  const t = normalizar(texto);
  const ruc = t.match(/\b(20\d{9})\b/);
  if (ruc) {
    const porRuc = ctx.empresas.find((e) => e.ruc === ruc[1]);
    if (porRuc) return porRuc;
  }
  // La mencion mas larga que aparezca en la pregunta gana.
  let mejor = null;
  for (const e of ctx.empresas) {
    const nombre = normalizar(nombreEmpresa(e)).replace(/\b(s\.?a\.?a?\.?c?\.?|s\.?r\.?l\.?|s\.?a\.?)$/g, "").trim();
    const palabras = nombre.split(" ").filter((p) => p.length > 3);
    if (!palabras.length) continue;
    const aciertos = palabras.filter((p) => t.includes(p)).length;
    if (aciertos >= Math.min(2, palabras.length) && (!mejor || aciertos > mejor.aciertos)) {
      mejor = { empresa: e, aciertos };
    }
  }
  return mejor?.empresa ?? null;
}

// ---------------------------------------------------------------- !info

export const INFO = {
  titulo: "Qué puedo hacer",
  texto: "Pregunta en tus palabras o pulsa una sugerencia. Trabajo con la publicación y la empresa elegidas arriba a la derecha.",
  items: [
    { etiqueta: "Quién subió o bajó más", valor: "¿Quién bajó más este mes?", nota: "Las mayores variaciones del mes frente al anterior." },
    { etiqueta: "Cuánto liquidó una empresa", valor: "¿Cuánto liquidó Celepsa?", nota: "Total, variación y lo que más pesó. Acepta razón social o RUC." },
    { etiqueta: "Qué proceso la movió", valor: "¿Qué proceso la movió?", nota: "Para la empresa elegida en la cabecera." },
    { etiqueta: "Qué salió en la publicación", valor: "¿Qué salió en la publicación?", nota: "Liquidación del mes, recálculos y alcance." },
    { etiqueta: "Alertas del mes", valor: "¿Cuántas alertas hay?", nota: "Empresas con relevancia alta y las primeras del radar." },
    { etiqueta: "Costo marginal", valor: "¿Cuál es el costo marginal?", nota: "Promedio del sistema, barra más cara y más barata." },
    { etiqueta: "Glosario", valor: "¿Qué es el monto restatado?", nota: "LVTEA, LVTP, LSCIO, SST-SCT, R1, publicación, CCI…" },
    { etiqueta: "Ir a una sección", valor: "Llévame a Red y precios", nota: "También: “abre Procesos”, “muéstrame Contactos”." },
  ],
  sugerencias: ["¿Quién bajó más este mes?", "¿Qué salió en la publicación?", "¿Cuál es el costo marginal?"],
  esInfo: true,
};

// ------------------------------------------------------------- intenciones

const INTENCIONES = [
  {
    nombre: "info",
    patrones: [/^!?(info|ayuda|help|comandos|opciones)\b/, /\b(que puedes hacer|que sabes hacer|como funcionas|como te uso)\b/, /^hola\b/, /^buen[oa]s/],
    async responder() {
      return INFO;
    },
  },
  {
    nombre: "navegar",
    patrones: [/\b(llevame|ir|abre|abrir|muestrame|mostrar|ve|vamos) (a|al|la|el)?\b/, /\bdonde (veo|esta|encuentro)\b/],
    async responder(t, ctx) {
      const seccion = SECCIONES.find((s) => s.claves.some((c) => t.includes(c)));
      if (!seccion) return null;
      ctx.irA?.(seccion.id);
      return { titulo: `→ ${NOMBRE_SECCION[seccion.id]}`, texto: seccion.texto };
    },
  },
  {
    nombre: "movimientos",
    patrones: [/\b(quien|quienes|cual|cuales|que empresa[s]?) (subio|subieron|bajo|bajaron|mas subio|mas bajo|movio|crecio|cayo)/, /\b(mayores|principales) (subidas|bajadas|variaciones|movimientos)/, /\bsubi(o|eron) mas\b/, /\bbaj(o|aron) mas\b/],
    async responder(t, ctx) {
      const radar = await obtenerRadar(ctx.periodo);
      const agentes = (radar.agentes_analizados ?? []).filter((a) => Number.isFinite(a.variacion_absoluta));
      const nombre = (a) => { const f = ctx.empresas.find((e) => e.empresa_id === a.agente_id); return f ? nombreEmpresa(f) : a.agente_id; };
      const orden = [...agentes].sort((a, b) => b.variacion_absoluta - a.variacion_absoluta);
      const quiereBaja = /baj|cay|redu/.test(t) && !/sub|crec/.test(t);
      const lista = quiereBaja ? orden.slice(-4).reverse() : orden.slice(0, 4);
      return {
        titulo: `${quiereBaja ? "Mayores bajadas" : "Mayores subidas"} · ${radar.periodo}`,
        texto: `Frente a ${radar.periodo_anterior}.`,
        items: lista.map((a) => ({
          etiqueta: nombre(a),
          valor: conSigno(a.variacion_absoluta),
          nota: `${Number.isFinite(a.variacion_porcentual) ? porcentaje(a.variacion_porcentual / 100) : "s/d"} · factor ${etiquetaProceso(a.principal_factor)}`,
          tono: tono(a.variacion_absoluta),
        })),
        sugerencias: [quiereBaja ? "¿Quién subió más este mes?" : "¿Quién bajó más este mes?", "¿Cuántas alertas hay?"],
      };
    },
  },
  {
    nombre: "alertas",
    patrones: [/\b(alertas?|critic[ao]s?|prioridad|revisar)\b/],
    async responder(_t, ctx) {
      const radar = await obtenerRadar(ctx.periodo);
      const nombre = (a) => { const f = ctx.empresas.find((e) => e.empresa_id === a.agente_id); return f ? nombreEmpresa(f) : a.agente_id; };
      const top = [...(radar.agentes_analizados ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 4);
      return {
        titulo: `Alertas · ${radar.periodo}`,
        texto: `${radar.total_alertas} de ${radar.total_agentes} empresas tienen relevancia alta (≥ 60). Las primeras del radar:`,
        items: top.map((a) => ({
          etiqueta: nombre(a),
          valor: `${a.score}/100`,
          nota: `${etiquetaProceso(a.principal_factor)} · ${conSigno(a.variacion_absoluta)}`,
          tono: "neutro",
        })),
        sugerencias: ["Llévame a Panorama", "¿Quién bajó más este mes?"],
      };
    },
  },
  {
    nombre: "publicacion",
    patrones: [/\b(publicacion|que salio|recalculos? (hay|salieron)|cuantos recalculos)/],
    async responder(_t, ctx) {
      const p = await obtenerPublicacion(ctx.periodo, ctx.empresa);
      const r = p.resumen;
      return {
        titulo: `Publicación ${p.publicacion_nombre} · ${ctx.empresa ? ctx.empresaNombre : "todo el sector"}`,
        items: [
          { etiqueta: "Liquidación del mes en curso", valor: solesCortos(r.liquidacion_mes_curso), nota: "Suma de las R0 de los cuatro procesos", tono: "neutro" },
          { etiqueta: "Efecto neto de recálculos", valor: solesCortos(r.efecto_neto_recalculos), nota: `${r.recalculos} recálculos de meses anteriores`, tono: tono(r.efecto_neto_recalculos) },
          { etiqueta: "Alcance hacia atrás", valor: `${r.alcance_meses} meses`, tono: "neutro" },
          { etiqueta: "Variaciones fuertes", valor: String(r.variaciones_fuertes), nota: "Tarjetas que merecen una mirada", tono: "neutro" },
        ],
        texto: ctx.empresa ? "Los montos son el neto de la empresa." : "Sin empresa elegida, cada monto es lo que cobran las acreedoras.",
        sugerencias: ["Llévame a Panorama", "¿Qué es una revisión?"],
      };
    },
  },
  {
    nombre: "liquidacion-empresa",
    patrones: [/\b(cuanto|como) (liquido|salio|le fue|cobra|paga|cobro|pago)\b/, /\bliquidacion de\b/, /\bresultado de\b/, /\btotal de\b/],
    async responder(t, ctx) {
      const empresa = buscarEmpresa(t, ctx) ?? (ctx.empresa ? ctx.empresas.find((e) => e.empresa_id === ctx.empresa) : null);
      if (!empresa) return { titulo: "¿De qué empresa?", texto: "Escribe parte de su razón social o su RUC, o elígela en la cabecera." };
      const r = await obtenerResumenAgente(empresa.empresa_id, ctx.periodo);
      const v = r.variacion;
      const imp = r.impulsores?.principal_incremento ?? r.impulsores?.principal_reduccion;
      const items = [
        { etiqueta: `Liquidación ${r.periodo.perinombre}`, valor: soles(r.resultado.total), tono: "neutro" },
      ];
      if (v?.encontrado) {
        items.push({ etiqueta: `Frente a ${v.periodo_anterior?.perinombre}`, valor: conSigno(v.variacion), nota: `${porcentaje(v.variacion_pct / 100)} · antes ${soles(v.anterior)}`, tono: tono(v.variacion) });
      }
      if (imp) {
        items.push({ etiqueta: "Lo que más pesó", valor: conSigno(imp.variacion), nota: `${imp.valorizacion} · ${imp.concepto}`, tono: tono(imp.variacion), proceso: imp.proceso });
      }
      if (empresa.empresa_id !== ctx.empresa) ctx.setEmpresa?.(empresa.empresa_id);
      return {
        titulo: nombreEmpresa(empresa),
        items,
        sugerencias: ["¿Qué proceso la movió?", "Llévame a Mi empresa"],
      };
    },
  },
  {
    nombre: "proceso-movio",
    patrones: [/\b(que|cual) proceso\b/, /\bque (la|lo) movio\b/, /\bpor que (cambio|subio|bajo)\b/],
    async responder(_t, ctx) {
      if (!ctx.empresa) return { titulo: "Falta la empresa", texto: "Elige una empresa en la cabecera y te digo qué proceso movió su liquidación." };
      const r = await obtenerResumenAgente(ctx.empresa, ctx.periodo);
      const procesos = [...(r.variacion?.procesos ?? [])].sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
      if (!procesos.length) return { titulo: ctx.empresaNombre, texto: `Sin mes anterior para comparar en ${r.periodo.perinombre}.` };
      return {
        titulo: `Qué movió a ${ctx.empresaNombre} · ${r.periodo.perinombre}`,
        items: procesos.map((p) => ({
          etiqueta: NOMBRE_PROCESO[p.proceso] ?? p.proceso,
          proceso: p.proceso,
          valor: conSigno(p.variacion),
          nota: `${porcentaje((p.variacion_pct ?? 0) / 100)} · ${soles(p.anterior)} → ${soles(p.actual)}`,
          tono: tono(p.variacion),
        })),
        sugerencias: ["Llévame a Mi empresa", "¿Qué salió en la publicación?"],
      };
    },
  },
  {
    nombre: "cuantas-empresas",
    patrones: [/\bcuantas empresas\b/, /\bnumero de empresas\b/],
    async responder(_t, ctx) {
      const c = await obtenerComparativa(ctx.periodo).catch(() => null);
      const total = c?.empresas?.length ?? ctx.empresas.length;
      const suma = c ? c.empresas.reduce((s, e) => s + (e.liquidacion_total ?? 0), 0) : null;
      return {
        titulo: `Empresas en ${ctx.periodoNombre}`,
        items: [
          { etiqueta: "Con liquidación en el mes", valor: String(total), tono: "neutro" },
          ...(suma !== null ? [{ etiqueta: "Monto liquidado", valor: solesCortos(suma), tono: "neutro" }] : []),
        ],
        sugerencias: ["Llévame al Comparador"],
      };
    },
  },
  {
    nombre: "costo-marginal",
    patrones: [/\b(costo marginal|cmg|barra mas cara|barra mas barata|precio de la energia)\b/],
    async responder(_t, ctx) {
      const r = await obtenerBarras(ctx.periodo);
      const barras = r.barras;
      const prom = barras.reduce((s, b) => s + b.cmg_promedio, 0) / barras.length;
      const orden = [...barras].sort((a, b) => b.cmg_promedio - a.cmg_promedio);
      const f = (v) => `${numero(v * 1000, 1)} S/·MWh`;
      return {
        titulo: `Costo marginal · ${ctx.periodoNombre}`,
        items: [
          { etiqueta: "Promedio del sistema", valor: f(prom), nota: `${barras.length} barras con dato`, tono: "neutro" },
          { etiqueta: `Más cara · ${orden[0].barrnombre}`, valor: f(orden[0].cmg_promedio), tono: "neg" },
          { etiqueta: `Más barata · ${orden[orden.length - 1].barrnombre}`, valor: f(orden[orden.length - 1].cmg_promedio), tono: "pos" },
        ],
        sugerencias: ["Llévame a Red y precios", "¿Qué es una barra?"],
      };
    },
  },
  {
    nombre: "periodo",
    patrones: [/\b(que|cual) (periodo|mes|publicacion) (es|esta|estoy)/, /\ben que mes estoy\b/],
    async responder(_t, ctx) {
      return {
        titulo: "Selección actual",
        items: [
          { etiqueta: "Publicación", valor: ctx.periodoNombre, tono: "neutro" },
          { etiqueta: "Empresa", valor: ctx.empresaNombre ?? "ninguna", tono: "neutro" },
        ],
        texto: "Cámbialas en el selector de arriba a la derecha.",
      };
    },
  },
  {
    nombre: "procesos-lista",
    patrones: [/\b(cuales|que) (son los )?procesos\b/, /\bprocesos de liquidacion\b/],
    async responder() {
      return {
        titulo: "Los cuatro procesos",
        items: Object.entries(NOMBRE_PROCESO).map(([k, v]) => ({ etiqueta: v, proceso: k, valor: etiquetaProceso(k), tono: "neutro" })),
        texto: "En Procesos ves cuánto paga y cobra una empresa en cada uno.",
        sugerencias: ["¿Qué es LVTEA?", "Llévame a Procesos"],
      };
    },
  },
];

/** Responde una pregunta con la forma descrita arriba. */
export async function responder(pregunta, ctx) {
  const t = normalizar(pregunta);

  for (const g of GLOSARIO) {
    if (g.patrones.some((p) => p.test(t))) {
      return { titulo: g.titulo, texto: g.texto, sugerencias: g.sugerencias };
    }
  }

  for (const intencion of INTENCIONES) {
    if (!intencion.patrones.some((p) => p.test(t))) continue;
    try {
      const r = await intencion.responder(t, ctx);
      if (r) return r;
    } catch {
      return { titulo: "Sin respuesta por ahora", texto: "No pude consultar ese dato. Prueba de nuevo en un momento." };
    }
  }

  // Sin intencion clara: una empresa mencionada vale como pregunta por su liquidacion.
  const empresa = buscarEmpresa(t, ctx);
  if (empresa) return INTENCIONES.find((i) => i.nombre === "liquidacion-empresa").responder(t, ctx);

  const seccion = SECCIONES.find((s) => s.claves.some((c) => t.includes(c)));
  if (seccion) { ctx.irA?.(seccion.id); return { titulo: `→ ${NOMBRE_SECCION[seccion.id]}`, texto: seccion.texto }; }

  return {
    titulo: "No entendí la pregunta",
    texto: "Escribe !info para ver lo que puedo hacer, o prueba una de estas:",
    sugerencias: ["¿Quién bajó más este mes?", "¿Cuánto liquidó Celepsa?", "¿Cuál es el costo marginal?", "!info"],
  };
}

export const SUGERENCIAS_INICIALES = [
  "!info",
  "¿Quién subió más este mes?",
  "¿Qué salió en la publicación?",
  "¿Qué es LVTEA?",
];
