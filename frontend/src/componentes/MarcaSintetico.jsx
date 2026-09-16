import { useId } from "react";

const EXPLICACION =
  "Mes generado para dar profundidad interanual. No son cifras publicadas.";

export function MarcaSintetico() {
  // title solo llega a quien usa raton: aria-describedby mas un span
  // .solo-lectores hace la misma explicacion alcanzable por teclado y
  // lector de pantalla. El title se conserva para quien pasa el cursor.
  const idExplicacion = useId();

  return (
    <span
      className="marca-sintetico"
      title={EXPLICACION}
      aria-describedby={idExplicacion}
    >
      sintetico
      <span id={idExplicacion} className="solo-lectores">{EXPLICACION}</span>
    </span>
  );
}
