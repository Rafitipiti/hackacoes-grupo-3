# Contexto — Reportes Intermedios: Potencia

## Descripción del proceso

Cuadro fuente del proceso de liquidación LVTP (Liquidación de Valorización de Transferencias de Potencia). A diferencia de Energía Activa, Potencia se compone de **3 mecanismos de cálculo distintos (Valorizaciones)** que se suman para dar el monto final de cada empresa:

1. **Transferencia de Potencia** — el pago/cobro directo por potencia entre empresas.
2. **Peaje por Conexión** — compensación a las transmisoras por el uso de sus líneas.
3. **Ingreso Tarifario** — un mecanismo regulatorio adicional ligado a las mismas líneas de transmisión.

## Datasets

### `desglose_por_valorizacion.json`
- **Descripción**: monto por empresa, Valorización y Concepto, para cada mes.
- **Qué representa**: la suma de los 3 mecanismos anteriores, cada fila es una combinación (empresa, valorización, concepto) — sumando todas las filas de una misma empresa en un mes se obtiene su monto total de Potencia ese mes.
- **Fuente conceptual**: `VTP_EMPRESA_PAGO` (Transferencia de Potencia), `VTP_PEAJE_EMPRESA_PAGO`+`VTP_PEAJE_INGRESO` (Peaje por Conexión), `VTP_INGRESO_TARIFARIO` (Ingreso Tarifario) — todas en Oracle. Siempre la última versión de recálculo disponible por mes.
- **Periodo**: 2026-01-01 a 2026-08-31.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `valorizacion`, `concepto`, `monto`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

### `saldos.json`
- **Descripción**: igual concepto que en Energía Activa, pero para Potencia.
- **Fuente conceptual**: `VTP_SALDO_EMPRESA`.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `saldo_total`, `cantidad_origenes`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `emprcodi` | Identificador anonimizado de empresa | string | `"EMPRESA_014"`, o `"NO_DEFINIDO"` | Sí | `"NO_DEFINIDO"` = un caso especial del sistema COES/SINAC, no es una empresa real |
| `valorizacion` | Mecanismo de cálculo | string | `"LIQUIDACIÓN DEL PEAJE POR CONEXIÓN"` | Sí | Ver "Códigos y parámetros" abajo |
| `concepto` | Detalle dentro de la Valorización | string | `"LT 220 kV Carhuamayo-Paragsha y subestaciones asociadas"` | Sí | Para Peaje/Ingreso Tarifario es el **nombre real y público** de la línea/sistema de transmisión — no se anonimiza (es infraestructura pública) |
| `monto` | Monto de esa fila (empresa+valorización+concepto) | string (decimal) | `"-258.1944831035"` | Sí | En Soles (S/) |

## Relaciones

```text
desglose_por_valorizacion.json.emprcodi
        ↓
_catalogos_comunes/empresas.json.empresa_id

Para el monto TOTAL de una empresa en un mes:
  SUM(monto) WHERE emprcodi=X AND pericodi=Y  (sumando las 3 Valorizaciones)
```

## Códigos y parámetros

```text
valorizacion

"COMPENSACIÓN A TRANSMISORAS POR INGRESO TARIFARIO" → mecanismo 3 (Ingreso Tarifario)
"LIQUIDACIÓN DEL PEAJE POR CONEXIÓN"                → mecanismo 2 (Peaje por Conexión)
(el mecanismo 1, "Transferencia de Potencia", usa su propio texto de valorización)
```
