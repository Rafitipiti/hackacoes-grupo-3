"""La publicacion mensual: que liquidaciones y recalculos salen en un mes.

Reproduce la lectura de la maqueta "Publicacion mensual de liquidaciones"
(spec, seccion 11): cada mes el COES publica la liquidacion R0 del mes y
recalculos (R1, R2...) de meses anteriores, por proceso. Cada tarjeta se
compara SIEMPRE contra algo:

- R0 -> la ultima revision conocida del mes anterior a la fecha de esta
  publicacion.
- Rn -> la revision inmediata anterior (R(n-1)) del mismo mes.

Agregacion del sector: la liquidacion es un juego de suma cero -- lo que
unas empresas pagan lo cobran otras -- asi que sumar los netos de todas
da cero y una tarjeta sin sentido. Cuando no hay empresa elegida, la
tarjeta muestra lo que COBRAN las empresas acreedoras (la suma de los
netos positivos): el volumen que se mueve en esa liquidacion. Con una
empresa elegida se muestra su neto, con signo.

El detalle de una tarjeta explica la variacion por componentes: las
valorizaciones del proceso tal como llegan (Potencia, LSCIO, SST-SCT) y,
para Energia Activa, las tres componentes simuladas de
data/componentes_lvtea.csv (entregas, retiros, ingreso tarifario y rentas
por congestion), ordenadas de mayor a menor impacto en soles.
"""

from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
COMPONENTES_LVTEA = BASE_DIR.parent / "data" / "componentes_lvtea.csv"

PROCESOS = ["LVTA", "LVTP", "LSCIO", "SST-SCT"]

# Una variacion "fuerte" merece un aviso en la tarjeta. Una liquidacion del
# mes que se mueve un cuarto frente al mes anterior, o un recalculo que
# mueve un decimo del monto, ya es noticia.
UMBRAL_FUERTE_R0 = 0.25
UMBRAL_FUERTE_REVISION = 0.10


def _variacion(actual: float, base: float | None) -> dict:
    if base is None:
        return {"delta": None, "delta_pct": None}

    delta = actual - base
    pct = delta / abs(base) if abs(base) > 1e-9 else None

    return {"delta": float(delta), "delta_pct": None if pct is None else float(pct)}


class PublicacionService:

    def __init__(self, datos):
        self.totales = datos["revisiones_totales"]
        self.revisiones = datos["revisiones"]
        self.calendario = datos["calendario"]
        self.periodos = datos["periodos"].set_index("pericodi")
        self._lvtea = None

    # ------------------------------------------------------------ utilidades

    @property
    def componentes_lvtea(self) -> pd.DataFrame:
        if self._lvtea is None:
            if COMPONENTES_LVTEA.exists():
                self._lvtea = pd.read_csv(COMPONENTES_LVTEA)
            else:
                self._lvtea = pd.DataFrame(
                    columns=["emprcodi", "pericodi", "revision", "componente", "monto"]
                )
        return self._lvtea

    def _nombre(self, pericodi: int) -> str:
        if pericodi in self.periodos.index:
            return str(self.periodos.loc[pericodi, "perinombre"])
        return str(pericodi)

    def _filtrar_empresa(self, tabla: pd.DataFrame, empresa_id: str | None) -> pd.DataFrame:
        if empresa_id is None:
            return tabla
        return tabla[tabla["emprcodi"] == empresa_id]

    def _montos(self, empresa_id: str | None) -> pd.DataFrame:
        """monto por (proceso, pericodi, revision) con la publicacion en que salio."""
        base = self._filtrar_empresa(self.totales, empresa_id)

        if empresa_id is None:
            # Sector: solo lo que cobran las acreedoras (ver docstring del modulo).
            base = base.assign(monto_total=base["monto_total"].clip(lower=0))

        return (
            base.groupby(["proceso", "pericodi", "revision"])
            .agg(monto=("monto_total", "sum"), publicacion=("publicacion_pericodi", "max"))
            .reset_index()
        )

    def _rmax(self) -> dict:
        """Hasta que revision llega cada (proceso, mes), segun el calendario."""
        return (
            self.calendario.groupby(["proceso", "pericodi"])["revision"].max().to_dict()
        )

    def _base_de(self, montos: pd.DataFrame, proceso: str, pericodi: int, revision: int, publicacion: int):
        """Contra que se compara una tarjeta. Devuelve (monto, pericodi, revision) o Nones."""
        del_proceso = montos[montos["proceso"] == proceso]

        if revision == 0:
            anteriores = del_proceso[
                (del_proceso["pericodi"] == pericodi - 1)
                & (del_proceso["publicacion"] <= publicacion)
            ]
            if anteriores.empty:
                return None, None, None
            fila = anteriores.sort_values("revision").iloc[-1]
            return float(fila["monto"]), int(fila["pericodi"]), int(fila["revision"])

        previa = del_proceso[
            (del_proceso["pericodi"] == pericodi) & (del_proceso["revision"] == revision - 1)
        ]
        if previa.empty:
            return None, None, None
        fila = previa.iloc[0]
        return float(fila["monto"]), int(pericodi), int(revision - 1)

    # ------------------------------------------------------------ vista lista

    def contenido(self, publicacion: int, empresa_id: str | None = None) -> dict:
        montos = self._montos(empresa_id)
        rmax = self._rmax()

        del_mes = montos[montos["publicacion"] == publicacion]

        bloques = []
        todos = []

        for proceso in PROCESOS:
            filas = del_mes[del_mes["proceso"] == proceso]
            items = []

            for fila in filas.sort_values("pericodi", ascending=False).to_dict(orient="records"):
                pericodi, revision = int(fila["pericodi"]), int(fila["revision"])
                monto = float(fila["monto"])
                base, base_pc, base_rev = self._base_de(montos, proceso, pericodi, revision, publicacion)
                var = _variacion(monto, base)
                tope = rmax.get((proceso, pericodi), revision)
                umbral = UMBRAL_FUERTE_R0 if revision == 0 else UMBRAL_FUERTE_REVISION
                fuerte = var["delta_pct"] is not None and abs(var["delta_pct"]) >= umbral

                item = {
                    "proceso": proceso,
                    "pericodi": pericodi,
                    "perinombre": self._nombre(pericodi),
                    "revision": revision,
                    "revision_maxima": int(tope),
                    "tipo": "liquidacion" if revision == 0 else "recalculo",
                    "monto": monto,
                    "base": base,
                    "base_pericodi": base_pc,
                    "base_revision": base_rev,
                    "base_etiqueta": None if base_pc is None else f"{self._nombre(base_pc)} · R{base_rev}",
                    "fuerte": bool(fuerte),
                    **var,
                }
                items.append(item)
                todos.append(item)

            bloques.append({"proceso": proceso, "items": items})

        mes_curso = sum(i["monto"] for i in todos if i["revision"] == 0)
        efecto = sum(i["delta"] for i in todos if i["revision"] > 0 and i["delta"] is not None)
        alcance = (publicacion - min(i["pericodi"] for i in todos)) if todos else 0

        return {
            "publicacion": publicacion,
            "publicacion_nombre": self._nombre(publicacion),
            "empresa_id": empresa_id,
            "alcance": "empresa" if empresa_id else "sector",
            "resumen": {
                "liquidacion_mes_curso": float(mes_curso),
                "efecto_neto_recalculos": float(efecto),
                "recalculos": sum(1 for i in todos if i["revision"] > 0),
                "alcance_meses": int(alcance),
                "variaciones_fuertes": sum(1 for i in todos if i["fuerte"]),
            },
            "procesos": bloques,
        }

    # ---------------------------------------------------------- vista detalle

    def _acreedoras(self, proceso: str, pericodi: int, revision: int) -> set[str]:
        """Empresas con neto positivo en esa revision: las que cobran."""
        filas = self.totales[
            (self.totales["proceso"] == proceso)
            & (self.totales["pericodi"] == pericodi)
            & (self.totales["revision"] == revision)
            & (self.totales["monto_total"] > 0)
        ]
        return set(filas["emprcodi"])

    def _componentes(self, proceso: str, pericodi: int, revision: int, empresa_id: str | None) -> dict[str, float]:
        if proceso == "LVTA":
            tabla = self.componentes_lvtea
            tabla = tabla[(tabla["pericodi"] == pericodi) & (tabla["revision"] == revision)]
            clave = "componente"
        else:
            tabla = self.revisiones[
                (self.revisiones["proceso"] == proceso)
                & (self.revisiones["pericodi"] == pericodi)
                & (self.revisiones["revision"] == revision)
            ]
            clave = "valorizacion"

        if empresa_id is None:
            # Las componentes de las acreedoras suman exactamente lo que cobran,
            # asi que el detalle cuadra con la tarjeta del sector.
            tabla = tabla[tabla["emprcodi"].isin(self._acreedoras(proceso, pericodi, revision))]
        else:
            tabla = self._filtrar_empresa(tabla, empresa_id)

        return tabla.groupby(clave)["monto"].sum().to_dict()

    def detalle(self, publicacion: int, proceso: str, pericodi: int, revision: int, empresa_id: str | None = None) -> dict | None:
        contenido = self.contenido(publicacion, empresa_id)
        bloque = next((b for b in contenido["procesos"] if b["proceso"] == proceso), None)
        item = next((i for i in (bloque or {"items": []})["items"] if i["pericodi"] == pericodi and i["revision"] == revision), None)

        if item is None:
            return None

        actual = self._componentes(proceso, pericodi, revision, empresa_id)
        previo = (
            self._componentes(proceso, item["base_pericodi"], item["base_revision"], empresa_id)
            if item["base_pericodi"] is not None
            else {}
        )

        componentes = []
        for etiqueta in sorted(set(actual) | set(previo)):
            a = actual.get(etiqueta)
            p = previo.get(etiqueta)
            delta = None if a is None or p is None else a - p
            componentes.append({
                "componente": etiqueta,
                "actual": None if a is None else float(a),
                "previo": None if p is None else float(p),
                "delta": None if delta is None else float(delta),
                "delta_pct": (
                    float(delta / abs(p)) if delta is not None and p is not None and abs(p) > 1e-9 else None
                ),
            })

        componentes.sort(key=lambda c: -abs(c["delta"] if c["delta"] is not None else (c["actual"] or 0)))

        # Historial de revisiones del mes liquidado, con las que aun no
        # salieron marcadas como futuras.
        montos = self._montos(empresa_id)
        cadena = montos[(montos["proceso"] == proceso) & (montos["pericodi"] == pericodi)].sort_values("revision")
        historial = []
        anterior = None
        for fila in cadena.to_dict(orient="records"):
            monto = float(fila["monto"])
            var = _variacion(monto, anterior)
            historial.append({
                "revision": int(fila["revision"]),
                "publicacion_pericodi": int(fila["publicacion"]),
                "publicacion_nombre": self._nombre(int(fila["publicacion"])),
                "monto": monto,
                "futura": bool(fila["publicacion"] > publicacion),
                "en_esta_publicacion": int(fila["revision"]) == revision,
                **var,
            })
            anterior = monto

        return {
            **item,
            "publicacion": publicacion,
            "publicacion_nombre": contenido["publicacion_nombre"],
            "empresa_id": empresa_id,
            "componentes": componentes,
            "componentes_simulados": proceso == "LVTA",
            "historial": historial,
        }
