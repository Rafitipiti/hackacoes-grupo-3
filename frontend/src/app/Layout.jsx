import { useEffect, useState } from "react";

import { SeleccionGlobal } from "./SeleccionGlobal.jsx";
import { SECCIONES } from "./secciones.js";
import { Asistente } from "../componentes/Asistente.jsx";

function Marca() {
  return (
    <div className="marca">
      {/* El logo del COES va sobre un fondo claro fijo: su azul marino no
          se lee sobre el modo oscuro. */}
      <span className="marca-logo">
        <img src="/coes-logo.png" alt="COES" width={72} height={38} />
      </span>
      <span className="marca-texto">
        <strong>COES Hub</strong>
        <span>Sistema Eléctrico Interconectado Nacional</span>
      </span>
    </div>
  );
}

export function Layout({ seccionActiva, alCambiarSeccion, tema, alCambiarTema, children }) {
  const seccion = SECCIONES.find((s) => s.id === seccionActiva);
  // En pantallas angostas el menu vive plegado detras de un boton; en
  // escritorio siempre esta visible y este estado no hace nada.
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!menuAbierto) return;
    function tecla(e) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [menuAbierto]);

  function elegir(id) {
    alCambiarSeccion(id);
    setMenuAbierto(false);
  }

  return (
    <div className={`disposicion${menuAbierto ? " menu-abierto" : ""}`}>
      <a className="saltar-al-contenido" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="barra-lateral">
        <div className="barra-superior">
          <Marca />
          <button
            type="button"
            className="boton-secundario boton-menu"
            aria-expanded={menuAbierto}
            aria-controls="menu-secciones"
            onClick={() => setMenuAbierto((a) => !a)}
          >
            <span aria-hidden="true">{menuAbierto ? "✕" : "☰"}</span>
            <span className="solo-lectores">{menuAbierto ? "Cerrar el menú" : "Abrir el menú"}</span>
            <span className="texto-menu"> {seccion?.titulo}</span>
          </button>
        </div>

        <hr className="franja-grad" aria-hidden="true" />

        {/* aria-current marca la seccion activa para lectores de pantalla:
            el color de fondo solo no comunica nada a quien no lo ve. */}
        <nav aria-label="Secciones del portal" id="menu-secciones" className="menu-secciones">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={
                "enlace-seccion" +
                (s.id === seccionActiva ? " activo" : "") +
                (s.disponible ? "" : " proximo")
              }
              onClick={() => s.disponible && elegir(s.id)}
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
                  Próximo
                  <span className="solo-lectores"> — sección no disponible todavía</span>
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            className="boton-secundario alternar-tema"
            onClick={alCambiarTema}
            aria-pressed={tema === "oscuro"}
          >
            <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span>
            {tema === "oscuro" ? " Modo claro" : " Modo oscuro"}
          </button>
        </nav>
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

      <Asistente irA={alCambiarSeccion} />
    </div>
  );
}
