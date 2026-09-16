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

import { obtenerBarras, obtenerCmgDiario, obtenerEnergiaDiaria } from "../api/red.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
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

// Cuatro capas del mapa (spec, seccion 12). "Todo en uno" mete las tres
// magnitudes en una marca: el color es el costo marginal, el semicirculo
// izquierdo crece con las entregas y el derecho con los retiros.
const CAPAS = [
  { id: "todo", etiqueta: "Todo en uno" },
  { id: "cmg", etiqueta: "Costo marginal" },
  { id: "ent", etiqueta: "Entregas" },
  { id: "ret", etiqueta: "Retiros" },
];

const METRICAS = {
  cmg: { etiqueta: "Costo marginal", unidad: "S/ por MWh", color: "var(--serie-2)" },
  ent: { etiqueta: "Entregas", unidad: "MWh", color: "var(--serie-1)" },
  ret: { etiqueta: "Retiros", unidad: "MWh", color: "var(--serie-3)" },
};

// Escala de color del costo marginal, en S/ por MWh (peticion del usuario,
// 2026-09-16). Es una escala fija y semantica -- morado barato, rojo caro --
// asi que no sigue al tema: el mismo tramo se pinta igual en claro y oscuro.
const ESCALA_CMG = [
  { hasta: 20, color: "#7b3fbf", etiqueta: "0 – 20" },
  { hasta: 30, color: "#0e6b3a", etiqueta: "20 – 30" },
  { hasta: 50, color: "#1baf5a", etiqueta: "30 – 50" },
  { hasta: 100, color: "#7fd069", etiqueta: "50 – 100" },
  { hasta: 150, color: "#3ec6c0", etiqueta: "100 – 150" },
  { hasta: 250, color: "#f2c84b", etiqueta: "150 – 250" },
  { hasta: 400, color: "#f4b183", etiqueta: "250 – 400" },
  { hasta: 500, color: "#f07f1f", etiqueta: "400 – 500" },
  { hasta: Infinity, color: "#d02b2b", etiqueta: "más de 500" },
];

function colorCmg(promedio) {
  const soles = promedio * 1000;
  return (ESCALA_CMG.find((t) => soles < t.hasta) ?? ESCALA_CMG[ESCALA_CMG.length - 1]).color;
}

function LeyendaCmg() {
  return (
    <ul className="leyenda-cmg" aria-label="Escala de color del costo marginal, en soles por MWh">
      {ESCALA_CMG.map((t) => (
        <li key={t.etiqueta}>
          <span className="muestra" style={{ background: t.color }} aria-hidden="true" />
          {t.etiqueta}
        </li>
      ))}
    </ul>
  );
}

function cmg(valor) {
  return valor === null || valor === undefined ? "—" : `${numero(valor * 1000, 2)} S/ por MWh`;
}

const mwh = (v) => `${numero(v, v >= 100 ? 0 : 1)} MWh`;

/** Semicirculo izquierdo ('i') o derecho ('d') de radio r centrado en (cx, cy). */
function semicirculo(cx, cy, r, lado) {
  if (r <= 0) return "";
  const barrido = lado === "i" ? 0 : 1;
  return `M${cx.toFixed(1)} ${(cy - r).toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${barrido} ${cx.toFixed(1)} ${(cy + r).toFixed(1)} Z`;
}

function MapaBarras({ barras, capa, seleccionada, alElegir }) {
  const maxEnergia = Math.max(1, ...barras.map((b) => Math.max(b.entregas, b.retiros)));
  // El area es proporcional a la energia: el ojo compara areas mejor que radios.
  const radioEnergia = (v) => (v > 0 ? 2 + Math.sqrt(v / maxEnergia) * 11 : 0);

  // Las barras con mas energia van debajo para no tapar a las chicas.
  const ordenadas = useMemo(
    () => [...barras].sort((a, b) => (b.entregas + b.retiros) - (a.entregas + a.retiros)),
    [barras],
  );

  const descripcion = {
    todo: "el color del punto sigue al costo marginal; el lado izquierdo crece con las entregas y el derecho con los retiros",
    cmg: "el color del punto sigue al costo marginal del mes",
    ent: "el tamaño del punto sigue a la energía entregada",
    ret: "el tamaño del punto sigue a la energía retirada",
  }[capa];

  return (
    <svg
      className="mapa-peru"
      viewBox={`0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`}
      role="img"
      aria-label={`Mapa del Perú con ${barras.length} barras del SEIN; ${descripcion}.`}
    >
      <path d={trazoPeru(ANCHO_MAPA, ALTO_MAPA)} className="pais" />
      {ordenadas.map((b) => {
        const { x, y } = proyectar(b.lat, b.lon, ANCHO_MAPA, ALTO_MAPA);
        const activa = b.barrcodi === seleccionada;
        const color = colorCmg(b.cmg_promedio);
        const titulo = `${b.barrnombre} · ${cmg(b.cmg_promedio)} · entregas ${mwh(b.entregas)} · retiros ${mwh(b.retiros)}`;
        const comunes = {
          className: `barra-marca${activa ? " activa" : ""}`,
          onClick: () => alElegir(b.barrcodi),
          tabIndex: 0,
          role: "button",
          "aria-label": titulo,
          onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alElegir(b.barrcodi); } },
        };

        let marca;
        if (capa === "cmg") {
          marca = (
            <circle cx={x} cy={y} r={activa ? 7.5 : 4.5} style={b.ubicacion_estimada ? { fill: color } : { stroke: color }} className={`barra-punto${b.ubicacion_estimada ? "" : " nominal"}`} />
          );
        } else if (capa === "ent" || capa === "ret") {
          const v = capa === "ent" ? b.entregas : b.retiros;
          const r = radioEnergia(v);
          marca = r > 0
            ? <circle cx={x} cy={y} r={r} className={`barra-energia ${capa}`} />
            : <circle cx={x} cy={y} r={1.6} className="barra-vacia" />;
        } else {
          const re = radioEnergia(b.entregas);
          const rr = radioEnergia(b.retiros);
          marca = re <= 0 && rr <= 0
            ? <circle cx={x} cy={y} r={2.2} style={{ fill: color }} className="barra-punto" />
            : (
              <>
                {re > 0 && <path d={semicirculo(x, y, re, "i")} style={{ fill: color }} className="mitad mitad-ent" />}
                {rr > 0 && <path d={semicirculo(x, y, rr, "d")} style={{ fill: color }} className="mitad mitad-ret" />}
              </>
            );
        }

        return (
          <g key={b.barrcodi} {...comunes}>
            <title>{titulo}</title>
            {activa && <circle cx={x} cy={y} r={12} className="anillo-activa" />}
            {marca}
            {/* Blanco de clic: en Lima y el sur los puntos se solapan y una
                marca de 3 px no se acierta con el ratón. */}
            <circle cx={x} cy={y} r={6} className="blanco-clic" />
          </g>
        );
      })}
    </svg>
  );
}

function LeyendaEnergia({ capa, barras }) {
  const max = Math.max(...barras.map((b) => Math.max(b.entregas, b.retiros)), 0);
  if (capa === "todo") {
    return (
      <div className="leyenda-energia">
        <svg width="30" height="20" aria-hidden="true"><path d="M15 2 A8 8 0 0 0 15 18 Z" className="mitad mitad-ent" style={{ fill: "var(--surface-3)" }} /></svg>
        <span>izquierda · entregas</span>
        <svg width="30" height="20" aria-hidden="true"><path d="M15 2 A8 8 0 0 1 15 18 Z" className="mitad mitad-ret" style={{ fill: "var(--surface-3)" }} /></svg>
        <span>derecha · retiros</span>
        <span className="nota">hasta {mwh(max)} · el área de cada mitad es proporcional a su energía</span>
      </div>
    );
  }
  const color = METRICAS[capa].color;
  return (
    <div className="leyenda-energia">
      <span className="bola" style={{ background: color, width: 8, height: 8 }} aria-hidden="true" />
      <span>poca</span>
      <span className="bola" style={{ background: color, width: 24, height: 24 }} aria-hidden="true" />
      <span>{mwh(max)}</span>
      <span className="nota">el área es proporcional a los MWh del mes</span>
    </div>
  );
}

/**
 * "¿Qué barras tienen el costo marginal más alto?" es la pregunta que se
 * hace al mirar el mapa. Esto la contesta como lista, con la magnitud de la
 * capa activa. La barrita se mide contra el rango del propio top: los
 * costos se apelotonan y desde cero todas saldrían llenas.
 */
function Ranking({ barras, capa, alElegir }) {
  const metrica = capa === "todo" ? "cmg" : capa;
  const valor = (b) => (metrica === "cmg" ? b.cmg_promedio : metrica === "ent" ? b.entregas : b.retiros);
  const top = [...barras].filter((b) => valor(b) > 0).sort((a, b) => valor(b) - valor(a)).slice(0, 12);
  if (!top.length) return null;

  const max = valor(top[0]);
  const min = valor(top[top.length - 1]);
  const ancho = (v) => (max > min ? 10 + (90 * (v - min)) / (max - min) : 100);
  const formato = (v) => (metrica === "cmg" ? numero(v * 1000, 2) : mwh(v));

  return (
    <div className="ranking">
      <h3>
        Barras con {metrica === "cmg" ? "el costo marginal más alto" : `más ${METRICAS[metrica].etiqueta.toLowerCase()}`}
        <span className="nota"> · las {top.length} primeras de {barras.length}{metrica === "cmg" ? " · S/ por MWh" : ""}</span>
      </h3>
      <ol className="lista-ranking">
        {top.map((b) => (
          <li key={b.barrcodi}>
            <button type="button" className="fila-ranking" onClick={() => alElegir(b.barrcodi)} title="Ver su perfil">
              <span className="nombre-ranking">{b.barrnombre}<span className="nota">{b.barrtension ? ` ${b.barrtension} kV` : ""}</span></span>
              <span className="riel-ranking" aria-hidden="true"><span style={{ width: `${ancho(valor(b))}%`, background: metrica === "cmg" ? colorCmg(b.cmg_promedio) : METRICAS[metrica].color }} /></span>
              <span className="valor-ranking cifra">{formato(valor(b))}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TooltipPerfil({ active, payload, label, metrica }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-grafico">
      <p className="tooltip-titulo">Día {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey}>
          <span className="muestra" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <strong className="cifra">{metrica === "cmg" ? cmg(p.value) : mwh(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

/**
 * Curvas diarias de una barra, una linea por periodo: costo marginal,
 * entregas o retiros. Cada clic en un periodo anade su linea; volver a
 * pulsarlo la quita.
 */
function Perfil({ barra, periodo, periodos, empresa, empresaNombre }) {
  const [metrica, setMetrica] = useState("cmg");
  const [series, setSeries] = useState({});
  const [apilados, setApilados] = useState([]);
  const [disponibles, setDisponibles] = useState(null);
  const [error, setError] = useState(null);

  // Al cambiar de barra, periodo, empresa o metrica se empieza de cero con
  // el periodo de la cabecera. Se ajusta durante el render comparando con
  // la ultima clave vista, en vez de en un efecto que provocaria un
  // segundo render.
  const claveBase = `${barra?.barrcodi ?? ""}-${periodo ?? ""}-${empresa ?? ""}-${metrica}`;
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
    const pedir = (p) =>
      metrica === "cmg"
        ? obtenerCmgDiario(barra.barrcodi, p).then((d) => [p, d.dias.map((x) => ({ dia: x.dia, valor: x.promedio })), d.periodos_disponibles])
        : obtenerEnergiaDiaria(barra.barrcodi, p, empresa).then((d) => [p, d.dias.map((x) => ({ dia: x.dia, valor: metrica === "ent" ? x.entregas : x.retiros })), null]);

    Promise.all(faltan.map((p) => pedir(p).catch(() => [p, null, null]))).then((resultados) => {
      if (!vigente) return;
      setSeries((actual) => {
        const siguiente = { ...actual };
        for (const [p, d] of resultados) siguiente[p] = d ?? [];
        return siguiente;
      });
      const conLista = resultados.find(([, , lista]) => lista);
      if (conLista) setDisponibles(conLista[2]);
      if (resultados.every(([, d]) => d === null)) {
        setError(metrica === "cmg" ? "No se pudo obtener el costo marginal de esta barra." : `Esta barra no registra ${METRICAS[metrica].etiqueta.toLowerCase()} en ese mes para la selección.`);
      }
    });

    return () => { vigente = false; };
  }, [barra, apilados, series, metrica, empresa]);

  const datos = useMemo(() => {
    const porDia = new Map();
    for (const p of apilados) {
      for (const d of series[p] ?? []) {
        if (!porDia.has(d.dia)) porDia.set(d.dia, { dia: d.dia });
        porDia.get(d.dia)[`p${p}`] = d.valor;
      }
    }
    return [...porDia.values()].sort((a, b) => a.dia - b.dia);
  }, [apilados, series]);

  function alternar(pericodi) {
    setApilados((actual) => (actual.includes(pericodi) ? actual.filter((p) => p !== pericodi) : [...actual, pericodi]));
  }

  const nombre = (pericodi) => periodos.find((p) => p.pericodi === pericodi)?.perinombre ?? String(pericodi);

  function bajarCSV() {
    descargar(
      `${metrica}_${barra.barrnombre.replace(/\s+/g, "_")}.csv`,
      aCSV(datos.map((fila) => {
        const salida = { dia: fila.dia };
        for (const p of apilados) salida[nombre(p)] = fila[`p${p}`] ?? "";
        return salida;
      })),
      "text/csv",
    );
  }

  if (!barra) {
    return <p className="nota">Elige una barra en el mapa, en el ranking o en la tabla para ver su curva día a día y comparar meses.</p>;
  }

  const ofrecidos = periodos.filter((p) => !disponibles || disponibles.includes(p.pericodi));
  const cfg = METRICAS[metrica];

  return (
    <div className="perfil-cmg">
      <div className="cabecera-perfil">
        <div>
          <h3>{barra.barrnombre}{barra.barrtension ? ` · ${barra.barrtension} kV` : ""}</h3>
          <p className="nota">
            {metrica === "cmg"
              ? "Costo marginal promedio diario del sistema en esta barra."
              : `${cfg.etiqueta} diarias en esta barra${empresaNombre ? ` de ${empresaNombre}` : ", de todas las empresas"}.`}
            {" "}Pulsa un mes para añadir su curva; púlsalo otra vez para quitarla.
            {!barra.ubicacion_estimada && " La ubicación de esta barra en el mapa es nominal."}
          </p>
        </div>
        <div className="acciones-perfil">
          <div className="segmento" role="group" aria-label="Magnitud del perfil">
            {Object.entries(METRICAS).map(([id, m]) => (
              <button key={id} type="button" aria-pressed={metrica === id} className={metrica === id ? "activo" : ""} onClick={() => setMetrica(id)}>{m.etiqueta}</button>
            ))}
          </div>
          <button type="button" className="boton-secundario" onClick={bajarCSV} disabled={!datos.length}>Descargar CSV</button>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Meses a comparar">
        {ofrecidos.map((p) => {
          const indice = apilados.indexOf(p.pericodi);
          const activo = indice >= 0;
          return (
            <button key={p.pericodi} type="button" className={`chip${activo ? " activo" : ""}`} aria-pressed={activo} onClick={() => alternar(p.pericodi)}>
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
          <YAxis tickFormatter={(v) => (metrica === "cmg" ? numero(v * 1000, 0) : numero(v, 0))} tick={{ fill: "var(--ink-2)", fontSize: 11 }} axisLine={false} tickLine={false} width={56} label={{ value: cfg.unidad, angle: -90, position: "insideLeft", fill: "var(--ink-muted)", fontSize: 11 }} />
          <Tooltip content={<TooltipPerfil metrica={metrica} />} cursor={{ stroke: "var(--axis)" }} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          {apilados.map((p, i) => (
            <Line key={p} type="monotone" dataKey={`p${p}`} name={nombre(p)} stroke={PALETA[i % PALETA.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
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
    const criterio = {
      cmg: (a, b) => b.cmg_promedio - a.cmg_promedio,
      ent: (a, b) => b.entregas - a.entregas,
      ret: (a, b) => b.retiros - a.retiros,
      nombre: (a, b) => a.barrnombre.localeCompare(b.barrnombre, "es"),
    }[orden];
    return lista.sort(criterio);
  }, [barras, filtro, orden]);

  return (
    <div className="tabla-barras">
      <div className="acciones-lista">
        <input type="search" placeholder="Buscar barra…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar barra" />
        {[["cmg", "Por costo"], ["ent", "Por entregas"], ["ret", "Por retiros"], ["nombre", "Por nombre"]].map(([id, texto]) => (
          <button key={id} type="button" className={`chip${orden === id ? " activo" : ""}`} onClick={() => setOrden(id)}>{texto}</button>
        ))}
        <span className="nota contador">{visibles.length} barras</span>
      </div>
      <div className="tabla-scroll lista-barras">
        <table className="tabla">
          <thead>
            <tr>
              <th>Barra</th>
              <th className="num">kV</th>
              <th className="num">CMg</th>
              <th className="num">Entregas</th>
              <th className="num">Retiros</th>
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
                <td className="num">
                  <span className="muestra-cmg" style={{ background: colorCmg(b.cmg_promedio) }} aria-hidden="true" />
                  {numero(b.cmg_promedio * 1000, 2)}
                </td>
                <td className="num">{b.entregas > 0 ? numero(b.entregas, 1) : <span className="nota">—</span>}</td>
                <td className="num">{b.retiros > 0 ? numero(b.retiros, 1) : <span className="nota">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RedPrecios() {
  const { periodo, periodos, empresa, empresas } = useSeleccion();

  const clave = periodo ? `${periodo}-${empresa ?? ""}` : null;
  const [estado, setEstado] = useState({ clave: null, datos: null, error: null });
  const [seleccionada, setSeleccionada] = useState(null);
  const [capa, setCapa] = useState("todo");

  useEffect(() => {
    if (!clave) return;
    let vigente = true;

    obtenerBarras(periodo, empresa)
      .then((datos) => { if (vigente) setEstado({ clave, datos, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setEstado({
          clave,
          datos: null,
          error: e.response?.status === 404
            ? "No hay costo marginal registrado para este periodo. Elige otro en la cabecera."
            : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });

    return () => { vigente = false; };
  }, [clave, periodo, empresa]);

  const cargando = Boolean(clave) && estado.clave !== clave;
  const datos = cargando ? null : estado.datos;
  const error = cargando ? null : estado.error;

  const barras = datos?.barras ?? [];
  const barra = barras.find((b) => b.barrcodi === seleccionada) ?? null;
  const periodoActual = periodos.find((p) => p.pericodi === periodo);
  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const empresaNombre = ficha ? nombreEmpresa(ficha) : null;

  const promedioSistema = barras.length ? barras.reduce((s, b) => s + b.cmg_promedio, 0) / barras.length : null;
  const conEnergia = barras.filter((b) => b.entregas > 0 || b.retiros > 0).length;

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!datos}>
      <div className="rejilla red-precios">
        <Tarjeta
          etiqueta={`Mapa del SEIN · ${periodoActual?.perinombre ?? ""}`}
          titulo={capa === "cmg" ? "Barras y costo marginal" : capa === "ent" ? "Dónde se entregó la energía" : capa === "ret" ? "Dónde se retiró la energía" : "Precio y energía, barra por barra"}
          acciones={
            <div className="segmento" role="group" aria-label="Capa del mapa">
              {CAPAS.map((c) => (
                <button key={c.id} type="button" aria-pressed={capa === c.id} className={capa === c.id ? "activo" : ""} onClick={() => setCapa(c.id)}>{c.etiqueta}</button>
              ))}
            </div>
          }
        >
          <p className="nota">
            {datos?.total} barras con costo marginal en el mes · promedio del sistema{" "}
            <strong className="cifra">{cmg(promedioSistema)}</strong>.
            {" "}Energía {empresaNombre ? <>de <strong>{empresaNombre}</strong></> : "de todas las empresas"}:{" "}
            <strong className="cifra">{mwh(datos?.entregas ?? 0)}</strong> entregados y{" "}
            <strong className="cifra">{mwh(datos?.retiros ?? 0)}</strong> retirados en {conEnergia} barras.
            {" "}El precio es del sistema y no cambia con la empresa elegida.
            {datos && datos.con_ubicacion < datos.total && (
              <> {datos.total - datos.con_ubicacion} barras sin localidad reconocida se dibujan en posición nominal.</>
            )}
            {datos?.sin_precio?.barras > 0 && (datos.sin_precio.entregas > 0 || datos.sin_precio.retiros > 0) && (
              <> {mwh(datos.sin_precio.entregas + datos.sin_precio.retiros)} caen en barras sin costo marginal publicado y no se dibujan.</>
            )}
          </p>
          <div className="mapa-y-tabla">
            <div>
              <MapaBarras barras={barras} capa={capa} seleccionada={seleccionada} alElegir={setSeleccionada} />
              {(capa === "cmg" || capa === "todo") && <LeyendaCmg />}
              {capa !== "cmg" && <LeyendaEnergia capa={capa} barras={barras} />}
            </div>
            <div className="lado-mapa">
              <Ranking barras={barras} capa={capa} alElegir={setSeleccionada} />
              <TablaBarras barras={barras} seleccionada={seleccionada} alElegir={setSeleccionada} />
            </div>
          </div>
        </Tarjeta>

        <Tarjeta etiqueta="Perfil de la barra" titulo={barra ? "Comparar meses" : "Elige una barra"}>
          <Perfil barra={barra} periodo={periodo} periodos={periodos} empresa={empresa} empresaNombre={empresaNombre} />
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
