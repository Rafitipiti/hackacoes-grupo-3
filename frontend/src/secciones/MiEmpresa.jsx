import LegacyApp from "../LegacyApp.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { useSeleccion } from "../app/contexto.jsx";

export function MiEmpresa() {
  const { empresa, periodo } = useSeleccion();

  if (!empresa) {
    return (
      <Tarjeta etiqueta="Modo agente" titulo="Elige una empresa">
        <p className="nota">
          Busca tu empresa en la barra lateral para ver que cambio en su
          liquidacion, por que cambio, y si puede avanzar al cierre.
        </p>
      </Tarjeta>
    );
  }

  return (
    <LegacyApp
      key={`agente-${empresa}-${periodo}`}
      modoInicial="agente"
      empresaInicial={empresa}
      periodoInicial={periodo}
    />
  );
}
