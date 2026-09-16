import { useEffect, useMemo, useRef, useState } from "react";

import { useSeleccion } from "../app/contexto.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { etiquetaProceso } from "../lib/procesos.js";
import { SUGERENCIAS_INICIALES, responder } from "../lib/asistente.js";

/** Una respuesta del asistente: titulo, renglones con cifra y sugerencias. */
function Respuesta({ r, alSugerir, mostrarSugerencias }) {
  return (
    <>
      {r.titulo && <p className="respuesta-titulo">{r.titulo}</p>}
      {r.texto && <p className="respuesta-texto">{r.texto}</p>}
      {r.items?.length > 0 && (
        <ul className={`respuesta-items${r.esInfo ? " respuesta-info" : ""}`}>
          {r.items.map((it, i) => (
            <li key={`${it.etiqueta}-${i}`}>
              <div className="item-texto">
                <span className="item-etiqueta">
                  {it.proceso && <span className="distintivo distintivo-revision">{etiquetaProceso(it.proceso)}</span>}
                  {it.etiqueta}
                </span>
                {it.nota && <span className="item-nota">{it.nota}</span>}
              </div>
              {r.esInfo ? (
                <button type="button" className="chip" onClick={() => alSugerir(it.valor)}>{it.valor}</button>
              ) : (
                <span className={`item-valor cifra tono-${it.tono ?? "neutro"}`}>{it.valor}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {mostrarSugerencias && r.sugerencias?.length > 0 && (
        <div className="chips">
          {r.sugerencias.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => alSugerir(s)}>{s}</button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Asistente flotante: un boton abajo a la derecha que abre una
 * conversacion corta. Responde con reglas sobre los datos del portal
 * (ver lib/asistente.js); no llama a servicios externos. `Info` lista lo
 * que sabe hacer.
 */
export function Asistente({ irA }) {
  const { periodo, periodos, empresa, empresas, setEmpresa } = useSeleccion();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([
    {
      de: "bot",
      r: {
        titulo: "Hola, soy el asistente del portal",
        texto: "Pregúntame por el mes, una empresa o un término. Escribe Info para ver todo lo que puedo hacer.",
        sugerencias: SUGERENCIAS_INICIALES,
      },
    },
  ]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef(null);

  const ctx = useMemo(() => {
    const p = periodos.find((x) => x.pericodi === periodo);
    const e = empresas.find((x) => x.empresa_id === empresa);
    return {
      periodo,
      periodoNombre: p?.perinombre ?? String(periodo ?? ""),
      empresa,
      empresaNombre: e ? nombreEmpresa(e) : null,
      empresas,
      irA,
      setEmpresa,
    };
  }, [periodo, periodos, empresa, empresas, irA, setEmpresa]);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes, abierto, pensando]);

  async function enviar(pregunta) {
    const limpia = pregunta.trim();
    if (!limpia || pensando) return;
    setTexto("");
    setMensajes((m) => [...m, { de: "yo", texto: limpia }]);
    setPensando(true);
    const r = await responder(limpia, ctx);
    if (r.accion?.tipo === "ir") irA?.(r.accion.seccion);
    setMensajes((m) => [...m, { de: "bot", r }]);
    setPensando(false);
  }

  return (
    <>
      <button
        type="button"
        className={`asistente-boton${abierto ? " activo" : ""}`}
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="asistente-panel"
      >
        <span aria-hidden="true">{abierto ? "✕" : "💬"}</span> {abierto ? "Cerrar" : "Asistente"}
      </button>

      {abierto && (
        <section id="asistente-panel" className="asistente-panel" aria-label="Asistente del portal">
          <header className="asistente-cabecera">
            <div>
              <p className="etiqueta">Asistente</p>
              <strong>{ctx.periodoNombre}{ctx.empresaNombre ? ` · ${ctx.empresaNombre}` : ""}</strong>
            </div>
            <button type="button" className="chip" onClick={() => enviar("Info")} title="Qué puedo hacer">Info</button>
          </header>

          <div className="asistente-mensajes" role="log" aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={`burbuja ${m.de}`}>
                {m.de === "yo" ? (
                  <p>{m.texto}</p>
                ) : (
                  <Respuesta r={m.r} alSugerir={enviar} mostrarSugerencias={i === mensajes.length - 1} />
                )}
              </div>
            ))}
            {pensando && <div className="burbuja bot"><p className="respuesta-texto">Consultando…</p></div>}
            <div ref={finRef} />
          </div>

          <form
            className="asistente-entrada"
            onSubmit={(e) => { e.preventDefault(); enviar(texto); }}
          >
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe una pregunta o Info…"
              aria-label="Pregunta al asistente"
              autoComplete="off"
            />
            <button type="submit" className="boton" disabled={!texto.trim() || pensando}>Enviar</button>
          </form>
        </section>
      )}
    </>
  );
}
