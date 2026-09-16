import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

import LegacyApp from "../LegacyApp.jsx";
import { obtenerContexto, obtenerResumenAgente, obtenerTrazabilidad } from "../api/agente.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { numero, porcentaje, soles } from "../lib/formato.js";
import { COLOR_PROCESO, NOMBRE_PROCESO, etiquetaProceso } from "../lib/procesos.js";
import { capitalizar, claseNivel, sinEmoji } from "../lib/texto.js";

function TooltipHistorico({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{p.perinombre}</p>
      <p><strong className="cifra">{soles(p.monto)}</strong></p>
    </div>
  );
}

function Sparkline({ historico }) {
  if (!historico?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={72}>
      <LineChart data={historico} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip content={<TooltipHistorico />} cursor={{ stroke: "var(--axis)" }} />
        <Line type="monotone" dataKey="monto" stroke="var(--serie-1)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--serie-1)", strokeWidth: 0 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Que la movio: cada proceso con su barra anterior/actual y su variacion. */
function ProcesosQueMovieron({ procesos }) {
  const filas = [...procesos].sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
  const escala = Math.max(...filas.flatMap((f) => [Math.abs(f.actual), Math.abs(f.anterior)]), 1);

  return (
    <div className="procesos-movieron">
      {filas.map((f) => (
        <div key={f.proceso} className="fila-proceso-mov">
          <div className="cabecera-fila">
            <strong>{etiquetaProceso(f.proceso)}</strong>
            <span className="nombre-proceso">{NOMBRE_PROCESO[f.proceso] ?? ""}</span>
            <span className="espaciador" />
            <Variacion actual={f.actual} anterior={f.anterior} />
          </div>
          <div className="pares-barras" aria-hidden="true">
            <span className="riel"><span className="barra anterior" style={{ width: `${(Math.abs(f.anterior) / escala) * 100}%` }} /></span>
            <span className="riel"><span className="barra actual" style={{ width: `${(Math.abs(f.actual) / escala) * 100}%`, background: COLOR_PROCESO[f.proceso] ?? "var(--serie-1)" }} /></span>
          </div>
          <div className="cifras-fila cifra">
            <span className="nota">antes {soles(f.anterior)}</span>
            <span>ahora <strong>{soles(f.actual)}</strong></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Callout({ etiqueta, dato, clase }) {
  if (!dato) return null;
  return (
    <div className={`callout ${clase}`}>
      <p className="etiqueta">{etiqueta}</p>
      <p className="callout-titulo">{etiquetaProceso(dato.proceso)} · {dato.valorizacion}</p>
      <p className="nota">{dato.concepto}</p>
      <p className="cifra callout-cifra">{soles(dato.variacion)} <span className="nota">({porcentaje((dato.variacion_pct ?? 0) / 100)})</span></p>
    </div>
  );
}

function estadoTrazabilidad(t) {
  return t?.estado ?? t?.validacion?.estado ?? (t?.encontrado ? "Con soporte" : "Sin dato");
}

function Acordeon({ titulo, resumen, distintivo, abierto, children }) {
  return (
    <details className="acordeon" open={abierto}>
      <summary>
        <span className="acordeon-titulo">{titulo}</span>
        {distintivo && <span className={`distintivo ${claseNivel(distintivo)}`}>{capitalizar(distintivo)}</span>}
        {resumen && <span className="nota acordeon-resumen">{resumen}</span>}
      </summary>
      <div className="acordeon-cuerpo">{children}</div>
    </details>
  );
}

export function MiEmpresa({ irA }) {
  const { empresa, periodo, periodos, empresas } = useSeleccion();

  const clave = empresa && periodo ? `${empresa}-${periodo}` : null;
  const [estado, setEstado] = useState({ clave: null, resumen: null, trazabilidad: null, contexto: null, error: null });
  const [detallado, setDetallado] = useState(false);

  useEffect(() => {
    if (!clave) return;
    let vigente = true;

    Promise.all([
      obtenerResumenAgente(empresa, periodo),
      obtenerTrazabilidad(empresa, periodo).catch(() => null),
      obtenerContexto(empresa, periodo).catch(() => null),
    ])
      .then(([resumen, trazabilidad, contexto]) => { if (vigente) setEstado({ clave, resumen, trazabilidad, contexto, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          clave, resumen: null, trazabilidad: null, contexto: null,
          error: e.response?.status === 404 ? "Esta empresa no tiene liquidación en el periodo elegido." : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });

    return () => { vigente = false; };
  }, [clave, empresa, periodo]);

  const cargando = Boolean(clave) && estado.clave !== clave;
  const r = cargando ? null : estado.resumen;
  const traza = cargando ? null : estado.trazabilidad;
  const ctx = cargando ? null : estado.contexto;
  const error = cargando ? null : estado.error;

  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const titulo = ficha ? nombreEmpresa(ficha) : empresa;
  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  const procesosVar = useMemo(() => r?.variacion?.procesos ?? [], [r]);
  const integridad = r?.integridad?.estado;
  const cierre = r?.cierre?.estado;
  const trazas = traza?.trazabilidad ? Object.entries(traza.trazabilidad) : [];
  const observadas = trazas.filter(([, t]) => !/OK/i.test(String(estadoTrazabilidad(t)))).length;

  if (!empresa) {
    return (
      <Tarjeta etiqueta="Mi empresa" titulo="Elige una empresa">
        <p className="nota">
          Busca tu empresa en la cabecera para ver cómo salió su liquidación, qué la movió,
          si cuadra con su soporte y si puede avanzar al cierre.
        </p>
      </Tarjeta>
    );
  }

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!r}>
      <div className="rejilla ejecutivo">
        <section className="hero-periodo hero-empresa">
          <div>
            <p className="etiqueta">{periodoActual?.perinombre} · {r?.periodo?.estado}</p>
            <h2>{titulo}</h2>
            <p className="nota">
              {ficha?.ruc && <span className="cifra">RUC {ficha.ruc} · </span>}
              <span className="distintivo distintivo-revision">{sinEmoji(r?.periodo?.version_vigente)}</span>{" "}
              {integridad && <span className={`distintivo ${claseNivel(integridad.nivel || integridad.codigo)}`}>Integridad: {capitalizar(integridad.codigo)}</span>}{" "}
              {cierre && <span className={`distintivo ${claseNivel(cierre.nivel || cierre.codigo)}`}>Cierre: {capitalizar(cierre.codigo)}</span>}
            </p>
          </div>
          <div className="kpis kpis-empresa">
            <div className="kpi kpi-acento">
              <p className="etiqueta">Liquidación del mes</p>
              <p className="kpi-valor cifra">{soles(r?.resultado?.total)}</p>
              <p className="nota">
                {r?.variacion?.encontrado ? (
                  <>
                    <Variacion actual={r.variacion.actual} anterior={r.variacion.anterior} /> frente a {r.variacion.periodo_anterior?.perinombre} ({soles(r.variacion.anterior)})
                  </>
                ) : "Sin mes anterior para comparar"}
              </p>
            </div>
            <div className="kpi kpi-sparkline">
              <p className="etiqueta">Últimos {r?.resultado?.historico?.length ?? 0} meses</p>
              <Sparkline historico={r?.resultado?.historico} />
              <button type="button" className="enlace" onClick={() => irA?.("evolucion")}>Ver la evolución completa →</button>
            </div>
          </div>
        </section>

        <div className="rejilla rejilla-2">
          <Tarjeta etiqueta="Qué la movió" titulo="Cada proceso frente al mes anterior">
            {procesosVar.length ? <ProcesosQueMovieron procesos={procesosVar} /> : <p className="nota">Sin mes anterior para comparar.</p>}
          </Tarjeta>
          <Tarjeta etiqueta="Impulsores" titulo="El movimiento que más pesó">
            <div className="callouts">
              <Callout etiqueta="Principal incremento" dato={r?.impulsores?.principal_incremento} clase="callout-pos" />
              <Callout etiqueta="Principal reducción" dato={r?.impulsores?.principal_reduccion} clase="callout-neg" />
              {!r?.impulsores?.principal_incremento && !r?.impulsores?.principal_reduccion && (
                <p className="nota">Sin movimientos destacados este mes.</p>
              )}
            </div>
            {r?.impulsores?.encontrado && (
              <p className="nota">
                Los principales movimientos explican <strong className="cifra">{soles(r.impulsores.impacto_principales)}</strong> de
                una variación total de <strong className="cifra">{soles(r.impulsores.variacion_total)}</strong>.
              </p>
            )}
          </Tarjeta>
        </div>

        <Tarjeta etiqueta="Paso a paso" titulo="Del resumen a la evidencia">
          <Acordeon titulo="¿Por qué cambió? Movimientos por concepto" resumen={`${r?.impulsores?.movimientos?.length ?? 0} movimientos`} abierto>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Proceso</th><th>Valorización · concepto</th><th className="num">Anterior</th><th className="num">Actual</th><th>Variación</th></tr>
                </thead>
                <tbody>
                  {(r?.impulsores?.movimientos ?? []).map((m, i) => (
                    <tr key={`${m.proceso}-${m.concepto}-${i}`}>
                      <td><strong>{etiquetaProceso(m.proceso)}</strong></td>
                      <td>{m.valorizacion}<span className="nota"> · {m.concepto}</span></td>
                      <td className="num">{soles(m.anterior)}</td>
                      <td className="num">{soles(m.actual)}</td>
                      <td><Variacion actual={m.actual} anterior={m.anterior} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Acordeon>

          <Acordeon
            titulo="¿Cuadra con su soporte? Trazabilidad por proceso"
            distintivo={observadas ? "OBSERVACION" : trazas.length ? "OK" : null}
            resumen={trazas.length ? `${trazas.length - observadas} de ${trazas.length} procesos cuadran` : "Sin trazabilidad"}
          >
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Proceso</th><th>Cómo se valida</th><th className="num">Resultado</th><th className="num">Soporte / esperado</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {trazas.map(([proceso, t]) => {
                    const soporte = typeof t.soporte === "number" ? t.soporte : typeof t.esperado === "number" ? t.esperado : null;
                    const est = estadoTrazabilidad(t);
                    return (
                      <tr key={proceso}>
                        <td><strong>{etiquetaProceso(proceso)}</strong><span className="nombre-proceso"> {NOMBRE_PROCESO[proceso]}</span></td>
                        <td className="nota">{t.relacion_validada ?? capitalizar(t.tipo)}</td>
                        <td className="num">{soles(t.resultado)}</td>
                        <td className="num">{soporte === null ? "—" : soles(soporte)}</td>
                        <td><span className={`distintivo ${claseNivel(est)}`}>{capitalizar(est)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Acordeon>

          <Acordeon
            titulo="¿Puede cerrar? Integridad y cierre"
            distintivo={cierre?.nivel || cierre?.codigo}
            resumen={integridad ? `${r.integridad.metricas?.reglas_ok ?? 0} de ${r.integridad.metricas?.reglas_ejecutadas ?? 0} reglas OK` : undefined}
          >
            <div className="rejilla rejilla-2">
              <div>
                <h3>{sinEmoji(integridad?.titulo) || "Integridad"}</h3>
                <p>{sinEmoji(integridad?.mensaje)}</p>
                {(r?.integridad?.alertas ?? []).length > 0 && (
                  <ul className="lista-alertas">
                    {r.integridad.alertas.map((a, i) => <li key={i}>{sinEmoji(typeof a === "string" ? a : a.mensaje ?? a.titulo ?? JSON.stringify(a))}</li>)}
                  </ul>
                )}
              </div>
              <div>
                <h3>{sinEmoji(cierre?.titulo) || "Cierre"}</h3>
                <p>{sinEmoji(cierre?.mensaje) || `Estado: ${capitalizar(cierre?.codigo)}`}</p>
                {r?.cierre?.recomendacion && <p className="nota">{sinEmoji(r.cierre.recomendacion)}</p>}
              </div>
            </div>
          </Acordeon>

          <Acordeon titulo="¿Qué pasaba en el sistema? Contexto del mes" resumen={ctx?.encontrado ? "Energía, precio y operación" : "Sin contexto"}>
            {ctx?.encontrado ? (
              <div className="contexto">
                <div className="kpi">
                  <p className="etiqueta">Energía entregada</p>
                  <p className="kpi-valor cifra">{numero(ctx.energia?.entregas?.actual, 1)} <span className="nota">GWh</span></p>
                  <p className="nota"><Variacion actual={ctx.energia?.entregas?.actual} anterior={ctx.energia?.entregas?.anterior} /> frente al mes anterior</p>
                </div>
                <div className="kpi">
                  <p className="etiqueta">Costo marginal promedio</p>
                  <p className="kpi-valor cifra">{numero((ctx.mercado?.promedio?.actual ?? 0) * 1000, 1)} <span className="nota">S/ por MWh</span></p>
                  <p className="nota"><Variacion actual={ctx.mercado?.promedio?.actual} anterior={ctx.mercado?.promedio?.anterior} /> · rango {numero((ctx.mercado?.minimo ?? 0) * 1000, 0)}–{numero((ctx.mercado?.maximo ?? 0) * 1000, 0)}</p>
                </div>
                <div className="kpi">
                  <p className="etiqueta">Operación</p>
                  <p className="kpi-valor cifra">{ctx.operacion?.puntos_entrega ?? "—"} <span className="nota">puntos de entrega</span></p>
                  <p className="nota">{ctx.operacion?.dias_entrega ?? 0} días con entrega · {ctx.operacion?.dias_retiro ?? 0} con retiro</p>
                </div>
                <p className="nota contexto-nota">{sinEmoji(ctx.nota)}</p>
              </div>
            ) : <p className="nota">No hay contexto de energía y mercado para esta empresa en el mes.</p>}
          </Acordeon>
        </Tarjeta>

        <Tarjeta etiqueta="Análisis detallado" titulo={detallado ? "Flujo completo A1 → A7" : "¿Necesitas ir al fondo?"}
          acciones={
            <button type="button" className="boton-secundario" onClick={() => setDetallado((d) => !d)}>
              {detallado ? "Ocultar análisis detallado" : "Abrir análisis detallado"}
            </button>
          }
        >
          {detallado ? (
            <LegacyApp key={`agente-${empresa}-${periodo}`} modoInicial="agente" empresaInicial={empresa} periodoInicial={periodo} />
          ) : (
            <p className="nota">
              El flujo completo recorre resultado, variación, causas, trazabilidad, integridad,
              contexto y cierre paso a paso, con la evidencia de cada concepto. Lo de arriba es su
              resumen; abre el detalle solo si necesitas sustentar una cifra.
            </p>
          )}
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
