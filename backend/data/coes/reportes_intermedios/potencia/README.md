# Reportes Intermedios — Potencia

## Qué problema representa

La "potencia" (capacidad instalada disponible, no la energía consumida) también se liquida entre empresas del mercado — a través de 3 mecanismos distintos que conviven en el mismo mes. Este módulo te permite ver el detalle de cada mecanismo por separado, algo que ni siquiera Liquidaciones expone (ahí solo ves el total ya cruzado).

## Qué información está disponible

- El desglose completo por empresa/mecanismo/concepto, mes a mes.
- Los ajustes (saldos) de meses anteriores aplicados a cada empresa.

## Cómo se relacionan

`desglose_por_valorizacion.json` es autocontenido — no necesitas otro dataset para reconstruir el total de Potencia de una empresa, solo sumar sus filas de un mismo `pericodi`. `saldos.json` es un ajuste aparte que se suma/resta a ese total.

## Preguntas que podrían responderse

- ¿Qué proporción del monto total de Potencia corresponde a cada uno de los 3 mecanismos?
- ¿Qué líneas de transmisión (concepto) concentran más monto de Peaje por Conexión?
- ¿Las empresas que más "Ingreso Tarifario" reciben son las mismas que más "Peaje por Conexión" pagan?
- ¿Cómo varía el peso relativo de cada mecanismo mes a mes?

## Ideas de visualización

- Gráfico de barras apiladas: monto por empresa, coloreado por Valorización.
- Top-N líneas de transmisión (`concepto`) por monto total en el periodo.
- Treemap de participación de cada mecanismo en el total del mercado.

## Tipo de análisis posible

Descomposición de un total en sus componentes (esto es justo lo que hace el botón "Ver composición" de la app real, pero aquí tienes el detalle crudo para construir tu propia versión). Análisis de concentración (¿pocas líneas concentran la mayoría del Peaje?).
