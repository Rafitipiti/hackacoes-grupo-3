import { clasificarVariacion } from "../lib/variaciones.js";

const TITULOS = {
  "normal": "Variacion respecto del periodo anterior",
  "cambio-signo": "Cambio de posicion: la empresa paso de cobrar a pagar o al reves",
  "fuera-de-rango": "Variacion demasiado grande para expresarla en porcentaje",
  "sin-dato": "Sin periodo base para comparar",
};

export function Variacion({ actual, anterior }) {
  const v = clasificarVariacion(actual, anterior);

  // La flecha indica direccion, nunca si algo es bueno o malo: en
  // liquidaciones subir es favorable o no segun si la empresa cobra o paga.
  const flecha =
    v.delta === null || v.delta === 0 ? "" : v.delta > 0 ? "▲" : "▼";

  return (
    <span
      className={`variacion mag-${v.magnitud} tipo-${v.tipo}`}
      title={TITULOS[v.tipo]}
    >
      {flecha && <span aria-hidden="true">{flecha}</span>}
      <span className="cifra">{v.texto}</span>
      {v.magnitud !== "normal" && (
        <span className="sello">
          {v.magnitud === "fuerte" ? "Fuerte" : "Revisar"}
        </span>
      )}
    </span>
  );
}
