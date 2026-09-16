"""Fichas de contacto por empresa, guardadas en un libro Excel (spec 9.3).

Es la persistencia provisional que pidio el usuario: una hoja, una fila
por empresa, en data/contactos.xlsx (carpeta data/ del repositorio). La
migracion a Supabase es una etapa posterior; este servicio es la unica
pieza que sabe donde y como se guarda, para que ese cambio no toque los
routers ni el frontend.

El libro no esta cifrado ni tiene control de acceso: la ficha del portal
avisa que en la demo no deben cargarse cuentas bancarias reales.
"""

from pathlib import Path
from threading import Lock

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
LIBRO = BASE_DIR.parent / "data" / "contactos.xlsx"
HOJA = "contactos"

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


class ContactosService:

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
        ahora = pd.Timestamp.now(tz="America/Lima").strftime("%Y-%m-%d %H:%M")

        nueva = {campo: None for campo in CAMPOS}
        nueva.update({k: v for k, v in ficha.items() if k in CAMPOS})
        nueva["empresa_id"] = empresa_id
        nueva["actualizado"] = ahora

        # Cadenas vacias se guardan como vacio real, no como "".
        nueva = {k: (None if v in ("", None) else str(v)) for k, v in nueva.items()}

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
