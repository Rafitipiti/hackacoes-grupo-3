import { useEffect, useMemo, useState } from "react";

import { obtenerDetallePublicacion, obtenerPublicacion } from "../api/publicacion.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { porcentaje, soles, solesCortos } from "../lib/formato.js";
import { COLOR_PROCESO, NOMBRE_PROCESO, etiquetaProceso } from "../lib/procesos.js";

const COLOR_POS = "var(--pos)";
const COLOR_NEG = "var(--neg)";

/** Una tarjeta de la publicacion: una liquidacion (R0) o un recalculo (Rn). */
function TarjetaLiquidacion({ item, alAbrir }) {
  const acento = COLOR_PROCESO[item.proceso] ?? "var(--serie-1)";
  const cadena = Array.from({ length: item.revision_maxima + 1 }, (_, i) => i);

  return (
    <button
      type="button"
      className={`cuadrante${item.revision === 0 ? " cuadrante-r0" : ""}`}
      style={{ "--acento": acento }}
      onClick={() => alAbrir(item)}
    >
      <div className="cuadrante-top">
        <div>
          <p className="cuadrante-mes">{item.perinombre}</p>
          <p className="nota">{item.tipo === "liquidacion" ? "liquidación del mes" : "recálculo"}</p>
        </div>
        <span className={`distintivo ${item.revision === 0 ? "distintivo-revision" : ""}`}>R{item.revision}</span>
      </div>
      <p className="cuadrante-monto cifra" style={{ color: item.monto >= 0 ? "var(--pos-texto)" : "var(--neg-texto)" }}>
        {soles(item.monto)}
      </p>
      <div className="cuadrante-var">
        <Variacion actual={item.monto} anterior={item.base} />
        {item.delta !== null && <span className="cifra nota">{item.delta >= 0 ? "+" : "−"}{soles(Math.abs(item.delta))}</span>}
      </div>
      <p className="nota">{item.base_etiqueta ? `vs ${item.base_etiqueta}` : "sin comparación"}</p>
      {item.fuerte && <span className="distintivo distintivo-aviso">Variación fuerte</span>}
      <div className="cuadrante-pie">
        <span className="cadena-rev" aria-label={`Revisiones R0 a R${item.revision_maxima}`}>
          {cadena.map((r) => <i key={r} className={r === item.revision ? "on" : ""} />)}
          <span className="nota">R0–R{item.revision_maxima}</span>
        </span>
        <span className="ver">Analizar →</span>
      </div>
    </button>
  );
}

/** Barras divergentes: la variacion de cada componente, cero al centro. */
function GraficoImpacto({ componentes }) {
  const datos = componentes.filter((c) => c.delta !== null && Math.abs(c.delta) > 0.005);
  if (datos.length < 2) return null;

  const max = Math.max(...datos.map((c) => Math.abs(c.delta)), 1e-9);

  return (
    <ul className="impacto" aria-label="Variación por componente, ordenada por impacto">
      {datos.map((c) => {
        const ancho = (Math.abs(c.delta) / max) * 50;
        const positivo = c.delta >= 0;
        return (
          <li key={c.componente}>
            <span className="impacto-etiqueta">{c.componente}</span>
            <span className="impacto-riel" aria-hidden="true">
              <span className="impacto-cero" />
              <span
                className="impacto-barra"
                style={{
                  width: `${ancho}%`,
                  left: positivo ? "50%" : `${50 - ancho}%`,
                  background: positivo ? COLOR_POS : COLOR_NEG,
                }}
              />
            </span>
            <span className="impacto-valor cifra" style={{ color: positivo ? "var(--pos-texto)" : "var(--neg-texto)" }}>
              {positivo ? "+" : "−"}{solesCortos(Math.abs(c.delta))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DetalleTarjeta({ publicacion, item, empresaId, alVolver }) {
  const [estado, setEstado] = useState({ clave: null, datos: null, error: null });
  const clave = `${publicacion}-${item.proceso}-${item.pericodi}-${item.revision}-${empresaId ?? ""}`;

  useEffect(() => {
    let vigente = true;
    obtenerDetallePublicacion(publicacion, item.proceso, item.pericodi, item.revision, empresaId)
      .then((d) => { if (vigente) setEstado({ clave, datos: d, error: null }); })
      .catch(() => { if (vigente) setEstado({ clave, datos: null, error: "No se pudo obtener el detalle de esta liquidación." }); });
    return () => { vigente = false; };
  }, [clave, publicacion, item, empresaId]);

  const cargando = estado.clave !== clave;
  const d = cargando ? null : estado.datos;
  const acento = COLOR_PROCESO[item.proceso] ?? "var(--serie-1)";
  const movidas = d?.componentes.filter((c) => Math.abs(c.delta ?? 0) > 0.005).length ?? 0;

  return (
    <div className="rejilla detalle-publicacion">
      <div className="miga">
        <button type="button" className="boton-secundario" onClick={alVolver}>← Volver a la publicación</button>
        <span className="nota">
          Publicación <strong>{d?.publicacion_nombre}</strong> › <strong>{etiquetaProceso(item.proceso)} · {NOMBRE_PROCESO[item.proceso]}</strong> › <strong>{item.perinombre} R{item.revision}</strong>
        </span>
      </div>

      <section className="hero-periodo" style={{ "--acento": acento }}>
        <div>
          <p className="etiqueta">{etiquetaProceso(item.proceso)} · {item.tipo === "liquidacion" ? "liquidación del mes" : "recálculo"}</p>
          <h2>{item.perinombre} <span style={{ color: acento }}>R{item.revision}</span></h2>
        </div>
        <div className="kpis">
          <div className="kpi">
            <p className="etiqueta">Monto de esta revisión</p>
            <p className="kpi-valor cifra" style={{ color: item.monto >= 0 ? "var(--pos-texto)" : "var(--neg-texto)" }}>{soles(item.monto)}</p>
            <p className="nota">{item.revision === 0 ? "Liquidación mensual" : `Revisión ${String(item.revision).padStart(2, "0")}`}</p>
          </div>
          <div className="kpi">
            <p className="etiqueta">Se compara contra</p>
            <p className="kpi-valor cifra">{item.base === null ? "—" : soles(item.base)}</p>
            <p className="nota">{item.base_etiqueta ?? "sin comparación"}</p>
          </div>
          <div className="kpi kpi-acento">
            <p className="etiqueta">Variación</p>
            <p className="kpi-valor cifra">{item.delta === null ? "—" : `${item.delta >= 0 ? "+" : "−"}${soles(Math.abs(item.delta))}`}</p>
            <p className="nota"><Variacion actual={item.monto} anterior={item.base} /></p>
          </div>
        </div>
      </section>

      <EstadoCarga cargando={cargando} error={cargando ? null : estado.error} vacio={!cargando && !d}>
        <Tarjeta etiqueta="¿Qué provocó la variación?" titulo="Componentes de la liquidación, ordenados de mayor a menor impacto en soles">
          {d && (
            <>
              <p className="nota">
                {movidas} de {d.componentes.length} componentes con variación
                {item.base_etiqueta ? ` · ${item.perinombre} R${item.revision} frente a ${item.base_etiqueta}` : ""}.
              </p>
              <GraficoImpacto componentes={d.componentes} />
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th className="num">{item.base_etiqueta ? `Base (${item.base_etiqueta})` : "Base"}</th>
                      <th className="num">R{item.revision}</th>
                      <th className="num">Δ</th>
                      <th>Δ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.componentes.map((c) => (
                      <tr key={c.componente}>
                        <td><strong>{c.componente}</strong></td>
                        <td className="num">{c.previo === null ? "—" : soles(c.previo)}</td>
                        <td className="num">{c.actual === null ? "—" : soles(c.actual)}</td>
                        <td className="num" style={{ color: c.delta === null ? undefined : c.delta >= 0 ? "var(--pos-texto)" : "var(--neg-texto)" }}>
                          {c.delta === null ? "—" : `${c.delta >= 0 ? "+" : "−"}${soles(Math.abs(c.delta))}`}
                        </td>
                        <td>{c.delta_pct === null ? "—" : porcentaje(c.delta_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Tarjeta>

        {d && (
          <Tarjeta etiqueta="Historial" titulo={`Revisiones de ${item.perinombre} en ${etiquetaProceso(item.proceso)}`}>
            <p className="nota">Todas las versiones publicadas de este mes liquidado y su efecto acumulado.</p>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Revisión</th><th>Sale en</th><th className="num">Monto restatado</th><th className="num">Δ vs versión previa</th><th>Δ %</th></tr>
                </thead>
                <tbody>
                  {d.historial.map((h) => (
                    <tr key={h.revision} className={h.en_esta_publicacion ? "fila-seleccionada" : ""} style={h.futura ? { opacity: 0.45 } : undefined}>
                      <td>
                        <strong>R{h.revision}</strong>
                        {h.en_esta_publicacion && <span className="distintivo distintivo-revision"> en esta publicación</span>}
                        {h.futura && <span className="nota"> (aún no publicada)</span>}
                      </td>
                      <td>{h.publicacion_nombre}</td>
                      <td className="num">{soles(h.monto)}</td>
                      <td className="num">{h.delta === null ? "—" : `${h.delta >= 0 ? "+" : "−"}${soles(Math.abs(h.delta))}`}</td>
                      <td>{h.delta_pct === null ? "—" : porcentaje(h.delta_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        )}
      </EstadoCarga>
    </div>
  );
}

export function PublicacionMensual() {
  const { periodo, empresa, empresas } = useSeleccion();

  const clave = periodo ? `${periodo}-${empresa ?? ""}` : null;
  const [estado, setEstado] = useState({ clave: null, datos: null, error: null });
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    obtenerPublicacion(periodo, empresa)
      .then((d) => { if (vigente) setEstado({ clave, datos: d, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          clave, datos: null,
          error: e.response?.status === 404
            ? "Esta publicación no contiene liquidaciones para la selección actual."
            : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });
    return () => { vigente = false; };
  }, [clave, periodo, empresa]);

  // Al cambiar de publicacion o de empresa, la tarjeta abierta ya no aplica.
  const [claveVista, setClaveVista] = useState(clave);
  if (clave !== claveVista) {
    setClaveVista(clave);
    setAbierta(null);
  }

  const cargando = Boolean(clave) && estado.clave !== clave;
  const d = cargando ? null : estado.datos;
  const error = cargando ? null : estado.error;

  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const alcance = useMemo(() => (empresa && ficha ? nombreEmpresa(ficha) : "todo el sector"), [empresa, ficha]);

  if (abierta) {
    return <DetalleTarjeta publicacion={periodo} item={abierta} empresaId={empresa} alVolver={() => setAbierta(null)} />;
  }

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!d}>
      <div className="rejilla publicacion">
        <Tarjeta etiqueta={`Publicación mensual · ${d?.publicacion_nombre ?? ""}`} titulo={`Qué salió en esta publicación para ${alcance}`}>
          <p className="nota">
            Cada mes el COES publica la liquidación del mes (R0) y recálculos de meses anteriores (R1, R2…).
            La R0 se compara con la última revisión conocida del mes anterior; un recálculo, con su versión inmediata anterior.
            Pulsa una tarjeta para ver qué provocó la variación.
            {d?.alcance === "sector"
              ? " Sin empresa elegida, cada monto es lo que cobran las empresas acreedoras: el volumen que mueve esa liquidación."
              : " Con una empresa elegida, cada monto es su neto: positivo si cobra, negativo si paga."}
          </p>
          <div className="kpis kpis-publicacion">
            <div className="kpi kpi-acento">
              <p className="etiqueta">Liquidación del mes en curso</p>
              <p className="kpi-valor cifra">{solesCortos(d?.resumen.liquidacion_mes_curso)}</p>
              <p className="nota">Suma de las R0 de los cuatro procesos</p>
            </div>
            <div className="kpi">
              <p className="etiqueta">Efecto neto de recálculos</p>
              <p className="kpi-valor cifra">{solesCortos(d?.resumen.efecto_neto_recalculos)}</p>
              <p className="nota">{d?.resumen.recalculos} recálculos de meses anteriores</p>
            </div>
            <div className="kpi">
              <p className="etiqueta">Alcance hacia atrás</p>
              <p className="kpi-valor cifra">{d?.resumen.alcance_meses} <span className="nota">meses</span></p>
              <p className="nota">Hasta dónde llegan los recálculos</p>
            </div>
            <div className="kpi">
              <p className="etiqueta">Variaciones fuertes</p>
              <p className="kpi-valor cifra">{d?.resumen.variaciones_fuertes}</p>
              <p className="nota">Tarjetas que merecen una mirada</p>
            </div>
          </div>
        </Tarjeta>

        {d?.procesos.map((bloque) => (
          <section key={bloque.proceso} className="bloque-proceso" style={{ "--acento": COLOR_PROCESO[bloque.proceso] }}>
            <header className="bloque-proceso-cab">
              <h3>
                <span className="distintivo distintivo-revision">{etiquetaProceso(bloque.proceso)}</span>
                {NOMBRE_PROCESO[bloque.proceso]}
              </h3>
              <span className="nota">
                {bloque.items.filter((i) => i.revision === 0).length} liquidación del mes · {bloque.items.filter((i) => i.revision > 0).length} recálculos
              </span>
            </header>
            {bloque.items.length ? (
              <div className="cuadrantes">
                {bloque.items.map((item) => (
                  <TarjetaLiquidacion key={`${item.pericodi}-${item.revision}`} item={item} alAbrir={setAbierta} />
                ))}
              </div>
            ) : (
              <p className="nota">Este proceso no publicó nada este mes para la selección actual.</p>
            )}
          </section>
        ))}
      </div>
    </EstadoCarga>
  );
}
