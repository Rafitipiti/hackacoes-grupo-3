import { useEffect, useState } from "react";

import { Layout } from "./Layout.jsx";
import { ProveedorSeleccion } from "./contexto.jsx";

import "../estilos/tokens.css";
import "../estilos/base.css";
import "./layout.css";

function Marcador({ seccion }) {
  return (
    <div className="tarjeta">
      <p>Seccion <strong>{seccion}</strong> en construccion.</p>
    </div>
  );
}

export function Aplicacion() {
  const [seccion, setSeccion] = useState("panorama");
  const [tema, setTema] = useState(
    () => localStorage.getItem("coes-tema") ?? "auto",
  );

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
        <Marcador seccion={seccion} />
      </Layout>
    </ProveedorSeleccion>
  );
}
