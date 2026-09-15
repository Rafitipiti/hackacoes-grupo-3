# Contexto — Reportes Intermedios: Energía Activa

## Descripción del proceso

Monitoreo mensual de las transferencias de energía activa entre agentes del SEIN (Sistema Eléctrico Interconectado Nacional) — el "cuadro fuente" que alimenta después el proceso de liquidación LVTA (Liquidación de Valorización de Transferencias de Energía Activa) en el módulo Liquidaciones. Cada empresa tiene, por mes, un monto total de transferencia (puede ser positivo o negativo según si predomina su rol de comprador o vendedor de energía en el periodo), más los ajustes ("saldos") que se le aplican por recálculos de periodos anteriores.

## Datasets

### `transferencias_por_empresa.json`
- **Descripción**: monto total de transferencia de energía activa por empresa y mes.
- **Qué representa**: la última versión de recálculo cerrada disponible de cada mes (ej. si un mes tiene versión "Mensual" y luego "Revisión 01", se usa "Revisión 01").
- **Fuente conceptual**: `TRN_VALOR_TOTAL_EMPRESA` (Oracle), cruzado con el catálogo de empresas.
- **Periodo**: 2026-01-01 a 2026-08-31.
- **Campos disponibles**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `vtotemcodi`, `pericodi`, `vtotemversion`, `vtotemtotal`, `perinombre`, `perianio`, `perimes`, `recanombre`, `version`, `perianiomes`, `periodo_preliminar`.

### `saldos.json`
- **Descripción**: ajuste (saldo) total aplicado a cada empresa en un mes destino, sumando todos los recálculos de meses anteriores que lo generaron.
- **Fuente conceptual**: `TRN_SALDO_RECALCULO` (Oracle).
- **Campos disponibles**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `saldo_total`, `cantidad_origenes` (de cuántos recálculos distintos proviene ese saldo), `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `emprcodi` | Identificador anonimizado de empresa | string | `"EMPRESA_014"` | Sí | Ya no es el código numérico real de COES |
| `emprruc` | RUC anonimizado | string | `"RUC_EMPRESA_014"` | No | Puede ser `null` si la empresa no tiene RUC asociado (caso "SINAC/no definido") |
| `vtotemcodi` | Identificador interno del registro | integer | `184380` | Sí | Sin significado analítico, solo trazabilidad |
| `vtotemtotal` | Monto total de la transferencia | string (decimal) | `"1663823.7544465215"` | Sí | En Soles (S/); positivo o negativo según el balance neto de la empresa ese mes |
| `vtotemversion` / `version` | Número de versión de recálculo usada | integer | `2` | Sí | 1 = "Mensual" (primera), 2+ = revisiones |
| `saldo_total` | Ajuste aplicado en el mes destino | string (decimal) | `"-464.9658741296"` | Sí | Suma de todos los orígenes |
| `cantidad_origenes` | Cantidad de recálculos de origen que aportaron al saldo | integer | `2` | Sí | |
| `pericodi` | Código de periodo | integer | `137` | Sí | Resuélvelo con `_catalogos_comunes/periodos.json` |
| `periodo_preliminar` | Si el mes seguía "Abierto" al generar el dataset | boolean | `false` | Sí | `true` = tratar la cifra con cautela |

## Relaciones

```text
transferencias_por_empresa.json.emprcodi
        ↓
_catalogos_comunes/empresas.json.empresa_id

saldos.json.emprcodi  →  misma empresa, mismo periodo (pericodi) que en transferencias_por_empresa.json
```

## Códigos y parámetros

```text
recanombre / version

"Mensual" (version=1)   → primer cálculo del mes, recién cerrado el periodo
"Revisión 01" (version=2), "Revisión 02" (version=3), ...
                          → recálculos posteriores del mismo mes (pueden ocurrir
                            meses después, cuando se corrige información)
```
