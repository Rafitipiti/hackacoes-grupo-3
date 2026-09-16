import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { obtenerRadar } from "../api/agente.js";
import { obtenerComparativa } from "../api/empresa.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { PublicacionMensual } from "./PublicacionMensual.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { soles, solesCortos } from "../lib/formato.js";
import { etiquetaProceso } from "../lib/procesos.js";
import { capitalizar, claseNivel, sinEmoji } from "../lib/texto.js";

const COLOR_POS = "var(--pos)";
const COLOR_NEG = "var(--neg)";
const FILAS_POR_PAGINA = 10;

function acortar(texto, largo = 30) {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

function Kpi({ etiqueta, valor, detalle, acento }) {
  return (
    <div className={`kpi${acento ? " kpi-acento" : ""}`}>
      <p className="etiqueta">{etiqueta}</p>
      <p className="kpi-valor cifra">{valor}</p>
      {detalle && <p className="nota">{detalle}</p>}
    </div>
  );
}

function TooltipMovimiento({ active, payload }) {
  if (!active || !payload?.length) return null;
  const fila = payload[0].payload;
  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{fila.nombre}</p>
      <p>Variación: <strong className="cifra">{soles(fila.variacion_absoluta)}</strong></p>
      <p>Factor principal: <strong>{etiquetaProceso(fila.principal_factor)}</strong></p>
    </div>
  );
}

/** Quien movio el mes: las mayores subidas y bajadas en soles. */
function QuienMovioElMes({ agentes, alAnalizar }) {
  const filas = useMemo(() => {
    const ordenados = [...agentes]
      .filter((a) => Number.isFinite(a.variacion_absoluta))
      .sort((a, b) => b.variacion_absoluta - a.variacion_absoluta);
    const subidas = ordenados.slice(0, 5);
    const bajadas = ordenados.slice(-5).reverse();
    return [...subidas, ...bajadas.filter((b) => !subidas.includes(b))];
  }, [agentes]);

  if (!filas.length) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, 34 * filas.length + 40)}>
      <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis type="number" tickFormatter={solesCortos} tick={{ fill: "var(--ink-2)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="agente_id"
          width={210}
          tickFormatter={(id) => acortar(filas.find((f) => f.agente_id === id)?.nombre ?? id)}
          tick={{ fill: "var(--ink-2)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipMovimiento />} cursor={{ fill: "var(--surface-2)" }} />
        <ReferenceLine x={0} stroke="var(--ink-2)" />
        <Bar dataKey="variacion_absoluta" radius={[0, 3, 3, 0]} isAnimationActive={false} onClick={(d) => alAnalizar(d.agente_id)} cursor="pointer">
          {filas.map((f) => <Cell key={f.agente_id} fill={f.variacion_absoluta < 0 ? COLOR_NEG : COLOR_POS} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TablaRadar({ agentes, alAnalizar }) {
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
              <tr key={a.agente_id}>
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

export function Panorama({ irA }) {
  const { periodo, periodos, empresas, setEmpresa } = useSeleccion();

  const [estado, setEstado] = useState({ pericodi: null, radar: null, comparativa: null, error: null });

  useEffect(() => {
    if (!periodo) return;
    let vigente = true;

    Promise.all([obtenerRadar(periodo), obtenerComparativa(periodo).catch(() => null)])
      .then(([radar, comparativa]) => { if (vigente) setEstado({ pericodi: periodo, radar, comparativa, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          pericodi: periodo,
          radar: null,
          comparativa: null,
          error: e.response?.status === 404 ? "No hay radar para este periodo." : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });

    return () => { vigente = false; };
  }, [periodo]);

  const cargando = Boolean(periodo) && estado.pericodi !== periodo;
  const radar = cargando ? null : estado.radar;
  const comparativa = cargando ? null : estado.comparativa;
  const error = cargando ? null : estado.error;

  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  // El radar trae codigos tecnicos; la identidad visible sale del padron.
  const agentes = useMemo(() => {
    const porId = new Map(empresas.map((e) => [e.empresa_id, e]));
    return (radar?.agentes_analizados ?? []).map((a) => {
      const ficha = porId.get(a.agente_id);
      return { ...a, nombre: ficha ? nombreEmpresa(ficha) : a.agente_id, ruc: ficha?.ruc ?? null };
    });
  }, [radar, empresas]);

  const resumen = useMemo(() => {
    const totales = comparativa?.empresas ?? [];
    const pcts = agentes.map((a) => a.variacion_porcentual).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    const mediana = pcts.length ? pcts[Math.floor(pcts.length / 2)] : null;
    const conRecalculo = totales.filter((e) => Math.abs(e.efecto_neto_recalculos ?? 0) > 0.005);
    return {
      liquidado: totales.reduce((s, e) => s + (e.liquidacion_total ?? 0), 0),
      recalculos: totales.reduce((s, e) => s + (e.efecto_neto_recalculos ?? 0), 0),
      conRecalculo: conRecalculo.length,
      mediana,
    };
  }, [comparativa, agentes]);

  function analizar(empresaId) {
    setEmpresa(empresaId);
    irA?.("mi-empresa");
  }

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!radar}>
      <div className="rejilla ejecutivo">
        <section className="hero-periodo">
          <div>
            <p className="etiqueta">Publicación</p>
            <h2>{radar?.periodo ?? periodoActual?.perinombre}</h2>
            <p className="nota">
              <span className="distintivo">{radar?.estado}</span>{" "}
              <span className="distintivo distintivo-revision">{sinEmoji(radar?.version_vigente)}</span>
              {radar?.periodo_anterior && <> · comparado con {radar.periodo_anterior}</>}
            </p>
          </div>
          <div className="kpis">
            <Kpi etiqueta="Empresas liquidadas" valor={radar?.total_agentes ?? "—"} detalle="Con liquidación en el mes" />
            <Kpi etiqueta="Monto liquidado" valor={solesCortos(resumen.liquidado)} detalle="Suma de las liquidaciones del mes" />
            <Kpi etiqueta="Ajustes por recálculo" valor={solesCortos(resumen.recalculos)} detalle={`${resumen.conRecalculo} empresas con revisión posterior`} />
            <Kpi etiqueta="Variación típica" valor={resumen.mediana === null ? "—" : `${resumen.mediana > 0 ? "+" : ""}${resumen.mediana.toFixed(1)}%`} detalle="Mediana frente al mes anterior" />
            <Kpi etiqueta="Alertas relevantes" valor={radar?.total_alertas ?? "—"} detalle="Empresas con relevancia ≥ 60" acento />
          </div>
        </section>

        <Tarjeta etiqueta="Quién movió el mes" titulo="Mayores subidas y bajadas frente al mes anterior">
          <QuienMovioElMes agentes={agentes} alAnalizar={analizar} />
          <p className="nota">Azul sube, rojo baja. Pulsa una barra para abrir el análisis de esa empresa.</p>
        </Tarjeta>

        <PublicacionMensual />

        <Tarjeta etiqueta="Radar de liquidaciones" titulo="Todas las empresas del mes, por relevancia">
          <TablaRadar agentes={agentes} alAnalizar={analizar} />
        </Tarjeta>

      </div>
    </EstadoCarga>
  );
}
