import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { obtenerPagosCobros } from "../api/empresa.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { aCSV, descargar } from "../lib/exportar.js";
import { soles, solesCortos } from "../lib/formato.js";
import { etiquetaProceso } from "../lib/procesos.js";

const COLOR_COBROS = "var(--pos)";
const COLOR_PAGOS = "var(--neg)";

// Que es cada proceso, en una linea, y que valorizaciones trae el cruce.
const PROCESOS = [
  {
    codigo: "LVTA",
    nombre: "Energía Activa",
    largo: "Valorización de las Transferencias de Energía Activa",
    que: "Liquida la energía que cada empresa inyectó o retiró del sistema frente a lo que tenía contratado. Es el proceso de mayor monto y el que más mueve la liquidación de un mes.",
    valorizaciones: ["Transferencias de Energía Activa"],
  },
  {
    codigo: "LVTP",
    nombre: "Potencia",
    largo: "Valorización de las Transferencias de Potencia",
    que: "Remunera la capacidad disponible y reparte el peaje por conexión y la compensación a transmisoras por ingreso tarifario. Muchas contrapartes con montos pequeños.",
    valorizaciones: [
      "Valorización de las Transferencias de Potencia",
      "Liquidación del peaje por conexión",
      "Compensación a transmisoras por ingreso tarifario",
    ],
  },
  {
    codigo: "LSCIO",
    nombre: "Servicios Complementarios",
    largo: "Servicios Complementarios e Inflexibilidad Operativa",
    que: "Cubre la regulación de frecuencia, la reserva y los sobrecostos de operar unidades fuera de su despacho económico. Es carga manual mes a mes del COES, por eso hay meses sin detalle.",
    valorizaciones: ["Transferencias de Servicios Complementarios e Inflexibilidad Operativa"],
  },
  {
    codigo: "SST-SCT",
    nombre: "Sistemas Secundarios y Complementarios de Transmisión",
    largo: "Asignación de responsabilidad de pago SST-SCT",
    que: "Asigna a generadores y usuarios el pago de los sistemas secundarios y complementarios de transmisión, por criterio de uso y por ingreso tarifario.",
    valorizaciones: [
      "Asignación responsabilidad de pago SST-SCT - Criterio de Uso",
      "Asignación responsabilidad de pago SST-SCT - Ingreso Tarifario",
    ],
  },
];

const NOMBRE = Object.fromEntries(PROCESOS.map((p) => [p.codigo, p.nombre]));

function TooltipProceso({ active, payload }) {
  if (!active || !payload?.length) return null;

  const fila = payload[0].payload;

  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{etiquetaProceso(fila.proceso)} · {NOMBRE[fila.proceso]}</p>
      <p>
        <span className="muestra" style={{ background: COLOR_COBROS }} aria-hidden="true" />
        Cobra: <strong className="cifra">{soles(fila.cobros)}</strong>
      </p>
      <p>
        <span className="muestra" style={{ background: COLOR_PAGOS }} aria-hidden="true" />
        Paga: <strong className="cifra">{soles(fila.pagos)}</strong>
      </p>
      <p>Neto: <strong className="cifra">{soles(fila.neto)}</strong></p>
    </div>
  );
}

/** Barras divergentes: pagos hacia la izquierda, cobros hacia la derecha. */
function DiagramaPagosCobros({ procesos }) {
  const datos = procesos.map((p) => ({ ...p, pagosNeg: -p.pagos }));
  const alto = Math.max(160, 52 * datos.length + 60);

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barGap={2}>
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => solesCortos(Math.abs(v))}
          tick={{ fill: "var(--ink-2)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="proceso"
          width={80}
          tickFormatter={etiquetaProceso}
          tick={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipProceso />} cursor={{ fill: "var(--surface-2)" }} />
        <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 12, paddingBottom: 6 }} />
        <ReferenceLine x={0} stroke="var(--ink-2)" />
        <Bar dataKey="pagosNeg" name="Paga" fill={COLOR_PAGOS} stackId="a" isAnimationActive={false} radius={[3, 0, 0, 3]}>
          {datos.map((d) => <Cell key={d.proceso} fill={COLOR_PAGOS} />)}
        </Bar>
        <Bar dataKey="cobros" name="Cobra" fill={COLOR_COBROS} stackId="a" isAnimationActive={false} radius={[0, 3, 3, 0]}>
          {datos.map((d) => <Cell key={d.proceso} fill={COLOR_COBROS} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Contrapartes({ titulo, filas, color }) {
  if (!filas.length) return <p className="nota">Sin {titulo.toLowerCase()} en este proceso.</p>;

  const total = filas.reduce((s, f) => s + f.monto, 0);
  const escala = Math.max(...filas.map((f) => f.monto), 1);

  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-contrapartes">
        <caption className="solo-lectores">{titulo}</caption>
        <thead>
          <tr>
            <th>{titulo}</th>
            <th>Valorización</th>
            <th className="num">Monto</th>
            <th className="num">% del proceso</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={`${f.empresa_id}-${f.valorizacion}-${i}`}>
              <td>
                <strong>{nombreEmpresa(f)}</strong>
                {f.ruc && <span className="ruc cifra"> RUC {f.ruc}</span>}
              </td>
              <td className="valorizacion">{f.valorizacion}</td>
              <td className="num">
                <span className="delta-con-barra">
                  <span className="riel-delta" aria-hidden="true">
                    <span className="barra-delta" style={{ width: `${(f.monto / escala) * 100}%`, background: color }} />
                  </span>
                  {soles(f.monto)}
                </span>
              </td>
              <td className="num">{total ? `${((f.monto / total) * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FichaProcesos() {
  return (
    <Tarjeta etiqueta="Los cuatro procesos" titulo="Qué liquida cada uno">
      <div className="rejilla rejilla-2">
        {PROCESOS.map((p) => (
          <article key={p.codigo} className="ficha-proceso">
            <h3>
              <span className="distintivo distintivo-revision">{etiquetaProceso(p.codigo)}</span> {p.nombre}
            </h3>
            <p className="nota">{p.largo}</p>
            <p>{p.que}</p>
            <ul className="valorizaciones">
              {p.valorizaciones.map((v) => <li key={v}>{v}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </Tarjeta>
  );
}

export function Procesos() {
  const { empresa, periodo, periodos, empresas, setPeriodo } = useSeleccion();

  const [estado, setEstado] = useState({ clave: null, datos: null, error: null });
  const clave = empresa && periodo ? `${empresa}-${periodo}` : null;

  useEffect(() => {
    if (!clave) return;

    let vigente = true;

    async function cargar() {
      try {
        const datos = await obtenerPagosCobros(empresa, periodo);
        if (vigente) setEstado({ clave, datos, error: null });
      } catch (e) {
        if (!vigente) return;
        setEstado({
          clave,
          datos: null,
          error:
            e.response?.status === 404
              ? "No hay detalle de pagos y cobros registrado para esta empresa."
              : "No se pudo contactar con el servicio de liquidaciones.",
        });
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [clave, empresa, periodo]);

  const cargando = Boolean(clave) && estado.clave !== clave;
  const datos = cargando ? null : estado.datos;
  const error = cargando ? null : estado.error;

  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const titulo = nombreEmpresa(datos ?? ficha) || empresa;
  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  const disponibles = useMemo(
    () =>
      (datos?.periodos_disponibles ?? [])
        .map((pc) => periodos.find((p) => p.pericodi === pc))
        .filter(Boolean),
    [datos, periodos],
  );

  function bajarCSV() {
    const filas = [];
    for (const p of datos?.procesos ?? []) {
      for (const c of p.contrapartes_pago) {
        filas.push({ proceso: etiquetaProceso(p.proceso), sentido: "paga", contraparte: c.razon_social ?? c.alias, ruc: c.ruc, valorizacion: c.valorizacion, monto: c.monto });
      }
      for (const c of p.contrapartes_cobro) {
        filas.push({ proceso: etiquetaProceso(p.proceso), sentido: "cobra", contraparte: c.razon_social ?? c.alias, ruc: c.ruc, valorizacion: c.valorizacion, monto: c.monto });
      }
    }
    descargar(`pagos_cobros_${empresa}_${periodo}.csv`, aCSV(filas), "text/csv");
  }

  if (!empresa) {
    return (
      <div className="rejilla">
        <Tarjeta etiqueta="Pagos y cobros" titulo="Elige una empresa">
          <p className="nota">
            Busca tu empresa en el selector para ver cuánto paga y cuánto
            cobra en cada proceso, y a quién.
          </p>
        </Tarjeta>
        <FichaProcesos />
      </div>
    );
  }

  // Una empresa que no aparece en el cruce bilateral no es un error del
  // servicio: se dice en su tarjeta y se deja la ficha de los procesos,
  // que es informacion util con o sin detalle.
  if (error) {
    return (
      <div className="rejilla">
        <Tarjeta etiqueta="Pagos y cobros" titulo={titulo}>
          <p className="nota">{error}</p>
          <p className="nota">
            El detalle de pagos y cobros está disponible para una parte de las
            empresas y periodos. Elige otra empresa o revisa su evolución
            histórica.
          </p>
        </Tarjeta>
        <FichaProcesos />
      </div>
    );
  }

  return (
    <EstadoCarga cargando={cargando} error={null} vacio={!datos}>
      <div className="rejilla">
        <Tarjeta
          etiqueta={`Pagos y cobros · ${periodoActual?.perinombre ?? ""}`}
          titulo={titulo}
          acciones={
            <button type="button" className="boton-secundario" onClick={bajarCSV} disabled={!datos?.procesos?.length}>
              Descargar CSV
            </button>
          }
        >
          {datos?.ruc && (
            <p className="nota identidad-empresa"><span className="cifra">RUC {datos.ruc}</span></p>
          )}

          {datos?.procesos?.length ? (
            <>
              <div className="resumen-pagos">
                <div className="bloque-impacto">
                  <p className="etiqueta">Cobra</p>
                  <p className="cifra grande" style={{ color: "var(--pos-texto)" }}>{soles(datos.total_cobros)}</p>
                </div>
                <div className="bloque-impacto">
                  <p className="etiqueta">Paga</p>
                  <p className="cifra grande" style={{ color: "var(--neg-texto)" }}>{soles(datos.total_pagos)}</p>
                </div>
                <div className="bloque-impacto">
                  <p className="etiqueta">Neto</p>
                  <p className="cifra grande">{soles(datos.neto)}</p>
                  <p className="nota">{datos.neto >= 0 ? "La empresa cobra más de lo que paga." : "La empresa paga más de lo que cobra."}</p>
                </div>
              </div>

              <DiagramaPagosCobros procesos={datos.procesos} />

              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Proceso</th>
                      <th className="num">Cobra</th>
                      <th className="num">Paga</th>
                      <th className="num">Neto</th>
                      <th className="num">Contrapartes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.procesos.map((p) => (
                      <tr key={p.proceso}>
                        <td><strong>{etiquetaProceso(p.proceso)}</strong> <span className="nombre-proceso">{NOMBRE[p.proceso]}</span></td>
                        <td className="num">{soles(p.cobros)}</td>
                        <td className="num">{soles(p.pagos)}</td>
                        <td className="num">{soles(p.neto)}</td>
                        <td className="num">{new Set([...p.contrapartes_pago, ...p.contrapartes_cobro].map((c) => c.empresa_id)).size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota">
                Transferencias entre empresas, de la deudora a la acreedora: cada
                monto es un pago de la primera y un cobro de la segunda.
              </p>
            </>
          ) : (
            <>
              <p className="nota">
                No hay detalle de pagos y cobros de {titulo} en {periodoActual?.perinombre}.
                {disponibles.length > 0 && " Sí lo hay en estos meses:"}
              </p>
              {disponibles.length > 0 && (
                <div className="chips">
                  {disponibles.map((p) => (
                    <button key={p.pericodi} type="button" className="chip" onClick={() => setPeriodo(p.pericodi)}>
                      {p.perinombre}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Tarjeta>

        {datos?.procesos?.map((p) => (
          <Tarjeta key={p.proceso} etiqueta={etiquetaProceso(p.proceso)} titulo={`${NOMBRE[p.proceso]} · a quién paga y de quién cobra`}>
            <div className="rejilla rejilla-2">
              <div>
                <h3 style={{ color: "var(--pos-texto)" }}>Cobra {soles(p.cobros)}</h3>
                <Contrapartes titulo="Cobros de" filas={p.contrapartes_cobro} color={COLOR_COBROS} />
              </div>
              <div>
                <h3 style={{ color: "var(--neg-texto)" }}>Paga {soles(p.pagos)}</h3>
                <Contrapartes titulo="Pagos a" filas={p.contrapartes_pago} color={COLOR_PAGOS} />
              </div>
            </div>
          </Tarjeta>
        ))}

        <FichaProcesos />
      </div>
    </EstadoCarga>
  );
}
