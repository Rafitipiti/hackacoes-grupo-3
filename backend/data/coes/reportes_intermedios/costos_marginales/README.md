# Reportes Intermedios — Costos Marginales

## Qué problema representa

El costo marginal es el precio "de referencia" de la energía en cada punto del sistema eléctrico, cada 15 minutos. Es información de mercado clave — cualquier análisis de eficiencia, congestión o comportamiento de precios del sistema eléctrico peruano parte de aquí.

## Qué información está disponible

- El promedio diario de las 828 barras activas, los 8 meses (`historico_diario.json`) — el dataset principal.
- El detalle completo de 96 intervalos de 15 minutos, para una muestra de barras representativas de distintos niveles de tensión (`curva_15min_muestra.json`).

## Cómo se relacionan

Ambos comparten `barrcodi` (join con `_catalogos_comunes/barras.json` para nombre/tensión) y `pericodi`/`dia`. `curva_15min_muestra.json` es un "zoom" de mayor resolución sobre un subconjunto de lo que `historico_diario.json` cubre para todas las barras.

## Preguntas que podrían responderse

- ¿Cómo varía el costo marginal promedio entre niveles de tensión (barras de 500 kV vs. 0.4 kV)?
- ¿Hay patrones horarios recurrentes dentro del día (horas punta vs. valle) usando la muestra de 15 minutos?
- ¿Qué tan volátil es el costo marginal día a día dentro de un mismo mes?
- ¿Existen barras con comportamiento atípico frente al promedio del sistema?

## Ideas de visualización

- Serie de tiempo del promedio diario, una línea por barra o por nivel de tensión.
- Curva horaria típica (perfil de 96 intervalos) promediada por mes, usando la muestra de 15 minutos.
- Mapa de calor Barra × Día.

## Tipo de análisis posible

Análisis de series de tiempo de alta frecuencia, comparación entre niveles de tensión, detección de patrones horarios (perfil de carga del sistema).
