import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SeleccionContext = createContext(null);

export function useSeleccion() {
  const contexto = useContext(SeleccionContext);

  if (!contexto) {
    throw new Error("useSeleccion debe usarse dentro de <ProveedorSeleccion>");
  }

  return contexto;
}

export function ProveedorSeleccion({ children }) {
  const [periodos, setPeriodos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Evita escribir estado si el componente se desmonta a media carga.
    let vigente = true;

    async function cargar() {
      try {
        const [respPeriodos, respEmpresas] = await Promise.all([
          axios.get(`${API_URL}/periodos`),
          axios.get(`${API_URL}/empresas`),
        ]);

        if (!vigente) return;

        const listaPeriodos = respPeriodos.data.periodos;

        if (!listaPeriodos || listaPeriodos.length === 0) {
          throw new Error("El servicio no devolvio ningun periodo.");
        }

        setPeriodos(listaPeriodos);
        setEmpresas(respEmpresas.data.empresas ?? []);

        // Arranca en el ultimo periodo CERRADO, no en el mas reciente.
        // Los periodos abiertos no tienen reportes intermedios cargados,
        // asi que la pantalla saldria vacia en la primera impresion.
        const cerrados = listaPeriodos.filter((p) => p.estado === "Cerrado");
        const inicial = cerrados.length
          ? cerrados[cerrados.length - 1]
          : listaPeriodos[listaPeriodos.length - 1];

        setPeriodo(inicial.pericodi);
      } catch (e) {
        if (!vigente) return;

        setError(
          e.response
            ? `el servicio respondio ${e.response.status}`
            : e.message,
        );
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, []);

  const valor = useMemo(
    () => ({ periodo, setPeriodo, empresa, setEmpresa, periodos, empresas, cargando, error }),
    [periodo, empresa, periodos, empresas, cargando, error],
  );

  return (
    <SeleccionContext.Provider value={valor}>
      {children}
    </SeleccionContext.Provider>
  );
}
