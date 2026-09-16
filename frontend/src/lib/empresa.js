// Como se nombra una empresa en pantalla (spec portal-analitico, D5).
//
// dim_empresa trae dos identidades por codigo: el alias de fantasia, que
// existe para todos, y la razon social con RUC, que solo tienen los 74
// codigos con liquidacion. Manda la razon social cuando esta; el alias es
// el respaldo para que ninguna fila salga sin nombre.

export function nombreEmpresa(empresa) {
  if (!empresa) return "";

  return empresa.razon_social ?? empresa.alias ?? empresa.empresa_id;
}

/**
 * Nombre mas RUC, para el selector: es lo que distingue dos razones
 * sociales parecidas, y hace que escribir un RUC encuentre la empresa.
 */
export function etiquetaEmpresa(empresa) {
  if (!empresa) return "";

  const nombre = nombreEmpresa(empresa);

  return empresa.ruc ? `${nombre} · RUC ${empresa.ruc}` : nombre;
}

export function ordenarEmpresas(empresas) {
  return [...empresas].sort((a, b) =>
    nombreEmpresa(a).localeCompare(nombreEmpresa(b), "es", {
      sensitivity: "base",
    }),
  );
}
