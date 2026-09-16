function celda(valor) {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);

  // Una coma, una comilla o un salto de linea romperian la columna.
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

export function aCSV(filas) {
  if (!filas || filas.length === 0) return "";

  const columnas = Object.keys(filas[0]);
  const cabecera = columnas.join(",");
  const cuerpo = filas.map((fila) => columnas.map((c) => celda(fila[c])).join(","));

  return [cabecera, ...cuerpo].join("\n");
}

export function descargar(nombreArchivo, contenido, tipoMime) {
  // BOM para que Excel abra el CSV con los acentos correctos.
  const bom = tipoMime.startsWith("text/csv") ? "\uFEFF" : "";
  const blob = new Blob([bom + contenido], { type: `${tipoMime};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}
