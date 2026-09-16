import { useEffect, useState } from "react";

import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { porcentaje, soles } from "../lib/formato.js";
import { obtenerCalendario, obtenerCascada, obtenerImpacto } from "../api/revisiones.js";
import { useSeleccion } from "../app/contexto.jsx";

const NOMBRE_PROCESO = {
  "LVTA": "Energia Activa",
  "LVTP": "Potencia",
  "LSCIO": "Servicios Complementarios",
  "SST-SCT": "Sistemas Secundarios de Transmision",
};

function Impacto({ datos }) {
  const total = Math.abs(datos.corriente) + Math.abs(datos.arrastre);
  const pctArrastre = total === 0 ? 0 : Math.abs(datos.arrastre) / total;

  return (
    <Tarjeta
      etiqueta="Que trae esta publicacion"
      titulo="Del mes corriente y de meses anteriores"
    >
      <div className="rejilla rejilla-2">
        <div className="bloque-impacto">
          <p className="etiqueta">Liquidacion del mes</p>
          <p className="cifra grande">{soles(datos.corriente)}</p>
          <p className="nota">Es la R0, la primera version de este mes.</p>
        </div>

        <div className="bloque-impacto">
          <p className="etiqueta">Ajuste de meses anteriores</p>
          <p className="cifra grande">{soles(datos.arrastre)}</p>
          <p className="nota">
            Suma de los ajustes de {datos.periodos_arrastrados} periodo(s)
            recalculados. Es la diferencia contra su revision previa, no el
            monto completo: sumar montos restatados seria doble contabilidad.
          </p>
        </div>
      </div>

      <div className="barra-proporcion" aria-hidden="true">
        <span style={{ width: `${(1 - pctArrastre) * 100}%` }} className="parte-corriente" />
        <span style={{ width: `${pctArrastre * 100}%` }} className="parte-arrastre" />
      </div>
      <p className="nota">
        El {porcentaje(pctArrastre, 0)} del movimiento de esta publicacion
        corresponde a recalculos de meses anteriores.
      </p>
    </Tarjeta>
  );
}

function Calendario({ entradas }) {
  const porProceso = entradas.reduce((acc, e) => {
    (acc[e.proceso] ??= []).push(e);
    return acc;
  }, {});

  return (
    <Tarjeta
      etiqueta="Calendario de publicacion"
      titulo="Que liquidaciones salen en este mes"
    >
      <p className="nota">
        COES no publica una liquidacion una sola vez: la publicacion de un mes
        trae la R0 de ese mes mas recalculos de meses anteriores.
      </p>

      <div className="rejilla rejilla-2">
        {Object.entries(porProceso).map(([proceso, filas]) => (
          <div key={proceso}>
            <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
            <table className="tabla">
              <thead>
                <tr><th>Mes liquidado</th><th>Revision</th></tr>
              </thead>
              <tbody>
                {filas
                  .sort((a, b) => a.pericodi - b.pericodi)
                  .map((f) => (
                    <tr key={`${f.pericodi}-${f.revision}`}>
                      <td>{f.perianiomes}</td>
                      <td>{f.revision_nombre}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function Cascada({ procesos }) {
  return (
    <Tarjeta
      etiqueta="Cascada de revisiones"
      titulo="Como cambio el monto de este mes, revision por revision"
    >
      <p className="nota">
        Cada proceso tiene su propia cadena: un mes puede llegar a R3 en
        Energia Activa y solo a R1 en Potencia. Por eso se muestran separados.
      </p>

      {Object.entries(procesos).map(([proceso, pasos]) => (
        <div key={proceso} className="cadena">
          <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Revision</th>
                <th className="num">Monto restatado</th>
                <th className="num">Ajuste</th>
                <th className="num">%</th>
                <th>Publicada en</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p) => (
                <tr key={p.revision}>
                  <td>{p.revision_nombre}</td>
                  <td className="num">{soles(p.monto_total)}</td>
                  <td className="num">{p.ajuste === null ? "—" : soles(p.ajuste)}</td>
                  <td className="num">{p.ajuste_pct === null ? "—" : porcentaje(p.ajuste_pct)}</td>
                  <td>{p.publicacion_pericodi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Tarjeta>
  );
}

export function CicloRevisiones() {
  const { periodo, empresa } = useSeleccion();

  const [impacto, setImpacto] = useState(null);
  const [calendario, setCalendario] = useState(null);
  const [cascada, setCascada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!periodo) return;

    let vigente = true;
    setCargando(true);
    setError(null);

    async function cargar() {
      try {
        const [i, c] = await Promise.all([
          obtenerImpacto(periodo),
          obtenerCalendario(periodo),
        ]);

        if (!vigente) return;

        setImpacto(i);
        setCalendario(c.entradas);

        if (empresa) {
          const casc = await obtenerCascada(empresa, periodo);
          if (vigente) setCascada(casc.procesos);
        } else {
          setCascada(null);
        }
      } catch (e) {
        if (vigente) setError(e.response?.status === 404 ? "sin datos para este periodo" : e.message);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [periodo, empresa]);

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!impacto}>
      <div className="rejilla">
        {impacto && <Impacto datos={impacto} />}
        {calendario && <Calendario entradas={calendario} />}

        {cascada
          ? <Cascada procesos={cascada} />
          : (
            <Tarjeta etiqueta="Cascada de revisiones" titulo="Elige una empresa">
              <p className="nota">
                Selecciona una empresa en la barra lateral para ver como
                evoluciono su liquidacion revision por revision.
              </p>
            </Tarjeta>
          )}
      </div>
    </EstadoCarga>
  );
}
