import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { useSeleccion } from "../app/contexto.jsx";

const REGLAS = [
  {
    codigo: "REGLA-LVTA-001",
    nombre: "Energía Activa",
    que: "El resultado de Energía Activa debe cuadrar con el soporte de transferencias por empresa.",
  },
  {
    codigo: "REGLA-LSCIO-001",
    nombre: "Reconstrucción LSCIO",
    que: "La suma del desglose por mecanismo debe igualar el total de transferencias LSCIO.",
  },
  {
    codigo: "REGLA-POTENCIA-001",
    nombre: "Compensación a transmisoras",
    que: "La compensación a transmisoras por ingreso tarifario debe cuadrar entre el resultado de Potencia y su desglose por valorización. No cubre las otras dos valorizaciones del proceso.",
  },
];

const LIMITES = [
  {
    titulo: "La cadena de cálculo no es reproducible desde estos datos",
    detalle:
      "Se verifico sobre los datos originales: los retiros cubren 12 de 71 empresas, el costo marginal cubre 248 de 828 barras, y la Energía Activa viene como una sola fila sin desglosar. Los datos son resultados de consultas a producción, no insumos de un modelo recalculable. Las validaciones comprueban consistencia interna, no reconstruyen la fórmula regulatoria.",
  },
  {
    titulo: "Los meses de 2025 son proyectados",
    detalle:
      "La fuente de datos trae liquidaciones publicadas hasta cierto corte y, hacia atrás, periodos proyectados a partir del comportamiento de los meses publicados, para dar profundidad interanual. El COES autorizó usar esa proyección en esta presentación, por lo que las pantallas no la etiquetan: sirve para mostrar tendencias y estacionalidad, no para contrastar cifras publicadas. El campo `origen` de cada periodo en la API (`real` o `sintetico`) conserva la distinción para quien la necesite.",
  },
  {
    titulo: "Los nombres de empresa son reales; sus cifras no",
    detalle:
      "Los datos de origen llegan anonimizados: cada empresa es un código interno sin RUC ni razón social, y no existe ninguna clave que lo cruce con una empresa real. Para la presentación, a los 74 códigos con liquidación se les adjudicó una identidad tomada del padrón real del COES: los códigos ordenados por clave, las empresas reales ordenadas por RUC, emparejados por posición. Es una asignación determinista, no una recuperación de identidad. Consecuencia: los montos, variaciones y alertas que ves bajo un nombre real son simulados y esa empresa no tuvo esos resultados. Esta sección es el único lugar del portal que lo dice; las demás pantallas van limpias a propósito.",
  },
  {
    titulo: "El detalle de pagos y cobros de 2026 es proyectado, salvo julio",
    detalle:
      "Las transferencias entre empresas (quién le paga a quién, por proceso y valorización) llegan publicadas para julio 2026 y proyectadas para 2025. Para enero–junio y agosto 2026 no había detalle: se proyectó tomando julio 2026 como plantilla de estructura y escalando los pagos de cada empresa por su propia actividad mensual, con una variación determinista pequeña. Los totales por empresa siguen siendo los de la evolución mensual; lo proyectado es el reparto entre contrapartes. La proyección está en data/cruce_bilateral_proyectado.csv.",
  },
  {
    titulo: "El simulador es un cálculo preliminar, no una liquidación",
    detalle:
      "La energía pegada se valoriza con el costo marginal promedio diario publicado de cada barra; la valorización oficial usa intervalos de 15 minutos. La vía por cuota aplica la participación histórica de la empresa al volumen del sistema; la vía por fórmula aplica la regla de cada proceso a los valores escritos. La demanda coincidente de potencia no se publica en MW: se despeja del monto liquidado con precios de referencia (S/ 25 y S/ 6 por kW-mes). La energía registrada por empresa es una muestra del total del sistema, así que la fórmula de energía activa con esa energía queda por debajo de lo liquidado; con la energía real de la empresa el resultado sí es el suyo.",
  },
  {
    titulo: "Las entregas y retiros del mapa son los registrados por barra",
    detalle:
      "Una entrega se atribuye a la empresa dueña del punto de entrega y a la barra de ese punto; un retiro, al generador que lo respalda y a su barra. Solo se dibujan las barras con costo marginal publicado; la energía que cae en barras sin precio se declara aparte en la propia pantalla.",
  },
  {
    titulo: "LSCIO tiene meses sin carga",
    detalle:
      "Es carga manual mes a mes del equipo de COES. Los meses vacios no son un error del dato: reflejan como es la operación real.",
  },
  {
    titulo: "Un monto restatado no es un ajuste",
    detalle:
      "Cada revisión restata el mes completo, así que su monto ya incluye todo lo publicado antes. Sumar los montos de varias revisiones del mismo mes seria doble contabilidad. Por eso el ajuste se calcula siempre como diferencia contra la revisión anterior.",
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
            <tr><td>Revisión vigente</td><td className="num">{p?.version_vigente ?? "—"}</td></tr>
            <tr><td>Origen del dato</td><td className="num">{p?.origen === "sintetico" ? "Proyectado" : "Publicado"}</td></tr>
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta
        etiqueta="Validaciones"
        titulo="Reglas de integridad que se ejecutan"
      >
        <p className="nota">
          Se ejecutan por empresa y periodo en la sección Mi empresa. Comprueban
          que los números cuadren entre el resultado y su soporte.
        </p>
        <table className="tabla">
          <thead>
            <tr><th>Código</th><th>Válida</th><th>Qué comprueba</th></tr>
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
        titulo="Qué debes saber antes de usar estas cifras"
      >
        <p className="nota">
          Declarar los límites no debilita el análisis: lo hace defendible.
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
