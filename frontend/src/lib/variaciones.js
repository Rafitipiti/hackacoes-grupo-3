import { soles } from "./formato.js";

// Umbrales de magnitud. Marcan cuanto merece atencion una variacion,
// no si es buena o mala: en liquidaciones subir es favorable o no segun
// si la empresa cobra o paga.
const UMBRAL_REVISAR = 0.25;
const UMBRAL_FUERTE = 0.5;

// Por encima de esto el porcentaje deja de informar y se muestra el delta.
const LIMITE_PORCENTAJE = 9.99;

function magnitudDe(pct) {
  const absoluto = Math.abs(pct);

  if (absoluto >= UMBRAL_FUERTE) return "fuerte";
  if (absoluto >= UMBRAL_REVISAR) return "revisar";

  return "normal";
}

function abreviar(monto) {
  const absoluto = Math.abs(monto);

  if (absoluto >= 1e6) return `${(monto / 1e6).toFixed(1)} M`;
  if (absoluto >= 1e3) return `${(monto / 1e3).toFixed(0)} k`;

  return monto.toFixed(0);
}

/**
 * Decide tipo/texto/magnitud a partir de delta y pct YA CALCULADOS (pct es
 * la fraccion delta/abs(anterior), la misma convencion que usa
 * clasificarVariacion). Es la parte de la decision que SI se puede tomar
 * sin conocer el signo real de "anterior" por separado.
 *
 * cambioSigno es opcional: quien ya sepa (porque tiene actual y anterior
 * con su signo real, como clasificarVariacion) que el monto cruzo cero lo
 * indica aqui. Sin ese dato esta funcion NO puede reconstruir un cambio de
 * signo de forma confiable: delta y pct (con anterior en valor absoluto)
 * no alcanzan para distinguir "cruzo cero" de "vario mucho sin cruzarlo"
 * (dos periodos negativos, uno mucho mas negativo que el otro, dan el
 * mismo pct que un cruce de cero real). Por eso las filas del radar, que
 * solo traen delta y pct, nunca muestran "cambio-signo": degradan a
 * "normal" o "fuera-de-rango" segun la magnitud, sin inventar un cruce que
 * no se puede confirmar.
 */
export function describirVariacion({ delta, pct, cambioSigno = false }) {
  const faltaDato =
    delta === null || delta === undefined ||
    pct === null || pct === undefined;

  if (faltaDato) {
    return { tipo: "sin-dato", texto: "s/d", delta: null, pct: null, magnitud: "normal" };
  }

  if (cambioSigno) {
    return {
      tipo: "cambio-signo",
      texto: `↔ ${soles(delta, 0)}`,
      delta,
      pct,
      magnitud: magnitudDe(pct),
    };
  }

  if (Math.abs(pct) > LIMITE_PORCENTAJE) {
    const signoDelta = delta < 0 ? "-" : "";

    return {
      tipo: "fuera-de-rango",
      texto: `Δ ${signoDelta}S/ ${abreviar(Math.abs(delta))}`,
      delta,
      pct,
      magnitud: "fuerte",
    };
  }

  const signo = pct > 0 ? "+" : "";

  return {
    tipo: "normal",
    texto: `${signo}${(pct * 100).toFixed(1)}%`,
    delta,
    pct,
    magnitud: magnitudDe(pct),
  };
}

/**
 * Clasifica una variacion entre dos periodos.
 *
 * Un porcentaje engaña en tres casos, y los tres se distinguen aqui:
 * cuando el monto cambia de signo (pasar de cobrar a pagar no es un
 * porcentaje, es un cambio de posicion), cuando la variacion es tan
 * grande que el porcentaje deja de informar, y cuando no hay base
 * contra la cual comparar.
 */
export function clasificarVariacion(actual, anterior) {
  const faltaDato =
    actual === null || actual === undefined ||
    anterior === null || anterior === undefined ||
    anterior === 0;

  if (faltaDato) {
    return { tipo: "sin-dato", texto: "s/d", delta: null, pct: null, magnitud: "normal" };
  }

  const delta = actual - anterior;
  const pct = delta / Math.abs(anterior);
  const cambioSigno = Math.sign(actual) !== Math.sign(anterior) && actual !== 0;

  return describirVariacion({ delta, pct, cambioSigno });
}
