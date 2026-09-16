import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { obtenerHistorico } from "../api/empresa.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { MarcaSintetico } from "../componentes/MarcaSintetico.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { aCSV, descargar } from "../lib/exportar.js";
import { soles, solesCortos } from "../lib/formato.js";

const NOMBRE_PROCESO = {
  "LVTA": "Energía Activa",
  "LVTP": "Potencia",
  "LSCIO": "Servicios Complementarios",
  "SST-SCT": "Sistemas Secundarios de Transmisión",
};

const ORDEN_PROCESOS = ["LVTA", "LVTP", "LSCIO", "SST-SCT"];

// Los colores se pasan como var(--token): el SVG los resuelve contra el
// tema activo, asi que el grafico cambia de modo con el resto de la pagina
// sin volver a renderizar.
const COLOR_TOTAL = "var(--serie-1)";
const COLOR_RECALCULOS = "var(--serie-2)";
// El periodo anterior va en el gris de texto secundario, no en el del eje:
// la leyenda de Recharts pinta el nombre con el color de la serie, y --axis
// sobre fondo oscuro no llega a leerse.
const COLOR_ANTERIOR = "var(--ink-muted)";
const COLOR_POS = "var(--pos)";
const COLOR_NEG = "var(--neg)";

// "2025.Enero" -> "Ene 25". En un eje con 20 marcas el nombre completo
// se pisa; la version completa va en el tooltip y en la tabla.
function etiquetaCorta(perinombre) {
  const [anio, mes] = perinombre.split(".");
  return `${mes.slice(0, 3)} ${anio.slice(2)}`;
}

/**
 * Marca del eje X. Es el gemelo SVG de <MarcaSintetico>: mismo tono, mismo
 * trazo discontinuo, porque un span HTML no puede vivir dentro del SVG del
 * grafico. La marca accesible (con explicacion) esta en la tabla de abajo.
 */
function TickPeriodo({ x, y, payload, sinteticos, seleccionado }) {
  const esSintetico = sinteticos.has(payload.value);
  const esSeleccionado = payload.value === seleccionado;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={12}
        textAnchor="middle"
        fontSize={11}
        fontWeight={esSeleccionado ? 700 : 400}
        fill={esSeleccionado ? "var(--ink)" : "var(--ink-2)"}
      >
        {etiquetaCorta(payload.value)}
      </text>
      {esSintetico && (
        <line
          x1={-12}
          x2={12}
          y1={17}
          y2={17}
          stroke="var(--warn)"
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />
      )}
    </g>
  );
}

function TooltipSerie({ active, payload, label, sinteticos }) {
  if (!active || !payload?.length) return null;

  const punto = payload[0].payload;

  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">
        {label}
        {sinteticos.has(label) && <MarcaSintetico />}
      </p>
      <p>
        <span className="muestra" style={{ background: COLOR_TOTAL }} aria-hidden="true" />
        Liquidación total: <strong className="cifra">{soles(punto.liquidacion_total)}</strong>
      </p>
      <p>
        <span className="muestra" style={{ background: COLOR_RECALCULOS }} aria-hidden="true" />
        Efecto neto de recálculos: <strong className="cifra">{soles(punto.efecto_neto_recalculos)}</strong>
        {punto.revisiones > 0 && (
          <span className="nota-tooltip"> · {punto.revisiones} revisión(es)</span>
        )}
      </p>
    </div>
  );
}

function SerieTemporal({ periodos, seleccionado, sinteticos }) {
  return (
    <div className="grafico-serie">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={periodos} margin={{ top: 10, right: 12, bottom: 10, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />

          {/* El mes seleccionado se destaca con una linea vertical, no con
              un color de serie distinto: la linea sigue siendo la misma
              serie. (En un eje de categorias un ReferenceArea con x1 = x2
              tiene ancho cero, por eso no es una banda.) */}
          {seleccionado && (
            <ReferenceLine
              yAxisId="total"
              x={seleccionado}
              stroke="var(--ink-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{
                value: "mes seleccionado",
                position: "insideTopLeft",
                fill: "var(--ink-2)",
                fontSize: 11,
              }}
            />
          )}

          <XAxis
            dataKey="perinombre"
            interval={0}
            height={34}
            tickLine={false}
            axisLine={{ stroke: "var(--axis)" }}
            tick={<TickPeriodo sinteticos={sinteticos} seleccionado={seleccionado} />}
          />
          <YAxis
            yAxisId="total"
            tickFormatter={solesCortos}
            tick={{ fill: "var(--ink-2)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <YAxis
            yAxisId="recalculos"
            orientation="right"
            tickFormatter={solesCortos}
            tick={{ fill: "var(--ink-2)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />

          <Tooltip
            content={<TooltipSerie sinteticos={sinteticos} />}
            cursor={{ stroke: "var(--axis)" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
          />

          <ReferenceLine yAxisId="recalculos" y={0} stroke="var(--axis)" strokeDasharray="3 3" />

          <Line
            yAxisId="total"
            type="monotone"
            dataKey="liquidacion_total"
            name="Liquidación total"
            stroke={COLOR_TOTAL}
            strokeWidth={2.2}
            dot={{ r: 3, fill: COLOR_TOTAL, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="recalculos"
            type="monotone"
            dataKey="efecto_neto_recalculos"
            name="Efecto neto de recálculos"
            stroke={COLOR_RECALCULOS}
            strokeWidth={1.8}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: COLOR_RECALCULOS, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="nota">
        Eje izquierdo: liquidación total del mes. Eje derecho: efecto neto de
        los recálculos publicados después, calculado como suma de los ajustes
        entre revisiones consecutivas (no de los montos restatados, que
        contarían el mes varias veces). Los meses con marca discontinua bajo
        la etiqueta son sintéticos.
      </p>
    </div>
  );
}

function TablaHistorico({ periodos, seleccionado }) {
  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-historico">
        <caption className="solo-lectores">
          Liquidación total y efecto neto de recálculos por periodo
        </caption>
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Estado</th>
            <th className="num">Liquidación total</th>
            <th className="num">Efecto neto de recálculos</th>
            <th className="num">Revisiones</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={p.pericodi} className={p.perinombre === seleccionado ? "fila-seleccionada" : ""}>
              <td>
                {p.perinombre}
                {p.origen === "sintetico" && <MarcaSintetico />}
              </td>
              <td>{p.estado}</td>
              <td className="num">{soles(p.liquidacion_total)}</td>
              <td className="num">{soles(p.efecto_neto_recalculos)}</td>
              <td className="num">{p.revisiones}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TooltipProceso({ active, payload }) {
  if (!active || !payload?.length) return null;

  const fila = payload[0].payload;

  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{fila.periodo}</p>
      <p><strong className="cifra">{soles(fila.monto)}</strong></p>
    </div>
  );
}

/**
 * Un grafico por proceso, cada uno con su propia escala. En un eje comun
 * SST-SCT (decenas de soles) desaparece junto a LVTA (millones): la barra
 * mide menos de un pixel y parece que falta. Con escalas propias cada
 * proceso muestra su "antes y después"; la magnitud relativa entre
 * procesos la da la tabla, con el delta como barra proporcional.
 */
function MiniProceso({ fila, anterior, actual }) {
  const datos = [
    { periodo: anterior.perinombre, monto: fila.anterior, clave: "anterior" },
    { periodo: actual.perinombre, monto: fila.actual, clave: "actual" },
  ];

  const sinMovimiento = fila.anterior === 0 && fila.actual === 0;

  return (
    <div className="mini-proceso">
      <h3>
        {fila.proceso}
        <span className="nombre-proceso"> {NOMBRE_PROCESO[fila.proceso] ?? ""}</span>
      </h3>
      {sinMovimiento ? (
        <p className="nota">Sin importes en ninguno de los dos meses.</p>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="periodo"
              tickFormatter={etiquetaCorta}
              tick={{ fill: "var(--ink-2)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
            />
            <YAxis
              tickFormatter={solesCortos}
              tick={{ fill: "var(--ink-2)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<TooltipProceso />} cursor={{ fill: "var(--surface-2)" }} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Bar dataKey="monto" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {datos.map((d) => (
                <Cell key={d.clave} fill={d.clave === "actual" ? COLOR_TOTAL : COLOR_ANTERIOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="delta-mini cifra">
        Δ {soles(fila.delta)}
      </p>
    </div>
  );
}

/**
 * "Que proceso movio mi liquidación?" El periodo actual contra el
 * anterior, proceso por proceso, y el delta de cada uno (spec 5.2).
 */
function ComparacionProcesos({ actual, anterior }) {
  const filas = useMemo(() => {
    const procesos = new Set([
      ...Object.keys(actual?.procesos ?? {}),
      ...Object.keys(anterior?.procesos ?? {}),
    ]);

    return ORDEN_PROCESOS
      .filter((p) => procesos.has(p))
      .map((proceso) => {
        const a = actual?.procesos?.[proceso] ?? 0;
        const b = anterior?.procesos?.[proceso] ?? 0;
        return { proceso, actual: a, anterior: b, delta: a - b };
      });
  }, [actual, anterior]);

  if (!anterior) {
    return (
      <p className="nota">
        {actual?.perinombre} es el primer periodo con liquidación de esta
        empresa: no hay un mes anterior contra el cual comparar.
      </p>
    );
  }

  const escalaDelta = Math.max(...filas.map((f) => Math.abs(f.delta)), 1);

  return (
    <div className="comparacion-procesos">
      <p className="leyenda-procesos">
        <span className="muestra" style={{ background: COLOR_ANTERIOR }} aria-hidden="true" /> {anterior.perinombre}
        <span className="muestra" style={{ background: COLOR_TOTAL }} aria-hidden="true" /> {actual.perinombre}
        <span className="nota"> · cada proceso con su propia escala</span>
      </p>

      <div className="rejilla-procesos">
        {filas.map((f) => (
          <MiniProceso key={f.proceso} fila={f} anterior={anterior} actual={actual} />
        ))}
      </div>

      <div className="tabla-scroll">
        <table className="tabla">
          <caption className="solo-lectores">
            Liquidación por proceso, {anterior.perinombre} contra {actual.perinombre}
          </caption>
          <thead>
            <tr>
              <th>Proceso</th>
              <th className="num">{anterior.perinombre}</th>
              <th className="num">{actual.perinombre}</th>
              <th className="num">Delta</th>
              <th>Variación</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.proceso}>
                <td>
                  <strong>{f.proceso}</strong>
                  <span className="nombre-proceso"> {NOMBRE_PROCESO[f.proceso] ?? ""}</span>
                </td>
                <td className="num">{soles(f.anterior)}</td>
                <td className="num">{soles(f.actual)}</td>
                <td className="num">
                  <span className="delta-con-barra">
                    <span className="riel-delta" aria-hidden="true">
                      <span
                        className="barra-delta"
                        style={{
                          width: `${(Math.abs(f.delta) / escalaDelta) * 100}%`,
                          background: f.delta < 0 ? COLOR_NEG : COLOR_POS,
                        }}
                      />
                    </span>
                    {soles(f.delta)}
                  </span>
                </td>
                <td><Variacion actual={f.actual} anterior={f.anterior} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="nota">
        El delta se colorea por dirección (azul sube, rojo baja), no por
        juicio: en liquidaciones subir es favorable o no según si la empresa
        cobra o paga. La barra del delta es proporcional entre procesos; los
        gráficos de arriba no lo son.
      </p>
    </div>
  );
}

export function EvolucionEmpresa() {
  const { empresa, periodo, empresas, periodos } = useSeleccion();

  // El historico recuerda de que empresa es: "cargando" se deduce
  // comparando con la empresa elegida, sin bandera aparte.
  const [historico, setHistorico] = useState({ empresa: null, datos: null, error: null });

  useEffect(() => {
    if (!empresa) return;

    let vigente = true;

    async function cargar() {
      try {
        const datos = await obtenerHistorico(empresa);
        if (vigente) setHistorico({ empresa, datos, error: null });
      } catch (e) {
        if (!vigente) return;
        setHistorico({
          empresa,
          datos: null,
          error:
            e.response?.status === 404
              ? "Esta empresa no tiene liquidaciones registradas en ningún periodo."
              : "No se pudo contactar con el servicio de liquidaciones.",
        });
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [empresa]);

  const sinteticos = useMemo(
    () => new Set(periodos.filter((p) => p.origen === "sintetico").map((p) => p.perinombre)),
    [periodos],
  );

  const cargando = Boolean(empresa) && historico.empresa !== empresa;
  const datos = cargando ? null : historico.datos;
  const error = cargando ? null : historico.error;

  const serie = datos?.periodos ?? [];
  const indiceActual = serie.findIndex((p) => p.pericodi === periodo);
  const actual = indiceActual >= 0 ? serie[indiceActual] : null;
  const anterior = indiceActual > 0 ? serie[indiceActual - 1] : null;

  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const titulo = nombreEmpresa(datos ?? ficha) || empresa;

  function bajarCSV() {
    const filas = serie.map((p) => ({
      periodo: p.perinombre,
      perianiomes: p.perianiomes,
      origen: p.origen,
      estado: p.estado,
      liquidacion_total: p.liquidacion_total,
      efecto_neto_recalculos: p.efecto_neto_recalculos,
      revisiones: p.revisiones,
      ...Object.fromEntries(
        ORDEN_PROCESOS.map((pr) => [pr, p.procesos?.[pr] ?? 0]),
      ),
    }));

    descargar(`historico_${empresa}.csv`, aCSV(filas), "text/csv");
  }

  if (!empresa) {
    return (
      <Tarjeta etiqueta="Evolución histórica" titulo="Elige una empresa">
        <p className="nota">
          Busca tu empresa en el selector para ver cómo se comportó su
          liquidación a lo largo de los 20 periodos y qué proceso movió el
          mes seleccionado.
        </p>
      </Tarjeta>
    );
  }

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!datos}>
      <div className="rejilla">
        <Tarjeta
          etiqueta="Evolución histórica"
          titulo={titulo}
          acciones={
            <button
              type="button"
              className="boton-secundario"
              onClick={bajarCSV}
              disabled={!serie.length}
            >
              Descargar CSV
            </button>
          }
        >
          {datos?.ruc && (
            <p className="nota identidad-empresa">
              <span className="cifra">RUC {datos.ruc}</span> · {serie.length} periodos con liquidación
            </p>
          )}
          <SerieTemporal
            periodos={serie}
            seleccionado={actual?.perinombre}
            sinteticos={sinteticos}
          />
          <details className="detalle-tabla">
            <summary>Ver la tabla de los {serie.length} periodos</summary>
            <TablaHistorico periodos={serie} seleccionado={actual?.perinombre} />
          </details>
        </Tarjeta>

        <Tarjeta
          etiqueta="Comparación por proceso"
          titulo={
            actual
              ? `¿Qué proceso movió la liquidación de ${actual.perinombre}?`
              : "Sin liquidación en el periodo seleccionado"
          }
        >
          {actual ? (
            <ComparacionProcesos actual={actual} anterior={anterior} />
          ) : (
            <p className="nota">
              Esta empresa no tiene liquidación en el periodo elegido. Elige
              otro periodo en el selector o mira la serie de arriba.
            </p>
          )}
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
