import { useMemo, useState } from "react";

import { useSeleccion } from "./contexto.jsx";
import { SelectorPeriodo, nombreMes } from "./SelectorPeriodo.jsx";
import { etiquetaEmpresa, nombreEmpresa, ordenarEmpresas } from "../lib/empresa.js";

export function SeleccionGlobal() {
  const {
    periodo, setPeriodo, empresa, setEmpresa, periodos, empresas, cargandoEmpresas,
  } = useSeleccion();
  const [busqueda, setBusqueda] = useState("");

  // El orden por clave tecnica se ve aleatorio cuando lo que se muestra es
  // la razon social. Se ordena por el texto visible.
  const empresasOrdenadas = useMemo(() => ordenarEmpresas(empresas), [empresas]);

  const periodoActual = periodos.find((p) => p.pericodi === periodo);
  const empresaActual = empresas.find((e) => e.empresa_id === empresa);

  // Si el contexto suelta la seleccion (la empresa no liquida en el nuevo
  // periodo), la caja de busqueda no puede seguir mostrando su nombre como
  // si siguiera elegida. Se ajusta durante el render, comparando con la
  // ultima empresa vista, en vez de en un efecto que provocaria un
  // segundo render.
  const [empresaVista, setEmpresaVista] = useState(empresa);

  if (empresa !== empresaVista) {
    setEmpresaVista(empresa);
    if (!empresa) setBusqueda("");
  }

  function alEscribir(texto) {
    setBusqueda(texto);

    const encontrada = empresas.find(
      (e) =>
        etiquetaEmpresa(e).localeCompare(texto, "es", {
          sensitivity: "base",
        }) === 0,
    );

    setEmpresa(encontrada ? encontrada.empresa_id : null);
  }

  return (
    <section className="seleccion-global" aria-label="Selección de publicación y empresa">
      <div className="seleccion-controles">
        <div className="campo">
          <label className="etiqueta" htmlFor="sel-periodo">Publicación</label>
          <SelectorPeriodo id="sel-periodo" periodos={periodos} valor={periodo} alCambiar={setPeriodo} />
        </div>

        <div className="campo campo-empresa">
          <label className="etiqueta" htmlFor="sel-empresa">Empresa</label>
          <input
            id="sel-empresa"
            list="lista-empresas"
            placeholder="Razón social o RUC…"
            value={busqueda}
            onChange={(e) => alEscribir(e.target.value)}
            aria-describedby="ayuda-empresa"
          />
          <datalist id="lista-empresas">
            {empresasOrdenadas.map((e) => (
              <option key={e.empresa_id} value={etiquetaEmpresa(e)} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="seleccion-avisos">
        {empresaActual ? (
          <p className="empresa-elegida">
            <strong>{nombreEmpresa(empresaActual)}</strong>
            {empresaActual.ruc && <span className="ruc">RUC {empresaActual.ruc}</span>}
            <button type="button" className="quitar-empresa" onClick={() => setEmpresa(null)} aria-label="Quitar la empresa elegida">×</button>
          </p>
        ) : (
          <p id="ayuda-empresa" className="ayuda-empresa">
            {cargandoEmpresas
              ? "Buscando empresas con liquidación en este periodo…"
              : `${empresas.length} empresas con liquidación en ${nombreMes(periodoActual)}`}
            {busqueda && !empresa && <span className="aviso-empresa"> · Sin coincidencia exacta</span>}
          </p>
        )}
      </div>
    </section>
  );
}
