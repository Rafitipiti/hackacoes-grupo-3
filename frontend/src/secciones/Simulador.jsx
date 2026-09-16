import { useEffect, useMemo, useState } from "react";

import { obtenerBarrasSimulador, obtenerBaseSimulador, valorizarEnergia } from "../api/simulador.js";
import { useSeleccion } from "../app/contexto.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { nombreEmpresa } from "../lib/empresa.js";
import { numero, soles } from "../lib/formato.js";
import { COLOR_PROCESO, NOMBRE_PROCESO, etiquetaProceso } from "../lib/procesos.js";
import {
  PROCESOS_SIMULADOR,
  calcularProcesos,
  defectosDesde,
  ejemploEnergia,
  parsearEnergia,
} from "../lib/simulador.js";

// El costo marginal llega en S/ por kWh; en pantalla va siempre en S/ por MWh.
const porMWh = (cmg) => (cmg === null || cmg === undefined ? "—" : `${numero(cmg * 1000, 2)} S/ por MWh`);
const conSigno = (v) => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : "−"}${soles(Math.abs(v))}`);
const colorSigno = (v) => (v === null || v === undefined ? undefined : v >= 0 ? "var(--pos-texto)" : "var(--neg-texto)");

function Segmento({ opciones, valor, alCambiar, etiqueta }) {
  return (
    <div className="segmento" role="group" aria-label={etiqueta}>
      {opciones.map(([id, texto]) => (
        <button key={id} type="button" aria-pressed={valor === id} className={valor === id ? "activo" : ""} onClick={() => alCambiar(id)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

function Campo({ id, etiqueta, valor, alCambiar, ayuda, paso = "any" }) {
  return (
    <label className="campo-sim" htmlFor={id}>
      <span>{etiqueta}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={paso}
        className="cifra"
        value={valor ?? ""}
        onChange={(e) => alCambiar(e.target.value === "" ? null : e.target.value)}
      />
      {ayuda && <i>{ayuda}</i>}
    </label>
  );
}

// ---------------------------------------------------------------- energia

/**
 * Energía activa: pegar entregas y retiros y valorizarlos con el costo
 * marginal publicado de cada barra. Funciona con o sin empresa elegida.
 */
function EnergiaActiva({ periodo, periodoNombre, barras, cmgSistema, resultado, alValorizar, alVaciar }) {
  const [granularidad, setGranularidad] = useState("mes");
  const [alcance, setAlcance] = useState("total");
  const [barra, setBarra] = useState(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ignoradas, setIgnoradas] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const barraActiva = barras.find((b) => b.barrcodi === Number(barra)) ?? barras[0] ?? null;
  const ejemplo = ejemploEnergia(granularidad, alcance);
  const diasDelMes = resultado?.dias_del_mes ?? 31;

  function cambiarModo(setter) {
    return (valor) => { setter(valor); setAviso(null); setIgnoradas([]); alVaciar(); };
  }

  async function calcular(fuente) {
    const contenido = fuente ?? texto;
    if (fuente) setTexto(fuente);
    const leido = parsearEnergia(contenido, { granularidad, alcance, diasDelMes });
    setIgnoradas(leido.ignoradas);

    if (!leido.filas.length) {
      setAviso({ ok: false, texto: "No pude leer ninguna fila. Mira el ejemplo del recuadro." });
      alVaciar();
      return;
    }

    setOcupado(true);
    try {
      const salida = await valorizarEnergia({
        pericodi: periodo,
        granularidad,
        barraDefecto: alcance === "total" ? barraActiva?.barrcodi ?? null : null,
        filas: leido.filas,
      });
      alValorizar(salida);
      const rechazadas = salida.no_reconocidas.length;
      setAviso({
        ok: true,
        texto: `${salida.filas} fila(s) valorizadas${leido.ignoradas.length + rechazadas ? `, ${leido.ignoradas.length + rechazadas} ignorada(s)` : ""}.`,
      });
      setIgnoradas([
        ...leido.ignoradas,
        ...salida.no_reconocidas.map((n) => ({ linea: n.fila, texto: n.texto, motivo: n.motivo })),
      ]);
    } catch {
      setAviso({ ok: false, texto: "No se pudo valorizar la energía. Vuelve a intentarlo." });
    } finally {
      setOcupado(false);
    }
  }

  function vaciar() {
    setTexto("");
    setAviso(null);
    setIgnoradas([]);
    alVaciar();
  }

  return (
    <Tarjeta etiqueta={`Energía activa · ${periodoNombre}`} titulo="Cálculo preliminar de LVTEA con tu energía">
      <p className="nota">
        El costo marginal de {periodoNombre} ya está publicado: pega tus entregas y retiros y sale el monto.{" "}
        <strong className="formula-inline">Σ CMg<sub>(barra, día)</sub> × (Entrega − Retiro)</strong>.
        Positivo, cobras; negativo, pagas.
      </p>

      <div className="controles-sim">
        <div className="control-sim">
          <span className="etiqueta">Granularidad</span>
          <Segmento etiqueta="Granularidad" valor={granularidad} alCambiar={cambiarModo(setGranularidad)} opciones={[["mes", "Mensual"], ["dia", "Diaria"]]} />
        </div>
        <div className="control-sim">
          <span className="etiqueta">Detalle</span>
          <Segmento etiqueta="Detalle" valor={alcance} alCambiar={cambiarModo(setAlcance)} opciones={[["total", "Una barra"], ["barras", "Varias barras"]]} />
        </div>
        {alcance === "total" && (
          <div className="control-sim control-barra">
            <label className="etiqueta" htmlFor="sim-barra">Barra</label>
            <select id="sim-barra" value={barraActiva?.barrcodi ?? ""} onChange={(e) => setBarra(e.target.value)}>
              {barras.map((b) => <option key={b.barrcodi} value={b.barrcodi}>{b.barrnombre}</option>)}
            </select>
            {barraActiva && <span className="nota">CMg del mes {porMWh(barraActiva.cmg_promedio)}</span>}
          </div>
        )}
      </div>

      <label className="campo-sim campo-pegar" htmlFor="sim-texto">
        <span>
          Pega tus datos {granularidad === "dia" ? "(día · entregas · retiros)" : "(entregas · retiros)"}
          {alcance === "barras" ? ", con la barra delante" : ""}
        </span>
        <textarea
          id="sim-texto"
          rows={6}
          spellCheck={false}
          className="cifra"
          placeholder={ejemplo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <i>
          Desde Excel: copia las columnas y pega. Acepta tabulador, coma o punto y coma, con o sin cabecera,
          y números como 1.234,56 o 1,234.56. Energía en MWh.
        </i>
      </label>

      <div className="acciones-sim">
        <button type="button" className="boton" onClick={() => calcular()} disabled={ocupado}>{ocupado ? "Calculando…" : "Calcular"}</button>
        <button type="button" className="boton-secundario" onClick={() => calcular(ejemplo)} disabled={ocupado}>Poner un ejemplo</button>
        {(resultado || texto) && <button type="button" className="boton-secundario" onClick={vaciar}>Vaciar</button>}
        {aviso && <span className={aviso.ok ? "nota mensaje-ok" : "estado-error"}>{aviso.texto}</span>}
      </div>

      {resultado && <ResultadoEnergia r={resultado} granularidad={granularidad} cmgSistema={cmgSistema} />}

      {ignoradas.length > 0 && (
        <div className="nota lista-ignoradas">
          <strong>{ignoradas.length} línea(s) ignoradas:</strong>
          <ul>
            {ignoradas.slice(0, 5).map((x) => <li key={`${x.linea}-${x.texto}`}>línea {x.linea}: {String(x.texto).slice(0, 48)} — {x.motivo}</li>)}
            {ignoradas.length > 5 && <li>…y {ignoradas.length - 5} más</li>}
          </ul>
        </div>
      )}
    </Tarjeta>
  );
}

function ResultadoEnergia({ r, granularidad, cmgSistema }) {
  const diferenciaPromedio = r.al_promedio === null ? null : r.al_promedio - r.total;

  return (
    <>
      <div className="kpis kpis-sim">
        <div className="kpi kpi-acento">
          <p className="etiqueta">Monto LVTEA</p>
          <p className="kpi-valor cifra" style={{ color: colorSigno(r.total) }}>{soles(r.total)}</p>
          <p className="nota">{r.total >= 0 ? "a cobrar" : "a pagar"} · {r.filas} fila(s)</p>
        </div>
        <div className="kpi">
          <p className="etiqueta">Energía neta</p>
          <p className="kpi-valor cifra">{numero(r.energia_neta, 1)} <span className="nota">MWh</span></p>
          <p className="nota">entregados menos retirados</p>
        </div>
        <div className="kpi">
          <p className="etiqueta">CMg efectivo</p>
          <p className="kpi-valor cifra">{r.cmg_efectivo === null ? "—" : numero(r.cmg_efectivo * 1000, 2)}</p>
          <p className="nota">S/ por MWh · el que resulta de tu mezcla{cmgSistema ? ` (sistema: ${numero(cmgSistema * 1000, 2)})` : ""}</p>
        </div>
        {r.al_promedio !== null && (
          <div className="kpi">
            <p className="etiqueta">Si usaras el promedio del mes</p>
            <p className="kpi-valor cifra">{soles(r.al_promedio)}</p>
            <p className="nota" style={{ color: Math.abs(diferenciaPromedio) > Math.abs(r.total) * 0.02 ? "var(--warn-texto)" : undefined }}>
              {r.total ? `${((100 * diferenciaPromedio) / Math.abs(r.total)).toFixed(1)}% de diferencia` : "—"}
            </p>
          </div>
        )}
      </div>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead>
            <tr><th>Barra</th><th className="num">Entregas</th><th className="num">Retiros</th><th className="num">Neto</th><th className="num">CMg aplicado</th><th className="num">Monto</th></tr>
          </thead>
          <tbody>
            {r.por_barra.map((b) => (
              <tr key={b.barrcodi}>
                <td><strong>{b.barrnombre}</strong>{b.filas > 1 && <span className="nota"> {b.filas} filas</span>}</td>
                <td className="num">{numero(b.entregas, 1)}</td>
                <td className="num">{numero(b.retiros, 1)}</td>
                <td className="num">{numero(b.entregas - b.retiros, 1)}</td>
                <td className="num">
                  {numero(b.cmg_minimo * 1000, 2)}
                  {b.cmg_minimo !== b.cmg_maximo && <span className="nota"> a {numero(b.cmg_maximo * 1000, 2)}</span>}
                </td>
                <td className="num" style={{ color: colorSigno(b.monto) }}><strong>{soles(b.monto)}</strong></td>
              </tr>
            ))}
            <tr className="fila-total">
              <td>Total</td>
              <td className="num">{numero(r.entregas, 1)}</td>
              <td className="num">{numero(r.retiros, 1)}</td>
              <td className="num">{numero(r.energia_neta, 1)}</td>
              <td className="num">—</td>
              <td className="num" style={{ color: colorSigno(r.total) }}><strong>{soles(r.total)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="nota">
        Entregas y retiros en MWh; el CMg en S/ por MWh. Un neto positivo significa que entregas más de lo que retiras y por tanto <strong>cobras</strong>.
        {granularidad === "dia"
          ? " Cada fila se valoriza con el CMg de su día en su barra."
          : " Se usa el promedio del mes de cada barra; cambia a granularidad diaria si tienes el detalle: dentro de un mes el CMg diario puede moverse varias veces."}
        {r.sin_cmg > 0 && <> <strong>{r.sin_cmg} fila(s)</strong> quedaron sin valorizar porque ese día o esa barra no tiene CMg publicado; no se inventa un valor.</>}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- empresa

const ENTRADAS_VACIAS = { entregas: null, retiros: null, cmg: null, dc: null, precioPot: null, peaje: null, lscio: {}, sst: {}, fijo: {} };

function TusValores({ base, entradas, setEntradas, empresaNombre }) {
  const d = defectosDesde(base);
  const redondo = (v, n = 2) => (v === null || v === undefined ? "" : Number(Number(v).toFixed(n)));
  const g = (clave, def, n) => (entradas[clave] === null || entradas[clave] === undefined ? redondo(def, n) : entradas[clave]);
  const gs = (grupo, clave, def) => (entradas[grupo]?.[clave] === null || entradas[grupo]?.[clave] === undefined ? redondo(def) : entradas[grupo][clave]);
  const poner = (clave) => (v) => setEntradas((e) => ({ ...e, [clave]: v }));
  const ponerGrupo = (grupo, clave) => (v) => setEntradas((e) => ({ ...e, [grupo]: { ...e[grupo], [clave]: v } }));

  const lscioLiquidado = base.liquidado?.LSCIO?.monto ?? null;

  return (
    <Tarjeta etiqueta="Tus valores" titulo={`${empresaNombre} · ${base.perinombre}`}>
      <p className="nota">
        Los campos arrancan con lo que esta empresa tuvo de verdad ese mes; cámbialos y el resultado se recalcula.
        Déjalos vacíos para volver al valor observado. La energía activa se carga arriba; aquí van los otros tres procesos.
      </p>

      <h3 className="titulo-proceso" style={{ "--acento": COLOR_PROCESO.LVTP }}>{etiquetaProceso("LVTP")} · Potencia</h3>
      <div className="rejilla-campos">
        <Campo id="sim-dc" etiqueta="Demanda coincidente (MW)" valor={g("dc", d.dc, 3)} alCambiar={poner("dc")} ayuda="en la hora de punta; despejada del monto liquidado" />
        <Campo id="sim-precio" etiqueta="Precio de potencia (S/ por kW-mes)" valor={g("precioPot", d.precioPot)} alCambiar={poner("precioPot")} ayuda="sin peaje" paso="0.1" />
        <Campo id="sim-peaje" etiqueta="Peaje unitario (S/ por kW-mes)" valor={g("peaje", d.peaje)} alCambiar={poner("peaje")} ayuda="conexión + transmisión" paso="0.1" />
      </div>

      <h3 className="titulo-proceso" style={{ "--acento": COLOR_PROCESO.LSCIO }}>{etiquetaProceso("LSCIO")} · Servicios Complementarios</h3>
      <p className="nota">
        {lscioLiquidado === null
          ? "Este mes la empresa no liquidó servicios complementarios; los tres mecanismos arrancan en cero."
          : `Los tres mecanismos arrancan con lo liquidado (${soles(lscioLiquidado)} en total).`}
      </p>
      <div className="rejilla-campos">
        <Campo id="sim-reactiva" etiqueta="Reactiva (S/)" valor={gs("lscio", "reactiva", d.lscio.reactiva)} alCambiar={ponerGrupo("lscio", "reactiva")} />
        <Campo id="sim-rsf" etiqueta="RSF (S/)" valor={gs("lscio", "rsf", d.lscio.rsf)} alCambiar={ponerGrupo("lscio", "rsf")} ayuda="regulación secundaria de frecuencia" />
        <Campo id="sim-inflex" etiqueta="Inflexibilidad operativa (S/)" valor={gs("lscio", "inflexibilidad", d.lscio.inflexibilidad)} alCambiar={ponerGrupo("lscio", "inflexibilidad")} />
      </div>

      <h3 className="titulo-proceso" style={{ "--acento": COLOR_PROCESO["SST-SCT"] }}>SST-SCT · Transmisión secundaria</h3>
      <div className="rejilla-campos">
        <Campo id="sim-uso" etiqueta="Criterio de uso (S/)" valor={gs("sst", "criterio_uso", d.sst.criterio_uso)} alCambiar={ponerGrupo("sst", "criterio_uso")} ayuda="pago por distancia eléctrica" />
        <Campo id="sim-ktit" etiqueta="Ingreso tarifario (S/)" valor={gs("sst", "ingreso_tarifario", d.sst.ingreso_tarifario)} alCambiar={ponerGrupo("sst", "ingreso_tarifario")} ayuda="K del titular × % de potencia" />
      </div>

      <h3 className="titulo-proceso">¿Ya sabes alguno?</h3>
      <p className="nota">Si tienes el monto cerrado de algún proceso, escríbelo aquí y el simulador lo respeta en vez de estimarlo.</p>
      <div className="rejilla-campos">
        {PROCESOS_SIMULADOR.map((p) => (
          <Campo key={p} id={`sim-fijo-${p}`} etiqueta={`${etiquetaProceso(p)} (S/)`} valor={entradas.fijo?.[p] ?? ""} alCambiar={ponerGrupo("fijo", p)} />
        ))}
      </div>
    </Tarjeta>
  );
}

function CalculoPreliminar({ base, calculo, via, escenario, granularidad }) {
  const procesos = calculo.procesos;
  const total = PROCESOS_SIMULADOR.reduce((s, p) => s + (procesos[p].usado ?? 0), 0);
  const totalLiquidado = PROCESOS_SIMULADOR.reduce((s, p) => s + (procesos[p].liquidado ?? 0), 0);
  const diferencia = total - totalLiquidado;

  return (
    <Tarjeta
      etiqueta="Cálculo preliminar"
      titulo={`${via === "formula" ? "Por fórmula" : "Por cuota histórica"}${escenario ? ` · escenario ${escenario > 0 ? "+" : ""}${escenario}%` : ""}`}
    >
      <div className="kpis kpis-sim">
        <div className="kpi kpi-acento">
          <p className="etiqueta">Total simulado</p>
          <p className="kpi-valor cifra" style={{ color: colorSigno(total) }}>{soles(total)}</p>
          <p className="nota">suma de los cuatro procesos · {total >= 0 ? "a favor" : "a pagar"}</p>
        </div>
        <div className="kpi">
          <p className="etiqueta">Liquidado en {base.perinombre}</p>
          <p className="kpi-valor cifra" style={{ color: colorSigno(totalLiquidado) }}>{soles(totalLiquidado)}</p>
          <p className="nota">última revisión conocida</p>
        </div>
        <div className="kpi">
          <p className="etiqueta">Diferencia</p>
          <p className="kpi-valor cifra" style={{ color: colorSigno(diferencia) }}>{conSigno(diferencia)}</p>
          <p className="nota">{totalLiquidado ? `${((100 * diferencia) / Math.abs(totalLiquidado)).toFixed(1)}% sobre lo liquidado` : "—"}</p>
        </div>
      </div>

      <div className="tabla-scroll">
        <table className="tabla">
          <thead><tr><th>Proceso</th><th className="num">Simulado</th><th className="num">Liquidado</th><th className="num">Diferencia</th></tr></thead>
          <tbody>
            {PROCESOS_SIMULADOR.map((p) => {
              const o = procesos[p];
              const sinCargar = p === "LSCIO" && o.detalle?.vacio && via === "formula" && o.fijo === null;
              const origen = o.fijo !== null
                ? "dato tuyo"
                : p === "LVTA" && o.detalle?.delDetalle
                  ? `tu energía, ${granularidad === "dia" ? "día a día" : "por barra"}`
                  : via === "formula" ? "por fórmula" : "por cuota";
              return (
                <tr key={p}>
                  <td>
                    <strong style={{ color: COLOR_PROCESO[p] }}>{etiquetaProceso(p)}</strong>
                    <span className="nota"> {NOMBRE_PROCESO[p]} · {origen}</span>
                  </td>
                  <td className="num" style={{ color: colorSigno(o.usado) }}>{sinCargar ? <span className="nota">sin cargar</span> : <strong>{soles(o.usado)}</strong>}</td>
                  <td className="num">{o.liquidado === null ? <span className="nota">sin liquidar</span> : soles(o.liquidado)}</td>
                  <td className="num" style={{ color: colorSigno(o.diferencia) }}>
                    {sinCargar || o.diferencia === null ? "—" : (
                      <>
                        {conSigno(o.diferencia)}
                        {o.liquidado ? <span className="nota"> {((100 * o.diferencia) / Math.abs(o.liquidado)).toFixed(1)}%</span> : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="nota">
        <strong>Por cuota</strong> aplica la participación histórica de la empresa al volumen que movió el sistema ese mes: reproduce lo que suele liquidarse.
        <strong> Por fórmula</strong> aplica la regla de cada proceso a tus valores: es exacta si los valores son tuyos y completos.
        {procesos.LVTA.usado < 0 && procesos.LVTA.detalle?.delDetalle && " LVTEA sale negativo: con esa energía retiras más de lo que entregas y pagas en vez de cobrar."}
      </p>
    </Tarjeta>
  );
}

function Formulas({ base, calculo, energiaValorizada, granularidad, empresaNombre }) {
  const v = calculo.valores;
  const o = calculo.procesos;
  const conEnergia = Boolean(energiaValorizada?.filas);
  const cmgMWh = numero(v.cmg * 1000, 2);

  // La relacion entre lo liquidado y lo que da la formula con la energia
  // registrada solo tiene sentido si los dos tienen el mismo signo.
  const lvtea = o.LVTA;
  const razon =
    !conEnergia && lvtea.liquidado && lvtea.porFormula && Math.sign(lvtea.liquidado) === Math.sign(lvtea.porFormula)
      ? Math.abs(lvtea.liquidado / lvtea.porFormula)
      : null;

  const bloque = (p, formula, sustitucion, nota) => (
    <div className="bloque-formula" style={{ "--acento": COLOR_PROCESO[p] }} key={p}>
      <header>
        <strong style={{ color: COLOR_PROCESO[p] }}>{etiquetaProceso(p)}</strong>
        <span className="nota">{NOMBRE_PROCESO[p]}</span>
      </header>
      <code className="formula">{formula}</code>
      <code className="formula sustitucion cifra">{sustitucion}</code>
      <p className="resultado-formula">
        = <strong className="cifra" style={{ color: colorSigno(o[p].porFormula) }}>{soles(o[p].porFormula)}</strong>
        <span className="nota"> por fórmula</span>
        {o[p].porCuota !== null && <span className="nota"> · por cuota <strong className="cifra">{soles(o[p].porCuota)}</strong></span>}
        {o[p].liquidado !== null && <span className="nota"> · liquidado <strong className="cifra">{soles(o[p].liquidado)}</strong></span>}
      </p>
      {nota && <p className="nota">{nota}</p>}
    </div>
  );

  return (
    <Tarjeta etiqueta="Las fórmulas, con tus números" titulo={`${empresaNombre} · ${base.perinombre}`}>
      <div className="rejilla rejilla-2">
        {bloque(
          "LVTA",
          conEnergia
            ? "LVTEA = Σ barra Σ día  CMg(b,d) × ( Entrega(b,d) − Retiro(b,d) )"
            : "LVTEA = Σ barra  CMg(b) × ( Entrega(b) − Retiro(b) )",
          conEnergia
            ? `= ${energiaValorizada.filas} fila(s) × su CMg ${granularidad === "dia" ? "del día" : "del mes"}, barra a barra`
            : `= ${cmgMWh} S/ por MWh × ( ${numero(v.entregas, 0)} − ${numero(v.retiros, 0)} ) MWh`,
          conEnergia
            ? `Calculado con tus ${energiaValorizada.filas} fila(s) de energía, ${granularidad === "dia" ? "día a día" : "con el promedio mensual de cada barra"}. El CMg lo pone el mercado; la energía la pones tú.`
            : razon
              ? `Con la energía registrada de la empresa la fórmula da ${numero(razon, 1)} veces menos que lo liquidado: la energía de este mes es una muestra, no el total. La fórmula es correcta; los insumos son parciales. Si pegas arriba tus MWh reales, el resultado sí es el tuyo.`
              : "Se aplica con el CMg promedio del sistema; la valorización oficial lo hace barra por barra y cada 15 minutos. Pega tu energía arriba para afinarlo.",
        )}
        {bloque(
          "LVTP",
          "LVTP = Demanda coincidente × ( Precio de potencia + Peaje ) × 1000",
          `= ${numero(v.dc, 3)} MW × ( ${numero(v.precioPot, 2)} + ${numero(v.peaje, 2)} ) S/ por kW-mes × 1000`,
          "La demanda coincidente arranca despejada del monto liquidado con precios de referencia, porque el dato en MW no se publica. El signo sigue al de tu liquidación: si en potencia cobras, se muestra como cobro.",
        )}
        {bloque(
          "LSCIO",
          "LSCIO = Reactiva + RSF + Inflexibilidad operativa",
          `= ${soles(v.lscio.reactiva)} + ${soles(v.lscio.rsf)} + ${soles(v.lscio.inflexibilidad)}`,
          o.LSCIO.detalle?.vacio ? "Los tres mecanismos están en cero: escríbelos en Tus valores para que la fórmula tenga con qué trabajar." : "Los tres mecanismos arrancan con lo que la empresa liquidó en cada uno.",
        )}
        {bloque(
          "SST-SCT",
          "SST-SCT = Criterio de uso + Ingreso tarifario",
          `= ${soles(v.sst.criterio_uso)} + ${soles(v.sst.ingreso_tarifario)}`,
          "El criterio de uso reparte cada obra según cuánto la usa cada generador (distancia eléctrica); el ingreso tarifario es la constante del titular por su participación en potencia.",
        )}
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- seccion

export function Simulador() {
  const { periodo, periodos, empresa, empresas } = useSeleccion();
  const periodoNombre = periodos.find((p) => p.pericodi === periodo)?.perinombre ?? String(periodo ?? "");
  const ficha = empresas.find((e) => e.empresa_id === empresa);
  const empresaNombre = ficha ? nombreEmpresa(ficha) : null;

  const [via, setVia] = useState("cuota");
  const [escenario, setEscenario] = useState(0);
  const [barras, setBarras] = useState({ pericodi: null, lista: [], cmgSistema: null });
  const [base, setBase] = useState({ clave: null, datos: null, error: null });
  const [energia, setEnergia] = useState(null);
  const [entradas, setEntradas] = useState(ENTRADAS_VACIAS);

  useEffect(() => {
    if (!periodo) return;
    let vigente = true;
    obtenerBarrasSimulador(periodo)
      .then((d) => { if (vigente) setBarras({ pericodi: periodo, lista: d.barras, cmgSistema: d.cmg_sistema }); })
      .catch(() => { if (vigente) setBarras({ pericodi: periodo, lista: [], cmgSistema: null }); });
    return () => { vigente = false; };
  }, [periodo]);

  const claveBase = periodo && empresa ? `${empresa}-${periodo}` : null;
  useEffect(() => {
    if (!claveBase) return;
    let vigente = true;
    obtenerBaseSimulador(empresa, periodo)
      .then((d) => { if (vigente) setBase({ clave: claveBase, datos: d, error: null }); })
      .catch((e) => {
        if (!vigente) return;
        setBase({
          clave: claveBase, datos: null,
          error: e.response?.status === 404
            ? "Esta empresa no tiene liquidación ni energía registrada en este periodo."
            : "No se pudo contactar con el servicio de liquidaciones.",
        });
      });
    return () => { vigente = false; };
  }, [claveBase, empresa, periodo]);

  // Al cambiar de empresa o de mes se sueltan los valores escritos y la
  // energia pegada: eran de la seleccion anterior.
  const [claveVista, setClaveVista] = useState(claveBase);
  if (claveBase !== claveVista) {
    setClaveVista(claveBase);
    setEntradas(ENTRADAS_VACIAS);
    setEnergia(null);
  }

  const datosBase = base.clave === claveBase ? base.datos : null;
  const calculo = useMemo(
    () => (datosBase ? calcularProcesos({ base: datosBase, entradas, via, escenario, energiaValorizada: energia }) : null),
    [datosBase, entradas, via, escenario, energia],
  );

  const granularidad = energia?.granularidad ?? "mes";
  const cargandoBarras = Boolean(periodo) && barras.pericodi !== periodo;

  return (
    <div className="rejilla simulador">
      <section className="hero-periodo hero-simulador">
        <div>
          <p className="etiqueta">Simulador</p>
          <h2>{empresaNombre ?? "Elige una empresa"} <span className="nota">· {periodoNombre}</span></h2>
          <p className="nota">
            {empresaNombre
              ? "Estima la liquidación del mes antes de que salga: con tu energía, con tus valores o con la participación histórica."
              : "La valorización de energía funciona sin empresa. Para simular los cuatro procesos, elige una arriba a la derecha."}
          </p>
        </div>
        <div className="controles-sim controles-hero">
          <div className="control-sim">
            <span className="etiqueta">Método</span>
            <Segmento etiqueta="Método de cálculo" valor={via} alCambiar={setVia} opciones={[["cuota", "Por cuota"], ["formula", "Por fórmula"]]} />
          </div>
          <div className="control-sim control-escenario">
            <label className="etiqueta" htmlFor="sim-escenario">Escenario</label>
            <div className="escenario">
              <input id="sim-escenario" type="range" min={-50} max={50} step={5} value={escenario} onChange={(e) => setEscenario(Number(e.target.value))} aria-label="Variación de los drivers" />
              <strong className="cifra">{escenario > 0 ? "+" : ""}{escenario}%</strong>
            </div>
            <span className="nota">mueve retiros, costo marginal y demanda</span>
          </div>
        </div>
      </section>

      {cargandoBarras ? (
        <p className="estado">Cargando barras…</p>
      ) : (
        <EnergiaActiva
          periodo={periodo}
          periodoNombre={periodoNombre}
          barras={barras.lista}
          cmgSistema={barras.cmgSistema}
          resultado={energia}
          alValorizar={setEnergia}
          alVaciar={() => setEnergia(null)}
        />
      )}

      {claveBase && base.clave !== claveBase && <p className="estado">Cargando la empresa…</p>}
      {claveBase && base.clave === claveBase && base.error && <p className="estado estado-error">{base.error}</p>}

      {datosBase && calculo && (
        <>
          <div className="rejilla rejilla-2 par-sim">
            <TusValores base={datosBase} entradas={entradas} setEntradas={setEntradas} empresaNombre={empresaNombre} />
            <CalculoPreliminar base={datosBase} calculo={calculo} via={via} escenario={escenario} granularidad={granularidad} />
          </div>
          <Formulas base={datosBase} calculo={calculo} energiaValorizada={energia} granularidad={granularidad} empresaNombre={empresaNombre} />
        </>
      )}

      {!empresa && (
        <Tarjeta etiqueta="Los cuatro procesos" titulo="Qué calcula el simulador con una empresa elegida">
          <div className="rejilla rejilla-2">
            {PROCESOS_SIMULADOR.map((p) => (
              <div key={p} className="bloque-formula" style={{ "--acento": COLOR_PROCESO[p] }}>
                <header><strong style={{ color: COLOR_PROCESO[p] }}>{etiquetaProceso(p)}</strong><span className="nota">{NOMBRE_PROCESO[p]}</span></header>
                <code className="formula">
                  {p === "LVTA" && "Σ CMg × ( Entrega − Retiro )"}
                  {p === "LVTP" && "Demanda coincidente × ( Precio de potencia + Peaje )"}
                  {p === "LSCIO" && "Reactiva + RSF + Inflexibilidad operativa"}
                  {p === "SST-SCT" && "Criterio de uso + Ingreso tarifario"}
                </code>
              </div>
            ))}
          </div>
          <p className="nota">Los campos arrancan con lo que la empresa tuvo de verdad en el mes elegido, y el resultado se compara con lo liquidado.</p>
        </Tarjeta>
      )}
    </div>
  );
}
