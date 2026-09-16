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
  // La lista de empresas recuerda de que periodo es. "Cargando" se deduce
  // comparando ese periodo con el elegido, en vez de llevar una bandera
  // aparte que habria que encender a mano al inicio de cada efecto.
  const [padron, setPadron] = useState({ pericodi: null, lista: [] });
  const [periodo, setPeriodo] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Evita escribir estado si el componente se desmonta a media carga.
    let vigente = true;

    async function cargar() {
      try {
        const respuesta = await axios.get(`${API_URL}/periodos`);

        if (!vigente) return;

        const listaPeriodos = respuesta.data.periodos;

        if (!listaPeriodos || listaPeriodos.length === 0) {
          throw new Error("El servicio no devolvió ningún periodo.");
        }

        setPeriodos(listaPeriodos);

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

        setError(describirError(e));
      } finally {
        if (vigente) setCargandoPeriodos(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, []);

  // El selector solo ofrece empresas con liquidacion en el periodo elegido
  // (spec portal-analitico, D4): 57 de los 131 codigos no tienen ninguna,
  // y muchos otros no la tienen en TODOS los meses. Por eso la lista se
  // vuelve a pedir cada vez que cambia el periodo.
  useEffect(() => {
    if (periodo === null) return;

    let vigente = true;

    async function cargar() {
      try {
        const respuesta = await axios.get(`${API_URL}/empresas`, {
          params: { pericodi: periodo },
        });

        if (!vigente) return;

        const lista = respuesta.data.empresas ?? [];
        setPadron({ pericodi: periodo, lista });

        // Si la empresa elegida no liquida en el nuevo periodo, la
        // seleccion se suelta: mantenerla llevaria a una pantalla vacia.
        setEmpresa((actual) =>
          actual && !lista.some((e) => e.empresa_id === actual) ? null : actual,
        );
      } catch (e) {
        if (!vigente) return;

        setError(describirError(e));
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [periodo]);

  const empresas = padron.lista;
  const cargandoEmpresas = periodo !== null && padron.pericodi !== periodo;
  // La primera impresion espera a las dos listas; despues, un cambio de
  // periodo solo marca el selector como ocupado, sin vaciar la pantalla.
  const cargando = cargandoPeriodos || (cargandoEmpresas && padron.pericodi === null);

  const valor = useMemo(
    () => ({
      periodo,
      setPeriodo,
      empresa,
      setEmpresa,
      periodos,
      empresas,
      cargando,
      cargandoEmpresas,
      error,
    }),
    [periodo, empresa, periodos, empresas, cargando, cargandoEmpresas, error],
  );

  return (
    <SeleccionContext.Provider value={valor}>
      {children}
    </SeleccionContext.Provider>
  );
}

function describirError(e) {
  if (e.response) return `el servicio respondió ${e.response.status}`;

  // El caso tipico en un despliegue: el build salio sin VITE_API_URL y el
  // portal busca la API en la maquina del visitante. Conviene decirlo.
  const apuntaALocal = /127\.0\.0\.1|localhost/.test(API_URL);
  const sirveDesdeFuera = typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname);
  if (apuntaALocal && sirveDesdeFuera) {
    return `el portal está configurado para buscar la API en ${API_URL}, que no existe en producción. Falta definir VITE_API_URL con la URL pública del backend y volver a desplegar`;
  }

  return `no se pudo contactar con el servicio de liquidaciones en ${API_URL}`;
}
