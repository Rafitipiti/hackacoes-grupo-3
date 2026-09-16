import { useEffect, useState } from "react";

import { Layout } from "./Layout.jsx";
import { ProveedorSeleccion, useSeleccion } from "./contexto.jsx";
import { CicloRevisiones } from "../secciones/CicloRevisiones.jsx";

import "../estilos/tokens.css";
import "../estilos/base.css";
import "./layout.css";
import "../componentes/componentes.css";
import "../secciones/ciclo.css";

const TEMAS = ["auto", "claro", "oscuro"];

function Marcador({ seccion }) {
  return (
    <div className="tarjeta">
      <p>Seccion <strong>{seccion}</strong> en construccion.</p>
    </div>
  );
}

function Contenido({ seccion }) {
  const { cargando, error } = useSeleccion();

  if (cargando) {
    return (
      <p className="estado">Cargando periodos y empresas…</p>
    );
  }

  if (error) {
    return (
      <section className="tarjeta">
        <h2>No se pudo conectar con el servicio de liquidaciones</h2>
        <p className="nota">Detalle: {error}</p>
        <p className="nota">
          Comprueba que el servicio este disponible y vuelve a cargar la
          pagina. Si el problema persiste, avisa al equipo del COES.
        </p>
      </section>
    );
  }

  return seccion === "revisiones" ? <CicloRevisiones /> : <Marcador seccion={seccion} />;
}

export function Aplicacion() {
  const [seccion, setSeccion] = useState("panorama");
  const [tema, setTema] = useState(() => {
    const guardado = localStorage.getItem("coes-tema");
    return TEMAS.includes(guardado) ? guardado : "auto";
  });

  useEffect(() => {
    if (tema === "auto") {
      document.documentElement.removeAttribute("data-tema");
    } else {
      document.documentElement.setAttribute("data-tema", tema);
    }

    localStorage.setItem("coes-tema", tema);
  }, [tema]);

  function alternarTema() {
    setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro"));
  }

  return (
    <ProveedorSeleccion>
      <Layout
        seccionActiva={seccion}
        alCambiarSeccion={setSeccion}
        tema={tema}
        alCambiarTema={alternarTema}
      >
        <Contenido seccion={seccion} />
      </Layout>
    </ProveedorSeleccion>
  );
}
