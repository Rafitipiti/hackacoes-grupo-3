import { useEffect, useState } from "react";

import { Layout } from "./Layout.jsx";
import { ProveedorSeleccion, useSeleccion } from "./contexto.jsx";
import { Panorama } from "../secciones/Panorama.jsx";
import { MiEmpresa } from "../secciones/MiEmpresa.jsx";
import { CicloRevisiones } from "../secciones/CicloRevisiones.jsx";
import { ApisDescargas } from "../secciones/ApisDescargas.jsx";
import { Calidad } from "../secciones/Calidad.jsx";

import "../estilos/tokens.css";
import "../estilos/base.css";
import "./layout.css";
import "../componentes/componentes.css";
import "../secciones/ciclo.css";
import "../secciones/apis.css";
import "../App.css";

const TEMAS = ["auto", "claro", "oscuro"];

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

  if (seccion === "panorama") return <Panorama />;
  if (seccion === "mi-empresa") return <MiEmpresa />;
  if (seccion === "revisiones") return <CicloRevisiones />;
  if (seccion === "calidad") return <Calidad />;
  if (seccion === "apis") return <ApisDescargas />;
  return null;
}

export function Aplicacion() {
  const [seccion, setSeccion] = useState("panorama");
  const [tema, setTema] = useState(() => {
    // localStorage puede lanzar en navegacion privada de algunos
    // navegadores. Esto corre en el inicializador del useState: sin
    // try/catch, un lanzamiento aqui rompe el primer render de toda la app.
    let guardado = null;
    try {
      guardado = localStorage.getItem("coes-tema");
    } catch {
      guardado = null;
    }
    return TEMAS.includes(guardado) ? guardado : "auto";
  });

  useEffect(() => {
    if (tema === "auto") {
      document.documentElement.removeAttribute("data-tema");
    } else {
      document.documentElement.setAttribute("data-tema", tema);
    }

    try {
      localStorage.setItem("coes-tema", tema);
    } catch {
      // Mismo caso: si el almacenamiento no esta disponible, el tema sigue
      // funcionando para esta sesion, solo no persiste entre recargas.
    }
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
