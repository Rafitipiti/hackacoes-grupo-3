"""Pagos y cobros por proceso (spec portal-analitico, 9.1).

`fact_bilateral` es la unica tabla con las dos puntas de cada
transferencia: empresa deudora, empresa acreedora, proceso y monto. Un
monto de la deudora a la acreedora es un PAGO de la primera y un COBRO
de la segunda; el neto de una empresa en un proceso es cobros menos
pagos.
"""

import pandas as pd

PROCESOS = ["LVTA", "LVTP", "LSCIO", "SST-SCT"]


class PagosService:

    def __init__(self, datos):
        self.bilateral = datos["cruce_bilateral"]
        self.empresas = datos["empresas"]

    def _identidad(self) -> dict[str, dict]:
        tabla = self.empresas.astype(object).where(pd.notna(self.empresas), None)

        return {
            f["empresa_id"]: {
                "alias": f["alias"],
                "ruc": f["ruc"],
                "razon_social": f["razon_social"],
            }
            for f in tabla.to_dict(orient="records")
        }

    def periodos_con_dato(self, empresa_id: str) -> list[int]:
        """En que periodos la empresa aparece en alguna transferencia.

        La fuente trae detalle para 13 de los 20 meses; los otros siete se
        proyectan con scripts/proyectar_bilateral.py. Si algun mes quedara
        sin detalle, la pantalla ofrece los que si lo tienen en vez de
        quedarse en un mensaje de error.
        """
        propias = self.bilateral[
            (self.bilateral["empresa_deudora"] == empresa_id)
            | (self.bilateral["empresa_acreedora"] == empresa_id)
        ]

        return sorted(int(p) for p in propias["pericodi"].unique())

    def pagos_cobros(self, empresa_id: str, pericodi: int) -> dict | None:
        disponibles = self.periodos_con_dato(empresa_id)

        if not disponibles:
            return None

        del_mes = self.bilateral[self.bilateral["pericodi"] == pericodi]

        pagos = del_mes[del_mes["empresa_deudora"] == empresa_id]
        cobros = del_mes[del_mes["empresa_acreedora"] == empresa_id]

        identidad = self._identidad()

        if pagos.empty and cobros.empty:
            # La empresa existe en el cruce, pero no este mes: se devuelve
            # la ficha vacia con los meses que si tienen detalle.
            return {
                "empresa_id": empresa_id,
                **identidad.get(
                    empresa_id, {"alias": None, "ruc": None, "razon_social": None}
                ),
                "pericodi": pericodi,
                "periodos_disponibles": disponibles,
                "total_pagos": 0.0,
                "total_cobros": 0.0,
                "neto": 0.0,
                "origen": None,
                "procesos": [],
            }

        def contrapartes(filas: pd.DataFrame, columna: str) -> list[dict]:
            agrupado = (
                filas.groupby([columna, "valorizacion"])["monto"]
                .sum()
                .reset_index()
                .sort_values("monto", ascending=False)
            )

            return [
                {
                    "empresa_id": f[columna],
                    **identidad.get(
                        f[columna],
                        {"alias": None, "ruc": None, "razon_social": None},
                    ),
                    "valorizacion": f["valorizacion"],
                    "monto": float(f["monto"]),
                }
                for f in agrupado.to_dict(orient="records")
            ]

        procesos = []

        for proceso in PROCESOS:
            p = pagos[pagos["proceso"] == proceso]
            c = cobros[cobros["proceso"] == proceso]

            if p.empty and c.empty:
                continue

            total_pagos = float(p["monto"].sum())
            total_cobros = float(c["monto"].sum())

            procesos.append({
                "proceso": proceso,
                "pagos": total_pagos,
                "cobros": total_cobros,
                "neto": total_cobros - total_pagos,
                "contrapartes_pago": contrapartes(p, "empresa_acreedora"),
                "contrapartes_cobro": contrapartes(c, "empresa_deudora"),
            })

        return {
            "empresa_id": empresa_id,
            **identidad.get(
                empresa_id, {"alias": None, "ruc": None, "razon_social": None}
            ),
            "pericodi": pericodi,
            "periodos_disponibles": disponibles,
            "total_pagos": float(pagos["monto"].sum()),
            "total_cobros": float(cobros["monto"].sum()),
            "neto": float(cobros["monto"].sum() - pagos["monto"].sum()),
            "origen": str(pd.concat([pagos, cobros])["origen"].iloc[0]),
            "procesos": procesos,
        }
