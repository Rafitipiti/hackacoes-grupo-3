# Contexto — Reportes Intermedios: LSCIO

## Descripción del proceso

LSCIO = Servicios Complementarios e Inflexibilidades Operativas. A diferencia de Energía Activa/Potencia (que vienen de los sistemas oficiales de COES en tiempo real), **esta información se carga manualmente cada mes** desde un archivo Excel — por eso, a diferencia de los demás módulos, **no todos los meses del rango tienen datos** (solo los meses que el equipo de COES efectivamente cargó).

Cubre 5 mecanismos de compensación: Reactiva, RSF, Inflexibilidad Operativa, Maniobras y Redistribución de Gas.

## Datasets

### `transferencias_por_empresa.json`
- **Descripción**: monto total mensual de LSCIO por empresa (ya combina los 5 mecanismos + ajustes de saldos).
- **Fuente conceptual**: tabla propia `lscio_transferencia_empresa` (PostgreSQL de COES, no Oracle).
- **Periodo con datos reales**: verificado que solo hay carga para **Abril–Julio 2026** dentro del rango 2026-01 a 2026-08 — el resto de meses aparece vacío en este dataset porque así está la base real, no por un error de generación.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `monto_total`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

### `desglose_por_mecanismo.json`
- **Descripción**: el mismo monto total, pero desglosado por mecanismo y concepto — incluye tanto el cálculo del mes corriente como los ajustes de saldos de meses anteriores (con concepto renombrado a `"Ajuste de saldo (...)"`).
- **Fuente conceptual**: `lscio_desglose_mensual` + `lscio_saldo_empresa` combinadas.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `mecanismo`, `concepto`, `monto`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

### `saldos.json`
- **Descripción**: ajustes de LSCIO aplicados a un mes destino desde meses de origen anteriores.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `saldo_total`, `cantidad_origenes`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `emprcodi` | Identificador anonimizado de empresa | string | `"EMPRESA_014"` | Sí | |
| `monto_total` | Monto final del mes (ya incluye ajustes) | string (decimal) | `"-32460.6752178425"` | Sí | En Soles (S/) |
| `mecanismo` | Categoría del cálculo | string | `"Inflexibilidad Operativa"` | Sí | Ver "Códigos y parámetros" |
| `concepto` | Detalle del cálculo dentro del mecanismo | string | `"Pago - CCBef + CMarr + Cccadic"` | No | Puede empezar con `"Ajuste de saldo (...)"` si viene de un mes anterior |

## Relaciones

```text
transferencias_por_empresa.json.monto_total (un mes, una empresa)
        =
SUM(desglose_por_mecanismo.json.monto) WHERE mismo emprcodi Y mismo pericodi
```

## Códigos y parámetros

```text
mecanismo

"Reactiva"                    → compensación por energía reactiva
"RSF"                         → Reserva de Seguridad de Frecuencia
"Inflexibilidad Operativa"    → compensación por restricciones técnicas de operación
"Maniobras"                   → compensación por maniobras de conexión/desconexión
"Redistribución de Gas"       → mecanismo específico de gas natural
```
