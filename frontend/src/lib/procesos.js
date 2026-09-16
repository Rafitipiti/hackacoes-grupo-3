// Los cuatro procesos de liquidacion, en el orden en que se muestran.
//
// La clave interna con la que llegan los registros es "LVTA"; el nombre
// correcto de cara al usuario es "LVTEA" (Valorizacion de las
// Transferencias de Energia Activa). Por eso la etiqueta visible se resuelve
// siempre con etiquetaProceso(), nunca imprimiendo la clave a secas.

export const ORDEN_PROCESOS = ["LVTA", "LVTP", "LSCIO", "SST-SCT"];

export const NOMBRE_PROCESO = {
  "LVTA": "Energía Activa",
  "LVTP": "Potencia",
  "LSCIO": "Servicios Complementarios",
  "SST-SCT": "Sistemas Secundarios de Transmisión",
};

const ETIQUETA = { "LVTA": "LVTEA" };

export function etiquetaProceso(codigo) {
  return ETIQUETA[codigo] ?? codigo;
}

// Un color fijo por proceso, para que la misma serie se pinte igual en
// cualquier grafico del portal.
export const COLOR_PROCESO = {
  "LVTA": "var(--serie-3)",
  "LVTP": "var(--serie-4)",
  "LSCIO": "var(--s3)",
  "SST-SCT": "var(--seq6)",
};
