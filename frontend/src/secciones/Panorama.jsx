import { useEffect, useMemo, useState } from "react";

import { obtenerRadar } from "../api/agente.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { BloquesPublicacion, DetalleTarjeta, usePublicacion } from "./PublicacionMensual.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { soles, solesCortos } from "../lib/formato.js";
import { etiquetaProceso } from "../lib/procesos.js";
import { capitalizar, claseNivel, sinEmoji } from "../lib/texto.js";

const FILAS_POR_PAGINA = 10;

function Kpi({ etiqueta, valor, detalle, acento, color }) {
  return (
    <div className={`kpi${acento ? " kpi-acento" : ""}`}>
      <p className="etiqueta">{etiqueta}</p>
      <p className="kpi-valor cifra" style={color ? { color } : undefined}>{valor}</p>
      {detalle && <p className="nota">{detalle}</p>}
    </div>
  );
}

const colorSigno = (v) => (v === null || v === undefined || v === 0 ? undefined : v > 0 ? "var(--pos-texto)" : "var(--neg-texto)");

function TablaRadar({ agentes, alAnalizar, empresaElegida }) {
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(1);

  const visibles = useMemo(() => {
    const texto = filtro.trim().toLocaleLowerCase("es");
    return agentes
      .filter((a) => !texto || a.nombre.toLocaleLowerCase("es").includes(texto) || (a.ruc ?? "").includes(texto))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || Math.abs(b.variacion_absoluta) - Math.abs(a.variacion_absoluta));
  }, [agentes, filtro]);

  const paginas = Math.max(1, Math.ceil(visibles.length / FILAS_POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const pagina_filas = visibles.slice((actual - 1) * FILAS_POR_PAGINA, actual * FILAS_POR_PAGINA);

  return (
    <>
      <div className="acciones-lista">
        <input
          type="search"
          placeholder="Buscar empresa o RUC…"
          value={filtro}
          onChange={(e) => { setFiltro(e.target.value); setPagina(1); }}
          aria-label="Buscar empresa en el radar"
          className="buscador"
        />
        <span className="nota contador">{visibles.length} empresas · ordenadas por relevancia</span>
      </div>
      <div className="tabla-scroll">
        <table className="tabla tabla-radar">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Variación</th>
              <th className="num">Impacto</th>
              <th className="num">Relevancia</th>
              <th>Nivel</th>
              <th>Factor principal</th>
              <th><span className="solo-lectores">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {pagina_filas.map((a) => (
              <tr key={a.agente_id} className={a.agente_id === empresaElegida ? "fila-seleccionada" : ""}>
                <td>
                  <strong>{a.nombre}</strong>
                  {a.ruc && <span className="ruc cifra"> RUC {a.ruc}</span>}
                </td>
                <td>
                  <Variacion
                    delta={a.variacion_absoluta}
                    pct={Number.isFinite(a.variacion_porcentual) ? a.variacion_porcentual / 100 : null}
                  />
                </td>
                <td className="num">{soles(a.variacion_absoluta)}</td>
                <td className="num"><strong>{a.score ?? "—"}</strong><span className="nota">/100</span></td>
                <td><span className={`distintivo ${claseNivel(a.nivel)}`}>{capitalizar(a.nivel)}</span></td>
                <td>
                  <strong>{etiquetaProceso(a.principal_factor)}</strong>
                  <span className="nota"> {soles(a.variacion_principal_factor)}</span>
                </td>
                <td>
                  <button type="button" className="boton-secundario boton-analizar" onClick={() => alAnalizar(a.agente_id)}>
                    Analizar →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div className="paginacion">
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={actual === 1}>← Anterior</button>
          <span className="nota">Página {actual} de {paginas}</span>
          <button type="button" className="boton-secundario" onClick={() => setPagina((p) => Math.min(paginas, p + 1))} disabled={actual === paginas}>Siguiente →</button>
        </div>
      )}
    </>
  );
}

/**
 * Panorama: una sola franja de indicadores y las tarjetas de la
 * publicacion, alimentadas por la misma fuente. Sin empresa elegida cuentan
 * el sector; con empresa, esa empresa. El radar de relevancia aporta el
 * numero de empresas, las alertas y la variacion frente al mes anterior.
 */
export function Panorama({ irA }) {
  const { periodo, periodos, empresa, empresas, setEmpresa } = useSeleccion();

  const [radarEstado, setRadarEstado] = useState({ pericodi: null, radar: null, error: null });
  const publicacion = usePublicacion(periodo, empresa);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    if (!periodo) return;
    let vigente = true;
    obtenerRadar(periodo)
      .then((radar) => { if (vigente) setRadarEstado({ pericodi: periodo, radar, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setRadarEstado({
          pericodi: periodo, radar: null,
          error: e.response?.status === 404 ? "No hay radar para este periodo." : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });
    return () => { vigente = false; };
  }, [periodo]);

  // Al cambiar de publicacion o de empresa, la tarjeta abierta ya no aplica.
  const [claveVista, setClaveVista] = useState(publicacion.clave);
  if (publicacion.clave !== claveVista) {
    setClaveVista(publicacion.clave);
    setAbierta(null);
  }

  const cargandoRadar = Boolean(periodo) && radarEstado.pericodi !== periodo;
  const radar = cargandoRadar ? null : radarEstado.radar;
  const periodoActual = periodos.find((p) => p.pericodi === periodo);
  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const nombre = ficha ? nombreEmpresa(ficha) : null;

  // El radar trae codigos tecnicos; la identidad visible sale del padron.
  const agentes = useMemo(() => {
    const porId = new Map(empresas.map((e) => [e.empresa_id, e]));
    return (radar?.agentes_analizados ?? []).map((a) => {
      const f = porId.get(a.agente_id);
      return { ...a, nombre: f ? nombreEmpresa(f) : a.agente_id, ruc: f?.ruc ?? null };
    });
  }, [radar, empresas]);

  const propio = empresa ? agentes.find((a) => a.agente_id === empresa) ?? null : null;

  const mediana = useMemo(() => {
    const pcts = agentes.map((a) => a.variacion_porcentual).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    return pcts.length ? pcts[Math.floor(pcts.length / 2)] : null;
  }, [agentes]);

  function analizar(empresaId) {
    setEmpresa(empresaId);
    irA?.("mi-empresa");
  }

  if (abierta) {
    return <DetalleTarjeta publicacion={periodo} item={abierta} empresaId={empresa} alVolver={() => setAbierta(null)} />;
  }

  const d = publicacion.datos;
  const resumen = d?.resumen;
  const cargando = cargandoRadar || publicacion.cargando;
  const error = cargando ? null : publicacion.error ?? (radar ? null : radarEstado.error);

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!d && !radar}>
      <div className="rejilla ejecutivo">
        <section className="hero-periodo">
          <div>
            <p className="etiqueta">Publicación</p>
            <h2>{d?.publicacion_nombre ?? periodoActual?.perinombre}</h2>
            <p className="nota">
              {radar?.version_vigente && <span className="distintivo distintivo-revision">{sinEmoji(radar.version_vigente)}</span>}
              {nombre ? <> · <strong>{nombre}</strong></> : <> · todo el sector</>}
              {radar?.periodo_anterior && <> · comparado con {radar.periodo_anterior}</>}
            </p>
            <p className="nota">
              {nombre
                ? "Cada monto es el neto de la empresa: positivo si cobra, negativo si paga."
                : "Sin empresa elegida, cada monto es lo que cobran las empresas acreedoras: el volumen que mueve la liquidación."}
            </p>
          </div>
          <div className="kpis">
            <Kpi
              etiqueta="Liquidación del mes"
              valor={solesCortos(resumen?.liquidacion_mes_curso)}
              detalle="Suma de las R0 de los cuatro procesos"
              color={nombre ? colorSigno(resumen?.liquidacion_mes_curso) : undefined}
              acento
            />
            <Kpi
              etiqueta="Efecto de los recálculos"
              valor={solesCortos(resumen?.efecto_neto_recalculos)}
              detalle={`${resumen?.recalculos ?? 0} recálculos de meses anteriores · hasta ${resumen?.alcance_meses ?? 0} meses atrás`}
              color={colorSigno(resumen?.efecto_neto_recalculos)}
            />
            {nombre ? (
              <Kpi
                etiqueta="Frente al mes anterior"
                valor={propio && Number.isFinite(propio.variacion_porcentual) ? `${propio.variacion_porcentual > 0 ? "+" : ""}${propio.variacion_porcentual.toFixed(1)}%` : "—"}
                detalle={propio ? `${soles(propio.variacion_absoluta)} · factor principal ${etiquetaProceso(propio.principal_factor)}` : "Sin variación calculada"}
                color={colorSigno(propio?.variacion_absoluta)}
              />
            ) : (
              <Kpi etiqueta="Empresas liquidadas" valor={radar?.total_agentes ?? "—"} detalle="Con liquidación en el mes" />
            )}
            {nombre ? (
              <div className="kpi">
                <p className="etiqueta">Relevancia</p>
                <p className="kpi-valor cifra">{propio?.score ?? "—"}<span className="nota">/100</span></p>
                <p className="nota">{propio ? <span className={`distintivo ${claseNivel(propio.nivel)}`}>{capitalizar(propio.nivel)}</span> : "Fuera del radar"}</p>
              </div>
            ) : (
              <Kpi
                etiqueta="Variación típica"
                valor={mediana === null ? "—" : `${mediana > 0 ? "+" : ""}${mediana.toFixed(1)}%`}
                detalle="Mediana frente al mes anterior"
              />
            )}
            <Kpi
              etiqueta={nombre ? "Variaciones fuertes" : "Alertas relevantes"}
              valor={nombre ? (resumen?.variaciones_fuertes ?? "—") : (radar?.total_alertas ?? "—")}
              detalle={nombre ? "Tarjetas que merecen una mirada" : "Empresas con relevancia ≥ 60"}
            />
          </div>
        </section>

        {d ? (
          <>
            <p className="nota nota-publicacion">
              Cada mes el COES publica la liquidación del mes (R0) y recálculos de meses anteriores (R1, R2…).
              La R0 se compara con la última revisión conocida del mes anterior; un recálculo, con su versión inmediata anterior.
              Pulsa una tarjeta para ver qué provocó la variación.
            </p>
            <BloquesPublicacion datos={d} alAbrir={setAbierta} />
          </>
        ) : (
          <p className="estado">{publicacion.error}</p>
        )}

        {radar && (
          <Tarjeta etiqueta="Radar de liquidaciones" titulo={nombre ? `Todas las empresas del mes · ${nombre} resaltada` : "Todas las empresas del mes, por relevancia"}>
            <TablaRadar agentes={agentes} alAnalizar={analizar} empresaElegida={empresa} />
          </Tarjeta>
        )}
      </div>
    </EstadoCarga>
  );
}
