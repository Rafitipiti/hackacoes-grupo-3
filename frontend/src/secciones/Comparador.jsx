import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { obtenerComparativa } from "../api/empresa.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { Variacion } from "../componentes/Variacion.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { aCSV, descargar } from "../lib/exportar.js";
import { soles, solesCortos } from "../lib/formato.js";

const COLOR_LIQUIDACION = "var(--serie-1)";
const COLOR_RESTATADO = "var(--serie-3)";

// Cuantas se marcan al entrar. Una pantalla vacia no invita a comparar;
// ocho barras se leen de un vistazo y se pueden limpiar con un clic.
const PRESELECCION = 8;

function acortar(texto, largo = 34) {
  if (!texto) return "";
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

function TooltipComparador({ active, payload }) {
  if (!active || !payload?.length) return null;

  const fila = payload[0].payload;

  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">{nombreEmpresa(fila)}</p>
      <p className="nota-tooltip cifra">RUC {fila.ruc}</p>
      <p>
        <span className="muestra" style={{ background: COLOR_LIQUIDACION }} aria-hidden="true" />
        Liquidación del mes: <strong className="cifra">{soles(fila.liquidacion_total)}</strong>
      </p>
      <p>
        <span className="muestra" style={{ background: COLOR_RESTATADO }} aria-hidden="true" />
        Monto restatado: <strong className="cifra">{soles(fila.monto_restatado)}</strong>
      </p>
      <p>Revisión vigente: <strong>{fila.revision_nombre ?? "—"}</strong></p>
    </div>
  );
}

function GraficoComparativo({ filas }) {
  const alto = Math.max(160, 36 * filas.length + 60);

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart
        data={filas}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        barGap={3}
      >
        <CartesianGrid stroke="var(--grid)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={solesCortos}
          tick={{ fill: "var(--ink-2)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="empresa_id"
          width={220}
          tickFormatter={(id) => acortar(nombreEmpresa(filas.find((f) => f.empresa_id === id)))}
          tick={{ fill: "var(--ink-2)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TooltipComparador />} cursor={{ fill: "var(--surface-2)" }} />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="square"
          wrapperStyle={{ fontSize: 12, paddingBottom: 6 }}
        />
        <ReferenceLine x={0} stroke="var(--axis)" />
        <Bar
          dataKey="liquidacion_total"
          name="Liquidación del mes"
          fill={COLOR_LIQUIDACION}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="monto_restatado"
          name="Monto restatado (última revisión)"
          fill={COLOR_RESTATADO}
          radius={[0, 3, 3, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ListaEmpresas({ empresas, seleccionadas, alCambiar, alTodas, alLimpiar }) {
  const [filtro, setFiltro] = useState("");

  const visibles = useMemo(() => {
    const texto = filtro.trim().toLocaleLowerCase("es");

    return empresas
      .filter(
        (e) =>
          !texto ||
          nombreEmpresa(e).toLocaleLowerCase("es").includes(texto) ||
          (e.ruc ?? "").includes(texto),
      )
      .sort((a, b) => nombreEmpresa(a).localeCompare(nombreEmpresa(b), "es", { sensitivity: "base" }));
  }, [empresas, filtro]);

  return (
    <div className="lista-comparador">
      <label className="etiqueta" htmlFor="filtro-comparador">Buscar</label>
      <input
        id="filtro-comparador"
        type="search"
        placeholder="Razón social o RUC…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />

      <div className="acciones-lista">
        <button type="button" className="boton-secundario" onClick={() => alTodas(visibles)}>
          Seleccionar todas
        </button>
        <button type="button" className="boton-secundario" onClick={alLimpiar} disabled={seleccionadas.size === 0}>
          Limpiar
        </button>
        <span className="nota contador">{seleccionadas.size} de {empresas.length}</span>
      </div>

      <ul className="casillas" aria-label="Empresas con liquidación en el periodo">
        {visibles.map((e) => {
          const id = `cmp-${e.empresa_id}`;
          return (
            <li key={e.empresa_id}>
              <input
                id={id}
                type="checkbox"
                checked={seleccionadas.has(e.empresa_id)}
                onChange={() => alCambiar(e.empresa_id)}
              />
              <label htmlFor={id}>
                <span className="nombre">{nombreEmpresa(e)}</span>
                <span className="ruc cifra">RUC {e.ruc ?? "—"}</span>
              </label>
            </li>
          );
        })}
        {visibles.length === 0 && <li className="nota">Sin coincidencias.</li>}
      </ul>
    </div>
  );
}

export function Comparador({ irA }) {
  const { periodo, empresa, setEmpresa } = useSeleccion();

  // La comparativa recuerda de que periodo es: "cargando" se deduce
  // comparando con el periodo elegido, sin bandera aparte.
  const [comparativa, setComparativa] = useState({ pericodi: null, datos: null, error: null });
  const [seleccionadas, setSeleccionadas] = useState(() => new Set());

  useEffect(() => {
    if (!periodo) return;

    let vigente = true;

    async function cargar() {
      try {
        const datos = await obtenerComparativa(periodo);
        if (!vigente) return;

        setComparativa({ pericodi: periodo, datos, error: null });

        // Preseleccion: la empresa elegida en la cabecera, si la hay, mas
        // las de mayor monto restatado hasta completar ocho.
        const porMonto = [...datos.empresas].sort(
          (a, b) => Math.abs(b.monto_restatado ?? 0) - Math.abs(a.monto_restatado ?? 0),
        );
        const iniciales = new Set(empresa ? [empresa] : []);
        for (const e of porMonto) {
          if (iniciales.size >= PRESELECCION) break;
          iniciales.add(e.empresa_id);
        }
        setSeleccionadas(iniciales);
      } catch (e) {
        if (!vigente) return;
        setComparativa({
          pericodi: periodo,
          datos: null,
          error:
            e.response?.status === 404
              ? "El servicio no devolvió la comparativa de este periodo."
              : "No se pudo contactar con el servicio de liquidaciones.",
        });
      }
    }

    cargar();

    return () => { vigente = false; };
    // La empresa de la cabecera solo influye en la preseleccion inicial;
    // cambiarla despues no debe recargar ni pisar lo que el usuario marco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const cargando = Boolean(periodo) && comparativa.pericodi !== periodo;
  const datos = cargando ? null : comparativa.datos;
  const error = cargando ? null : comparativa.error;

  const empresas = useMemo(() => datos?.empresas ?? [], [datos]);
  const filas = useMemo(
    () =>
      empresas
        .filter((e) => seleccionadas.has(e.empresa_id))
        .sort((a, b) => (b.monto_restatado ?? 0) - (a.monto_restatado ?? 0)),
    [empresas, seleccionadas],
  );

  function alternar(id) {
    setSeleccionadas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function analizar(id) {
    setEmpresa(id);
    irA?.("mi-empresa");
  }

  function bajarCSV() {
    const salida = filas.map((f) => ({
      empresa_id: f.empresa_id,
      ruc: f.ruc,
      razon_social: f.razon_social,
      periodo: datos?.perinombre,
      revision_vigente: f.revision_nombre,
      liquidacion_total: f.liquidacion_total,
      liquidacion_anterior: f.liquidacion_anterior,
      monto_restatado: f.monto_restatado,
      efecto_neto_recalculos: f.efecto_neto_recalculos,
    }));

    descargar(`comparador_${periodo}.csv`, aCSV(salida), "text/csv");
  }

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!datos}>
      <div className="comparador">
        <Tarjeta etiqueta="Empresas" titulo={`Con liquidación en ${datos?.perinombre ?? ""}`}>
          <ListaEmpresas
            empresas={empresas}
            seleccionadas={seleccionadas}
            alCambiar={alternar}
            alTodas={(visibles) =>
              setSeleccionadas((actual) => new Set([...actual, ...visibles.map((e) => e.empresa_id)]))
            }
            alLimpiar={() => setSeleccionadas(new Set())}
          />
        </Tarjeta>

        <Tarjeta
          etiqueta="Comparador"
          titulo={
            filas.length
              ? `${filas.length} empresa${filas.length === 1 ? "" : "s"} lado a lado · ${datos?.perinombre ?? ""}`
              : "Marca empresas en la lista para compararlas"
          }
          acciones={
            <button type="button" className="boton-secundario" onClick={bajarCSV} disabled={!filas.length}>
              Descargar CSV
            </button>
          }
        >
          {filas.length > 0 && (
            <>
              <GraficoComparativo filas={filas} />

              <div className="tabla-scroll">
                <table className="tabla tabla-comparador">
                  <caption className="solo-lectores">
                    Empresas seleccionadas en {datos?.perinombre}: revisión vigente, liquidación y monto restatado
                  </caption>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Revisión vigente</th>
                      <th className="num">Liquidación del mes</th>
                      <th className="num">Monto restatado</th>
                      <th className="num">Efecto neto de recálculos</th>
                      <th>Variación vs. mes anterior</th>
                      <th><span className="solo-lectores">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.empresa_id}>
                        <td>
                          <strong>{nombreEmpresa(f)}</strong>
                          <span className="ruc cifra"> RUC {f.ruc ?? "—"}</span>
                        </td>
                        <td>
                          <span className={`distintivo ${f.revision > 0 ? "distintivo-revision" : ""}`}>
                            {f.revision_nombre ?? "Sin revisiones"}
                          </span>
                        </td>
                        <td className="num">{soles(f.liquidacion_total)}</td>
                        <td className="num">{soles(f.monto_restatado)}</td>
                        <td className="num">{soles(f.efecto_neto_recalculos)}</td>
                        <td><Variacion actual={f.liquidacion_total} anterior={f.liquidacion_anterior} /></td>
                        <td>
                          <button
                            type="button"
                            className="boton-secundario boton-analizar"
                            onClick={() => analizar(f.empresa_id)}
                          >
                            Analizar →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="nota">
                La liquidación del mes sale de la evolución mensual, igual que
                en el resto del portal. El monto restatado es la última revisión
                publicada de cada proceso; el efecto neto es esa última revisión
                menos la original, nunca la suma de montos restatados.
              </p>
            </>
          )}
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
