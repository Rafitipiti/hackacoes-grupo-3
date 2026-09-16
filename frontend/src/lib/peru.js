// Contorno simplificado del Peru para el mapa de barras (spec 9.2). Son
// unos cincuenta vertices [lon, lat] trazados a mano sobre la frontera y la
// costa: suficientes para que el pais se reconozca y las barras caigan
// donde corresponde, sin cargar un GeoJSON de megabytes ni depender de una
// libreria de mapas.

export const CONTORNO_PERU = [
  [-80.40, -3.40], [-80.20, -3.85], [-80.10, -4.30], [-79.60, -4.45], [-79.05, -4.95],
  [-78.55, -3.45], [-77.90, -2.95], [-76.70, -2.40], [-75.60, -1.55], [-75.30, -0.15],
  [-74.50, -0.95], [-73.60, -1.60], [-72.90, -2.40], [-71.80, -2.30], [-70.80, -2.60],
  [-70.05, -2.75], [-70.30, -3.60], [-69.95, -4.20], [-70.60, -4.60], [-71.80, -5.40],
  [-72.90, -6.40], [-73.75, -7.35], [-73.10, -8.50], [-72.30, -9.45], [-70.60, -9.45],
  [-70.60, -11.00], [-69.55, -10.95], [-68.70, -12.50], [-69.00, -13.80], [-68.95, -14.30],
  [-69.40, -15.20], [-69.00, -16.20], [-69.45, -17.60], [-70.40, -18.35], [-71.35, -17.90],
  [-72.10, -17.05], [-72.70, -16.65], [-73.50, -16.30], [-74.30, -15.85], [-75.20, -15.40],
  [-75.90, -14.65], [-76.30, -13.85], [-76.80, -12.60], [-77.15, -12.05], [-77.70, -11.00],
  [-78.20, -10.05], [-78.60, -9.10], [-79.10, -8.10], [-79.90, -6.90], [-80.60, -5.70],
  [-81.15, -5.25], [-81.30, -4.60], [-81.00, -4.05], [-80.70, -3.75],
];

// Caja que encierra el contorno, con un margen para que no roce el borde.
export const CAJA_PERU = { lonMin: -81.6, lonMax: -68.4, latMin: -18.6, latMax: 0.2 };

/**
 * Proyeccion equirrectangular simple sobre un lienzo de ancho x alto. A la
 * escala de un pais la distorsion es visible pero tolerable; el mapa es un
 * localizador, no un plano.
 */
export function proyectar(lat, lon, ancho, alto) {
  const { lonMin, lonMax, latMin, latMax } = CAJA_PERU;

  // Peru es mas alto que ancho: se conserva la proporcion y se centra.
  const escala = Math.min(ancho / (lonMax - lonMin), alto / (latMax - latMin));
  const margenX = (ancho - (lonMax - lonMin) * escala) / 2;
  const margenY = (alto - (latMax - latMin) * escala) / 2;

  return {
    x: margenX + (lon - lonMin) * escala,
    y: margenY + (latMax - lat) * escala,
  };
}

export function trazoPeru(ancho, alto) {
  return (
    CONTORNO_PERU.map(([lon, lat], i) => {
      const { x, y } = proyectar(lat, lon, ancho, alto);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z"
  );
}
