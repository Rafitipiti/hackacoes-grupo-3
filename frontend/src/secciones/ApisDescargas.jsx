import { useState } from "react";

import { API_URL, cliente } from "../api/cliente.js";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { aCSV, descargar } from "../lib/exportar.js";
import { useSeleccion } from "../app/contexto.jsx";
import { nombreEmpresa } from "../lib/empresa.js";

const CATALOGO = [
  {
    grupo: "Catalogos",
    endpoints: [
      { ruta: "/periodos", descripcion: "Los 20 periodos disponibles, con su estado y revisión vigente.", parametros: [] },
      { ruta: "/empresas", descripcion: "El padrón: código técnico, alias, RUC y razón social. Con ?pericodi= devuelve solo las que liquidan en ese periodo, que es lo que usa el selector de la barra lateral.", parametros: [] },
    ],
  },
  {
    grupo: "Red y precios",
    endpoints: [
      { ruta: "/red/barras/{pericodi}", descripcion: "Barras con costo marginal en el mes, con ubicación estimada y promedio, mínimo y máximo del periodo.", parametros: ["pericodi"] },
      { ruta: "/red/cmg/1/{pericodi}", descripcion: "Curva diaria del costo marginal de una barra (aquí la barra 1, TALARA 220) en el periodo, y los periodos con dato.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Contactos",
    endpoints: [
      { ruta: "/contactos", descripcion: "Todas las fichas de contacto guardadas en el libro Excel, con los catálogos de moneda y tipo de cuenta.", parametros: [] },
    ],
  },
  {
    grupo: "Panorama",
    endpoints: [
      { ruta: "/radar/{pericodi}", descripcion: "Variaciones del periodo contra el anterior, por empresa.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Trazabilidad de revisiones",
    endpoints: [
      { ruta: "/revisiones/calendario/{pericodi}", descripcion: "Qué liquidaciones salen en la publicación de ese mes.", parametros: ["pericodi"] },
      { ruta: "/revisiones/cascada/{empresa_id}/{pericodi}", descripcion: "Cadena R0 a R4 de un mes, separada por proceso, con el ajuste de cada salto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/revisiones/impacto/{pericodi}", descripcion: "Cuánto de la publicación es del mes y cuánto viene arrastrado.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Análisis por empresa",
    endpoints: [
      { ruta: "/empresa/pagos-cobros/{empresa_id}/{pericodi}", descripcion: "Cuánto paga y cuánto cobra la empresa en el mes, proceso por proceso, con sus contrapartes. Alimenta la sección Procesos.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/empresas/comparar/{pericodi}", descripcion: "Todas las empresas con liquidación en el mes, lado a lado: liquidación, monto restatado, revisión vigente y efecto neto de recálculos. Alimenta el comparador.", parametros: ["pericodi"] },
      { ruta: "/empresa/historico/{empresa_id}", descripcion: "Los 20 periodos de la empresa: liquidación total, desglose por proceso y efecto neto de los recálculos. Alimenta la evolución histórica y la comparación por proceso.", parametros: ["empresa_id"] },
      { ruta: "/agente/resumen/{empresa_id}/{pericodi}", descripcion: "Resultado del periodo, variación y principales movimientos.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cambios/{empresa_id}/{pericodi}", descripcion: "Qué cambió respecto del periodo anterior, por proceso.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/causas/{empresa_id}/{pericodi}", descripcion: "Descomposicion de la variación en sus causas.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/trazabilidad/{empresa_id}/{pericodi}", descripcion: "Del monto al proceso y del proceso a su fuente.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/integridad/{empresa_id}/{pericodi}", descripcion: "Reglas de validación ejecutadas y su resultado.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/contexto/{empresa_id}/{pericodi}", descripcion: "Energía, mercado y operación del periodo, para contexto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cierre/{empresa_id}/{pericodi}", descripcion: "Si la liquidación está lista para cerrar.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/explicacion/{empresa_id}/{pericodi}", descripcion: "Explicación consolidada de la liquidación: resumen, variación, impulsores y detalle por proceso en un solo texto.", parametros: ["empresa_id", "pericodi"] },
    ],
  },
  {
    grupo: "Análisis por empresa - Energía Activa (LVTEA)",
    endpoints: [
      { ruta: "/agente/causas-lvta/{empresa_id}/{pericodi}", descripcion: "Descompone la variación de Energía Activa por valorización y concepto (factores asociados, no causalidad confirmada).", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/trazabilidad-lvta/{empresa_id}/{pericodi}", descripcion: "Válida que el resultado de Energía Activa cuadre contra su soporte de transferencias por empresa (regla LVTEA-001).", parametros: ["empresa_id", "pericodi"] },
    ],
  },
  {
    grupo: "Análisis por empresa - Servicios Complementarios (LSCIO)",
    endpoints: [
      { ruta: "/agente/causas-concepto/{empresa_id}/{pericodi}", descripcion: "Explica la variación de LSCIO bajando del mecanismo al concepto específico que la origina.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/explicacion-lscio/{empresa_id}/{pericodi}", descripcion: "Explicación consolidada de la variación de LSCIO: del mecanismo al concepto y su evidencia.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/integridad-lscio/{empresa_id}/{pericodi}", descripcion: "Válida que la suma del desglose por mecanismo cuadre con el total de transferencias LSCIO (regla LSCIO-001).", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/integridad-lscio-conceptos/{empresa_id}/{pericodi}", descripcion: "Válida que cada mecanismo LSCIO se pueda reconstruir sumando sus conceptos.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/evidencia-lscio/{empresa_id}/{pericodi}", descripcion: "Registros originales que sustentan un concepto LSCIO puntual y si su suma cuadra con el importe reportado. Además de empresa y periodo, esta ruta pide mecanismo y concepto exactos (no se completan solos: se obtienen del desglose que devuelve integridad-lscio-conceptos).", parametros: ["empresa_id", "pericodi"], sinPrueba: true },
    ],
  },
  {
    grupo: "Servicio",
    endpoints: [
      { ruta: "/", descripcion: "Identifica el servicio y su versión, y apunta a la documentación interactiva.", parametros: [] },
      { ruta: "/health", descripcion: "Estado del servicio.", parametros: [] },
    ],
  },
];

function resolverRuta(ruta, { empresa, periodo }) {
  return ruta
    .replace("{empresa_id}", empresa ?? "EMPRESA_001")
    .replace("{pericodi}", periodo ?? 137);
}

function FichaEndpoint({ endpoint, contexto }) {
  const [respuesta, setRespuesta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const rutaResuelta = resolverRuta(endpoint.ruta, contexto);

  async function probar() {
    setCargando(true);
    setError(null);

    try {
      const { data } = await cliente.get(rutaResuelta);
      setRespuesta(data);
    } catch (e) {
      setError(e.response?.status ? `HTTP ${e.response.status}` : e.message);
    } finally {
      setCargando(false);
    }
  }

  function bajarJSON() {
    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_") || "raiz";
    descargar(`${nombre}.json`, JSON.stringify(respuesta, null, 2), "application/json");
  }

  function bajarCSV() {
    // Se busca el primer arreglo de objetos dentro de la respuesta:
    // algunos endpoints devuelven la lista en la raiz y otros anidada.
    const filas = Array.isArray(respuesta)
      ? respuesta
      : Object.values(respuesta ?? {}).find(
          (v) => Array.isArray(v) && typeof v[0] === "object",
        );

    if (!filas) {
      setError("esta respuesta no es tabular; usa la descarga JSON");
      return;
    }

    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_") || "raiz";
    descargar(`${nombre}.csv`, aCSV(filas), "text/csv");
  }

  return (
    <article className="ficha-endpoint">
      <header>
        <code className="metodo">GET</code>
        <code className="ruta">{endpoint.ruta}</code>
      </header>

      <p className="descripcion">{endpoint.descripcion}</p>

      {endpoint.parametros.length > 0 && (
        <p className="nota">
          Parametros: {endpoint.parametros.join(", ")} — se completan con tu
          seleccion de la barra lateral.
        </p>
      )}

      <p className="url-resuelta cifra">{API_URL}{rutaResuelta}</p>

      {endpoint.parametros.includes("empresa_id") && (
        <p className="nota">
          La ruta lleva el identificador tecnico porque es lo que la API
          espera. Corresponde a{" "}
          <strong>{contexto.alias ?? "la empresa de ejemplo"}</strong>.
        </p>
      )}

      <div className="acciones-endpoint">
        {endpoint.sinPrueba ? (
          <p className="nota">
            Esta ruta necesita mecanismo y concepto exactos, que no salen de la
            barra lateral, así que no se puede probar desde aquí. Tómalos del
            desglose de <code>/agente/integridad-lscio-conceptos</code>.
          </p>
        ) : (
          <button type="button" className="boton" onClick={probar} disabled={cargando}>
            {cargando ? "Consultando…" : "Probar"}
          </button>
        )}

        {respuesta && (
          <>
            <button type="button" className="boton-secundario" onClick={bajarJSON}>
              Descargar JSON
            </button>
            <button type="button" className="boton-secundario" onClick={bajarCSV}>
              Descargar CSV
            </button>
          </>
        )}
      </div>

      {error && <p className="estado-error">{error}</p>}

      {respuesta && (
        <details className="respuesta">
          <summary>Respuesta</summary>
          <pre>{JSON.stringify(respuesta, null, 2).slice(0, 4000)}</pre>
        </details>
      )}
    </article>
  );
}

export function ApisDescargas() {
  const { periodo, empresa, empresas } = useSeleccion();

  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const alias = ficha ? nombreEmpresa(ficha) : undefined;

  return (
    <div className="rejilla">
      <Tarjeta etiqueta="Cómo funciona" titulo="Consulta y exporta los datos">
        <p className="nota">
          Todos los endpoints son <code>GET</code> y devuelven JSON. Las rutas
          se completan con lo que elijas en la barra lateral: hoy periodo{" "}
          <strong>{periodo ?? "—"}</strong> y empresa{" "}
          <strong>{alias ?? "ninguna (se usa una de ejemplo)"}</strong>.
        </p>
        <p className="nota">
          La descarga CSV busca la primera lista de registros dentro de la
          respuesta. Cuando la respuesta no es tabular, usa JSON.
        </p>
        <p className="nota">
          Base: <code className="cifra">{API_URL}</code> · Documentacion
          interactiva en <code className="cifra">{API_URL}/docs</code>
        </p>
      </Tarjeta>

      {CATALOGO.map((grupo) => (
        <Tarjeta key={grupo.grupo} etiqueta="Grupo" titulo={grupo.grupo}>
          <div className="lista-endpoints">
            {grupo.endpoints.map((e) => (
              <FichaEndpoint
                key={e.ruta}
                endpoint={e}
                contexto={{ empresa, periodo, alias }}
              />
            ))}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
