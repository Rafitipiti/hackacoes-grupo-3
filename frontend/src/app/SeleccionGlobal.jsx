import { useMemo, useState } from "react";

import { useSeleccion } from "./contexto.jsx";

export function SeleccionGlobal() {
  const { periodo, setPeriodo, empresa, setEmpresa, periodos, empresas } = useSeleccion();
  const [busqueda, setBusqueda] = useState("");

  // 131 empresas: el orden por clave tecnica se ve aleatorio cuando lo que
  // se muestra es el alias. Se ordena por el texto visible.
  const empresasOrdenadas = useMemo(
    () =>
      [...empresas].sort((a, b) =>
        (a.alias ?? a.empresa_id).localeCompare(b.alias ?? b.empresa_id, "es", {
          sensitivity: "base",
        }),
      ),
    [empresas],
  );

  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  function alEscribir(texto) {
    setBusqueda(texto);

    const encontrada = empresas.find(
      (e) => (e.alias ?? e.empresa_id) === texto,
    );

    setEmpresa(encontrada ? encontrada.empresa_id : null);
  }

  return (
    <div className="seleccion-global">
      <label className="etiqueta" htmlFor="sel-periodo">Periodo</label>
      <select
        id="sel-periodo"
        value={periodo ?? ""}
        onChange={(e) => setPeriodo(Number(e.target.value))}
      >
        {periodos.map((p) => (
          <option key={p.pericodi} value={p.pericodi}>
            {p.perinombre} · {p.estado}
          </option>
        ))}
      </select>

      {periodoActual?.origen === "sintetico" && (
        <p className="aviso-sintetico">
          ⚠ Mes sintetico. Generado para dar profundidad interanual; no son
          cifras publicadas.
        </p>
      )}

      <label className="etiqueta" htmlFor="sel-empresa">Empresa</label>
      <input
        id="sel-empresa"
        list="lista-empresas"
        placeholder="Escribe para buscar..."
        value={busqueda}
        onChange={(e) => alEscribir(e.target.value)}
      />
      <datalist id="lista-empresas">
        {empresasOrdenadas.map((e) => (
          <option key={e.empresa_id} value={e.alias ?? e.empresa_id} />
        ))}
      </datalist>

      {busqueda && !empresa && (
        <p className="aviso-empresa">Sin coincidencia exacta</p>
      )}
    </div>
  );
}
