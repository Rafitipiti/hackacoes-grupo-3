import { useEffect, useId, useRef, useState } from "react";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];

export function nombreMes(periodo) {
  if (!periodo) return "—";
  return `${MESES_LARGOS[periodo.perimes - 1] ?? periodo.perimes} ${periodo.perianio}`;
}

/**
 * Calendario de meses para elegir la publicacion (peticion del usuario,
 * 2026-09-16): un boton con el mes elegido que abre una rejilla de doce
 * meses por año. Solo se pueden pulsar los meses con publicacion; los
 * demas se ven apagados para que se entienda hasta donde llega el dato.
 */
export function SelectorPeriodo({ periodos, valor, alCambiar, id }) {
  const [abierto, setAbierto] = useState(false);
  const actual = periodos.find((p) => p.pericodi === valor) ?? null;
  const [anio, setAnio] = useState(actual?.perianio ?? new Date().getFullYear());
  const raiz = useRef(null);
  const idPanel = useId();

  // Si la seleccion cambia desde fuera, el calendario se abre en su año.
  const [valorVisto, setValorVisto] = useState(valor);
  if (valor !== valorVisto) {
    setValorVisto(valor);
    if (actual) setAnio(actual.perianio);
  }

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) {
      if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
    }
    function tecla(e) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const anios = [...new Set(periodos.map((p) => p.perianio))].sort((a, b) => a - b);
  const porMes = new Map(periodos.filter((p) => p.perianio === anio).map((p) => [p.perimes, p]));
  const indice = anios.indexOf(anio);

  function elegir(p) {
    alCambiar(p.pericodi);
    setAbierto(false);
  }

  return (
    <div className="selector-periodo" ref={raiz}>
      <button
        type="button"
        id={id}
        className="boton-periodo"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="icono-calendario" aria-hidden="true">▦</span>
        <span>{nombreMes(actual)}</span>
        <span className="flecha" aria-hidden="true">{abierto ? "▴" : "▾"}</span>
      </button>

      {abierto && (
        <div className="calendario-meses" id={idPanel} role="dialog" aria-label="Elegir publicación">
          <div className="calendario-anio">
            <button type="button" className="boton-secundario" onClick={() => setAnio(anios[indice - 1])} disabled={indice <= 0} aria-label="Año anterior">‹</button>
            <strong>{anio}</strong>
            <button type="button" className="boton-secundario" onClick={() => setAnio(anios[indice + 1])} disabled={indice < 0 || indice >= anios.length - 1} aria-label="Año siguiente">›</button>
          </div>
          <div className="rejilla-meses">
            {MESES.map((nombre, i) => {
              const p = porMes.get(i + 1);
              const elegido = p && p.pericodi === valor;
              return (
                <button
                  key={nombre}
                  type="button"
                  className={`mes${elegido ? " elegido" : ""}${p ? "" : " sin-dato"}`}
                  disabled={!p}
                  aria-pressed={Boolean(elegido)}
                  title={p ? `${MESES_LARGOS[i]} ${anio}` : "Sin publicación"}
                  onClick={() => p && elegir(p)}
                >
                  {nombre}
                </button>
              );
            })}
          </div>
          <p className="nota">Solo se pueden elegir los meses con publicación.</p>
        </div>
      )}
    </div>
  );
}
