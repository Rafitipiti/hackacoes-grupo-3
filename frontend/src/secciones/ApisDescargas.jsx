import { useState } from "react";

import { API_URL, cliente } from "../api/cliente.js";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { aCSV, descargar } from "../lib/exportar.js";
import { useSeleccion } from "../app/contexto.jsx";

const CATALOGO = [
  {
    grupo: "Catalogos",
    endpoints: [
      { ruta: "/periodos", descripcion: "Los 20 periodos disponibles, con su estado y revision vigente.", parametros: [] },
      { ruta: "/empresas", descripcion: "Las 131 empresas con su alias visible.", parametros: [] },
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
      { ruta: "/revisiones/calendario/{pericodi}", descripcion: "Que liquidaciones salen en la publicacion de ese mes.", parametros: ["pericodi"] },
      { ruta: "/revisiones/cascada/{empresa_id}/{pericodi}", descripcion: "Cadena R0 a R4 de un mes, separada por proceso, con el ajuste de cada salto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/revisiones/impacto/{pericodi}", descripcion: "Cuanto de la publicacion es del mes y cuanto viene arrastrado.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Analisis por empresa",
    endpoints: [
      { ruta: "/agente/resumen/{empresa_id}/{pericodi}", descripcion: "Resultado del periodo, variacion y principales movimientos.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cambios/{empresa_id}/{pericodi}", descripcion: "Que cambio respecto del periodo anterior, por proceso.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/causas/{empresa_id}/{pericodi}", descripcion: "Descomposicion de la variacion en sus causas.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/trazabilidad/{empresa_id}/{pericodi}", descripcion: "Del monto al proceso y del proceso a su fuente.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/integridad/{empresa_id}/{pericodi}", descripcion: "Reglas de validacion ejecutadas y su resultado.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/contexto/{empresa_id}/{pericodi}", descripcion: "Energia, mercado y operacion del periodo, para contexto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cierre/{empresa_id}/{pericodi}", descripcion: "Si la liquidacion esta lista para cerrar.", parametros: ["empresa_id", "pericodi"] },
    ],
  },
  {
    grupo: "Servicio",
    endpoints: [
      { ruta: "/health", descripcion: "Estado del servicio.", parametros: [] },
      { ruta: "/docs", descripcion: "Documentacion interactiva generada por FastAPI.", parametros: [] },
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
    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_");
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

    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_");
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

      <div className="acciones-endpoint">
        <button type="button" className="boton" onClick={probar} disabled={cargando}>
          {cargando ? "Consultando…" : "Probar"}
        </button>

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

  const alias = empresas.find((e) => e.empresa_id === empresa)?.alias;

  return (
    <div className="rejilla">
      <Tarjeta etiqueta="Como funciona" titulo="Consulta y exporta los datos">
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
                contexto={{ empresa, periodo }}
              />
            ))}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
