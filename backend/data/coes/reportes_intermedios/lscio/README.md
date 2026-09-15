# Reportes Intermedios — LSCIO

## Qué problema representa

Hay costos operativos del sistema eléctrico que no se calculan automáticamente en los sistemas oficiales de COES — se cargan manualmente cada mes desde un Excel. Este módulo es tu ventana a esa información: 5 mecanismos de compensación distintos (Reactiva, RSF, Inflexibilidad Operativa, Maniobras, Redistribución de Gas) que se combinan en un monto final por empresa.

## Qué información está disponible

- El monto final mensual por empresa (`transferencias_por_empresa.json`).
- El desglose línea por línea de qué compone ese monto (`desglose_por_mecanismo.json`) — incluyendo ajustes retroactivos de meses anteriores.
- Los saldos aplicados (`saldos.json`).

⚠️ Recuerda: solo hay datos reales para Abril–Julio 2026 dentro del rango — es información real de carga manual, no un error.

## Cómo se relacionan

`desglose_por_mecanismo.json` es el detalle que explica `transferencias_por_empresa.json` — sumando todas las filas de una empresa en un mes, obtienes exactamente el `monto_total` de esa empresa ese mes.

## Preguntas que podrían responderse

- ¿Qué mecanismo (Reactiva, RSF, etc.) tiene mayor peso en el total de LSCIO?
- ¿Los ajustes de saldo ("Ajuste de saldo...") son grandes en proporción al cálculo del mes corriente, o marginales?
- ¿Qué empresas concentran la mayor parte del monto de LSCIO?
- Con solo 4 meses de datos reales, ¿hay una tendencia visible mes a mes?

## Ideas de visualización

- Barras apiladas por mecanismo, un mes a la vez.
- Comparación "cálculo del mes" vs. "ajustes de saldo" como dos series separadas.
- Ranking de empresas por monto absoluto de LSCIO.

## Tipo de análisis posible

Análisis de composición (qué mecanismo pesa más), y — dado que es carga manual — una oportunidad interesante para detectar inconsistencias o patrones de carga (¿siempre se sube el mismo día del mes? ¿hay mecanismos que faltan en algún mes?).
