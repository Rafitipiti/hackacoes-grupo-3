"""Trazabilidad del ciclo de revisiones de liquidaciones.

COES no publica una liquidacion una sola vez: la publicacion de un mes
trae la R0 de ese mes mas recalculos de meses anteriores. Este servicio
expone ese ciclo.

Regla de dominio: 'monto_total' es el monto restatado completo del mes,
no el ajuste. El ajuste es la diferencia contra la revision anterior, y
por eso se calcula aqui en vez de sumarse desde los datos.
"""

import pandas as pd


class RevisionService:

    def __init__(self, datos: dict[str, pd.DataFrame]):
        self.totales = datos["revisiones_totales"]
        self.calendario = datos["calendario"]

    def calendario_de_publicacion(
        self, publicacion_pericodi: int
    ) -> list[dict]:
        """Que liquidaciones salen en la publicacion de un mes."""
        entradas = self.calendario[
            self.calendario["publicacion_pericodi"] == publicacion_pericodi
        ]

        entradas = entradas.sort_values(
            ["proceso", "pericodi", "revision"]
        )

        return entradas.to_dict(orient="records")

    def cascada(self, empresa_id: str, pericodi: int) -> dict[str, list[dict]]:
        """La cadena R0..R4 de un mes, separada por proceso.

        Cada proceso tiene su propia cadena de revisiones: un mes puede
        llegar a R3 en Energia Activa y solo a R1 en Potencia. Consolidar
        los montos entre procesos y luego comparar revisiones consecutivas
        produce un ajuste que mide la desaparicion de un proceso, no un
        recalculo. Por eso se separan.
        """
        filas = self.totales[
            (self.totales["emprcodi"] == empresa_id)
            & (self.totales["pericodi"] == pericodi)
        ]

        if filas.empty:
            return {}

        por_proceso = {}

        for proceso, grupo in filas.groupby("proceso"):
            grupo = grupo.sort_values("revision")

            pasos = []
            monto_anterior = None

            for fila in grupo.to_dict(orient="records"):
                monto = float(fila["monto_total"])

                if monto_anterior is None:
                    ajuste = None
                    ajuste_pct = None
                else:
                    ajuste = monto - monto_anterior
                    ajuste_pct = (
                        ajuste / abs(monto_anterior)
                        if monto_anterior != 0
                        else None
                    )

                pasos.append({
                    "revision": int(fila["revision"]),
                    "revision_nombre": fila["revision_nombre"],
                    "monto_total": monto,
                    "ajuste": ajuste,
                    "ajuste_pct": ajuste_pct,
                    "publicacion_pericodi": int(fila["publicacion_pericodi"]),
                    "origen": fila["origen"],
                })

                monto_anterior = monto

            por_proceso[proceso] = pasos

        return por_proceso

    def impacto_de_publicacion(
        self, publicacion_pericodi: int
    ) -> dict:
        """Cuanto de una publicacion es del mes y cuanto viene arrastrado."""
        filas = self.totales[
            self.totales["publicacion_pericodi"] == publicacion_pericodi
        ]

        if filas.empty:
            return {
                "publicacion_pericodi": publicacion_pericodi,
                "corriente": 0.0,
                "arrastre": 0.0,
                "periodos_arrastrados": 0,
            }

        del_mes = filas[filas["pericodi"] == publicacion_pericodi]
        arrastradas = filas[filas["pericodi"] != publicacion_pericodi]

        return {
            "publicacion_pericodi": publicacion_pericodi,
            "corriente": float(del_mes["monto_total"].sum()),
            "arrastre": float(arrastradas["monto_total"].sum()),
            "periodos_arrastrados": int(arrastradas["pericodi"].nunique()),
        }
