// El orden es el del menu. `disponible: false` pinta la entrada como
// proxima, para que se vea el mapa completo del producto sin fingir que
// esta construido.
export const SECCIONES = [
  {
    id: "panorama",
    titulo: "Panorama",
    icono: "▤",
    descripcion: "El sector en un vistazo",
    disponible: true,
  },
  {
    id: "mi-empresa",
    titulo: "Mi empresa",
    icono: "◉",
    descripcion: "Que cambio en mi liquidacion y por que",
    disponible: true,
  },
  {
    id: "revisiones",
    titulo: "Ciclo y revisiones",
    icono: "↻",
    descripcion: "Como evoluciona una liquidacion entre publicaciones",
    disponible: true,
  },
  {
    id: "calidad",
    titulo: "Calidad y trazabilidad",
    icono: "✓",
    descripcion: "Reglas de integridad y limites del dato",
    disponible: true,
  },
  {
    id: "apis",
    titulo: "APIs y descargas",
    icono: "↧",
    descripcion: "Consulta y exporta los datos",
    disponible: true,
  },
  {
    id: "procesos",
    titulo: "Procesos",
    icono: "⚡",
    descripcion: "VTEA · VTP · SCIO · SST-SCT",
    disponible: false,
  },
  {
    id: "red",
    titulo: "Red y precios",
    icono: "◈",
    descripcion: "Mapa del SEIN, intradia y costo marginal",
    disponible: false,
  },
];
