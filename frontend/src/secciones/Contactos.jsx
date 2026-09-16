import { useEffect, useMemo, useState } from "react";

import { eliminarContacto, guardarContacto, listarContactos } from "../api/contactos.js";
import { useSeleccion } from "../app/contexto.jsx";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { nombreEmpresa, ordenarEmpresas } from "../lib/empresa.js";
import { aCSV, descargar } from "../lib/exportar.js";

const VACIA = {
  razon_social: "",
  ruc: "",
  banco: "",
  tipo_cuenta: "",
  moneda: "",
  numero_cuenta: "",
  cci: "",
  correos: "",
  telefonos: "",
  notas: "",
};

function Campo({ id, etiqueta, children, ayuda }) {
  return (
    <div className="campo-ficha">
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda && <p className="nota">{ayuda}</p>}
    </div>
  );
}

function Formulario({ empresa, ficha, catalogos, alGuardar, alEliminar, ocupado }) {
  const [valores, setValores] = useState(VACIA);
  const [mensaje, setMensaje] = useState(null);

  // Al cambiar de empresa la ficha se recarga: lo guardado si existe, y si
  // no, razon social y RUC del padron como punto de partida.
  const claveFicha = `${empresa?.empresa_id}-${ficha?.actualizado ?? "nueva"}`;
  const [claveVista, setClaveVista] = useState(null);
  if (claveFicha !== claveVista) {
    setClaveVista(claveFicha);
    setValores({
      ...VACIA,
      ...(ficha ?? {}),
      razon_social: ficha?.razon_social ?? empresa?.razon_social ?? "",
      ruc: ficha?.ruc ?? empresa?.ruc ?? "",
    });
    setMensaje(null);
  }

  function cambiar(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function enviar(e) {
    e.preventDefault();
    setMensaje(null);
    try {
      await alGuardar(valores);
      setMensaje({ tipo: "ok", texto: "Ficha guardada." });
    } catch (err) {
      setMensaje({ tipo: "error", texto: err.response?.data?.detail ?? "No se pudo guardar la ficha." });
    }
  }

  const id = (campo) => `ficha-${campo}`;

  return (
    <form className="ficha-contacto" onSubmit={enviar}>
      <div className="rejilla rejilla-2">
        <Campo id={id("razon_social")} etiqueta="Razón social">
          <input id={id("razon_social")} value={valores.razon_social ?? ""} onChange={(e) => cambiar("razon_social", e.target.value)} maxLength={200} />
        </Campo>
        <Campo id={id("ruc")} etiqueta="RUC">
          <input id={id("ruc")} className="cifra" value={valores.ruc ?? ""} onChange={(e) => cambiar("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" maxLength={11} />
        </Campo>
        <Campo id={id("banco")} etiqueta="Banco">
          <input id={id("banco")} value={valores.banco ?? ""} onChange={(e) => cambiar("banco", e.target.value)} maxLength={80} />
        </Campo>
        <Campo id={id("tipo_cuenta")} etiqueta="Tipo de cuenta">
          <select id={id("tipo_cuenta")} value={valores.tipo_cuenta ?? ""} onChange={(e) => cambiar("tipo_cuenta", e.target.value)}>
            <option value="">—</option>
            {catalogos.tipos_cuenta.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo id={id("moneda")} etiqueta="Moneda">
          <select id={id("moneda")} value={valores.moneda ?? ""} onChange={(e) => cambiar("moneda", e.target.value)}>
            <option value="">—</option>
            {catalogos.monedas.map((m) => <option key={m} value={m}>{m === "PEN" ? "PEN · Soles" : "USD · Dólares"}</option>)}
          </select>
        </Campo>
        <Campo id={id("numero_cuenta")} etiqueta="Número de cuenta">
          <input id={id("numero_cuenta")} className="cifra" value={valores.numero_cuenta ?? ""} onChange={(e) => cambiar("numero_cuenta", e.target.value)} maxLength={40} />
        </Campo>
        <Campo id={id("cci")} etiqueta="CCI" ayuda="Código de cuenta interbancario, 20 dígitos.">
          <input id={id("cci")} className="cifra" value={valores.cci ?? ""} onChange={(e) => cambiar("cci", e.target.value.replace(/\D/g, "").slice(0, 20))} inputMode="numeric" maxLength={20} />
        </Campo>
        <Campo id={id("correos")} etiqueta="Correos" ayuda="Varios, separados por punto y coma.">
          <input id={id("correos")} value={valores.correos ?? ""} onChange={(e) => cambiar("correos", e.target.value)} maxLength={300} />
        </Campo>
        <Campo id={id("telefonos")} etiqueta="Teléfonos" ayuda="Varios, separados por punto y coma.">
          <input id={id("telefonos")} value={valores.telefonos ?? ""} onChange={(e) => cambiar("telefonos", e.target.value)} maxLength={120} />
        </Campo>
      </div>
      <Campo id={id("notas")} etiqueta="Notas">
        <textarea id={id("notas")} rows={3} value={valores.notas ?? ""} onChange={(e) => cambiar("notas", e.target.value)} maxLength={1000} />
      </Campo>

      <div className="acciones-ficha">
        <button type="submit" className="boton" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar ficha"}</button>
        {ficha && (
          <button type="button" className="boton-secundario" onClick={alEliminar} disabled={ocupado}>Eliminar ficha</button>
        )}
        {ficha?.actualizado && <span className="nota">Última actualización: {ficha.actualizado}</span>}
        {mensaje && <span className={mensaje.tipo === "ok" ? "nota mensaje-ok" : "estado-error"}>{mensaje.texto}</span>}
      </div>
    </form>
  );
}

export function Contactos() {
  const { empresa, setEmpresa, empresas } = useSeleccion();

  const [libro, setLibro] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarContactos()
      .then((d) => { if (vigente) { setLibro(d); setError(null); } })
      .catch(() => { if (vigente) setError("No se pudo leer el libro de contactos."); });
    return () => { vigente = false; };
  }, [version]);

  const fichas = useMemo(() => new Map((libro?.fichas ?? []).map((f) => [f.empresa_id, f])), [libro]);
  const lista = useMemo(() => ordenarEmpresas(empresas), [empresas]);
  const elegida = empresas.find((e) => e.empresa_id === empresa) ?? null;

  async function guardar(valores) {
    setOcupado(true);
    try {
      await guardarContacto(empresa, valores);
      setVersion((v) => v + 1);
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar() {
    setOcupado(true);
    try {
      await eliminarContacto(empresa);
      setVersion((v) => v + 1);
    } finally {
      setOcupado(false);
    }
  }

  function bajarCSV() {
    descargar("contactos.csv", aCSV(libro?.fichas ?? []), "text/csv");
  }

  return (
    <EstadoCarga cargando={!libro && !error} error={error} vacio={false}>
      <div className="comparador contactos">
        <Tarjeta etiqueta="Empresas" titulo={`${fichas.size} fichas de ${lista.length}`}
          acciones={<button type="button" className="boton-secundario" onClick={bajarCSV} disabled={!fichas.size}>Descargar CSV</button>}
        >
          <ul className="casillas lista-contactos" aria-label="Empresas">
            {lista.map((e) => (
              <li key={e.empresa_id} className={e.empresa_id === empresa ? "elegida" : ""}>
                <button type="button" className="fila-empresa" onClick={() => setEmpresa(e.empresa_id)}>
                  <span className="nombre">{nombreEmpresa(e)}</span>
                  <span className="ruc cifra">RUC {e.ruc ?? "—"}</span>
                  {fichas.has(e.empresa_id) && <span className="distintivo distintivo-ok">Ficha</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="nota">Se listan las empresas con liquidación en el periodo de la cabecera.</p>
        </Tarjeta>

        <Tarjeta etiqueta="Ficha de contacto" titulo={elegida ? nombreEmpresa(elegida) : "Elige una empresa"}>
          {libro?.almacen === "supabase" ? (
            <p className="nota aviso-almacen">
              Las fichas se guardan en la base de datos del portal (Supabase), consolidadas para todas las empresas.
              Es una demostración: no cargues cuentas bancarias reales.
            </p>
          ) : (
            <p className="aviso-demo">
              Las fichas se están guardando en un archivo local sin cifrado ni control de acceso,
              pensado para la demostración. No cargues cuentas bancarias reales.
            </p>
          )}
          {elegida ? (
            <Formulario
              empresa={elegida}
              ficha={fichas.get(elegida.empresa_id) ?? null}
              catalogos={{ monedas: libro?.monedas ?? [], tipos_cuenta: libro?.tipos_cuenta ?? [] }}
              alGuardar={guardar}
              alEliminar={eliminar}
              ocupado={ocupado}
            />
          ) : (
            <p className="nota">Elige una empresa en la lista o en la cabecera para ver o completar su ficha.</p>
          )}
        </Tarjeta>
      </div>
    </EstadoCarga>
  );
}
