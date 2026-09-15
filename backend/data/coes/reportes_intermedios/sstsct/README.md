# Reportes Intermedios — SST-SCT

## Qué problema representa

Las líneas de transmisión "secundarias" (más pequeñas que las troncales) las paga el conjunto de generadores que las usa, no una sola empresa — y hay dos maneras distintas de calcular cuánto le toca pagar a cada uno. Este módulo expone ambos mecanismos por separado.

## Qué información está disponible

Un único dataset con el detalle por empresa, mecanismo (Valorización) y sistema/titular (Concepto), para los 8 meses.

## Cómo se relacionan

No hay múltiples datasets que unir aquí — `desglose_por_valorizacion.json` ya trae todo lo necesario. La relación interesante está DENTRO del dataset: agrupa por `valorizacion` para separar "Criterio de Uso" de "Ingreso Tarifario", y por `concepto` para ver qué sistema/titular concentra más monto.

## Preguntas que podrían responderse

- ¿Qué mecanismo pesa más en el total de SST-SCT, Criterio de Uso o Ingreso Tarifario?
- ¿Qué sistemas de transmisión (concepto, en Criterio de Uso) concentran más monto pagado?
- ¿Hay empresas cuyo monto neto en SST-SCT es consistentemente cercano a cero (indicio de que son generadoras Y titulares a la vez)?
- ¿Cómo varía el mecanismo "Ingreso Tarifario" mes a mes, dado que depende de la participación en el mercado de Potencia?

## Ideas de visualización

- Comparación de barras: Criterio de Uso vs. Ingreso Tarifario, por mes.
- Red/grafo de flujos: qué empresas (deudoras) pagan a qué sistemas/titulares (acreedores), con el grosor de la conexión proporcional al monto.

## Tipo de análisis posible

Análisis de redes (grafo bipartito generador↔sistema de transmisión), detección de pares con monto neto ≈ 0 (el caso "empresa que se paga a sí misma" descrito en `contexto.md`).
