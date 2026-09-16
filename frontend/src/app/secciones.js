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
    descripcion: "Qué cambió en mi liquidación y por qué",
    disponible: true,
  },
  {
    id: "evolucion",
    titulo: "Evolución histórica",
    icono: "↗",
    descripcion: "Qué es normal para mi empresa, mes a mes",
    disponible: true,
  },
  {
    id: "comparador",
    titulo: "Comparador de empresas",
    icono: "⇄",
    descripcion: "Varias empresas lado a lado en un mismo mes",
    disponible: true,
  },
  {
    id: "revisiones",
    titulo: "Ciclo y revisiones",
    icono: "↻",
    descripcion: "Cómo evoluciona una liquidación entre publicaciones",
    disponible: true,
  },
  {
    id: "calidad",
    titulo: "Calidad y trazabilidad",
    icono: "✓",
    descripcion: "Reglas de integridad y límites del dato",
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
    descripcion: "Mapa del SEIN, intradía y costo marginal",
    disponible: false,
  },
];
