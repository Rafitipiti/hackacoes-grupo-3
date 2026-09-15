# Contexto — Reportes Intermedios: Costos Marginales

## Descripción del proceso

El costo marginal es el precio de la energía en cada barra (subestación) del sistema eléctrico, calculado cada 15 minutos (96 intervalos por día). Es la referencia base de precios del mercado eléctrico peruano — no está directamente ligado a un proceso de liquidación específico, pero es insumo para entender el comportamiento de precios del sistema.

## Datasets

### `historico_diario.json`
- **Descripción**: costo marginal **promedio del día**, por barra, para las 828 barras activas del SEIN, los 8 meses del rango.
- **Fuente conceptual**: `TRN_COSTO_MARGINAL` (columna `COSMARPROMEDIODIA`), usando siempre la última versión de recálculo cerrada disponible por mes.
- **Por qué "promedio diario" y no el detalle de 96 intervalos**: con 828 barras activas, el detalle completo de 96 intervalos por día superaría fácilmente varios cientos de MB — el promedio diario es el dataset principal, manejable, y suficiente para la mayoría de análisis agregados. Para el detalle de 15 minutos, ver `curva_15min_muestra.json`.
- **Campos**: `barrcodi`, `dia`, `recacodi`, `recanombre`, `recaestado`, `valor`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

### `curva_15min_muestra.json`
- **Descripción**: el detalle completo de 96 intervalos de 15 minutos por día, pero limitado a una **muestra de barras** (una por cada nivel de tensión representativo: 500, 220, 138, 60, 22.9, 10 y 0.4 kV), los 8 meses.
- **Por qué una muestra y no las 828 barras**: a resolución de 15 minutos, el archivo completo sería del orden de millones de filas — la muestra te da la forma real de la curva horaria sin ese volumen.
- **Campos**: `barrcodi`, `intervalo` (identificador del intervalo de 15 min dentro del día — "24:00" es el último del día), `valor`, `dia`, `version`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `barrcodi` | Código de la barra | integer | `512` | Sí | Resuélvelo con `_catalogos_comunes/barras.json` para nombre/tensión |
| `dia` | Día del mes (1-31) | integer | `15` | Sí | |
| `valor` | Costo marginal (S/ por unidad de energía) | string (decimal) | `"0.4150018406"` | Sí | Promedio del día en `historico_diario.json`, valor del intervalo en `curva_15min_muestra.json` |
| `recacodi` / `version` | Versión de recálculo | integer | `2` | Sí | |
| `recanombre` | Etiqueta de la versión | string | `"Revisión 01"` | Sí | |
| `recaestado` | Estado de la versión | string | `"Cerrado"` | Sí | |

## Relaciones

```text
historico_diario.json.barrcodi / curva_15min_muestra.json.barrcodi
        ↓
_catalogos_comunes/barras.json.barrcodi  (nombre real, nivel de tensión)
```

## Códigos y parámetros

```text
Numeración de intervalos de 15 minutos (en curva_15min_muestra.json)

El intervalo se identifica por su hora de FIN, no de inicio:
  intervalo 1  = 00:00–00:15 → se etiqueta "00:15"
  intervalo 96 = 23:45–24:00 → se etiqueta "24:00" (no "00:00", para que el
                                 eje de tiempo no parezca "reiniciar" a medianoche)
```
