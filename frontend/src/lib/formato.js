const SIN_DATO = "—";

// Espacio duro entre "S/" y la cifra (spec portal-analitico, C2): un salto
// de linea que deje "S/" solo al final de una fila y el numero en la
// siguiente hace ilegible una tabla. Es un caracter, no un contenedor,
// asi que protege tambien los importes que se interpolan en texto.
export const ESPACIO_DURO = " ";

function hayDato(valor) {
  return valor !== null && valor !== undefined && !Number.isNaN(valor);
}

export function numero(valor, decimales = 2) {
  if (!hayDato(valor)) return SIN_DATO;

  return valor.toLocaleString("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function soles(monto, decimales = 2) {
  if (!hayDato(monto)) return SIN_DATO;

  const signo = monto < 0 ? "-" : "";

  return `${signo}S/${ESPACIO_DURO}${numero(Math.abs(monto), decimales)}`;
}

/**
 * Importe abreviado para ejes y etiquetas de grafico: "S/ 1.3 M", "S/ 48 k".
 * Pierde precision a proposito: en un eje la cifra completa no cabe y no
 * aporta; el valor exacto va en el tooltip y en la tabla.
 */
export function solesCortos(monto) {
  if (!hayDato(monto)) return SIN_DATO;

  const signo = monto < 0 ? "-" : "";
  const absoluto = Math.abs(monto);

  let cuerpo;
  if (absoluto >= 1e6) cuerpo = `${(absoluto / 1e6).toFixed(1)} M`;
  else if (absoluto >= 1e3) cuerpo = `${(absoluto / 1e3).toFixed(0)} k`;
  else cuerpo = absoluto.toFixed(0);

  return `${signo}S/${ESPACIO_DURO}${cuerpo}`;
}

export function porcentaje(fraccion, decimales = 1) {
  if (!hayDato(fraccion)) return SIN_DATO;

  const signo = fraccion > 0 ? "+" : "";

  return `${signo}${(fraccion * 100).toFixed(decimales)}%`;
}
