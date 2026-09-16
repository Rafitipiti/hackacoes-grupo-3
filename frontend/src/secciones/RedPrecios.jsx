import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { obtenerBarras, obtenerCmgDiario } from "../api/red.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { aCSV, descargar } from "../lib/exportar.js";
import { numero } from "../lib/formato.js";
import { proyectar, trazoPeru } from "../lib/peru.js";

const ANCHO_MAPA = 420;
const ALTO_MAPA = 600;

// Una paleta para las lineas apiladas: los cuatro tonos de serie y luego
// los de la identidad, para llegar a ocho periodos distinguibles.
const PALETA = [
  "var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)",
  "var(--s3)", "var(--seq6)", "var(--crit)", "var(--ink-2)",
];

function cmg(valor) {
  return valor === null || valor === undefined ? "—" : `${numero(valor * 1000, 2)} S/ por MWh`;
}

function MapaBarras({ barras, seleccionada, alElegir }) {
  const [minimo, maximo] = useMemo(() => {
    const valores = barras.map((b) => b.cmg_promedio);
    return [Math.min(...valores), Math.max(...valores)];
  }, [barras]);

  // Radio por costo marginal: la barra mas cara del mes, la mas grande.
  function radio(b) {
    if (maximo === minimo) return 4;
    return 3 + 6 * ((b.cmg_promedio - minimo) / (maximo - minimo));
  }

  return (
    <svg
      className="mapa-peru"
      viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`}
      role="img"
      aria-label={`Mapa del Perú con ${barras.length} barras del SEIN; el tamaño del punto sigue al costo marginal del mes.`}
    >
      <path d={trazoPeru(ANCHO_MAPA, ALTO_MAPA)} className="pais" />
      {barras.map((b) => {
        const { x, y } = proyectar(b.lat, b.lon, ANCHO_MAPA, ALTO_MAPA);
        const activa = b.barrcodi === seleccionada;
        return (
          <circle
            key={b.barrcodi}
            cx={x}
            cy={y}
            r={activa ? radio(b) + 3 : radio(b)}
            className={`barra-punto${activa ? " activa" : ""}${b.ubicacion_estimada ? "" : " nominal"}`}
            onClick={() => alElegir(b.barrcodi)}
            tabIndex={0}
            role="button"
            aria-label={`${b.barrnombre}: ${cmg(b.cmg_promedio)}`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alElegir(b.barrcodi); } }}
          >
            <title>{b.barrnombre} · {cmg(b.cmg_promedio)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function TooltipCmg({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">Día {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey}>
          <span className="muestra" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <strong className="cifra">{cmg(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * Curvas del costo marginal diario de una barra, una linea por periodo.
 * Cada clic en un periodo anade su linea; volver a pulsarlo la quita.
 */
function PerfilCmg({ barra, periodo, periodos }) {
  const [series, setSeries] = useState({});
  const [apilados, setApilados] = useState([]);
  const [disponibles, setDisponibles] = useState(null);
  const [error, setError] = useState(null);

  // Al cambiar de barra o de periodo se empieza de cero con el periodo de
  // la cabecera. Se ajusta durante el render comparando con la ultima
  // clave vista, en vez de en un efecto que provocaria un segundo render.
  const claveBase = `${barra?.barrcodi ?? ""}-${periodo ?? ""}`;
  const [claveVista, setClaveVista] = useState(claveBase);
  if (claveBase !== claveVista) {
    setClaveVista(claveBase);
    setSeries({});
    setApilados(periodo ? [periodo] : []);
    setDisponibles(null);
    setError(null);
  }

  useEffect(() => {
    if (!barra) return;

    const faltan = apilados.filter((p) => !series[p]);
    if (!faltan.length) return;

    let vigente = true;

    Promise.all(
      faltan.map((p) =>
        obtenerCmgDiario(barra.barrcodi, p)
          .then((d) => [p, d])
          .catch(() => [p, null]),
      ),
    ).then((resultados) => {
      if (!vigente) return;

      setSeries((actual) => {
        const siguiente = { ...actual };
        for (const [p, d] of resultados) siguiente[p] = d ? d.dias : [];
        return siguiente;
      });

      const conLista = resultados.find(([, d]) => d?.periodos_disponibles);
      if (conLista) setDisponibles(conLista[1].periodos_disponibles);
      if (resultados.every(([, d]) => d === null)) {
        setError("No se pudo obtener el costo marginal de esta barra.");
      }
    });

    return () => { vigente = false; };
  }, [barra, apilados, series]);

  const datos = useMemo(() => {
    const porDia = new Map();
    for (const p of apilados) {
      for (const d of series[p] ?? []) {
        if (!porDia.has(d.dia)) porDia.set(d.dia, { dia: d.dia });
        porDia.get(d.dia)[`p${p}`] = d.promedio;
      }
    }
    return [...porDia.values()].sort((a, b) => a.dia - b.dia);
  }, [apilados, series]);

  function alternar(pericodi) {
    setApilados((actual) =>
      actual.includes(pericodi) ? actual.filter((p) => p !== pericodi) : [...actual, pericodi],
    );
  }

  function nombre(pericodi) {
    return periodos.find((p) => p.pericodi === pericodi)?.perinombre ?? String(pericodi);
  }

  function bajarCSV() {
    descargar(
      `cmg_${barra.barrnombre.replace(/\s+/g, "_")}.csv`,
      aCSV(datos.map((fila) => {
        const salida = { dia: fila.dia };
        for (const p of apilados) salida[nombre(p)] = fila[`p${p}`] ?? "";
        return salida;
      })),
      "text/csv",
    );
  }

  if (!barra) {
    return (
      <p className="nota">
        Elige una barra en el mapa o en la tabla para ver su costo marginal
        día a día y comparar periodos.
      </p>
    );
  }

  const ofrecidos = periodos.filter((p) => !disponibles || disponibles.includes(p.pericodi));

  return (
    <div className="perfil-cmg">
      <div className="cabecera-perfil">
        <div>
          <h3>{barra.barrnombre}{barra.barrtension ? ` · ${barra.barrtension} kV` : ""}</h3>
          <p className="nota">
            Costo marginal promedio diario. Pulsa un periodo para añadir su
            curva; púlsalo otra vez para quitarla.
            {!barra.ubicacion_estimada && " La ubicación de esta barra en el mapa es nominal."}
          </p>
        </div>
        <button type="button" className="boton-secundario" onClick={bajarCSV} disabled={!datos.length}>
          Descargar CSV
        </button>
      </div>

      <div className="chips" role="group" aria-label="Periodos a comparar">
        {ofrecidos.map((p) => {
          const indice = apilados.indexOf(p.pericodi);
          const activo = indice >= 0;
          return (
            <button
              key={p.pericodi}
              type="button"
              className={`chip${activo ? " activo" : ""}`}
              aria-pressed={activo}
              onClick={() => alternar(p.pericodi)}
            >
              {activo && <span className="muestra" style={{ background: PALETA[indice % PALETA.length] }} aria-hidden="true" />}
              {p.perinombre}
            </button>
          );
        })}
      </div>

      {error && <p className="estado-error">{error}</p>}

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={datos} margin={{ top: 10, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="dia" type="number" domain={[1, 31]} tickCount={16} tick={{ fill: "var(--ink-2)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--axis)" }} label={{ value: "Día del mes", position: "insideBottomRight", offset: -2, fill: "var(--ink-muted)", fontSize: 11 }} />
          <YAxis tickFormatter={(v) => numero(v * 1000, 0)} tick={{ fill: "var(--ink-2)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} label={{ value: "S/ por MWh", angle: -90, position: "insideLeft", fill: "var(--ink-muted)", fontSize: 11 }} />
          <Tooltip content={<TooltipCmg />} cursor={{ stroke: "var(--axis)" }} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          {apilados.map((p, i) => (
            <Line
              key={p}
              type="monotone"
              dataKey={`p${p}`}
              name={nombre(p)}
              stroke={PALETA[i % PALETA.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TablaBarras({ barras, seleccionada, alElegir }) {
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState("cmg");

  const visibles = useMemo(() => {
    const texto = filtro.trim().toLocaleLowerCase("es");
    const lista = barras.filter((b) => !texto || b.barrnombre.toLocaleLowerCase("es").includes(texto));
    return lista.sort((a, b) =>
      orden === "cmg" ? b.cmg_promedio - a.cmg_promedio : a.barrnombre.localeCompare(b.barrnombre, "es"),
    );
  }, [barras, filtro, orden]);

  return (
    <div className="tabla-barras">
      <div className="acciones-lista">
        <input
          type="search"
          placeholder="Buscar barra…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Buscar barra"
        />
        <button type="button" className={`chip${orden === "cmg" ? " activo" : ""}`} onClick={() => setOrden("cmg")}>Por costo</button>
        <button type="button" className={`chip${orden === "nombre" ? " activo" : ""}`} onClick={() => setOrden("nombre")}>Por nombre</button>
        <span className="nota contador">{visibles.length} barras</span>
      </div>
      <div className="tabla-scroll lista-barras">
        <table className="tabla">
          <thead>
            <tr>
              <th>Barra</th>
              <th className="num">kV</th>
              <th className="num">CMg promedio</th>
              <th className="num">Mín · Máx</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((b) => (
              <tr
                key={b.barrcodi}
                className={`fila-elegible${b.barrcodi === seleccionada ? " fila-seleccionada" : ""}`}
                onClick={() => alElegir(b.barrcodi)}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") alElegir(b.barrcodi); }}
              >
                <td>{b.barrnombre}{!b.ubicacion_estimada && <span className="nota" title="Ubicación nominal en el mapa"> ◌</span>}</td>
                <td className="num">{b.barrtension ?? "—"}</td>
                <td className="num">{numero(b.cmg_promedio * 1000, 2)}</td>
                <td className="num">{numero(b.cmg_minimo * 1000, 1)} · {numero(b.cmg_maximo * 1000, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RedPrecios() {
  const { periodo, periodos } = useSeleccion();

  const [estado, setEstado] = useState({ pericodi: null, datos: null, error: null });
  const [seleccionada, setSeleccionada] = useState(null);

  useEffect(() => {
    if (!periodo) return;

    let vigente = true;

    obtenerBarras(periodo)
      .then((datos) => { if (vigente) setEstado({ pericodi: periodo, datos, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          pericodi: periodo,
          datos: null,
          error:
            e.response?.status === 404
              ? "No hay costo marginal registrado para este periodo. Elige otro en la cabecera."
              : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });

    return () => { vigente = false; };
  }, [periodo]);

  const cargando = Boolean(periodo) && estado.pericodi !== periodo;
  const datos = cargando ? null : estado.datos;
  const error = cargando ? null : estado.error;

  const barras = datos?.barras ?? [];
  const barra = barras.find((b) => b.barrcodi === seleccionada) ?? null;
  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  const promedioSistema = barras.length
    ? barras.reduce((s, b) => s + b.cmg_promedio, 0) / barras.length
    : null;

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!datos}>
      <div className="rejilla red-precios">
        <Tarjeta etiqueta={`Mapa del SEIN · ${periodoActual?.perinombre ?? ""}`} titulo="Barras y costo marginal">
          <p className="nota">
            {datos?.total} barras con costo marginal en el mes; el tamaño del
            punto sigue al promedio. Promedio del sistema:{" "}
            <strong className="cifra">{cmg(promedioSistema)}</strong>.
            {datos && datos.con_ubicacion < datos.total && (
              <> {datos.total - datos.con_ubicacion} barras sin localidad reconocida se dibujan en posición nominal (punto hueco).</>
            )}
          </p>
          <div className="mapa-y-tabla">
            <MapaBarras barras={barras} seleccionada={seleccionada} alElegir={setSeleccionada} />
            <TablaBarras barras={barras} seleccionada={seleccionada} alElegir={setSeleccionada} />
          </div>
        </Tarjeta>

        <Tarjeta etiqueta="Perfil de costo marginal" titulo={barra ? "Comparar periodos" : "Elige una barra"}>
          <PerfilCmg barra={barra} periodo={periodo} periodos={periodos} />
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
