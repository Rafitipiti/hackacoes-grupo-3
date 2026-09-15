const SIN_DATO = "—";

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

  return `${signo}S/ ${numero(Math.abs(monto), decimales)}`;
}

export function porcentaje(fraccion, decimales = 1) {
  if (!hayDato(fraccion)) return SIN_DATO;

  const signo = fraccion > 0 ? "+" : "";

  return `${signo}${(fraccion * 100).toFixed(decimales)}%`;
}
