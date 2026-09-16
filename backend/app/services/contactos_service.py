"""Fichas de contacto por empresa (spec 9.3 y §12).

Dos almacenes con la misma interfaz:

- **Supabase** (`ContactosSupabase`): la tabla `contactos` de un proyecto
  Supabase, a través de su API REST (PostgREST). Es el almacén de
  producción: la información queda consolidada en una base de datos y
  sobrevive a los reinicios del servidor. Se activa con las variables
  SUPABASE_URL y SUPABASE_SERVICE_KEY; el esquema está en
  supabase/contactos.sql.

- **Excel** (`ContactosExcel`): una hoja, una fila por empresa, en
  data/contactos.xlsx. Es el respaldo para desarrollo local sin
  credenciales y lo que hubo antes de la migración.

`crear_servicio()` elige según el entorno. Los routers y el frontend no
saben cuál está detrás: solo leen `almacen` para decirlo en pantalla.
"""

import os
from pathlib import Path
from threading import Lock

import httpx
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
LIBRO = BASE_DIR.parent / "data" / "contactos.xlsx"
HOJA = "contactos"
TABLA_SUPABASE = "contactos"

CAMPOS = [
    "empresa_id",
    "razon_social",
    "ruc",
    "banco",
    "tipo_cuenta",
    "moneda",
    "numero_cuenta",
    "cci",
    "correos",
    "telefonos",
    "notas",
    "actualizado",
]

MONEDAS = ["PEN", "USD"]
TIPOS_CUENTA = ["Corriente", "Ahorros", "Detracciones"]

_candado = Lock()


def _normalizar_ficha(empresa_id: str, ficha: dict) -> dict:
    """La fila que se guarda: solo los campos conocidos, vacíos como None."""
    ahora = pd.Timestamp.now(tz="America/Lima").strftime("%Y-%m-%d %H:%M")

    nueva = {campo: None for campo in CAMPOS}
    nueva.update({k: v for k, v in ficha.items() if k in CAMPOS})
    nueva["empresa_id"] = empresa_id
    nueva["actualizado"] = ahora

    return {k: (None if v in ("", None) else str(v)) for k, v in nueva.items()}


class ContactosExcel:

    almacen = "excel"

    def __init__(self, ruta: Path = LIBRO):
        self.ruta = ruta

    def _leer(self) -> pd.DataFrame:
        if not self.ruta.exists():
            return pd.DataFrame(columns=CAMPOS)

        tabla = pd.read_excel(self.ruta, sheet_name=HOJA, dtype=str)
        tabla = tabla.reindex(columns=CAMPOS)

        # Las celdas vacias vuelven como NaN; hacia afuera son None, que es
        # lo que el JSON y el formulario entienden como "sin dato".
        return tabla.astype(object).where(pd.notna(tabla), None)

    def _escribir(self, tabla: pd.DataFrame) -> None:
        self.ruta.parent.mkdir(parents=True, exist_ok=True)

        with pd.ExcelWriter(self.ruta, engine="openpyxl") as escritor:
            tabla[CAMPOS].to_excel(escritor, sheet_name=HOJA, index=False)

    def listar(self) -> list[dict]:
        with _candado:
            return self._leer().to_dict(orient="records")

    def obtener(self, empresa_id: str) -> dict | None:
        with _candado:
            tabla = self._leer()

        fila = tabla[tabla["empresa_id"] == empresa_id]

        if fila.empty:
            return None

        return fila.iloc[0].to_dict()

    def guardar(self, empresa_id: str, ficha: dict) -> dict:
        """Crea o reemplaza la ficha de una empresa. Devuelve lo guardado."""
        nueva = _normalizar_ficha(empresa_id, ficha)

        with _candado:
            tabla = self._leer()
            tabla = tabla[tabla["empresa_id"] != empresa_id]
            tabla = pd.concat(
                [tabla, pd.DataFrame([nueva])], ignore_index=True
            ).sort_values("empresa_id")
            self._escribir(tabla)

        return nueva

    def eliminar(self, empresa_id: str) -> bool:
        with _candado:
            tabla = self._leer()

            if tabla[tabla["empresa_id"] == empresa_id].empty:
                return False

            self._escribir(tabla[tabla["empresa_id"] != empresa_id])

        return True


class ContactosSupabase:
    """La tabla `contactos` de Supabase, vía PostgREST.

    La clave de servicio salta las políticas de fila (RLS): la tabla no
    se expone a los navegadores, solo la usa este backend.
    """

    almacen = "supabase"

    def __init__(self, url: str, clave: str, tabla: str = TABLA_SUPABASE, transporte=None):
        self.tabla = tabla
        self.cliente = httpx.Client(
            base_url=f"{url.rstrip('/')}/rest/v1",
            headers={
                "apikey": clave,
                "Authorization": f"Bearer {clave}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
            transport=transporte,
        )

    def _pedir(self, metodo: str, **kwargs) -> httpx.Response:
        respuesta = self.cliente.request(metodo, f"/{self.tabla}", **kwargs)
        respuesta.raise_for_status()
        return respuesta

    @staticmethod
    def _fila(registro: dict) -> dict:
        return {campo: registro.get(campo) for campo in CAMPOS}

    def listar(self) -> list[dict]:
        respuesta = self._pedir("GET", params={"select": "*", "order": "empresa_id.asc"})
        return [self._fila(r) for r in respuesta.json()]

    def obtener(self, empresa_id: str) -> dict | None:
        respuesta = self._pedir(
            "GET", params={"select": "*", "empresa_id": f"eq.{empresa_id}", "limit": "1"}
        )
        filas = respuesta.json()
        return self._fila(filas[0]) if filas else None

    def guardar(self, empresa_id: str, ficha: dict) -> dict:
        nueva = _normalizar_ficha(empresa_id, ficha)
        respuesta = self._pedir(
            "POST",
            json=nueva,
            headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        filas = respuesta.json()
        return self._fila(filas[0]) if filas else nueva

    def eliminar(self, empresa_id: str) -> bool:
        respuesta = self._pedir(
            "DELETE",
            params={"empresa_id": f"eq.{empresa_id}"},
            headers={"Prefer": "return=representation"},
        )
        return bool(respuesta.json())


# El nombre historico sigue apuntando al almacen en Excel: las pruebas y el
# script de migracion lo usan para leer el libro.
ContactosService = ContactosExcel


def _cargar_env_local() -> None:
    """Lee backend/.env (ignorado por git) si existe: CLAVE=valor por línea.

    Es para desarrollo local: la clave de servicio de Supabase no debe
    escribirse en el código ni en la terminal. En Render las variables
    llegan por el panel y este archivo no existe.
    """
    ruta = BASE_DIR / ".env"
    if not ruta.exists():
        return

    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


def crear_servicio():
    """Supabase si hay credenciales en el entorno; si no, el Excel local."""
    _cargar_env_local()
    url = os.getenv("SUPABASE_URL", "").strip()
    clave = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if url and clave:
        return ContactosSupabase(url, clave)

    return ContactosExcel()
