import { SeleccionGlobal } from "./SeleccionGlobal.jsx";
import { SECCIONES } from "./secciones.js";

export function Layout({ seccionActiva, alCambiarSeccion, tema, alCambiarTema, children }) {
  const seccion = SECCIONES.find((s) => s.id === seccionActiva);

  return (
    <div className="disposicion">
      <a className="saltar-al-contenido" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="barra-lateral">
        <div className="marca">
          <span className="marca-escudo" aria-hidden="true">⚡</span>
          <span className="marca-texto">
            <strong>Liquidaciones 360</strong>
            <span>COES · Sistema Eléctrico Interconectado Nacional</span>
          </span>
        </div>

        <hr className="franja-grad" aria-hidden="true" />

        {/* aria-current marca la seccion activa para lectores de pantalla:
            el color de fondo solo no comunica nada a quien no lo ve. */}
        <nav aria-label="Secciones del portal">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={
                "enlace-seccion" +
                (s.id === seccionActiva ? " activo" : "") +
                (s.disponible ? "" : " proximo")
              }
              onClick={() => s.disponible && alCambiarSeccion(s.id)}
              disabled={!s.disponible}
              aria-current={s.id === seccionActiva ? "page" : undefined}
            >
              <span className="icono" aria-hidden="true">{s.icono}</span>
              <span className="titulo">
                {s.titulo}
                <small>{s.descripcion}</small>
              </span>
              {!s.disponible && (
                <span className="tag-proximo">
                  Proximo
                  <span className="solo-lectores"> — sección no disponible todavía</span>
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="boton-secundario alternar-tema"
          onClick={alCambiarTema}
          aria-pressed={tema === "oscuro"}
        >
          <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span>
          {tema === "oscuro" ? " Modo claro" : " Modo oscuro"}
        </button>
      </aside>

      {/* tabIndex -1 permite que el salto al contenido deje el foco aqui. */}
      <main className="contenido" id="contenido" tabIndex={-1}>
        {/* La seleccion de publicacion y empresa gobierna todas las
            secciones, asi que vive arriba a la derecha, en el mismo sitio
            en cada pantalla (spec portal-analitico, D8). */}
        <header className="cabecera-seccion">
          <div className="cabecera-titulo">
            <p className="etiqueta">{seccion?.descripcion}</p>
            <h1>{seccion?.titulo}</h1>
          </div>
          <SeleccionGlobal />
        </header>

        {children}
      </main>
    </div>
  );
}
