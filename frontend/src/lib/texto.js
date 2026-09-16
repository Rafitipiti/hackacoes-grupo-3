// Ayudas de texto para lo que llega del servicio.

// Algunos mensajes del analisis traen un emoji delante ("🟢 Listo para
// cerrar"). En las vistas ejecutivas el estado lo da un distintivo, asi
// que el emoji sobra.
export function sinEmoji(texto) {
  if (!texto) return "";
  return String(texto).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?\s?/gu, "").trim();
}

// Nivel de alerta -> variante del distintivo. Las etiquetas del servicio
// van en mayusculas y con tilde ("CRÍTICO"); se compara sin acentos.
export function claseNivel(nivel) {
  const plano = sinEmoji(nivel).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  if (plano.includes("CRITIC") || plano.includes("ERROR")) return "distintivo-critico";
  if (plano.includes("ALTO") || plano.includes("OBSERVACION") || plano.includes("REVISAR") || plano.includes("ADVERTENCIA")) return "distintivo-aviso";
  if (plano.includes("MEDIO")) return "";
  if (plano.includes("OK") || plano.includes("NORMAL") || plano.includes("BAJO") || plano.includes("LISTO")) return "distintivo-ok";
  return "";
}

// Orden de severidad para listar niveles: lo urgente primero.
const ORDEN_NIVEL = ["CRITIC", "ALTO", "MEDIO", "BAJO", "NORMAL", "OK"];

export function pesoNivel(nivel) {
  const plano = sinEmoji(nivel).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const indice = ORDEN_NIVEL.findIndex((n) => plano.includes(n));
  return indice === -1 ? ORDEN_NIVEL.length : indice;
}

export function capitalizar(texto) {
  const limpio = sinEmoji(texto);
  if (!limpio) return "";
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
}
