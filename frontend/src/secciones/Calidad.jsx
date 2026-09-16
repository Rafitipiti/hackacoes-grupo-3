import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { useSeleccion } from "../app/contexto.jsx";

const REGLAS = [
  {
    codigo: "REGLA-LVTA-001",
    nombre: "Energia Activa",
    que: "El resultado de Energia Activa debe cuadrar con el soporte de transferencias por empresa.",
  },
  {
    codigo: "REGLA-LSCIO-001",
    nombre: "Reconstruccion LSCIO",
    que: "La suma del desglose por mecanismo debe igualar el total de transferencias LSCIO.",
  },
  {
    codigo: "REGLA-POTENCIA-001",
    nombre: "Compensacion a transmisoras",
    que: "La compensacion a transmisoras por ingreso tarifario debe cuadrar entre el resultado de Potencia y su desglose por valorizacion. No cubre las otras dos valorizaciones del proceso.",
  },
];

const LIMITES = [
  {
    titulo: "La cadena de calculo no es reproducible desde estos datos",
    detalle:
      "Se verifico sobre los datos originales: los retiros cubren 12 de 71 empresas, el costo marginal cubre 248 de 828 barras, y la Energia Activa viene como una sola fila sin desglosar. Los datasets son resultados de consultas a produccion, no insumos de un modelo recalculable. Las validaciones comprueban consistencia interna, no reconstruyen la formula regulatoria.",
  },
  {
    titulo: "Los meses de 2025 son sinteticos",
    detalle:
      "Fueron generados para dar profundidad interanual, calibrados sobre el comportamiento de los meses reales. Sirven para demostrar tendencias y estacionalidad; no para afirmar hechos sobre empresas concretas ni contrastar cifras publicadas. Cada mes sintetico se marca en pantalla.",
  },
  {
    titulo: "Los nombres de empresa son reales; sus cifras no",
    detalle:
      "El welcome kit llega anonimizado: cada empresa es un codigo tecnico (EMPRESA_001) sin RUC ni razon social, y no existe ninguna clave que lo cruce con una empresa real. Para la presentacion, a los 74 codigos con liquidacion se les ADJUDICO una identidad tomada del padron real del COES: los codigos ordenados por clave, las empresas reales ordenadas por RUC, emparejados por posicion. Es una asignacion determinista, no una recuperacion de identidad. Consecuencia: los montos, variaciones y alertas que ves bajo un nombre real son simulados y esa empresa no tuvo esos resultados. Esta seccion es el unico lugar del portal que lo dice; las demas pantallas van limpias a proposito.",
  },
  {
    titulo: "LSCIO tiene meses sin carga",
    detalle:
      "Es carga manual mes a mes del equipo de COES. Los meses vacios no son un error del dato: reflejan como es la operacion real.",
  },
  {
    titulo: "Un monto restatado no es un ajuste",
    detalle:
      "Cada revision restata el mes completo, asi que su monto ya incluye todo lo publicado antes. Sumar los montos de varias revisiones del mismo mes seria doble contabilidad. Por eso el ajuste se calcula siempre como diferencia contra la revision anterior.",
  },
];

export function Calidad() {
  const { periodos, periodo } = useSeleccion();
  const p = periodos.find((x) => x.pericodi === periodo);

  return (
    <div className="rejilla">
      <Tarjeta etiqueta="Periodo seleccionado" titulo={p?.perinombre ?? "—"}>
        <table className="tabla">
          <tbody>
            <tr><td>Estado</td><td className="num">{p?.estado ?? "—"}</td></tr>
            <tr><td>Revision vigente</td><td className="num">{p?.version_vigente ?? "—"}</td></tr>
            <tr><td>Origen del dato</td><td className="num">{p?.origen === "sintetico" ? "Sintetico" : "Real"}</td></tr>
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta
        etiqueta="Validaciones"
        titulo="Reglas de integridad que se ejecutan"
      >
        <p className="nota">
          Se ejecutan por empresa y periodo en la seccion Mi empresa. Comprueban
          que los numeros cuadren entre el resultado y su soporte.
        </p>
        <table className="tabla">
          <thead>
            <tr><th>Codigo</th><th>Valida</th><th>Que comprueba</th></tr>
          </thead>
          <tbody>
            {REGLAS.map((r) => (
              <tr key={r.codigo}>
                <td className="cifra">{r.codigo}</td>
                <td>{r.nombre}</td>
                <td>{r.que}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta
        etiqueta="Honestidad del dato"
        titulo="Que debes saber antes de usar estas cifras"
      >
        <p className="nota">
          Declarar los limites no debilita el analisis: lo hace defendible.
        </p>
        {LIMITES.map((l) => (
          <details key={l.titulo} className="limite">
            <summary>{l.titulo}</summary>
            <p>{l.detalle}</p>
          </details>
        ))}
      </Tarjeta>
    </div>
  );
}
