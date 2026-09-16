import { useEffect, useState } from "react";

import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { porcentaje, soles } from "../lib/formato.js";
import { obtenerCalendario, obtenerCascada, obtenerImpacto } from "../api/revisiones.js";
import { useSeleccion } from "../app/contexto.jsx";

const NOMBRE_PROCESO = {
  "LVTA": "Energía Activa",
  "LVTP": "Potencia",
  "LSCIO": "Servicios Complementarios",
  "SST-SCT": "Sistemas Secundarios de Transmisión",
};

function Impacto({ datos }) {
  const neto = datos.corriente + datos.arrastre;
  const escala = Math.max(Math.abs(datos.corriente), Math.abs(datos.arrastre)) || 1;

  return (
    <Tarjeta
      etiqueta="Qué trae esta publicación"
      titulo="Del mes corriente y de meses anteriores"
    >
      <div className="rejilla rejilla-2">
        <div className="bloque-impacto">
          <p className="etiqueta">Liquidación del mes</p>
          <p className="cifra grande">{soles(datos.corriente)}</p>
          <p className="nota">Es la R0, la primera versión de este mes.</p>
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

      <div className="barras-impacto">
        <div className="fila-barra">
          <span className="etiqueta-barra">Mes corriente</span>
          <div className="riel">
            <span
              className="barra positiva"
              aria-hidden="true"
              style={{ width: `${(Math.abs(datos.corriente) / escala) * 100}%` }}
            />
          </div>
          <span className="cifra valor-barra">{soles(datos.corriente)}</span>
        </div>

        <div className="fila-barra">
          <span className="etiqueta-barra">Ajuste de meses anteriores</span>
          <div className="riel">
            <span
              className={datos.arrastre < 0 ? "barra negativa" : "barra positiva"}
              aria-hidden="true"
              style={{ width: `${(Math.abs(datos.arrastre) / escala) * 100}%` }}
            />
          </div>
          <span className="cifra valor-barra">{soles(datos.arrastre)}</span>
        </div>
      </div>

      <p className="nota">
        Neto de la publicacion:{" "}
        <strong className="cifra">{soles(neto)}</strong>.{" "}
        {datos.arrastre < 0
          ? "Los recálculos de meses anteriores reducen lo que se publica este mes."
          : "Los recálculos de meses anteriores aumentan lo que se publica este mes."}
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
      etiqueta="Calendario de publicación"
      titulo="Qué liquidaciones salen en este mes"
    >
      <p className="nota">
        COES no publica una liquidación una sola vez: la publicación de un mes
        trae la R0 de ese mes más recálculos de meses anteriores.
      </p>

      <div className="rejilla rejilla-2">
        {Object.entries(porProceso).map(([proceso, filas]) => (
          <div key={proceso}>
            <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Mes liquidado</th><th>Revisión</th></tr>
                </thead>
                <tbody>
                  {filas
                    .sort((a, b) => a.pericodi - b.pericodi)
                    .map((f) => (
                      <tr key={`${f.pericodi}-${f.revision}`}>
                        <td>
                          {f.perianiomes}
                        </td>
                        <td>{f.revision_nombre}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
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
      titulo="Cómo cambió el monto de este mes, revisión por revisión"
    >
      <p className="nota">
        Cada proceso tiene su propia cadena: un mes puede llegar a R3 en
        Energía Activa y solo a R1 en Potencia. Por eso se muestran separados.
      </p>

      {Object.entries(procesos).map(([proceso, pasos]) => (
        <div key={proceso} className="cadena">
          <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Revisión</th>
                  <th className="num">Monto restatado</th>
                  <th className="num">Ajuste</th>
                  <th className="num">%</th>
                  <th>Publicada en</th>
                </tr>
              </thead>
              <tbody>
                {pasos.map((p) => (
                  <tr key={p.revision}>
                    <td>
                      {p.revision_nombre}
                    </td>
                    <td className="num">{soles(p.monto_total)}</td>
                    <td className="num">{p.ajuste === null ? "—" : soles(p.ajuste)}</td>
                    <td className="num">{p.ajuste_pct === null ? "—" : porcentaje(p.ajuste_pct)}</td>
                    <td>{p.publicacion_pericodi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const [sinDatos, setSinDatos] = useState(false);
  const [errorCascada, setErrorCascada] = useState(null);

  useEffect(() => {
    if (!periodo) return;

    let vigente = true;
    setCargando(true);
    setError(null);
    setSinDatos(false);
    setErrorCascada(null);

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
          try {
            const casc = await obtenerCascada(empresa, periodo);
            if (vigente) {
              setCascada(casc.procesos);
              setErrorCascada(null);
            }
          } catch (e) {
            if (vigente) {
              setCascada(null);
              setErrorCascada(
                e.response?.status === 404
                  ? "Esta empresa no tiene revisiones registradas en este periodo."
                  : "No se pudo contactar con el servicio de liquidaciones.",
              );
            }
          }
        } else {
          setCascada(null);
          setErrorCascada(null);
        }
      } catch (e) {
        if (!vigente) return;
        // Un periodo abierto (como el ultimo del calendario) todavia no
        // tiene reportes intermedios: no es una falla del servicio, es un
        // estado esperado que se explica, no se muestra como error tecnico.
        if (e.response?.status === 404) {
          setSinDatos(true);
        } else {
          setError("No se pudo contactar con el servicio de liquidaciones.");
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [periodo, empresa]);

  return (
    <EstadoCarga
      cargando={cargando}
      error={error}
      vacio={sinDatos || !impacto}
      mensajeVacio="Este periodo aún no tiene revisiones publicadas. Los periodos abiertos publican su calendario y cascada al cerrar el mes: elige un periodo cerrado en la barra lateral para ver el ciclo completo."
    >
      <div className="rejilla">
        {impacto && <Impacto datos={impacto} />}
        {calendario && <Calendario entradas={calendario} />}

        {cascada ? (
          <Cascada procesos={cascada} />
        ) : (
          <Tarjeta etiqueta="Cascada de revisiones" titulo={empresa ? "Sin revisiones para esta empresa" : "Elige una empresa"}>
            <p className="nota">
              {errorCascada ??
                "Selecciona una empresa en la barra lateral para ver como evoluciono su liquidación revisión por revisión."}
            </p>
          </Tarjeta>
        )}
      </div>
    </EstadoCarga>
  );
}
