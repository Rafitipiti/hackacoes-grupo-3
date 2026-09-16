"""Simulador: cálculo preliminar de la liquidación de una empresa (spec, §12).

Dos piezas:

1. **Valorizar energía activa.** La empresa pega sus entregas y retiros
   (por mes o por día, de una barra o de varias) y se valorizan con el
   costo marginal publicado de cada barra:

       LVTEA = Σ_barra Σ_día  CMg(b, d) × (Entrega(b, d) − Retiro(b, d))

   El CMg está en S/ por kWh y la energía en MWh, así que el monto es
   CMg × MWh × 1000. El signo sigue la convención del portal: positivo,
   la empresa cobra; negativo, paga.

2. **Base de la empresa.** Lo que la empresa tuvo de verdad en el mes
   —energía por barra, montos liquidados por proceso, valorizaciones que
   los componen, su participación histórica en el sistema— para que los
   campos del simulador arranquen en un punto real y las dos vías
   (por fórmula y por cuota) tengan con qué compararse.

Ninguna cifra se inventa: si una barra o un día no tiene CMg publicado
la fila queda sin valorizar y se dice cuántas quedaron así.
"""

import calendar
import unicodedata
from functools import lru_cache

import pandas as pd

from app.services.energia import energia_mes

PROCESOS = ["LVTA", "LVTP", "LSCIO", "SST-SCT"]

# Etiquetas visibles de las valorizaciones tal como llegan en los datos.
# El simulador las agrupa por mecanismo para prellenar los campos.
MECANISMOS = {
    "LVTP": {
        "VALORIZACIÓN DE LAS TRANSFERENCIA DE POTENCIA": "transferencia_potencia",
        "LIQUIDACIÓN DEL PEAJE POR CONEXIÓN": "peaje_conexion",
        "COMPENSACIÓN A TRANSMISORAS POR INGRESO TARIFARIO": "ingreso_tarifario",
    },
    "LSCIO": {
        "Reactiva": "reactiva",
        "RSF": "rsf",
        "Inflexibilidad Operativa": "inflexibilidad",
    },
    "SST-SCT": {
        "Asignación responsabilidad de pago SST-SCT - Criterio de Uso": "criterio_uso",
        "Asignación responsabilidad de pago SST-SCT - Ingreso Tarifario": "ingreso_tarifario",
    },
}


def normalizar(texto: str) -> str:
    plano = unicodedata.normalize("NFD", str(texto or ""))
    plano = "".join(c for c in plano if unicodedata.category(c) != "Mn")
    return " ".join(plano.upper().split())


class SimuladorService:

    def __init__(self, datos):
        self.datos = datos

    # ------------------------------------------------------------ utilidades

    @property
    def periodos(self) -> pd.DataFrame:
        return self.datos["periodos"]

    def nombre_periodo(self, pericodi: int) -> str:
        fila = self.periodos[self.periodos["pericodi"] == pericodi]
        return str(fila["perinombre"].iloc[0]) if not fila.empty else str(pericodi)

    def dias_del_mes(self, pericodi: int) -> int:
        fila = self.periodos[self.periodos["pericodi"] == pericodi]
        if fila.empty:
            return 30
        return calendar.monthrange(int(fila["perianio"].iloc[0]), int(fila["perimes"].iloc[0]))[1]

    @lru_cache(maxsize=1)
    def _catalogo_barras(self) -> pd.DataFrame:
        barras = self.datos["barras"].copy()
        barras["clave"] = barras["barrnombre"].map(normalizar)
        return barras

    def resolver_barra(self, texto) -> dict | None:
        """Una barra escrita a mano: por código, por nombre exacto o por
        prefijo único, tolerando mayúsculas y tildes."""
        if texto is None:
            return None

        barras = self._catalogo_barras()

        if isinstance(texto, (int, float)) or str(texto).strip().isdigit():
            fila = barras[barras["barrcodi"] == int(texto)]
            return None if fila.empty else self._ficha(fila.iloc[0])

        clave = normalizar(texto)
        if not clave:
            return None

        exacta = barras[barras["clave"] == clave]
        if not exacta.empty:
            return self._ficha(exacta.iloc[0])

        prefijo = barras[barras["clave"].str.startswith(clave)]
        if len(prefijo) == 1:
            return self._ficha(prefijo.iloc[0])

        return None

    @staticmethod
    def _ficha(fila) -> dict:
        return {"barrcodi": int(fila["barrcodi"]), "barrnombre": str(fila["barrnombre"])}

    @lru_cache(maxsize=24)
    def _cmg_mes(self, pericodi: int) -> pd.DataFrame:
        """CMg por barra y día del mes, y su promedio mensual."""
        costos = self.datos["costos_marginales_diario"]
        del_mes = costos[costos["pericodi"] == pericodi][["barrcodi", "dia", "promedio"]]
        return del_mes.reset_index(drop=True)

    def cmg(self, barrcodi: int, pericodi: int, dia: int | None = None) -> float | None:
        tabla = self._cmg_mes(pericodi)
        filas = tabla[tabla["barrcodi"] == barrcodi]

        if dia is not None:
            filas = filas[filas["dia"] == dia]

        if filas.empty:
            return None

        return float(filas["promedio"].mean())

    def cmg_sistema(self, pericodi: int) -> float | None:
        tabla = self._cmg_mes(pericodi)
        if tabla.empty:
            return None
        return float(tabla.groupby("barrcodi")["promedio"].mean().mean())

    def barras_con_cmg(self, pericodi: int) -> list[dict]:
        tabla = self._cmg_mes(pericodi)
        if tabla.empty:
            return []
        promedio = tabla.groupby("barrcodi")["promedio"].mean().reset_index()
        promedio = promedio.merge(self._catalogo_barras()[["barrcodi", "barrnombre"]], on="barrcodi")
        return [
            {"barrcodi": int(f["barrcodi"]), "barrnombre": f["barrnombre"], "cmg_promedio": float(f["promedio"])}
            for f in promedio.sort_values("barrnombre").to_dict(orient="records")
        ]

    # ----------------------------------------------------------- valorizar

    def valorizar(self, pericodi: int, granularidad: str, barra_defecto: int | None, filas: list[dict]) -> dict:
        """Valoriza filas {barra, dia, entregas, retiros} con el CMg del mes.

        `barra` puede venir como nombre, como código o vacía (se usa
        `barra_defecto`). En granularidad diaria cada fila lleva su día y
        se valoriza con el CMg de ese día; en mensual, con el promedio.
        """
        por_dia = granularidad == "dia"
        detalle, no_reconocidas = [], []
        sin_cmg = 0

        for indice, fila in enumerate(filas, start=1):
            barra = self.resolver_barra(fila.get("barra")) if fila.get("barra") not in (None, "") else None
            if barra is None and barra_defecto is not None:
                barra = self.resolver_barra(barra_defecto)

            if barra is None:
                no_reconocidas.append({"fila": indice, "texto": str(fila.get("barra") or ""), "motivo": "barra no reconocida"})
                continue

            dia = int(fila["dia"]) if por_dia and fila.get("dia") is not None else None
            entregas = float(fila.get("entregas") or 0.0)
            retiros = float(fila.get("retiros") or 0.0)
            neto = entregas - retiros
            cmg = self.cmg(barra["barrcodi"], pericodi, dia)

            if cmg is None:
                sin_cmg += 1

            detalle.append({
                **barra,
                "dia": dia,
                "entregas": entregas,
                "retiros": retiros,
                "neto": neto,
                "cmg": cmg,
                "monto": None if cmg is None else neto * cmg * 1000.0,
            })

        valorizadas = [d for d in detalle if d["monto"] is not None]
        total = sum(d["monto"] for d in valorizadas)
        neto_total = sum(d["neto"] for d in valorizadas)

        # Lo mismo valorizado al promedio del mes: cuánto se habría perdido
        # por no bajar al día. Solo tiene sentido en granularidad diaria.
        al_promedio = None
        if por_dia and valorizadas:
            al_promedio = 0.0
            for d in valorizadas:
                cmg_mes = self.cmg(d["barrcodi"], pericodi)
                if cmg_mes is not None:
                    al_promedio += d["neto"] * cmg_mes * 1000.0

        por_barra = {}
        for d in valorizadas:
            acumulado = por_barra.setdefault(d["barrcodi"], {
                "barrcodi": d["barrcodi"], "barrnombre": d["barrnombre"],
                "entregas": 0.0, "retiros": 0.0, "monto": 0.0, "filas": 0,
                "cmg_minimo": d["cmg"], "cmg_maximo": d["cmg"],
            })
            acumulado["entregas"] += d["entregas"]
            acumulado["retiros"] += d["retiros"]
            acumulado["monto"] += d["monto"]
            acumulado["filas"] += 1
            acumulado["cmg_minimo"] = min(acumulado["cmg_minimo"], d["cmg"])
            acumulado["cmg_maximo"] = max(acumulado["cmg_maximo"], d["cmg"])

        return {
            "pericodi": pericodi,
            "perinombre": self.nombre_periodo(pericodi),
            "granularidad": granularidad,
            "dias_del_mes": self.dias_del_mes(pericodi),
            "total": float(total),
            "energia_neta": float(neto_total),
            "entregas": float(sum(d["entregas"] for d in valorizadas)),
            "retiros": float(sum(d["retiros"] for d in valorizadas)),
            "cmg_efectivo": None if abs(neto_total) < 1e-9 else float(total / (neto_total * 1000.0)),
            "al_promedio": None if al_promedio is None else float(al_promedio),
            "filas": len(detalle),
            "sin_cmg": sin_cmg,
            "no_reconocidas": no_reconocidas,
            "por_barra": sorted(por_barra.values(), key=lambda b: -abs(b["monto"])),
            "detalle": detalle,
        }

    # ------------------------------------------------------------ base

    def _ultima_revision(self, tabla: pd.DataFrame, empresa_id: str, pericodi: int) -> pd.DataFrame:
        propias = tabla[(tabla["emprcodi"] == empresa_id) & (tabla["pericodi"] == pericodi)]
        if propias.empty:
            return propias
        tope = propias.groupby("proceso")["revision"].transform("max")
        return propias[propias["revision"] == tope]

    def liquidado(self, empresa_id: str, pericodi: int) -> dict:
        """Monto neto de cada proceso en su última revisión conocida."""
        ultimas = self._ultima_revision(self.datos["revisiones_totales"], empresa_id, pericodi)
        salida = {p: None for p in PROCESOS}

        for fila in ultimas.to_dict(orient="records"):
            salida[fila["proceso"]] = {
                "monto": float(fila["monto_total"]),
                "revision": int(fila["revision"]),
                "revision_nombre": str(fila["revision_nombre"]),
            }

        return salida

    def mecanismos(self, empresa_id: str, pericodi: int) -> dict:
        """Las valorizaciones de cada proceso, agrupadas por mecanismo."""
        ultimas = self._ultima_revision(self.datos["revisiones"], empresa_id, pericodi)
        salida = {p: {} for p in PROCESOS}

        for fila in ultimas.to_dict(orient="records"):
            proceso = fila["proceso"]
            clave = MECANISMOS.get(proceso, {}).get(fila["valorizacion"], normalizar(fila["valorizacion"]).lower())
            salida[proceso][clave] = salida[proceso].get(clave, 0.0) + float(fila["monto"])

        return salida

    @lru_cache(maxsize=1)
    def _volumen_sistema(self) -> pd.DataFrame:
        """Volumen del sistema por (proceso, mes): lo que cobran las acreedoras
        en la última revisión. Es el mismo criterio que la publicación."""
        totales = self.datos["revisiones_totales"]
        ultimas = totales[totales["es_ultima_revision"]]
        positivos = ultimas.assign(monto=ultimas["monto_total"].clip(lower=0))
        return positivos.groupby(["proceso", "pericodi"])["monto"].sum().rename("volumen").reset_index()

    def sistema(self, pericodi: int) -> dict:
        volumen = self._volumen_sistema()
        del_mes = volumen[volumen["pericodi"] == pericodi].set_index("proceso")["volumen"]
        return {p: (float(del_mes[p]) if p in del_mes.index else None) for p in PROCESOS}

    def cuota(self, empresa_id: str) -> dict:
        """Participación histórica de la empresa en cada proceso: su neto
        sobre el volumen del sistema, mediana de los meses con dato."""
        totales = self.datos["revisiones_totales"]
        propias = totales[(totales["emprcodi"] == empresa_id) & totales["es_ultima_revision"]]
        con_volumen = propias.merge(self._volumen_sistema(), on=["proceso", "pericodi"])
        con_volumen = con_volumen[con_volumen["volumen"] > 0]
        con_volumen = con_volumen.assign(cuota=con_volumen["monto_total"] / con_volumen["volumen"])

        salida = {p: None for p in PROCESOS}
        for proceso, grupo in con_volumen.groupby("proceso"):
            salida[proceso] = {
                "mediana": float(grupo["cuota"].median()),
                "minimo": float(grupo["cuota"].min()),
                "maximo": float(grupo["cuota"].max()),
                "meses": int(len(grupo)),
            }
        return salida

    def energia(self, empresa_id: str, pericodi: int) -> dict:
        tabla = energia_mes(pericodi, empresa_id)
        tabla = tabla.merge(self._catalogo_barras()[["barrcodi", "barrnombre"]], on="barrcodi", how="left")

        por_barra = []
        for fila in tabla.sort_values("barrcodi").to_dict(orient="records"):
            cmg = self.cmg(int(fila["barrcodi"]), pericodi)
            por_barra.append({
                "barrcodi": int(fila["barrcodi"]),
                "barrnombre": fila["barrnombre"],
                "entregas": float(fila["entregas"]),
                "retiros": float(fila["retiros"]),
                "cmg": cmg,
            })

        return {
            "entregas": float(tabla["entregas"].sum()) if not tabla.empty else 0.0,
            "retiros": float(tabla["retiros"].sum()) if not tabla.empty else 0.0,
            "por_barra": por_barra,
        }

    def base(self, empresa_id: str, pericodi: int) -> dict:
        return {
            "empresa_id": empresa_id,
            "pericodi": pericodi,
            "perinombre": self.nombre_periodo(pericodi),
            "dias_del_mes": self.dias_del_mes(pericodi),
            "cmg_sistema": self.cmg_sistema(pericodi),
            "energia": self.energia(empresa_id, pericodi),
            "liquidado": self.liquidado(empresa_id, pericodi),
            "mecanismos": self.mecanismos(empresa_id, pericodi),
            "cuota": self.cuota(empresa_id),
            "sistema": self.sistema(pericodi),
        }
