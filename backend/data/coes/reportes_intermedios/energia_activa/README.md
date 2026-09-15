# Reportes Intermedios — Energía Activa

## Qué problema representa

Cada mes, las empresas del mercado eléctrico peruano intercambian energía activa entre sí (generan, transportan, distribuyen, consumen). Este módulo muestra, para cada empresa, cuál fue su balance económico neto de esas transferencias — la base con la que después el módulo Liquidaciones calcula específicamente quién le debe a quién (proceso LVTA).

## Qué información está disponible

- El monto total mensual de cada empresa (`transferencias_por_empresa.json`), para los 8 meses del rango.
- Los ajustes que se le aplicaron a cada empresa por recálculos de meses pasados (`saldos.json`).

## Cómo se relacionan

Un mismo `emprcodi` puede aparecer en ambos archivos, en el mismo `pericodi` — el monto final "real" que la empresa reconoce ese mes sería, conceptualmente, `vtotemtotal` ya incluyendo lo que corresponda de `saldo_total` (el sistema ya los combina así en otros módulos, ej. LSCIO, donde el monto mostrado ya es el total final).

## Preguntas que podrían responderse

- ¿Qué empresas tienen el balance más volátil mes a mes?
- ¿Existe estacionalidad en el monto total transferido (ej. meses de verano/invierno)?
- ¿Qué proporción del monto total de cada empresa termina siendo corregida por saldos posteriores?
- ¿Cuántas empresas tienen saldo cero o positivo consistentemente vs. negativo?

## Ideas de visualización

- Serie de tiempo del monto total agregado (todas las empresas) por mes.
- Ranking Top-10 empresas por magnitud de transferencia, por mes.
- Distribución (histograma) de `vtotemtotal` — ¿es simétrica alrededor de cero, o hay más deudoras que acreedoras?
- Comparación lado a lado: monto original vs. saldo aplicado, por empresa.

## Tipo de análisis posible

Análisis de series de tiempo, detección de outliers/anomalías mes a mes, segmentación de empresas por patrón de comportamiento (siempre positivas, siempre negativas, mixtas).
