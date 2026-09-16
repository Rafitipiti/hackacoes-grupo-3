import LegacyApp from "../LegacyApp.jsx";
import { useSeleccion } from "../app/contexto.jsx";

export function Panorama() {
  const { periodo } = useSeleccion();

  return (
    <LegacyApp
      key={`analista-${periodo}`}
      modoInicial="analista"
      periodoInicial={periodo}
    />
  );
}
