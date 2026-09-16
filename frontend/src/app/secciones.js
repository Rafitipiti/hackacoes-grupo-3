// El orden es el del menu, de mayor a menor uso en una presentacion: lo que
// se mira cada mes va arriba; APIs y Calidad son de consulta puntual y
// cierran la lista (peticion del usuario, 2026-09-16). `disponible: false`
// pintaria una entrada como proxima; hoy todas estan construidas.
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
    id: "procesos",
    titulo: "Procesos",
    icono: "⚡",
    descripcion: "Pagos y cobros por proceso: LVTEA · LVTP · LSCIO · SST-SCT",
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
    id: "red",
    titulo: "Red y precios",
    icono: "◈",
    descripcion: "Mapa de barras del SEIN y costo marginal por periodo",
    disponible: true,
  },
  {
    id: "contactos",
    titulo: "Contactos",
    icono: "☎",
    descripcion: "Fichas de contacto y cuentas por empresa",
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
    id: "calidad",
    titulo: "Calidad y trazabilidad",
    icono: "✓",
    descripcion: "Reglas de integridad y límites del dato",
    disponible: true,
  },
];
