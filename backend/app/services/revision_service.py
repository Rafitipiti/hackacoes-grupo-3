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
        self.evolucion = datos["evolucion_liquidaciones"]
        self.periodos = datos["periodos"]

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

    def impacto_de_publicacion(self, publicacion_pericodi: int) -> dict:
        """Cuanto de una publicacion es del mes y cuanto viene arrastrado.

        'corriente' es el monto de las liquidaciones del propio mes (R0),
        que no tienen revision anterior contra la cual ajustar.

        'arrastre' es la suma de los AJUSTES de los recalculos de meses
        anteriores, no de sus montos restatados. Sumar montos restatados
        seria doble contabilidad: cada revision restata el mes completo,
        asi que su monto ya incluye todo lo publicado antes.
        """
        # El ajuste necesita la revision anterior, que puede haber salido
        # en otra publicacion. Por eso se calcula sobre la tabla completa
        # y recien despues se filtra por publicacion.
        todas = self.totales.sort_values("revision").copy()
        todas["monto_anterior"] = (
            todas.groupby(["proceso", "emprcodi", "pericodi"])["monto_total"]
            .shift()
        )
        todas["ajuste"] = todas["monto_total"] - todas["monto_anterior"]

        filas = todas[
            todas["publicacion_pericodi"] == publicacion_pericodi
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
            "arrastre": float(arrastradas["ajuste"].sum()),
            "periodos_arrastrados": int(arrastradas["pericodi"].nunique()),
        }

    def serie_historica(self, empresa_id: str) -> list[dict]:
        """Los 20 periodos de una empresa: total, procesos y recalculos.

        Dos series distintas y dos fuentes distintas, a proposito:

        - 'liquidacion_total' y 'procesos' salen de la evolucion mensual,
          que es la misma fuente que alimenta "Mi empresa". Si aqui se
          usara el monto restatado de las revisiones, el mismo mes
          mostraria dos totales distintos en dos pantallas del portal.
        - 'efecto_neto_recalculos' sale de las revisiones, porque la
          evolucion no las distingue.

        El efecto neto es la suma de los AJUSTES entre revisiones
        consecutivas, no de los montos restatados: cada revision restata
        el mes completo, asi que sumar montos contaria varias veces lo
        mismo. Es la regla que ya aplica impacto_de_publicacion.
        """
        movimientos = self.evolucion[
            self.evolucion["empresa_deudora"] == empresa_id
        ]

        if movimientos.empty:
            return []

        totales = (
            movimientos.groupby("pericodi")["monto"].sum().to_dict()
        )

        por_proceso = (
            movimientos.groupby(["pericodi", "proceso"])["monto"]
            .sum()
            .unstack(fill_value=0.0)
        )

        ajustes = self._ajustes_por_periodo(empresa_id)

        serie = []

        for fila in self.periodos.sort_values("pericodi").to_dict(
            orient="records"
        ):
            pericodi = int(fila["pericodi"])

            if pericodi not in totales:
                continue

            procesos = (
                por_proceso.loc[pericodi].to_dict()
                if pericodi in por_proceso.index
                else {}
            )

            serie.append({
                "pericodi": pericodi,
                "perinombre": fila["perinombre"],
                "perianiomes": fila["perianiomes"],
                "origen": fila["origen"],
                "estado": fila["estado"],
                "liquidacion_total": float(totales[pericodi]),
                "efecto_neto_recalculos": ajustes["neto"].get(pericodi, 0.0),
                "revisiones": ajustes["revisiones"].get(pericodi, 0),
                "procesos": {
                    proceso: float(monto)
                    for proceso, monto in procesos.items()
                },
            })

        return serie

    def _ajustes_por_periodo(self, empresa_id: str) -> dict:
        """Efecto neto de los recalculos de cada mes, y cuantos hubo."""
        filas = self.totales[self.totales["emprcodi"] == empresa_id]

        if filas.empty:
            return {"neto": {}, "revisiones": {}}

        filas = filas.sort_values(["proceso", "pericodi", "revision"]).copy()

        # La revision anterior es la del mismo proceso y el mismo mes: la
        # cadena R0..R4 es propia de cada proceso (ver cascada).
        filas["monto_anterior"] = (
            filas.groupby(["proceso", "pericodi"])["monto_total"].shift()
        )
        filas["ajuste"] = filas["monto_total"] - filas["monto_anterior"]

        neto = filas.groupby("pericodi")["ajuste"].sum()

        # R0 no es un recalculo: es la publicacion original del mes.
        recalculos = (
            filas[filas["revision"] > 0]
            .groupby("pericodi")["revision"]
            .max()
        )

        return {
            "neto": {
                int(pericodi): float(valor)
                for pericodi, valor in neto.items()
            },
            "revisiones": {
                int(pericodi): int(valor)
                for pericodi, valor in recalculos.items()
            },
        }
