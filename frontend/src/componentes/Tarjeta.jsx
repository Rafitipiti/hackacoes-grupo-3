export function Tarjeta({ titulo, etiqueta, acciones, children }) {
  return (
    <section className="tarjeta">
      {(titulo || etiqueta || acciones) && (
        <header className="tarjeta-cabecera">
          <div>
            {etiqueta && <p className="etiqueta">{etiqueta}</p>}
            {titulo && <h2>{titulo}</h2>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
