export function EstadoCarga({ cargando, error, vacio, mensajeVacio, children }) {
  if (cargando) {
    return <p className="estado estado-cargando">Cargando…</p>;
  }

  if (error) {
    return (
      <p className="estado estado-error">
        {error}
      </p>
    );
  }

  if (vacio) {
    return (
      <p className="estado estado-vacio">
        {mensajeVacio ?? "No hay datos para esta seleccion."}
      </p>
    );
  }

  return children;
}
